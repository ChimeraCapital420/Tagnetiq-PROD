import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import { Camera, Scan, X, Check, FlipHorizontal, Upload, Video, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Card, CardContent } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type ScanMode = 'barcode' | 'image';

interface DualScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DualScanner: React.FC<DualScannerProps> = ({ isOpen, onClose }) => {
  const [scanMode, setScanMode] = useState<ScanMode>('image');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const { setLastAnalysisResult, setIsAnalyzing, selectedCategory } = useAppContext();

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    setCapturedImages([]);
    setIsRecording(false);
    onClose();
  }, [onClose, stopCamera]);

  // --- NEW: Unified Analysis Handler ---
  const handleAnalysis = useCallback(async (scanType: ScanMode, data: string) => {
    if (!user) {
      toast.error("Authentication Error", { description: "You must be logged in to perform an analysis." });
      return;
    }
    if (!selectedCategory) {
      toast.error("Category Not Selected", { description: "Please select an analysis category from the dashboard." });
      return;
    }
    
    setIsProcessing(true);
    setIsAnalyzing(true);
    toast.info(`Analyzing ${scanType}...`);

    const [category_id, subcategory_id] = selectedCategory.split('-');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id,
          subcategory_id,
          scanType,
          data,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed. The AI engine returned an error.');
      }

      const result = await response.json();
      setLastAnalysisResult({ ...result, id: uuidv4(), code: data.substring(0, 20) });
      toast.success('Analysis Complete');
    } catch (error) {
      console.error(error);
      toast.error('Analysis Error', { description: (error as Error).message });
      setLastAnalysisResult(null);
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
      handleClose();
    }
  }, [user, selectedCategory, setLastAnalysisResult, setIsAnalyzing, handleClose]);


  const handleBarcodeScan = (barcode: string) => {
    handleAnalysis('barcode', barcode);
  };

  const { ref: barcodeRef } = useZxing({
    onDecodeResult(result) {
      handleBarcodeScan(result.getText());
    },
  });

  // --- Other functions (startCamera, captureImage, etc.) remain unchanged ---

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error("Camera Permission Needed", { description: "Please grant camera permissions to continue." });
      handleClose();
    }
  }, [facingMode, handleClose, stopCamera]);

  useEffect(() => {
    if (isOpen && (scanMode === 'image' || scanMode === 'barcode')) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, scanMode, startCamera, stopCamera]);

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImages(prev => [...prev, imageData]);
    toast.success("Photo captured!");
  }, []);
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => setCapturedImages(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(file);
    });
    toast.success(`${files.length} image(s) added.`);
  };

  const analyzeImages = () => {
    if (capturedImages.length === 0) return;
    handleAnalysis('image', capturedImages[0]);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    toast.info(isRecording ? "Stopped recording (placeholder)." : "Started recording (placeholder).");
  }

  const flipCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-900 shadow-2xl border-gray-700">
        <CardContent className="p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Scanner</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400" onClick={handleClose}><X className="w-5 h-5" /></Button>
          </div>
          <div className="flex gap-2 mb-4 p-1 bg-gray-800 rounded-lg">
            <Button variant={scanMode === 'barcode' ? 'secondary' : 'ghost'} size="sm" onClick={() => setScanMode('barcode')} className="flex-1"><Scan className="w-4 h-4 mr-2" />Barcode/QR</Button>
            <Button variant={scanMode === 'image' ? 'secondary' : 'ghost'} size="sm" onClick={() => setScanMode('image')} className="flex-1"><Camera className="w-4 h-4 mr-2" />Image</Button>
          </div>

          {scanMode === 'image' ? (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {isRecording && <div className="absolute top-2 right-2 h-4 w-4 bg-red-500 rounded-full animate-pulse" />}
              </div>
              {capturedImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {capturedImages.map((img, index) => ( <img key={index} src={img} alt={`capture ${index}`} className="h-16 w-16 object-cover rounded-md border-2 border-purple-500" /> ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button onClick={captureImage} className="flex-1"> <Camera className="w-4 h-4 mr-2" /> {capturedImages.length > 0 ? 'Add Photo' : 'Capture'} </Button>
                <Toggle pressed={isRecording} onPressedChange={toggleRecording} aria-label="Toggle recording"> {isRecording ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />} </Toggle>
                <Button variant="outline" size="icon" onClick={flipCamera}><FlipHorizontal className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /></Button>
              </div>
               <Button onClick={analyzeImages} disabled={isProcessing || capturedImages.length === 0} className="w-full">
                  <Check className="w-4 h-4 mr-2" />
                  {isProcessing ? 'Analyzing...' : `Analyze (${capturedImages.length})`}
                </Button>
            </div>
          ) : (
            <div>
              <video ref={barcodeRef} className="w-full aspect-video object-cover rounded-lg bg-black"/>
            </div>
          )}
        </CardContent>
      </Card>
      <canvas ref={canvasRef} className="hidden" />
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
    </div>
  );
};

export default DualScanner;