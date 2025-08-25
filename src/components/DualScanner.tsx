// FILE: src/components/DualScanner.tsx

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import { Camera, Scan, X, Check, FlipHorizontal, Upload, ZoomIn, ZoomOut, Circle, Settings as SettingsIcon, Zap, Loader2, Grid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import './DualScanner.css';


type ScanMode = 'image' | 'barcode';
type CaptureResolution = 'Low' | 'Medium' | 'High';

const RESOLUTION_PRESETS = {
  Low: { width: 640, height: 480 },
  Medium: { width: 1280, height: 720 },
  High: { width: 1920, height: 1080 },
};

interface DualScannerProps {
  isOpen: boolean;
  onClose: () => void;
}


const DualScanner: React.FC<DualScannerProps> = ({ isOpen, onClose }) => {
  const { setLastAnalysisResult, setIsAnalyzing, selectedCategory } = useAppContext();
  const { session } = useAuth();
  
  const [scanMode, setScanMode] = useState<ScanMode>('image');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [showGrid, setShowGrid] = useState(false);
  const [captureResolution, setCaptureResolution] = useState<CaptureResolution>('High');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialPinchDistance = useRef<number | null>(null);

  const [zoom, setZoom] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number; max: number; step: number } | null>(null);

  const applyZoom = useCallback((track: MediaStreamVideoTrack, value: number) => {
    if (zoomCapabilities) {
      const newZoom = Math.max(zoomCapabilities.min, Math.min(zoomCapabilities.max, value));
      track.applyConstraints({ advanced: [{ zoom: newZoom }] }).catch(e => console.error("Zoom failed", e));
      setZoom(newZoom);
    }
  }, [zoomCapabilities]);

  const handleZoomChange = (value: number[]) => {
    if (videoRef.current?.srcObject) {
      const track = (videoRef.current.srcObject as MediaStream).getVideoTracks()[0];
      applyZoom(track, value[0]);
    }
  };

  const startCamera = useCallback(async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const { width, height } = RESOLUTION_PRESETS[captureResolution];
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode,
            width: { ideal: width },
            height: { ideal: height },
            zoom: true 
          }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if (capabilities.zoom) {
          setZoomCapabilities({
            min: capabilities.zoom.min,
            max: capabilities.zoom.max,
            step: capabilities.zoom.step
          });
          setZoom(track.getSettings().zoom || 1);
        } else {
          setZoomCapabilities(null);
        }

      } catch (err) {
        console.error("Error accessing camera:", err);
        toast.error("Camera access denied.", {
          description: "Please enable camera permissions in your browser settings to use this feature.",
        });
      }
    }
  }, [facingMode, captureResolution]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  const { ref: zxingRef } = useZxing({
    onResult(result) {
      if (scanMode === 'barcode') {
        toast.success(`Barcode detected: ${result.getText()}`);
        setLastAnalysisResult({ barcode: result.getText(), category: selectedCategory });
        setIsAnalyzing(true);
        onClose();
      }
    },
    paused: scanMode !== 'barcode' || !isOpen,
  });

  useEffect(() => {
    if (videoRef.current) {
        zxingRef(videoRef.current);
    }
  }, [zxingRef, isOpen, scanMode]);

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImages(prev => [...prev, dataUrl]);
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setCapturedImages(prev => [...prev, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const processImages = async () => {
    if (capturedImages.length === 0 || !session) return;
    setIsProcessing(true);
    toast.info("Uploading images and starting analysis...");

    try {
      // 1. Convert Data URLs to Blobs and get upload URLs
      const fileMetas = capturedImages.map((_, index) => ({
        name: `${session.user.id}/${uuidv4()}-${index}.jpg`,
        type: 'image/jpeg'
      }));

      const { data: presignedUrlsData, error: presignedUrlError } = await supabase.functions.invoke('request-upload', {
        body: { files: fileMetas }
      });
      if (presignedUrlError) throw presignedUrlError;
      
      // 2. Upload files to presigned URLs
      await Promise.all(capturedImages.map(async (dataUrl, index) => {
        const { uploadUrl } = presignedUrlsData[index];
        const blob = await (await fetch(dataUrl)).blob();
        const { error: uploadError } = await supabase.storage.from('scans').uploadToSignedUrl(uploadUrl, blob);
        if (uploadError) throw new Error(`Upload failed for image ${index + 1}: ${uploadError.message}`);
      }));

      const uploadedImageUrls = fileMetas.map(meta => meta.name);

      // 3. Trigger analysis
      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke('analyze', {
        body: { images: uploadedImageUrls, category: selectedCategory },
      });
      if (analysisError) throw analysisError;

      setLastAnalysisResult(analysisResult);
      setIsAnalyzing(true);
      toast.success("Analysis complete!");
      onClose();

    } catch (error) {
      console.error("Processing error:", error);
      toast.error("Image processing failed.", {
        description: (error as Error).message
      });
    } finally {
      setIsProcessing(false);
      setCapturedImages([]);
    }
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };
  
  const handleTouchMove = (e: React.TouchEvent<HTMLVideoElement>) => {
    if (e.touches.length === 2 && videoRef.current?.srcObject) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(Math.pow(touch2.pageX - touch1.pageX, 2) + Math.pow(touch2.pageY - touch1.pageY, 2));

      if (initialPinchDistance.current === null) {
        initialPinchDistance.current = distance;
      }
      
      const track = (videoRef.current.srcObject as MediaStream).getVideoTracks()[0];
      const scale = distance / initialPinchDistance.current;
      const newZoom = Math.max(zoomCapabilities?.min || 1, Math.min(zoomCapabilities?.max || 10, zoom * scale));
      
      applyZoom(track, newZoom);
    }
  };
  
  const handleTouchEnd = () => {
    initialPinchDistance.current = null;
  };
  
  if (!isOpen) return null;

  return (
    <div className="dual-scanner-overlay" onClick={onClose}>
      <div className="dual-scanner-content" onClick={e => e.stopPropagation()}>
        <header className="dual-scanner-header">
          <h2 className="text-lg font-semibold">{scanMode === 'image' ? 'Image Analysis' : 'Barcode Scanner'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X /></Button>
        </header>

        <main className="dual-scanner-main">
          <div className="relative w-full h-full bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
            {showGrid && <div className="grid-overlay" />}
            <div className="absolute top-2 left-2 flex flex-col gap-2">
              <Button size="icon" variant="secondary" onClick={toggleFacingMode}><FlipHorizontal /></Button>
              <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
              <Button size="icon" variant="secondary" onClick={() => fileInputRef.current?.click()}><Upload /></Button>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="secondary" className="absolute top-2 right-2"><SettingsIcon /></Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4 space-y-4">
                <div className="space-y-2">
                    <Label>Scan Mode</Label>
                    <div className="flex gap-2">
                        <Button onClick={() => setScanMode('image')} variant={scanMode === 'image' ? 'default' : 'outline'} className="flex-1">Image</Button>
                        <Button onClick={() => setScanMode('barcode')} variant={scanMode === 'barcode' ? 'default' : 'outline'} className="flex-1">Barcode</Button>
                    </div>
                </div>
                <Separator />
                <div className="space-y-2">
                    <Label>Camera Resolution</Label>
                    <Select value={captureResolution} onValueChange={(val) => setCaptureResolution(val as CaptureResolution)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Low">Low (640x480)</SelectItem>
                            <SelectItem value="Medium">Medium (1280x720)</SelectItem>
                            <SelectItem value="High">High (1920x1080)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                    <Label htmlFor="grid-switch">Show Grid</Label>
                    <Switch id="grid-switch" checked={showGrid} onCheckedChange={setShowGrid} />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </main>
        
        <footer className="dual-scanner-footer">
          {scanMode === 'image' ? (
            <>
              <div className="captured-previews">
                {capturedImages.map((src, index) => (
                  <img key={index} src={src} alt={`capture ${index}`} className="preview-thumb" />
                ))}
              </div>
              {capturedImages.length > 0 && 
                <Button onClick={processImages} disabled={isProcessing} className="glow-on-hover">
                  {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</> : <><Zap className="mr-2 h-4 w-4" /> Analyze</>}
                </Button>
              }
              <Button onClick={captureImage} className="capture-button" size="icon" disabled={isProcessing}><Circle className="w-16 h-16" /></Button>
            </>
          ) : (
             <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                <Scan className="mr-2 h-4 w-4" /> Point camera at a barcode
             </div>
          )}
        </footer>
        <div className="absolute bottom-24 w-full flex justify-center p-4 pointer-events-none">
            {zoomCapabilities && (
              <div className="flex items-center gap-2 px-4 bg-black/30 backdrop-blur-sm p-2 rounded-full pointer-events-auto">
                <ZoomOut className="w-5 h-5" />
                <Slider value={[zoom]} onValueChange={handleZoomChange} min={zoomCapabilities.min} max={zoomCapabilities.max} step={zoomCapabilities.step} className="w-32" />
                <ZoomIn className="w-5 h-5" />
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default DualScanner;