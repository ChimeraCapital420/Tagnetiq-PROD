// FILE: src/components/DualScanner.tsx (MULTI-MODAL ANALYSIS SYSTEM)

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import { X, FlipHorizontal, Upload, Circle, Zap, Loader2, ScanLine, ImageIcon, Video, Settings as SettingsIcon, Focus, Check, FileText, Award, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import CameraSettingsModal from './CameraSettingsModal';
import './DualScanner.css';
import { AnalysisResult } from '@/types';

type ScanMode = 'image' | 'barcode' | 'video';

interface CapturedItem {
  id: string;
  type: 'photo' | 'video' | 'document' | 'certificate';
  data: string; // base64 or blob URL
  thumbnail: string;
  name: string;
  selected: boolean;
  metadata?: {
    documentType?: 'certificate' | 'grading' | 'appraisal' | 'receipt' | 'authenticity' | 'other';
    description?: string;
  };
}

interface DualScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DualScanner: React.FC<DualScannerProps> = ({ isOpen, onClose }) => {
  const { setLastAnalysisResult, setIsAnalyzing, selectedCategory } = useAppContext();
  const { session } = useAuth();
  
  const [scanMode, setScanMode] = useState<ScanMode>('image');
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [isRecording, setIsRecording] = useState(false);
  const [videoChunks, setVideoChunks] = useState<Blob[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
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

  const addCapturedItem = (item: Omit<CapturedItem, 'id' | 'selected'>) => {
    const newItem: CapturedItem = {
      ...item,
      id: uuidv4(),
      selected: true, // Auto-select new items
    };
    
    setCapturedItems(prev => {
      // Deselect other items of different types if this is the first of its type
      const updated = prev.map(existingItem => ({
        ...existingItem,
        selected: false
      }));
      return [...updated, newItem].slice(-10); // Keep max 10 items
    });
  };

  const toggleItemSelection = (itemId: string) => {
    setCapturedItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, selected: !item.selected }
          : item
      )
    );
  };

  const removeItem = (itemId: string) => {
    setCapturedItems(prev => prev.filter(item => item.id !== itemId));
  };

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
        
        addCapturedItem({
          type: 'photo',
          data: dataUrl,
          thumbnail: dataUrl,
          name: `Photo ${capturedItems.filter(i => i.type === 'photo').length + 1}`
        });
      }
    }
  };

  const generateVideoThumbnail = async (videoBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const videoUrl = URL.createObjectURL(videoBlob);
      const tempVideo = document.createElement('video');
      tempVideo.src = videoUrl;
      tempVideo.muted = true;
      tempVideo.preload = 'metadata';
      
      tempVideo.onloadedmetadata = () => {
        tempVideo.currentTime = Math.max(0.1, tempVideo.duration / 2);
      };

      tempVideo.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = tempVideo.videoWidth || 320;
        canvas.height = tempVideo.videoHeight || 240;
        const context = canvas.getContext('2d');
        
        if (context) {
          context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
          URL.revokeObjectURL(videoUrl);
          resolve(thumbnail);
        } else {
          reject(new Error('Could not generate thumbnail'));
        }
      };

      tempVideo.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        reject(new Error('Video loading failed'));
      };

      tempVideo.load();
    });
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

      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
        
        try {
          const thumbnail = await generateVideoThumbnail(videoBlob);
          const videoUrl = URL.createObjectURL(videoBlob);
          
          addCapturedItem({
            type: 'video',
            data: videoUrl,
            thumbnail: thumbnail,
            name: `Video ${capturedItems.filter(i => i.type === 'video').length + 1}`
          });
        } catch (error) {
          console.error('Failed to generate thumbnail:', error);
        }

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

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const dataUrl = e.target.result as string;
          addCapturedItem({
            type: 'photo',
            data: dataUrl,
            thumbnail: dataUrl,
            name: file.name || `Upload ${capturedItems.filter(i => i.type === 'photo').length + 1}`
          });
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleDocumentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const dataUrl = e.target.result as string;
          
          // Create a thumbnail for document (first page if PDF, or the image itself)
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 200;
          canvas.height = 260;
          
          if (ctx) {
            // Create a document-style thumbnail
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, 200, 260);
            ctx.fillStyle = '#6c757d';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Document', 100, 130);
            ctx.fillText(file.name.split('.').pop()?.toUpperCase() || 'FILE', 100, 150);
          }
          
          const thumbnailUrl = canvas.toDataURL('image/png');
          
          // Detect document type from filename
          const fileName = file.name.toLowerCase();
          let documentType: CapturedItem['metadata']['documentType'] = 'other';
          
          if (fileName.includes('certificate') || fileName.includes('cert')) {
            documentType = 'certificate';
          } else if (fileName.includes('grade') || fileName.includes('grading')) {
            documentType = 'grading';
          } else if (fileName.includes('appraisal')) {
            documentType = 'appraisal';
          } else if (fileName.includes('receipt') || fileName.includes('invoice')) {
            documentType = 'receipt';
          } else if (fileName.includes('authentic')) {
            documentType = 'authenticity';
          }
          
          addCapturedItem({
            type: 'document',
            data: dataUrl,
            thumbnail: thumbnailUrl,
            name: file.name,
            metadata: {
              documentType: documentType,
              description: `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} document`
            }
          });

          toast.success(`Document uploaded: ${documentType} detected`);
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  const processMultiModalAnalysis = async () => {
    const selectedItems = capturedItems.filter(item => item.selected);
    
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item for analysis.");
      return;
    }

    if (!session?.access_token) {
      toast.error("Authentication required. Please sign in again.");
      return;
    }

    setIsProcessing(true);
    setIsAnalyzing(true);
    onClose();
    toast.info(`Analyzing ${selectedItems.length} items with AI...`);

    try {
      // Prepare the multi-modal analysis payload
      const analysisData = {
        scanType: 'multi-modal',
        items: await Promise.all(selectedItems.map(async (item) => {
          let processedData = item.data;
          
          // For videos, extract a frame
          if (item.type === 'video') {
            try {
              const videoBlob = await fetch(item.data).then(r => r.blob());
              const videoUrl = URL.createObjectURL(videoBlob);
              const tempVideo = document.createElement('video');
              tempVideo.src = videoUrl;
              tempVideo.muted = true;
              tempVideo.preload = 'metadata';
              
              await new Promise((resolve) => {
                tempVideo.onloadedmetadata = () => {
                  tempVideo.currentTime = Math.max(0.1, tempVideo.duration / 2);
                };
                tempVideo.onseeked = resolve;
                tempVideo.load();
              });

              const canvas = document.createElement('canvas');
              canvas.width = tempVideo.videoWidth || 640;
              canvas.height = tempVideo.videoHeight || 480;
              const context = canvas.getContext('2d');
              
              if (context) {
                context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                processedData = canvas.toDataURL('image/jpeg', 0.95);
              }
              
              URL.revokeObjectURL(videoUrl);
            } catch (error) {
              console.error('Error processing video:', error);
            }
          }
          
          return {
            type: item.type,
            name: item.name,
            data: processedData,
            metadata: item.metadata || {}
          };
        })),
        category_id: selectedCategory?.split('-')[0] || 'general',
        subcategory_id: selectedCategory || 'general'
      };

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(analysisData)
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
      setLastAnalysisResult({ 
        ...analysisResult, 
        id: uuidv4(), 
        imageUrls: selectedItems.map(item => item.thumbnail) 
      });
      toast.success("Multi-modal analysis complete!");

    } catch (error) {
      console.error("Processing error:", error);
      setLastAnalysisResult(null);
      toast.error("Analysis Failed", {
        description: (error as Error).message
      });
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
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

  const getItemIcon = (type: string, metadata?: any) => {
    switch (type) {
      case 'photo': return <ImageIcon className="w-3 h-3" />;
      case 'video': return <Video className="w-3 h-3" />;
      case 'document': 
        if (metadata?.documentType === 'certificate') return <Award className="w-3 h-3" />;
        if (metadata?.documentType === 'authenticity') return <ShieldCheck className="w-3 h-3" />;
        return <FileText className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
    }
  };

  const selectedCount = capturedItems.filter(item => item.selected).length;
  
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
                <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                <Button variant="ghost" size="icon" onClick={() => imageInputRef.current?.click()}><Upload /></Button>
                <input type="file" ref={documentInputRef} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={handleDocumentUpload} />
                <Button variant="ghost" size="icon" onClick={() => documentInputRef.current?.click()}><FileText /></Button>
            </div>

            {scanMode === 'image' && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Button onClick={captureImage} className="capture-button" size="icon" disabled={isProcessing || capturedItems.length >= 10}>
                      <Circle className="w-16 h-16 fill-white" />
                  </Button>
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
              </div>
            )}
            
            {/* MULTI-MODAL ANALYSIS BUTTON */}
            {selectedCount > 0 && (
              <div style={{ position: 'absolute', right: '1rem', bottom: '8rem', zIndex: 10 }}>
                <Button onClick={processMultiModalAnalysis} disabled={isProcessing} size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                  {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Zap className="mr-2" />}
                  Analyze {selectedCount} Item{selectedCount > 1 ? 's' : ''}
                </Button>
              </div>
            )}
            
            {/* CAPTURED ITEMS GRID */}
            <div className="captured-previews" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', maxHeight: '4rem', overflowY: 'auto' }}>
              {capturedItems.map((item) => (
                <div key={item.id} className="relative group">
                  <img 
                    src={item.thumbnail} 
                    alt={item.name} 
                    className={`preview-thumb cursor-pointer transition-all ${item.selected ? 'ring-2 ring-blue-500 scale-105' : 'opacity-70 hover:opacity-100'}`}
                    onClick={() => toggleItemSelection(item.id)}
                    title={`${item.name} (${item.type})`}
                  />
                  
                  {/* Selection indicator */}
                  {item.selected && (
                    <Check className="absolute top-0 right-0 w-4 h-4 bg-blue-500 text-white rounded-full p-0.5" />
                  )}
                  
                  {/* Type indicator */}
                  <div className="absolute bottom-0 left-0 bg-black/70 text-white rounded-tr p-0.5">
                    {getItemIcon(item.type, item.metadata)}
                  </div>
                  
                  {/* Remove button (appears on hover) */}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="absolute top-0 left-0 w-4 h-4 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                  >
                    <Trash2 className="w-2 h-2" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mode-toggle">
                <Button onClick={() => setScanMode('image')} variant={scanMode === 'image' ? 'secondary' : 'ghost'}>
                  <ImageIcon className="mr-2"/>Photo
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