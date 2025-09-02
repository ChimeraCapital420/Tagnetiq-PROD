// FILE: src/components/DualScanner.tsx

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import { X, FlipHorizontal, Upload, Circle, Zap, Loader2, ScanLine, ImageIcon, Video, Settings as SettingsIcon, Focus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import CameraSettingsModal from './CameraSettingsModal';
import './DualScanner.css';
import { AnalysisResult } from '@/types';

type ScanMode = 'image' | 'barcode' | 'video';

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [isRecording, setIsRecording] = useState(false);
  const [videoChunks, setVideoChunks] = useState<Blob[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const { ref: zxingRef } = useZxing({
    deviceId: selectedDeviceId,
    onResult(result) {
      if (scanMode === 'barcode' && !isProcessing) {
        setIsProcessing(true);
        toast.success(`Barcode detected: ${result.getText()}`);
        // @ts-ignore - Preserving original structure which may have temporary type issues.
        setLastAnalysisResult({ id: uuidv4(), decision: 'PASS', itemName: `Barcode: ${result.getText()}`, estimatedValue: '0.00', confidence: 'low', reasoning: 'Barcode scanned, ready for lookup.' });
        setIsAnalyzing(true);
        onClose();
      }
    },
    paused: scanMode !== 'barcode' || !isOpen || isProcessing,
  });

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        toast.error("Camera access denied.", {
          description: "Please enable camera permissions in your browser settings.",
        });
        onClose();
      }
    }
  }, [selectedDeviceId, onClose, stopCamera]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true }); // Request permission
        const availableDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = availableDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
        if (!selectedDeviceId && videoDevices.length > 0) {
          const rearCamera = videoDevices.find(d => d.label.toLowerCase().includes('back'));
          setSelectedDeviceId(rearCamera?.deviceId || videoDevices[0].deviceId);
        }
      } catch (err) {
        toast.error("Could not access camera devices.");
      }
    };
    if (isOpen) {
        getDevices();
    }
  }, [isOpen, selectedDeviceId]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  const handleManualFocus = () => {
    if (videoRef.current) {
      videoRef.current.focus();
      toast.info("Attempting to focus camera.");
    }
  };
  
  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setCapturedImages(prev => [...prev, dataUrl].slice(-5));
      }
    }
  };

  const startVideoRecording = () => {
    if (!streamRef.current) {
      toast.error("No camera stream available for recording.");
      return;
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9'
      });

      mediaRecorderRef.current = mediaRecorder;
      setVideoChunks([]);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setVideoChunks(prev => [...prev, event.data]);
        }
      };

      mediaRecorder.onstop = () => {
        toast.success("Video recorded successfully!");
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Video recording started...");

    } catch (error) {
      console.error("Error starting video recording:", error);
      toast.error("Failed to start video recording.");
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // VULCAN FORGE: SURGICALLY REPLACED FUNCTION
  const processVideoAnalysis = async () => {
    if (videoChunks.length === 0) {
      toast.error("No video recorded to analyze.");
      return;
    }

    setIsProcessing(true);
    setIsAnalyzing(true);
    onClose();

    try {
      const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
      
      // Create a temporary video element to extract frames
      const videoUrl = URL.createObjectURL(videoBlob);
      const tempVideo = document.createElement('video');
      tempVideo.src = videoUrl;
      tempVideo.muted = true; // Prevent audio issues
      
      await new Promise((resolve, reject) => {
        tempVideo.onloadedmetadata = () => {
          console.log('Video duration:', tempVideo.duration);
          resolve(true);
        };
        tempVideo.onerror = reject;
        tempVideo.load();
      });

      // Check if duration is valid
      if (!tempVideo.duration || tempVideo.duration === 0 || isNaN(tempVideo.duration)) {
        throw new Error("Invalid video duration. Video may be corrupted.");
      }

      // Extract frame at middle of video for analysis
      const targetTime = Math.max(0, tempVideo.duration / 2);
      tempVideo.currentTime = targetTime;
      
      await new Promise((resolve, reject) => {
        tempVideo.onseeked = resolve;
        tempVideo.onerror = reject;
        // Fallback timeout in case seeking fails
        setTimeout(resolve, 2000);
      });

      // Draw frame to canvas and get image data
      const canvas = document.createElement('canvas');
      canvas.width = tempVideo.videoWidth || 640;
      canvas.height = tempVideo.videoHeight || 480;
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error("Could not get canvas context");
      }

      context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
      const frameDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      
      // Verify we got a valid frame
      if (!frameDataUrl || frameDataUrl === 'data:,') {
        throw new Error("Could not extract frame from video");
      }
      
      // Process the frame like a normal image
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          scanType: 'image',
          data: frameDataUrl,
          category_id: selectedCategory?.split('-')[0] || 'general',
          subcategory_id: selectedCategory || 'general'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analysis failed: ${response.status}`);
      }
      
      const analysisResult: AnalysisResult = await response.json();
      setLastAnalysisResult({ ...analysisResult, id: uuidv4() });
      toast.success("Video analysis complete!");

      // Cleanup
      URL.revokeObjectURL(videoUrl);

    } catch (error) {
      console.error("Video processing error:", error);
      toast.error("Video Analysis Failed", {
        description: (error as Error).message
      });
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
      setVideoChunks([]);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setCapturedImages(prev => [...prev, e.target!.result as string].slice(-5));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const processImages = async () => {
    if (capturedImages.length === 0 || !session) return;
    setIsProcessing(true);
    setIsAnalyzing(true);
    onClose();
    toast.info("Analysis initiated...");

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          scanType: 'image',
          data: capturedImages[0],
          category_id: selectedCategory?.split('-')[0] || 'general',
          subcategory_id: selectedCategory || 'general'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Analysis API Error Response Text:", errorText);
        try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.error || `Analysis request failed with status ${response.status}.`);
        } catch (e) {
             throw new Error(`Analysis request failed with status ${response.status}. The server response was not valid JSON.`);
        }
      }
      
      const analysisResult: AnalysisResult = await response.json();
      // @ts-ignore
      setLastAnalysisResult({ ...analysisResult, id: uuidv4(), imageUrls: capturedImages });
      toast.success("Analysis complete!");

    } catch (error) {
      console.error("Processing error:", error);
      setLastAnalysisResult(null);
      toast.error("Analysis Failed", {
        description: (error as Error).message
      });
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
      setCapturedImages([]);
    }
  };

  const handleFlipCamera = () => {
    if (devices.length > 1) {
      const currentIndex = devices.findIndex(d => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % devices.length;
      setSelectedDeviceId(devices[nextIndex].deviceId);
    } else {
      toast.info("No other camera detected.");
    }
  };
  
  if (!isOpen) return null;

  return (
    <>
      <div className="dual-scanner-overlay" onClick={onClose}>
        <div className="dual-scanner-content" onClick={e => e.stopPropagation()}>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <header className="dual-scanner-header">
            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
              <SettingsIcon />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X />
            </Button>
          </header>

          <main className="dual-scanner-main">
            <div className="relative w-full h-full bg-black">
              <video
                ref={(node) => {
                  videoRef.current = node;
                  if (zxingRef) {
                    (zxingRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              {scanMode === 'barcode' && <div className="barcode-reticle" />}
              {isRecording && (
                <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(239, 68, 68, 0.9)', color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
                  ● REC
                </div>
              )}
            </div>
          </main>
          
          <footer className="dual-scanner-footer">
            <div className="scanner-controls">
                <Button variant="ghost" size="icon" onClick={handleFlipCamera}><FlipHorizontal/></Button>
                <Button variant="ghost" size="icon" onClick={handleManualFocus}><Focus /></Button>
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}><Upload /></Button>
            </div>

            {scanMode === 'image' && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Button onClick={captureImage} className="capture-button" size="icon" disabled={isProcessing || capturedImages.length >= 5}>
                      <Circle className="w-16 h-16 fill-white" />
                  </Button>
                  {capturedImages.length > 0 && 
                    <Button onClick={processImages} disabled={isProcessing} size="lg" style={{ position: 'absolute', right: '1rem', bottom: '6rem' }}>
                      {isProcessing ? <Loader2 className="animate-spin" /> : <Zap />}
                      <span className="ml-2">Analyze</span>
                    </Button>
                  }
              </div>
            )}

            {scanMode === 'video' && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Button 
                    onClick={isRecording ? stopVideoRecording : startVideoRecording} 
                    className="capture-button" 
                    size="icon" 
                    disabled={isProcessing}
                    style={{ backgroundColor: isRecording ? '#ef4444' : 'transparent' }}
                  >
                      <Circle className="w-16 h-16 fill-white" />
                  </Button>
                  {videoChunks.length > 0 && !isRecording && 
                    <Button onClick={processVideoAnalysis} disabled={isProcessing} size="lg" style={{ position: 'absolute', right: '1rem', bottom: '6rem' }}>
                      {isProcessing ? <Loader2 className="animate-spin" /> : <Zap />}
                      <span className="ml-2">Analyze Video</span>
                    </Button>
                  }
              </div>
            )}
            
            <div className="captured-previews">
              {capturedImages.map((src, index) => (
                <img key={index} src={src} alt={`capture ${index}`} className="preview-thumb" />
              ))}
            </div>

            <div className="mode-toggle">
                <Button onClick={() => setScanMode('image')} variant={scanMode === 'image' ? 'secondary' : 'ghost'}>
                  <ImageIcon className="mr-2"/>Image
                </Button>
                <Button onClick={() => setScanMode('barcode')} variant={scanMode === 'barcode' ? 'secondary' : 'ghost'}>
                  <ScanLine className="mr-2"/>Barcode
                </Button>
                <Button onClick={() => setScanMode('video')} variant={scanMode === 'video' ? 'secondary' : 'ghost'}>
                  <Video className="mr-2"/>Video
                </Button>
            </div>
          </footer>
        </div>
      </div>
      <CameraSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        availableDevices={devices}
        currentDeviceId={selectedDeviceId}
        onDeviceChange={setSelectedDeviceId}
      />
    </>
  );
};

export default DualScanner;