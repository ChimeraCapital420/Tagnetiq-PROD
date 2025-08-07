import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Camera, ArrowLeft } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from '@/components/ui/use-toast';
import { BarcodeDetector, BarcodeResult } from '@/lib/barcodeDetection';
import { useNavigate } from 'react-router-dom';

interface AnalysisResult {
  decision: string;
  itemName: string;
  estimatedValue: string;
}

const BarcodeScanner: React.FC = () => {
  const { isScanning, setIsScanning } = useAppContext();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [detector, setDetector] = useState<BarcodeDetector | null>(null);
  const [showHUD, setShowHUD] = useState(false);
  const [hudResult, setHudResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    if (isScanning) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isScanning]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current && canvasRef.current) {
            const barcodeDetector = new BarcodeDetector(videoRef.current, canvasRef.current);
            setDetector(barcodeDetector);
            barcodeDetector.startScanning((result: BarcodeResult) => {
              handleBarcodeDetected(result.text);
            });
          }
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (detector) {
      detector.stopScanning();
      setDetector(null);
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleBarcodeDetected = (barcode: string) => {
    // Show HUD with analysis result
    const result: AnalysisResult = {
      decision: "GO",
      itemName: `Item with Code: ${barcode}`,
      estimatedValue: "$150.00"
    };
    
    setHudResult(result);
    setShowHUD(true);
    
    // Hide HUD after 3 seconds and reset scanner
    setTimeout(() => {
      setShowHUD(false);
      setHudResult(null);
    }, 3000);
  };

  const handleBackToHome = () => {
    setIsScanning(false);
    navigate('/');
  };

  const simulateScan = () => {
    const mockBarcode = "123456789012";
    handleBarcodeDetected(mockBarcode);
  };

  if (!isScanning) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="absolute top-0 left-0 right-0 z-10 bg-black/80 p-4">
        <div className="flex justify-between items-center">
          <Button 
            onClick={handleBackToHome} 
            variant="ghost" 
            size="lg" 
            className="text-white hover:bg-white/20 bg-white/10 border border-white/30 px-4 py-2"
          >
            <ArrowLeft className="w-6 h-6 mr-2" />
            Back
          </Button>
          <h2 className="text-white text-lg font-semibold">Continuous Scanner</h2>
          <Button 
            onClick={() => setIsScanning(false)} 
            variant="ghost" 
            size="lg" 
            className="text-white hover:bg-white/20 bg-white/10 border border-white/30 px-4 py-2"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>

      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />

      {/* Scanning Frame */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <div className="w-64 h-32 border-2 border-green-400 rounded-lg">
            <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-green-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-green-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-green-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-green-400 rounded-br-lg" />
          </div>
          <p className="text-white text-center mt-4">Position barcode within frame</p>
        </div>
      </div>

      {/* HUD Overlay */}
      {showHUD && hudResult && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 mx-4 max-w-sm w-full">
            <div className="text-center space-y-3">
              <div className="text-4xl font-bold text-green-600">{hudResult.decision}</div>
              <div className="text-lg font-medium text-gray-800">{hudResult.itemName}</div>
              <div className="text-2xl font-bold text-blue-600">{hudResult.estimatedValue}</div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <Button onClick={simulateScan} className="bg-purple-600 hover:bg-purple-700 text-white">
          <Camera className="w-4 h-4 mr-2" />
          Simulate Scan
        </Button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default BarcodeScanner;