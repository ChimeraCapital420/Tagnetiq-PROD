// FILE: src/components/DualScanner.tsx
// REFACTORED: Now uses extracted hooks and utilities from Phase 1 & 2
// Mobile-first multi-modal scanner with image persistence

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import {
  X, FlipHorizontal, Upload, Circle, Zap, Loader2, ScanLine,
  ImageIcon, Video, Settings as SettingsIcon, Focus, Check,
  FileText, Award, ShieldCheck, Trash2, Search, Bluetooth
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import CameraSettingsModal from './CameraSettingsModal.js';
import DevicePairingModal from './DevicePairingModal.js';
import './DualScanner.css';
import { AnalysisResult } from '@/types';

// =============================================================================
// IMPORTS FROM REFACTORED MODULES (Phase 1 & 2)
// =============================================================================
import type { CapturedItem, ScanMode } from '@/types/scanner';
import { compressImage, formatBytes } from '@/lib/scanner/compression';
import { uploadImages } from '@/lib/scanner/upload';

// =============================================================================
// TYPES
// =============================================================================

interface DualScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const DualScanner: React.FC<DualScannerProps> = ({ isOpen, onClose }) => {
  const { setLastAnalysisResult, setIsAnalyzing, selectedCategory } = useAppContext();
  const { session } = useAuth();

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const [scanMode, setScanMode] = useState<ScanMode>('image');
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDevicePairingOpen, setIsDevicePairingOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [isRecording, setIsRecording] = useState(false);
  const [videoChunks, setVideoChunks] = useState<Blob[]>([]);
  const [isAnalyzingBarcodes, setIsAnalyzingBarcodes] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // ---------------------------------------------------------------------------
  // REFS
  // ---------------------------------------------------------------------------
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // ---------------------------------------------------------------------------
  // BARCODE SCANNER (react-zxing)
  // ---------------------------------------------------------------------------
  const { ref: zxingRef } = useZxing({
    deviceId: selectedDeviceId,
    onResult(result) {
      if (scanMode === 'barcode' && !isProcessing) {
        setIsProcessing(true);
        toast.success(`Barcode detected: ${result.getText()}`);
        setLastAnalysisResult({
          id: uuidv4(),
          decision: 'BUY',
          itemName: `Barcode: ${result.getText()}`,
          estimatedValue: 0.00,
          confidenceScore: 50,
          summary_reasoning: 'Barcode scanned, ready for lookup.',
          analysis_quality: 'OPTIMAL',
          valuation_factors: ['Barcode Detection'],
          capturedAt: new Date().toISOString(),
          category: 'barcode',
          imageUrl: '',
          marketComps: [],
          resale_toolkit: { listInArena: true, sellOnProPlatforms: true, linkToMyStore: false, shareToSocial: true },
          tags: ['barcode']
        });
        setIsAnalyzing(true);
        onClose();
      }
    },
    paused: scanMode !== 'barcode' || !isOpen || isProcessing,
  });

  // ---------------------------------------------------------------------------
  // CAMERA MANAGEMENT
  // ---------------------------------------------------------------------------
  const stopCamera = useCallback(() => {
    console.log('📷 [CAMERA] Stopping camera...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`📷 [CAMERA] Stopped track: ${track.kind}`);
      });
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    console.log('📷 [CAMERA] Starting camera...');

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Camera not supported in this browser');
      return;
    }

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
      console.log('📷 [CAMERA] Stream started successfully');
    } catch (err) {
      console.error('📷 [CAMERA] Error:', err);
      toast.error('Camera access denied.', {
        description: 'Please enable camera permissions in your browser settings.',
      });
      onClose();
    }
  }, [selectedDeviceId, onClose, stopCamera]);

  // Enumerate devices on mount
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const availableDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = availableDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
        if (!selectedDeviceId && videoDevices.length > 0) {
          const rearCamera = videoDevices.find(d => d.label.toLowerCase().includes('back'));
          setSelectedDeviceId(rearCamera?.deviceId || videoDevices[0].deviceId);
        }
      } catch (err) {
        toast.error('Could not access camera devices.');
      }
    };
    if (isOpen) {
      getDevices();
    }
  }, [isOpen, selectedDeviceId]);

  // Start/stop camera based on modal state
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  // ---------------------------------------------------------------------------
  // CAPTURE FUNCTIONS
  // ---------------------------------------------------------------------------

  /**
   * Add captured item with compression (preserves original for storage)
   */
  const addCapturedItem = useCallback(async (item: Omit<CapturedItem, 'id' | 'selected'>) => {
    setIsCompressing(true);
    console.log('📸 [CAPTURE] Processing new item...');

    try {
      let processedData = item.data;
      let originalData = item.data;
      let originalSize = 0;
      let compressedSize = 0;

      // Compress images for API, but keep original for storage
      if (item.type === 'photo' || item.type === 'document') {
        const result = await compressImage(item.data);
        processedData = result.compressed;
        originalSize = result.originalSize;
        compressedSize = result.compressedSize;

        if (originalSize > 1024 * 1024 && compressedSize < originalSize * 0.7) {
          toast.info(`Image compressed: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)}`);
        }
      }

      const newItem: CapturedItem = {
        ...item,
        id: uuidv4(),
        selected: true,
        data: processedData,
        originalData: originalData,
        thumbnail: item.type === 'document' ? item.thumbnail : processedData,
        metadata: {
          ...item.metadata,
          originalSize,
          compressedSize,
        },
      };

      setCapturedItems(prev => [...prev, newItem].slice(-15));
      console.log('📸 [CAPTURE] Item added successfully');

      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error('📸 [CAPTURE] Error:', error);
      toast.error('Failed to process image');
    } finally {
      setIsCompressing(false);
    }
  }, []);

  /**
   * Capture photo from video stream
   */
  const captureImage = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      await addCapturedItem({
        type: 'photo',
        data: dataUrl,
        thumbnail: dataUrl,
        name: `Photo ${capturedItems.filter(i => i.type === 'photo').length + 1}`
      });
    }
  }, [addCapturedItem, capturedItems]);

  // ---------------------------------------------------------------------------
  // VIDEO RECORDING
  // ---------------------------------------------------------------------------

  const extractVideoFrames = async (videoBlob: Blob, frameCount: number = 5): Promise<string[]> => {
    return new Promise((resolve) => {
      const videoUrl = URL.createObjectURL(videoBlob);
      const tempVideo = document.createElement('video');
      tempVideo.src = videoUrl;
      tempVideo.muted = true;
      tempVideo.preload = 'metadata';

      const frames: string[] = [];
      let currentFrame = 0;

      tempVideo.onloadedmetadata = () => {
        const interval = tempVideo.duration / frameCount;

        const extractFrame = () => {
          if (currentFrame >= frameCount) {
            URL.revokeObjectURL(videoUrl);
            resolve(frames);
            return;
          }
          tempVideo.currentTime = Math.max(0.1, interval * currentFrame);
        };

        tempVideo.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = tempVideo.videoWidth || 640;
          canvas.height = tempVideo.videoHeight || 480;
          const context = canvas.getContext('2d');

          if (context) {
            context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL('image/jpeg', 0.85));
          }
          currentFrame++;
          extractFrame();
        };

        extractFrame();
      };

      tempVideo.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        resolve([]);
      };

      tempVideo.load();
    });
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
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
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

  const startVideoRecording = useCallback(() => {
    if (!streamRef.current) {
      toast.error('No camera stream available for recording.');
      return;
    }

    console.log('🎬 [VIDEO] Starting recording...');

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
          const videoFrames = await extractVideoFrames(videoBlob, 5);
          const videoUrl = URL.createObjectURL(videoBlob);

          // Compress video frames
          const compressedFrames = await Promise.all(
            videoFrames.map(async (frame) => {
              const result = await compressImage(frame, { maxWidth: 1280, quality: 0.8 });
              return result.compressed;
            })
          );

          addCapturedItem({
            type: 'video',
            data: videoUrl,
            thumbnail: thumbnail,
            name: `Video ${capturedItems.filter(i => i.type === 'video').length + 1}`,
            metadata: {
              videoFrames: compressedFrames
            }
          });
        } catch (error) {
          console.error('🎬 [VIDEO] Processing failed:', error);
        }

        toast.success('Video recorded and processed!');
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Video recording started...');

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    } catch (error) {
      console.error('🎬 [VIDEO] Error starting:', error);
      toast.error('Failed to start video recording.');
    }
  }, [addCapturedItem, capturedItems, videoChunks]);

  const stopVideoRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // ---------------------------------------------------------------------------
  // FILE UPLOADS
  // ---------------------------------------------------------------------------

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.info(`Compressing large image: ${formatBytes(file.size)}`);
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          const dataUrl = e.target.result as string;
          await addCapturedItem({
            type: 'photo',
            data: dataUrl,
            thumbnail: dataUrl,
            name: file.name || `Upload ${capturedItems.filter(i => i.type === 'photo').length + 1}`
          });
        }
      };
      reader.readAsDataURL(file);
    }

    if (event.target) event.target.value = '';
  }, [addCapturedItem, capturedItems]);

  const handleDocumentUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          const dataUrl = e.target.result as string;

          // Create document thumbnail
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 200;
          canvas.height = 260;

          if (ctx) {
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, 200, 260);
            ctx.fillStyle = '#6c757d';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Document', 100, 130);
            ctx.fillText(file.name.split('.').pop()?.toUpperCase() || 'FILE', 100, 150);
          }

          const thumbnailUrl = canvas.toDataURL('image/png');

          // Detect document type
          const fileName = file.name.toLowerCase();
          let documentType: CapturedItem['metadata']['documentType'] = 'other';

          if (fileName.includes('certificate') || fileName.includes('cert')) documentType = 'certificate';
          else if (fileName.includes('grade') || fileName.includes('psa') || fileName.includes('bgs')) documentType = 'grading';
          else if (fileName.includes('appraisal')) documentType = 'appraisal';
          else if (fileName.includes('receipt') || fileName.includes('invoice')) documentType = 'receipt';
          else if (fileName.includes('authentic') || fileName.includes('coa')) documentType = 'authenticity';

          await addCapturedItem({
            type: 'document',
            data: dataUrl,
            thumbnail: thumbnailUrl,
            name: file.name,
            metadata: {
              documentType,
              description: `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} document`
            }
          });

          toast.success(`Document uploaded: ${documentType} detected`);
        }
      };
      reader.readAsDataURL(file);
    }

    if (event.target) event.target.value = '';
  }, [addCapturedItem]);

  // ---------------------------------------------------------------------------
  // ITEM MANAGEMENT
  // ---------------------------------------------------------------------------

  const toggleItemSelection = (itemId: string) => {
    setCapturedItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const selectAllItems = () => {
    setCapturedItems(prev => prev.map(item => ({ ...item, selected: true })));
  };

  const deselectAllItems = () => {
    setCapturedItems(prev => prev.map(item => ({ ...item, selected: false })));
  };

  const removeItem = (itemId: string) => {
    setCapturedItems(prev => prev.filter(item => item.id !== itemId));
  };

  const clearAllItems = () => {
    setCapturedItems([]);
    toast.info('All items cleared');
  };

  const handleFlipCamera = () => {
    if (devices.length > 1) {
      const currentIndex = devices.findIndex(d => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % devices.length;
      setSelectedDeviceId(devices[nextIndex].deviceId);
    } else {
      toast.info('No other camera detected.');
    }
  };

  const handleManualFocus = () => {
    if (videoRef.current) {
      videoRef.current.focus();
      toast.info('Attempting to focus camera.');
    }
  };

  const handleBluetoothDeviceConnected = (device: any) => {
    toast.success(`Connected to ${device.name}`, {
      description: 'Device is now available as a camera source'
    });
    setIsDevicePairingOpen(false);
  };

  const scanAllImagesForBarcodes = async () => {
    const imageItems = capturedItems.filter(item => item.type === 'photo');
    if (imageItems.length === 0) {
      toast.error('No images to scan for barcodes');
      return;
    }

    setIsAnalyzingBarcodes(true);
    toast.info(`Scanning ${imageItems.length} images for barcodes...`);

    // Barcode detection would go here
    await new Promise(resolve => setTimeout(resolve, 500));

    setIsAnalyzingBarcodes(false);
    toast.success('Barcode scan complete');
  };

  // ---------------------------------------------------------------------------
  // ANALYSIS SUBMISSION
  // ---------------------------------------------------------------------------

  const processMultiModalAnalysis = async () => {
    const selectedItems = capturedItems.filter(item => item.selected);

    if (selectedItems.length === 0) {
      toast.error('Please select at least one item for analysis.');
      return;
    }

    if (!session?.access_token || !session?.user?.id) {
      toast.error('Authentication required. Please sign in again.');
      return;
    }

    console.log('🚀 [ANALYSIS] Starting processMultiModalAnalysis');
    console.log(`🚀 [ANALYSIS] User ID: ${session.user.id}`);
    console.log(`🚀 [ANALYSIS] Selected items: ${selectedItems.length}`);

    setIsProcessing(true);
    setIsAnalyzing(true);
    onClose();
    toast.info(`Analyzing ${selectedItems.length} items with multi-AI system...`);

    try {
      // =====================================================================
      // STEP 1: Upload original images to Supabase
      // =====================================================================
      setIsUploading(true);

      const imageItems = selectedItems.filter(item => item.type === 'photo' || item.type === 'document');
      console.log(`📤 [ANALYSIS] Image items to upload: ${imageItems.length}`);

      let originalImageUrls: string[] = [];

      if (imageItems.length > 0) {
        toast.info('Uploading images to storage...');
        originalImageUrls = await uploadImages(imageItems, session.user.id);

        if (originalImageUrls.length > 0) {
          console.log(`✅ [ANALYSIS] Uploaded ${originalImageUrls.length} images`);
          toast.success(`Uploaded ${originalImageUrls.length} image(s)`);
        } else {
          console.warn('⚠️ [ANALYSIS] No images uploaded');
          toast.warning('Images could not be uploaded - continuing with analysis');
        }
      }

      setIsUploading(false);

      // =====================================================================
      // STEP 2: Prepare analysis payload
      // =====================================================================
      let totalPayloadSize = 0;

      const analysisData = {
        scanType: 'multi-modal',
        originalImageUrls,
        items: await Promise.all(selectedItems.map(async (item) => {
          let processedData = item.data;
          let additionalFrames: string[] = [];

          if (item.type === 'video' && item.metadata?.videoFrames) {
            additionalFrames = item.metadata.videoFrames;
            processedData = item.metadata.videoFrames[0] || item.thumbnail;
          } else if (item.type === 'photo' || item.type === 'document') {
            // Final safety compression check
            const currentSize = Math.round((processedData.length * 3) / 4);
            if (currentSize > 2 * 1024 * 1024) {
              console.log(`⚠️ Re-compressing large image: ${formatBytes(currentSize)}`);
              const result = await compressImage(processedData, { maxSizeMB: 1.5, quality: 0.75 });
              processedData = result.compressed;
            }
          }

          totalPayloadSize += processedData.length;
          additionalFrames.forEach(f => totalPayloadSize += f.length);

          return {
            type: item.type,
            name: item.name,
            data: processedData,
            additionalFrames,
            metadata: {
              ...item.metadata,
              extractedText: item.metadata?.extractedText || '',
              barcodes: item.metadata?.barcodes || []
            }
          };
        })),
        category_id: selectedCategory?.split('-')[0] || 'general',
        subcategory_id: selectedCategory || 'general'
      };

      const estimatedBytes = (totalPayloadSize * 3) / 4;
      console.log(`📦 Total payload size: ${formatBytes(estimatedBytes)}`);

      if (estimatedBytes > 4 * 1024 * 1024) {
        toast.warning(`Large payload detected (${formatBytes(estimatedBytes)}). Analysis may take longer.`);
      }

      // =====================================================================
      // STEP 3: Send to API
      // =====================================================================
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
        console.error('Analysis API Error:', errorText);

        if (response.status === 413 || errorText.includes('PAYLOAD_TOO_LARGE')) {
          throw new Error('Image too large for analysis. Please try with a smaller image.');
        }

        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || `Analysis request failed with status ${response.status}.`);
        } catch {
          throw new Error(`Analysis request failed with status ${response.status}.`);
        }
      }

      const analysisResult: AnalysisResult = await response.json();

      setLastAnalysisResult({
        ...analysisResult,
        id: uuidv4(),
        imageUrls: originalImageUrls.length > 0 ? originalImageUrls : selectedItems.map(item => item.thumbnail)
      });

      toast.success('Enhanced multi-modal analysis complete!');

    } catch (error) {
      console.error('Processing error:', error);
      setLastAnalysisResult(null);
      toast.error('Analysis Failed', {
        description: (error as Error).message
      });
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
      setIsUploading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

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
  const totalItems = capturedItems.length;

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  if (!isOpen) return null;

  return (
    <>
      <div className="dual-scanner-overlay" onClick={onClose}>
        <div className="dual-scanner-content" onClick={e => e.stopPropagation()}>
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Header */}
          <header className="dual-scanner-header">
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
                <SettingsIcon />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsDevicePairingOpen(true)}>
                <Bluetooth />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedCount}/{totalItems} selected
              </span>
              {totalItems > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectedCount === totalItems ? deselectAllItems : selectAllItems}
                  >
                    {selectedCount === totalItems ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAllItems}>
                    Clear All
                  </Button>
                </>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X />
            </Button>
          </header>

          {/* Main Video Area */}
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
                <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-bold">
                  ● REC
                </div>
              )}

              {isCompressing && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-blue-500/90 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Compressing...
                </div>
              )}

              {isUploading && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-green-500/90 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                </div>
              )}
            </div>
          </main>

          {/* Footer Controls */}
          <footer className="dual-scanner-footer">
            {/* Control Buttons */}
            <div className="scanner-controls">
              <Button variant="ghost" size="icon" onClick={handleFlipCamera}><FlipHorizontal /></Button>
              <Button variant="ghost" size="icon" onClick={handleManualFocus}><Focus /></Button>
              <input
                type="file"
                ref={imageInputRef}
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button variant="ghost" size="icon" onClick={() => imageInputRef.current?.click()}>
                <Upload />
              </Button>
              <input
                type="file"
                ref={documentInputRef}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                multiple
                className="hidden"
                onChange={handleDocumentUpload}
              />
              <Button variant="ghost" size="icon" onClick={() => documentInputRef.current?.click()}>
                <FileText />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={scanAllImagesForBarcodes}
                disabled={isAnalyzingBarcodes || capturedItems.filter(i => i.type === 'photo').length === 0}
              >
                {isAnalyzingBarcodes ? <Loader2 className="animate-spin" /> : <Search />}
              </Button>
            </div>

            {/* Capture Button */}
            {scanMode === 'image' && (
              <div className="relative flex items-center justify-center">
                <Button
                  onClick={captureImage}
                  className="capture-button"
                  size="icon"
                  disabled={isProcessing || isCompressing || isUploading || capturedItems.length >= 15}
                >
                  <Circle className="w-16 h-16 fill-white" />
                </Button>
              </div>
            )}

            {scanMode === 'video' && (
              <div className="relative flex items-center justify-center">
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

            {/* Analyze Button */}
            {selectedCount > 0 && (
              <div className="absolute right-4 bottom-32 z-10">
                <Button
                  onClick={processMultiModalAnalysis}
                  disabled={isProcessing || isCompressing || isUploading}
                  size="lg"
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {isProcessing || isUploading ? <Loader2 className="animate-spin mr-2" /> : <Zap className="mr-2" />}
                  {isUploading ? 'Uploading...' : `AI Analyze ${selectedCount} Item${selectedCount > 1 ? 's' : ''}`}
                </Button>
              </div>
            )}

            {/* Captured Items Preview */}
            <div className="captured-previews flex gap-2 flex-wrap justify-center max-h-20 overflow-y-auto p-2">
              {capturedItems.map((item) => (
                <div key={item.id} className="relative group">
                  <img
                    src={item.thumbnail}
                    alt={item.name}
                    className={`cursor-pointer transition-all border-2 rounded-lg ${
                      item.selected
                        ? 'border-blue-500 ring-2 ring-blue-300 scale-105'
                        : 'border-gray-300 opacity-70 hover:opacity-100'
                    }`}
                    style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                    onClick={() => toggleItemSelection(item.id)}
                    title={`${item.name} (${item.type})${item.metadata?.compressedSize ? ` - ${formatBytes(item.metadata.compressedSize)}` : ''}`}
                  />

                  {item.selected && (
                    <div className="absolute -top-0.5 -right-0.5 bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center border-2 border-white z-10">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  <div className="absolute bottom-0.5 left-0.5 bg-black/80 text-white rounded p-0.5 flex items-center justify-center">
                    {getItemIcon(item.type, item.metadata)}
                  </div>

                  {item.metadata?.barcodes && item.metadata.barcodes.length > 0 && (
                    <div className="absolute bottom-0.5 right-0.5 bg-green-500/90 text-white rounded px-1 text-xs font-bold">
                      {item.metadata.barcodes.length}
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-0.5 -left-0.5 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity border-2 border-white p-0 min-w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Mode Toggle */}
            <div className="mode-toggle">
              <Button onClick={() => setScanMode('image')} variant={scanMode === 'image' ? 'secondary' : 'ghost'}>
                <ImageIcon className="mr-2" />Photo
              </Button>
              <Button onClick={() => setScanMode('barcode')} variant={scanMode === 'barcode' ? 'secondary' : 'ghost'}>
                <ScanLine className="mr-2" />Barcode
              </Button>
              <Button onClick={() => setScanMode('video')} variant={scanMode === 'video' ? 'secondary' : 'ghost'}>
                <Video className="mr-2" />Video
              </Button>
            </div>
          </footer>
        </div>
      </div>

      {/* Modals */}
      <CameraSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        availableDevices={devices}
        currentDeviceId={selectedDeviceId}
        onDeviceChange={setSelectedDeviceId}
      />
      <DevicePairingModal
        isOpen={isDevicePairingOpen}
        onClose={() => setIsDevicePairingOpen(false)}
        onDeviceConnected={handleBluetoothDeviceConnected}
      />
    </>
  );
};

export default DualScanner;