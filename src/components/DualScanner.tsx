// FILE: src/components/DualScanner.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { Camera, Scan, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

type ScanMode = 'barcode' | 'image';

interface DualScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DualScanner: React.FC<DualScannerProps> = ({ isOpen, onClose }) => {
  const [scanMode, setScanMode] = useState<ScanMode>('image');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { setLastAnalysisResult, setIsAnalyzing } = useAppContext();

  const handleClose = () => {
    stopCamera();
    setCapturedImages([]);
    onClose();
  };

  const { ref: barcodeRef } = useZxing({
    onDecodeResult(result) { console.log('Barcode Scanned:', result.getText()); },
  });
  
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast({
        title: "Camera Permission Needed",
        description: "Please grant camera permissions in your browser to continue.",
        variant: "destructive"
      });
      handleClose();
    }
  }, [handleClose]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
        if (scanMode === 'image') {
            startCamera();
        }
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
  }, []);

  const analyzeImages = useCallback(async () => {
    // ... analysis logic
  }, [capturedImages]);

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
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-64 object-cover" />
              </div>
              {capturedImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {capturedImages.map((img, index) => ( <img key={index} src={img} className="h-16 w-16 object-cover rounded-md border-2 border-purple-500" /> ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={captureImage} className="flex-1">
                  <Camera className="w-4 h-4 mr-2" />
                  {capturedImages.length > 0 ? 'Add Photo' : 'Capture'}
                </Button>
                <Button onClick={analyzeImages} disabled={isProcessing || capturedImages.length === 0} className="flex-1">
                  <Check className="w-4 h-4 mr-2" />
                  {isProcessing ? 'Analyzing...' : `Analyze (${capturedImages.length})`}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <video ref={barcodeRef} className="w-full h-64 object-cover rounded-lg bg-black"/>
            </div>
          )}
        </CardContent>
      </Card>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default DualScanner;