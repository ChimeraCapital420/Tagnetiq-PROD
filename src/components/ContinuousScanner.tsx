import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AnalysisHUD from './AnalysisHUD';

interface ContinuousScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ContinuousScanner: React.FC<ContinuousScannerProps> = ({ isOpen, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showHUD, setShowHUD] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsScanning(true);
      simulateBarcodeDetection();
    } catch (error) {
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  };

  const simulateBarcodeDetection = () => {
    const detectCode = () => {
      if (!isOpen || !isScanning) return;
      
      if (Math.random() > 0.7) {
        const mockCode = `${Math.floor(Math.random() * 1000000000000)}`;
        handleCodeDetected(mockCode);
      } else {
        setTimeout(detectCode, 1000);
      }
    };
    
    setTimeout(detectCode, 2000);
  };

  const handleCodeDetected = async (code: string) => {
    setIsLoading(true);
    setError(null);
    setDetectedCode(code);
    setShowHUD(true);
    setIsScanning(false);
    
    // Show loading for 1 second
    setTimeout(() => {
      setIsLoading(false);
      
      // Show analysis result for 3 seconds
      setTimeout(() => {
        setShowHUD(false);
        setDetectedCode(null);
        // Reset for next scan after 500ms
        setTimeout(() => {
          setIsScanning(true);
          simulateBarcodeDetection();
        }, 500);
      }, 3000);
    }, 1000);
  };

  const handleBackToHome = () => {
    stopCamera();
    onClose();
    navigate('/');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      
      {/* Header with controls */}
      <div className="absolute top-0 left-0 right-0 z-60 bg-black bg-opacity-50 p-4">
        <div className="flex items-center justify-between">
          <Button
            onClick={handleBackToHome}
            className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-600"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <h1 className="text-white font-mono text-lg font-bold">
            TAGNETIQ SCANNER
          </h1>
          
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scanning indicator */}
      {isScanning && !showHUD && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-60">
          <div className="bg-black bg-opacity-70 text-green-400 px-6 py-3 rounded-full border border-green-500 font-mono">
            <div className="flex items-center">
              <div className="animate-pulse w-3 h-3 bg-green-400 rounded-full mr-3"></div>
              SCANNING FOR CODES...
            </div>
          </div>
        </div>
      )}

      <AnalysisHUD
        isVisible={showHUD}
        isLoading={isLoading}
        error={error}
        code={detectedCode}
      />
    </div>
  );
};

export default ContinuousScanner;
