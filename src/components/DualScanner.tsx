import React, { useState, useRef, useCallback } from 'react';
import { useZxing } from 'react-zxing';
import { Camera, Scan, Image as ImageIcon, X, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

type ScanMode = 'barcode' | 'image';

interface DualScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DualScanner: React.FC<DualScannerProps> = ({ isOpen, onClose }) => {
  const [scanMode, setScanMode] = useState<ScanMode>('barcode');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { setLastAnalysisResult, setIsAnalyzing, setShowListingModal } = useAppContext();
  const { user } = useAuth();

  // React-zxing barcode scanner
  const { ref: barcodeRef } = useZxing({
    onDecodeResult(result) {
      handleBarcodeResult(result);
    },
    onError(error) {
      console.error('Barcode scanning error:', error);
    },
    constraints: {
      video: {
        facingMode: 'environment'
      }
    }
  });

  // Handle barcode scan result
  const handleBarcodeResult = useCallback(async (result: any) => {
    if (!result || isProcessing) return;
    
    setIsProcessing(true);
    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/analyze-barcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token || ''}`
        },
        body: JSON.stringify({
          barcode: result.text,
          scanType: 'barcode',
          userId: user?.id
        })
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const analysisResult = await response.json();
      
      setLastAnalysisResult({
        decision: analysisResult.decision,
        item: analysisResult.itemName,
        marketValue: analysisResult.estimatedValue,
        code: result.text
      });

      toast({
        title: "Analysis Complete",
        description: `${analysisResult.itemName} analyzed successfully`
      });

      onClose();
      setShowListingModal(true);
      
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Unable to analyze barcode. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
    }
  }, [isProcessing, setLastAnalysisResult, setIsAnalyzing, setShowListingModal, user, onClose]);

  // Capture image from camera
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);
  }, []);

  // Analyze captured image
  const analyzeImage = useCallback(async () => {
    if (!capturedImage) return;

    setIsProcessing(true);
    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token || ''}`
        },
        body: JSON.stringify({
          imageData: capturedImage,
          scanType: 'image',
          userId: user?.id
        })
      });

      if (!response.ok) {
        throw new Error('Image analysis failed');
      }

      const analysisResult = await response.json();
      
      setLastAnalysisResult({
        decision: analysisResult.decision,
        item: analysisResult.itemName,
        marketValue: analysisResult.estimatedValue,
        code: 'IMAGE_SCAN'
      });

      toast({
        title: "Image Analysis Complete",
        description: `${analysisResult.itemName} identified and analyzed`
      });

      onClose();
      setCapturedImage(null);
      setShowListingModal(true);
      
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Unable to analyze image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
    }
  }, [capturedImage, setLastAnalysisResult, setIsAnalyzing, setShowListingModal, user, onClose]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // Reset captured image
  const resetImage = useCallback(() => {
    setCapturedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Start camera for image mode
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  }, []);

  // Effect to start camera when switching to image mode
  React.useEffect(() => {
    if (scanMode === 'image' && !capturedImage && isOpen) {
      startCamera();
    }
  }, [scanMode, capturedImage, isOpen, startCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Tagnetiq Scanner</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={scanMode === 'barcode' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScanMode('barcode')}
              className="flex-1"
            >
              <Scan className="w-4 h-4 mr-2" />
              Barcode/QR
            </Button>
            <Button
              variant={scanMode === 'image' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScanMode('image')}
              className="flex-1"
            >
              <Camera className="w-4 h-4 mr-2" />
              Image
            </Button>
          </div>

          {/* Scanner Content */}
          <div className="space-y-4">
            {scanMode === 'barcode' ? (
              /* Barcode Scanner */
              <div className="relative">
                <Badge className="absolute top-2 left-2 z-10">
                  Amazon Arbitrage Mode
                </Badge>
                <div className="rounded-lg overflow-hidden bg-black">
                  <video
                    ref={barcodeRef}
                    style={{
                      width: '100%',
                      height: '300px',
                      objectFit: 'cover'
                    }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2 text-center">
                  Point camera at barcode or QR code
                </p>
              </div>
            ) : (
              /* Image Scanner */
              <div className="space-y-4">
                <Badge className="mb-2">
                  Collectibles Analysis Mode
                </Badge>
                
                {!capturedImage ? (
                  <div className="space-y-4">
                    {/* Camera View */}
                    <div className="rounded-lg overflow-hidden bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-64 object-cover"
                      />
                    </div>
                    
                    {/* Capture Controls */}
                    <div className="flex gap-2">
                      <Button onClick={captureImage} className="flex-1">
                        <Camera className="w-4 h-4 mr-2" />
                        Capture
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1"
                      >
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                ) : (
                  /* Captured Image */
                  <div className="space-y-4">
                    <img
                      src={capturedImage}
                      alt="Captured item"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={analyzeImage}
                        disabled={isProcessing}
                        className="flex-1"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {isProcessing ? 'Analyzing...' : 'Analyze'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={resetImage}
                        disabled={isProcessing}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 text-sm text-blue-600">
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                Processing with Hydra AI...
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default DualScanner;