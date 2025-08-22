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

  const startCamera = useCallback(async () => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.srcObject = stream;
        await new Promise(resolve => videoElement.onloadedmetadata = resolve);
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if ('zoom' in capabilities && capabilities.zoom) {
          setZoomCapabilities({ min: capabilities.zoom.min, max: capabilities.zoom.max, step: capabilities.zoom.step });
          setZoom(capabilities.zoom.min);
        } else {
          setZoomCapabilities(null);
        }
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error("Camera Permission Needed", { description: "Please grant camera permissions to continue." });
      onClose();
    }
  }, [facingMode, onClose]);

  useEffect(() => {
    if (isOpen) {
        startCamera();
    }
  }, [isOpen, facingMode, startCamera]);
  
  const handleAnalysis = useCallback(async (scanType: ScanMode, data: string | string[]) => {
    setIsProcessing(true);
    setIsAnalyzing(true);
    toast.info(`Analyzing ${scanType}...`);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Authentication Error");
      setIsProcessing(false);
      setIsAnalyzing(false);
      return;
    }

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          category_id: selectedCategory?.split('-')[0] || 'general',
          subcategory_id: selectedCategory?.split('-')[1] || undefined,
          scanType,
          data: Array.isArray(data) ? data[0] : data,
        }),
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Analysis failed.');
      }
      const result = await response.json();
      setLastAnalysisResult({ ...result, id: uuidv4(), code: Array.isArray(data) ? "Image" : data, imageUrls: Array.isArray(data) ? data : undefined });
      toast.success('Analysis Complete');
      onClose();
    } catch (error) {
      toast.error('Analysis Error', { description: (error as Error).message });
      setLastAnalysisResult(null);
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
    }
  }, [selectedCategory, setIsAnalyzing, setLastAnalysisResult, onClose]);

  const { ref: barcodeRef } = useZxing({ onDecodeResult: (result) => handleAnalysis('barcode', result.getText()) });

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    const preset = RESOLUTION_PRESETS[captureResolution];
    canvas.width = preset.width;
    canvas.height = preset.height;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImages(prev => [imageData, ...prev].slice(0, 5));
    toast.success(`Photo captured at ${captureResolution} resolution!`);
  }, [captureResolution]);

  const getPinchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) initialPinchDistance.current = getPinchDistance(e.touches);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && initialPinchDistance.current && zoomCapabilities && videoRef.current?.srcObject) {
      const newDistance = getPinchDistance(e.touches);
      const scale = newDistance / initialPinchDistance.current;
      const newZoom = zoom * scale;
      const track = (videoRef.current.srcObject as MediaStream).getVideoTracks()[0];
      applyZoom(track, newZoom);
    }
  };

  const handleTouchEnd = () => { initialPinchDistance.current = null; };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => setCapturedImages(prev => [event.target?.result as string, ...prev].slice(0, 5));
      reader.readAsDataURL(file);
    });
    toast.success(`${imageFiles.length} image(s) added.`);
  };

  const handleFlipCamera = () => {
    setFacingMode(p => p === 'user' ? 'environment' : 'user');
  };

  if (!isOpen) return null;

  return (
    <div className="scanner-container" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <header className="scanner-header">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full bg-black/30 backdrop-blur-sm"><SettingsIcon /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-4">
              <h4 className="font-medium leading-none">Smart Glasses</h4>
              <Button className="w-full" onClick={() => toast.info('Pairing mode initiated...')}>
                <Zap className="mr-2 h-4 w-4" /> Connect Glasses
              </Button>
              <Separator />
              <h4 className="font-medium leading-none">Camera Settings</h4>
              <div className="flex items-center justify-between"><Label htmlFor="grid-switch">Grid Overlay</Label><Switch id="grid-switch" checked={showGrid} onCheckedChange={setShowGrid} /></div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="resolution">Capture Resolution</Label>
                <Select value={captureResolution} onValueChange={(value) => setCaptureResolution(value as CaptureResolution)}>
                  <SelectTrigger id="resolution"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High (1080p)</SelectItem>
                    <SelectItem value="Medium">Medium (720p)</SelectItem>
                    <SelectItem value="Low">Low (480p)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Lower resolution is faster on cellular.</p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex gap-2">
          <Button variant={scanMode === 'image' ? 'secondary' : 'ghost'} size="sm" onClick={() => setScanMode('image')} className="backdrop-blur-sm"><Camera className="w-4 h-4 mr-2" />Photo</Button>
          <Button variant={scanMode === 'barcode' ? 'secondary' : 'ghost'} size="sm" onClick={() => setScanMode('barcode')} className="backdrop-blur-sm"><Scan className="w-4 h-4 mr-2" />Barcode</Button>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-black/30 backdrop-blur-sm"><X /></Button>
      </header>
      
      <main className="scanner-main">
        <video ref={scanMode === 'image' ? videoRef : barcodeRef} autoPlay playsInline muted className="scanner-video" />
        {showGrid && scanMode === 'image' && <div className="grid-overlay" />}
        {scanMode === 'barcode' && (
          <div className="barcode-scanner-overlay">
            <div className="barcode-scanner-aiming-box" />
            <div className="barcode-scanner-laser" />
          </div>
        )}
      </main>

      <footer className="scanner-footer">
        {scanMode === 'image' && (
          <>
            {zoomCapabilities && (
              <div className="flex items-center gap-2 px-4 bg-black/30 backdrop-blur-sm p-2 rounded-full">
                <ZoomOut className="w-5 h-5" />
                <Slider value={[zoom]} onValueChange={handleZoomChange} min={zoomCapabilities.min} max={zoomCapabilities.max} step={zoomCapabilities.step} />
                <ZoomIn className="w-5 h-5" />
              </div>
            )}
            <div className="scanner-controls">
              <Button variant="ghost" size="icon" className="w-16 h-16 rounded-full bg-black/30 backdrop-blur-sm" onClick={() => fileInputRef.current?.click()}>
                  {capturedImages.length > 0 && <div className="absolute -top-1 -right-1 text-xs bg-primary rounded-full h-5 w-5 flex items-center justify-center">{capturedImages.length}</div>}
                  <Upload />
              </Button>
              <button onClick={captureImage} className="shutter-button"><div className="shutter-button-inner" /></button>
              <Button variant="ghost" size="icon" className="w-16 h-16 rounded-full bg-black/30 backdrop-blur-sm" onClick={handleFlipCamera}><FlipHorizontal /></Button>
            </div>
            {capturedImages.length > 0 && (
                <Button onClick={() => handleAnalysis('image', capturedImages)} disabled={isProcessing} size="lg" className="w-full">
                    {isProcessing ? <Loader2 className="animate-spin" /> : <><Check className="mr-2" /> Analyze ({capturedImages.length})</>}
                </Button>
            )}
          </>
        )}
      </footer>
      <canvas ref={canvasRef} className="hidden" />
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
    </div>
  );
};

export default DualScanner;