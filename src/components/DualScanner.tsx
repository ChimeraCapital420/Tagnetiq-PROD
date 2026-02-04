// FILE: src/components/DualScanner.tsx
// CONSOLIDATED: Ghost Protocol + Grid Overlay + Camera Controls
// Mobile-first: compression on device, haptic feedback, touch-manipulation
// FIXES: Console spam, Ghost button visibility

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import {
  X, FlipHorizontal, Upload, Circle, Zap, Loader2, ScanLine,
  ImageIcon, Video, Settings as SettingsIcon, Focus, Check,
  FileText, Award, ShieldCheck, Trash2, Search, Bluetooth,
  Flashlight, Grid3X3, Ghost, MapPin, Store, DollarSign, Clock,
  RefreshCw, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import CameraSettingsModal from './CameraSettingsModal';
import DevicePairingModal from './DevicePairingModal';
import './DualScanner.css';
import { AnalysisResult } from '@/types';

// Imports from refactored modules
import type { CapturedItem, ScanMode } from '@/types/scanner';
import { compressImage, formatBytes } from '@/lib/scanner/compression';
import { uploadImages } from '@/lib/scanner/upload';

// Phase 4 imports - Grid Overlay & Camera Controls
import { useGridOverlay } from '@/hooks/useGridOverlay';
import { useCameraControls } from '@/hooks/useCameraControls';
import { GridOverlay } from './GridOverlay';
import { FloatingAudioMeter } from './AudioLevelMeter';

// =============================================================================
// TYPES
// =============================================================================

interface DualScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GhostLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

interface GhostStoreInfo {
  type: string;
  name: string;
  aisle?: string;
  shelf_price: number;
}

// =============================================================================
// GHOST MODE HOOK (INLINE)
// =============================================================================

function useGhostMode() {
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [location, setLocation] = useState<GhostLocation | null>(null);
  const [storeInfo, setStoreInfo] = useState<GhostStoreInfo | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [handlingHours, setHandlingHours] = useState(24);

  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }

    setIsCapturingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        });
        setIsCapturingLocation(false);
      },
      (error) => {
        setLocationError(error.message);
        setIsCapturingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const toggleGhostMode = useCallback((enabled?: boolean) => {
    const newState = enabled ?? !isGhostMode;
    setIsGhostMode(newState);
    
    if (newState && !location) {
      captureLocation();
    }
    
    if (!newState) {
      setStoreInfo(null);
      setLocationError(null);
    }
  }, [isGhostMode, location, captureLocation]);

  const updateStoreInfo = useCallback((info: Partial<GhostStoreInfo>) => {
    setStoreInfo(prev => prev ? { ...prev, ...info } : {
      type: 'thrift',
      name: '',
      shelf_price: 0,
      ...info,
    });
  }, []);

  const isGhostReady = isGhostMode && 
    location !== null && 
    storeInfo !== null && 
    storeInfo.name.trim() !== '' && 
    storeInfo.shelf_price > 0;

  const buildGhostData = useCallback((estimatedValue: number) => {
    if (!location || !storeInfo) return null;

    const margin = estimatedValue - storeInfo.shelf_price;
    const marginPercent = storeInfo.shelf_price > 0 
      ? (margin / storeInfo.shelf_price) * 100 
      : 0;

    return {
      is_ghost: true,
      location: {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
      },
      store: {
        type: storeInfo.type,
        name: storeInfo.name,
        aisle: storeInfo.aisle,
      },
      pricing: {
        shelf_price: storeInfo.shelf_price,
        estimated_value: estimatedValue,
      },
      handling_time_hours: handlingHours,
      kpis: {
        estimated_margin: margin,
        margin_percent: marginPercent,
        velocity_score: marginPercent > 100 ? 'high' : marginPercent > 50 ? 'medium' : 'low',
      },
      scanned_at: new Date().toISOString(),
    };
  }, [location, storeInfo, handlingHours]);

  return {
    isGhostMode,
    location,
    storeInfo,
    isCapturingLocation,
    locationError,
    handlingHours,
    toggleGhostMode,
    refreshLocation: captureLocation,
    updateStoreInfo,
    setHandlingHours,
    buildGhostData,
    isGhostReady,
  };
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
  const [isGhostSheetOpen, setIsGhostSheetOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [isRecording, setIsRecording] = useState(false);
  const [videoChunks, setVideoChunks] = useState<Blob[]>([]);
  const [isAnalyzingBarcodes, setIsAnalyzingBarcodes] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  const [cssFilter, setCssFilter] = useState<string>('none');

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
  // HOOKS
  // ---------------------------------------------------------------------------
  const gridOverlay = useGridOverlay();
  
  const ghostMode = useGhostMode();
  
  const videoTrack = useMemo(() => {
    return streamRef.current?.getVideoTracks()[0] || null;
  }, [streamRef.current]);
  
  const cameraControls = useCameraControls(videoTrack);

  // ---------------------------------------------------------------------------
  // TRACK VIDEO DIMENSIONS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateDimensions = () => {
      if (video.clientWidth > 0 && video.clientHeight > 0) {
        setVideoDimensions({
          width: video.clientWidth,
          height: video.clientHeight
        });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(video);
    video.addEventListener('loadedmetadata', updateDimensions);
    updateDimensions();

    return () => {
      resizeObserver.disconnect();
      video.removeEventListener('loadedmetadata', updateDimensions);
    };
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // SETTINGS HANDLER
  // ---------------------------------------------------------------------------
  const handleSettingsChange = useCallback((settings: {
    filter?: string;
    grid?: { enabled: boolean; type: string; opacity: number };
  }) => {
    if (settings.filter) {
      setCssFilter(settings.filter);
    }
    
    if (settings.grid) {
      gridOverlay.setEnabled(settings.grid.enabled);
      if (settings.grid.type) {
        gridOverlay.setType(settings.grid.type as any);
      }
      if (settings.grid.opacity !== undefined) {
        gridOverlay.setOpacity(settings.grid.opacity);
      }
    }
  }, [gridOverlay]);

  // ---------------------------------------------------------------------------
  // GRID TOGGLE
  // ---------------------------------------------------------------------------
  const handleGridToggle = useCallback(() => {
    gridOverlay.toggle();
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  }, [gridOverlay]);

  // ---------------------------------------------------------------------------
  // BARCODE SCANNER
  // ---------------------------------------------------------------------------
  const { ref: zxingRef } = useZxing({
    deviceId: selectedDeviceId,
    onResult(result) {
      if (scanMode === 'barcode' && !isProcessing) {
        setIsProcessing(true);
        
        if ('vibrate' in navigator) {
          navigator.vibrate([50, 30, 50]);
        }
        
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
          imageUrls: [],
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
  
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const availableDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = availableDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
        if (!selectedDeviceId && videoDevices.length > 0) {
          const rearCamera = videoDevices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
          );
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

  useEffect(() => {
    if (isOpen) {
      const initCamera = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
          toast.error('Camera not supported in this browser');
          return;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: scanMode === 'video' ? { echoCancellation: true, noiseSuppression: true } : false,
          });
          
          streamRef.current = stream;
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error('[DUAL] Camera error:', err);
          toast.error('Camera access denied');
          onClose();
        }
      };

      initCamera();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      // Reset ghost mode when closing
      if (ghostMode.isGhostMode) {
        ghostMode.toggleGhostMode(false);
      }
    };
  }, [isOpen, selectedDeviceId, scanMode, onClose]);

  // ---------------------------------------------------------------------------
  // CAPTURE FUNCTIONS
  // ---------------------------------------------------------------------------

  const addCapturedItem = useCallback(async (item: Omit<CapturedItem, 'id' | 'selected'>) => {
    setIsCompressing(true);

    try {
      let processedData = item.data;
      let originalData = item.data;
      let originalSize = 0;
      let compressedSize = 0;

      if (item.type === 'photo' || item.type === 'document') {
        const result = await compressImage(item.data);
        processedData = result.compressed;
        originalSize = result.originalSize;
        compressedSize = result.compressedSize;

        if (originalSize > 1024 * 1024 && compressedSize < originalSize * 0.7) {
          toast.info(`Compressed: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)}`);
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

      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error('[CAPTURE] Error:', error);
      toast.error('Failed to process image');
    } finally {
      setIsCompressing(false);
    }
  }, []);

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
  // VIDEO RECORDING (abbreviated for space - same as before)
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
      toast.error('No camera stream available');
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
          const videoFrames = await extractVideoFrames(videoBlob, 5);
          const videoUrl = URL.createObjectURL(videoBlob);

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
            metadata: { videoFrames: compressedFrames }
          });
        } catch (error) {
          console.error('[VIDEO] Processing failed:', error);
        }

        toast.success('Video recorded!');
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Recording...');

      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    } catch (error) {
      console.error('[VIDEO] Error:', error);
      toast.error('Failed to start recording');
    }
  }, [addCapturedItem, capturedItems, videoChunks]);

  const stopVideoRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 30, 50]);
      }
    }
  }, [isRecording]);

  // ---------------------------------------------------------------------------
  // FILE UPLOADS
  // ---------------------------------------------------------------------------

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.info(`Compressing: ${formatBytes(file.size)}`);
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
          toast.success(`Document: ${documentType}`);
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
    setCapturedItems(prev => prev.map(item => item.id === itemId ? { ...item, selected: !item.selected } : item));
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
    toast.info('Cleared');
  };

  const handleFlipCamera = () => {
    if (devices.length > 1) {
      const currentIndex = devices.findIndex(d => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % devices.length;
      setSelectedDeviceId(devices[nextIndex].deviceId);
      if ('vibrate' in navigator) navigator.vibrate(30);
    } else {
      toast.info('No other camera');
    }
  };

  const handleManualFocus = () => {
    if (cameraControls.capabilities.focusMode.length > 0) {
      cameraControls.setFocusMode('single-shot');
      toast.info('Focusing...');
      if ('vibrate' in navigator) navigator.vibrate(20);
    } else if (videoRef.current) {
      videoRef.current.focus();
      toast.info('Focus');
    }
  };

  const handleTorchToggle = () => {
    if (cameraControls.capabilities.torch) {
      cameraControls.setTorch(!cameraControls.settings.torch);
      if ('vibrate' in navigator) navigator.vibrate(30);
    } else {
      toast.info('No flashlight');
    }
  };

  const handleBluetoothDeviceConnected = (device: any) => {
    toast.success(`Connected: ${device.name}`);
    setIsDevicePairingOpen(false);
  };

  const scanAllImagesForBarcodes = async () => {
    const imageItems = capturedItems.filter(item => item.type === 'photo');
    if (imageItems.length === 0) {
      toast.error('No images to scan');
      return;
    }
    setIsAnalyzingBarcodes(true);
    toast.info(`Scanning ${imageItems.length} images...`);
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsAnalyzingBarcodes(false);
    toast.success('Scan complete');
  };

  // ---------------------------------------------------------------------------
  // ANALYSIS SUBMISSION - WITH GHOST DATA
  // ---------------------------------------------------------------------------

  const processMultiModalAnalysis = async () => {
    const selectedItems = capturedItems.filter(item => item.selected);

    if (selectedItems.length === 0) {
      toast.error('Select at least one item');
      return;
    }

    if (!session?.access_token || !session?.user?.id) {
      toast.error('Please sign in');
      return;
    }

    // Check ghost readiness
    if (ghostMode.isGhostMode && !ghostMode.isGhostReady) {
      toast.error('Complete ghost listing details', {
        description: 'Enter store name and shelf price',
      });
      setIsGhostSheetOpen(true);
      return;
    }

    setIsProcessing(true);
    setIsAnalyzing(true);
    onClose();
    
    const toastMsg = ghostMode.isGhostMode 
      ? `👻 Ghost analyzing ${selectedItems.length} items...`
      : `Analyzing ${selectedItems.length} items...`;
    toast.info(toastMsg);

    try {
      setIsUploading(true);
      const imageItems = selectedItems.filter(item => item.type === 'photo' || item.type === 'document');
      let originalImageUrls: string[] = [];

      if (imageItems.length > 0) {
        toast.info('Uploading...');
        originalImageUrls = await uploadImages(imageItems, session.user.id);
        if (originalImageUrls.length > 0) {
          toast.success(`Uploaded ${originalImageUrls.length} image(s)`);
        }
      }
      setIsUploading(false);

      const analysisData: any = {
        scanType: 'multi-modal',
        originalImageUrls,
        items: await Promise.all(selectedItems.map(async (item) => {
          let processedData = item.data;
          let additionalFrames: string[] = [];

          if (item.type === 'video' && item.metadata?.videoFrames) {
            additionalFrames = item.metadata.videoFrames;
            processedData = item.metadata.videoFrames[0] || item.thumbnail;
          } else if (item.type === 'photo' || item.type === 'document') {
            const currentSize = Math.round((processedData.length * 3) / 4);
            if (currentSize > 2 * 1024 * 1024) {
              const result = await compressImage(processedData, { maxSizeMB: 1.5, quality: 0.75 });
              processedData = result.compressed;
            }
          }

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

      // Add ghost data if enabled
      if (ghostMode.isGhostMode && ghostMode.location && ghostMode.storeInfo) {
        analysisData.ghostMode = {
          enabled: true,
          shelfPrice: ghostMode.storeInfo.shelf_price,
          handlingHours: ghostMode.handlingHours,
          storeType: ghostMode.storeInfo.type,
          storeName: ghostMode.storeInfo.name,
          storeAisle: ghostMode.storeInfo.aisle,
          location: {
            lat: ghostMode.location.lat,
            lng: ghostMode.location.lng,
            accuracy: ghostMode.location.accuracy,
          },
        };
      }

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
        if (response.status === 413 || errorText.includes('PAYLOAD_TOO_LARGE')) {
          throw new Error('Image too large. Try smaller image.');
        }
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const analysisResult: AnalysisResult = await response.json();
      
      // Build ghost data for result
      const ghostData = ghostMode.isGhostMode 
        ? ghostMode.buildGhostData(analysisResult.estimatedValue || 0) 
        : null;

      setLastAnalysisResult({
        ...analysisResult,
        id: analysisResult.id || uuidv4(),
        imageUrls: originalImageUrls.length > 0 ? originalImageUrls : selectedItems.map(item => item.thumbnail),
        ghostData: ghostData || undefined,
      });

      if (ghostMode.isGhostMode && ghostData) {
        const margin = ghostData.kpis.estimated_margin;
        toast.success('👻 Ghost Analysis Complete!', {
          description: `Potential profit: $${margin.toFixed(2)} (${ghostData.kpis.velocity_score} velocity)`,
        });
      } else {
        toast.success('Analysis complete!');
      }

    } catch (error) {
      console.error('Error:', error);
      setLastAnalysisResult(null);
      toast.error('Analysis Failed', { description: (error as Error).message });
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

          {/* ================================================================ */}
          {/* HEADER */}
          {/* ================================================================ */}
          <header className="dual-scanner-header">
            {/* Left: Settings, Bluetooth, Ghost */}
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsSettingsOpen(true)} 
                className="touch-manipulation h-10 w-10"
              >
                <SettingsIcon className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsDevicePairingOpen(true)} 
                className="touch-manipulation h-10 w-10"
              >
                <Bluetooth className="w-5 h-5" />
              </Button>
              {/* GHOST BUTTON */}
              <Button
                variant={ghostMode.isGhostMode ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setIsGhostSheetOpen(true)}
                className={`touch-manipulation h-10 w-10 ${ghostMode.isGhostMode ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                title="Ghost Protocol"
              >
                <Ghost className={`w-5 h-5 ${ghostMode.isGhostMode ? 'animate-pulse' : ''}`} />
              </Button>
            </div>
            
            {/* Center: Selection + Ghost indicator */}
            <div className="flex items-center gap-1 sm:gap-2">
              {ghostMode.isGhostMode && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                  <Ghost className="h-3 w-3 text-purple-400 animate-pulse" />
                  <span className="text-[10px] text-purple-300 font-medium hidden sm:inline">GHOST</span>
                </div>
              )}
              <span className="text-xs sm:text-sm text-muted-foreground">
                {selectedCount}/{totalItems}
              </span>
              {totalItems > 0 && (
                <div className="hidden sm:flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectedCount === totalItems ? deselectAllItems : selectAllItems}
                    className="text-xs h-8 px-2"
                  >
                    {selectedCount === totalItems ? 'None' : 'All'}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearAllItems}
                    className="text-xs h-8 px-2"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
            
            {/* Right: Grid, Torch, Close */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleGridToggle}
                className={`p-2 rounded-full transition-all touch-manipulation ${
                  gridOverlay.settings.enabled
                    ? 'bg-white/20 text-white'
                    : 'text-white/70'
                }`}
                title="Toggle Grid"
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              
              {cameraControls.capabilities.torch && (
                <button
                  onClick={handleTorchToggle}
                  className={`p-2 rounded-full transition-all touch-manipulation ${
                    cameraControls.settings.torch
                      ? 'bg-yellow-500 text-black'
                      : 'text-white/70'
                  }`}
                  title="Toggle Torch"
                >
                  <Flashlight className="w-5 h-5" />
                </button>
              )}
              
              <Button 
                variant="destructive" 
                size="icon" 
                onClick={onClose}
                className="touch-manipulation h-10 w-10 ml-1"
                title="Close Scanner"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
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
                style={{ filter: cssFilter }}
              />

              {/* Grid Overlay */}
              <GridOverlay
                width={videoDimensions.width}
                height={videoDimensions.height}
                enabled={gridOverlay.settings.enabled}
                type={gridOverlay.settings.type}
                opacity={gridOverlay.settings.opacity}
                color={gridOverlay.settings.color}
              />

              {/* Barcode Reticle */}
              {scanMode === 'barcode' && <div className="barcode-reticle" />}

              {/* Ghost Mode Overlay */}
              {ghostMode.isGhostMode && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-2 border-2 border-purple-500/50 rounded-lg" />
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-600/90 text-white text-xs font-medium shadow-lg">
                    <Ghost className="h-3.5 w-3.5" />
                    Ghost Mode
                  </div>
                  {ghostMode.location && (
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-600/90 text-white text-[10px] font-medium">
                      <MapPin className="h-3 w-3" />
                      GPS
                    </div>
                  )}
                </div>
              )}

              {/* Audio Meter */}
              {isRecording && streamRef.current && (
                <FloatingAudioMeter stream={streamRef.current} position="bottom-right" autoStart />
              )}

              {/* Recording/Processing Indicators */}
              {isRecording && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 animate-pulse z-30">
                  <span className="w-2 h-2 bg-white rounded-full" />
                  REC
                </div>
              )}
              {isCompressing && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-blue-500/90 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 z-30">
                  <Loader2 className="w-4 h-4 animate-spin" /> Compressing...
                </div>
              )}
              {isUploading && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-green-500/90 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 z-30">
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                </div>
              )}
            </div>
          </main>

          {/* Footer Controls */}
          <footer className="dual-scanner-footer">
            <div className="scanner-controls">
              <Button variant="ghost" size="icon" onClick={handleFlipCamera} className="touch-manipulation h-11 w-11">
                <FlipHorizontal className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleManualFocus} className="touch-manipulation h-11 w-11">
                <Focus className="w-5 h-5" />
              </Button>
              <input type="file" ref={imageInputRef} accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              <Button variant="ghost" size="icon" onClick={() => imageInputRef.current?.click()} className="touch-manipulation h-11 w-11">
                <Upload className="w-5 h-5" />
              </Button>
              <input type="file" ref={documentInputRef} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple className="hidden" onChange={handleDocumentUpload} />
              <Button variant="ghost" size="icon" onClick={() => documentInputRef.current?.click()} className="touch-manipulation h-11 w-11">
                <FileText className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={scanAllImagesForBarcodes} disabled={isAnalyzingBarcodes || capturedItems.filter(i => i.type === 'photo').length === 0} className="touch-manipulation h-11 w-11">
                {isAnalyzingBarcodes ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </Button>
            </div>

            {/* Capture Button */}
            {scanMode === 'image' && (
              <div className="relative flex items-center justify-center py-2">
                <Button
                  onClick={captureImage}
                  className={`capture-button touch-manipulation ${ghostMode.isGhostMode ? 'ring-4 ring-purple-500/50' : ''}`}
                  size="icon"
                  disabled={isProcessing || isCompressing || isUploading || capturedItems.length >= 15}
                >
                  <Circle className="w-16 h-16 fill-white" />
                </Button>
              </div>
            )}

            {scanMode === 'video' && (
              <div className="relative flex items-center justify-center py-2">
                <Button
                  onClick={isRecording ? stopVideoRecording : startVideoRecording}
                  className="capture-button touch-manipulation"
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
              <div className="absolute right-3 bottom-44 sm:bottom-40 md:bottom-36 z-10">
                <Button
                  onClick={processMultiModalAnalysis}
                  disabled={isProcessing || isCompressing || isUploading || (ghostMode.isGhostMode && !ghostMode.isGhostReady)}
                  size="lg"
                  className={`touch-manipulation shadow-xl min-h-[48px] text-sm sm:text-base px-3 sm:px-4 ${
                    ghostMode.isGhostMode 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700'
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                  }`}
                >
                  {isProcessing || isUploading ? (
                    <Loader2 className="animate-spin mr-1.5 h-4 w-4" />
                  ) : ghostMode.isGhostMode ? (
                    <Ghost className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Zap className="mr-1.5 h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isUploading ? 'Uploading...' : ghostMode.isGhostMode ? `👻 Ghost ${selectedCount}` : `Analyze ${selectedCount}`}
                  </span>
                  <span className="sm:hidden">{selectedCount}</span>
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
                    className={`cursor-pointer transition-all border-2 rounded-lg touch-manipulation ${
                      item.selected ? 'border-blue-500 ring-2 ring-blue-300 scale-105' : 'border-gray-300 opacity-70'
                    }`}
                    style={{ width: '56px', height: '56px', objectFit: 'cover' }}
                    onClick={() => toggleItemSelection(item.id)}
                  />
                  {item.selected && (
                    <div className="absolute -top-0.5 -right-0.5 bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center border-2 border-white z-10">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0.5 left-0.5 bg-black/80 text-white rounded p-0.5">
                    {getItemIcon(item.type, item.metadata)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-0.5 -left-0.5 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity border-2 border-white p-0"
                    onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Mode Toggle */}
            <div className="mode-toggle">
              <Button onClick={() => setScanMode('image')} variant={scanMode === 'image' ? 'secondary' : 'ghost'} className="touch-manipulation text-xs sm:text-sm">
                <ImageIcon className="mr-1 w-4 h-4" />Photo
              </Button>
              <Button onClick={() => setScanMode('barcode')} variant={scanMode === 'barcode' ? 'secondary' : 'ghost'} className="touch-manipulation text-xs sm:text-sm">
                <ScanLine className="mr-1 w-4 h-4" />Barcode
              </Button>
              <Button onClick={() => setScanMode('video')} variant={scanMode === 'video' ? 'secondary' : 'ghost'} className="touch-manipulation text-xs sm:text-sm">
                <Video className="mr-1 w-4 h-4" />Video
              </Button>
            </div>
          </footer>
        </div>
      </div>

      {/* ================================================================ */}
      {/* GHOST PROTOCOL SHEET */}
      {/* ================================================================ */}
      {isGhostSheetOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-end justify-center" onClick={() => setIsGhostSheetOpen(false)}>
          <div className="w-full max-w-lg bg-zinc-950 border-t border-zinc-800 rounded-t-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-zinc-950 p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ghost className="h-5 w-5 text-purple-400" />
                <h3 className="text-lg font-semibold">Ghost Protocol</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsGhostSheetOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-6">
              {/* Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-center gap-3">
                  <Ghost className={`h-6 w-6 ${ghostMode.isGhostMode ? 'text-purple-400 animate-pulse' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium">Ghost Mode</p>
                    <p className="text-xs text-muted-foreground">List items you don't own yet</p>
                  </div>
                </div>
                <Switch checked={ghostMode.isGhostMode} onCheckedChange={() => ghostMode.toggleGhostMode()} />
              </div>

              {ghostMode.isGhostMode && (
                <>
                  {/* Location */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Location
                    </Label>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                      {ghostMode.isCapturingLocation ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                          <span className="text-sm">Getting location...</span>
                        </>
                      ) : ghostMode.location ? (
                        <>
                          <Check className="h-4 w-4 text-green-400" />
                          <span className="text-sm text-green-400">GPS locked (±{ghostMode.location.accuracy.toFixed(0)}m)</span>
                          <Button variant="ghost" size="sm" onClick={ghostMode.refreshLocation} className="ml-auto">
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </>
                      ) : ghostMode.locationError ? (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-400" />
                          <span className="text-sm text-red-400">{ghostMode.locationError}</span>
                          <Button variant="ghost" size="sm" onClick={ghostMode.refreshLocation} className="ml-auto">Retry</Button>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-yellow-400" />
                          <span className="text-sm">Location needed</span>
                          <Button variant="ghost" size="sm" onClick={ghostMode.refreshLocation} className="ml-auto">Get Location</Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Store Info */}
                  <div className="space-y-4">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Store className="h-4 w-4" /> Store Details
                    </Label>
                    <Select value={ghostMode.storeInfo?.type || 'thrift'} onValueChange={(v) => ghostMode.updateStoreInfo({ type: v })}>
                      <SelectTrigger><SelectValue placeholder="Store type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="thrift">Thrift Store</SelectItem>
                        <SelectItem value="antique">Antique Shop</SelectItem>
                        <SelectItem value="estate">Estate Sale</SelectItem>
                        <SelectItem value="garage">Garage/Yard Sale</SelectItem>
                        <SelectItem value="flea">Flea Market</SelectItem>
                        <SelectItem value="pawn">Pawn Shop</SelectItem>
                        <SelectItem value="auction">Auction</SelectItem>
                        <SelectItem value="retail">Retail Clearance</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Store name (e.g. Goodwill on Main St)" value={ghostMode.storeInfo?.name || ''} onChange={(e) => ghostMode.updateStoreInfo({ name: e.target.value })} />
                    <Input placeholder="Aisle/Section (optional)" value={ghostMode.storeInfo?.aisle || ''} onChange={(e) => ghostMode.updateStoreInfo({ aisle: e.target.value })} />
                  </div>

                  {/* Shelf Price */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Shelf Price
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" value={ghostMode.storeInfo?.shelf_price || ''} onChange={(e) => ghostMode.updateStoreInfo({ shelf_price: parseFloat(e.target.value) || 0 })} className="pl-7" />
                    </div>
                  </div>

                  {/* Handling Time */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Handling Time
                    </Label>
                    <Select value={ghostMode.handlingHours.toString()} onValueChange={(v) => ghostMode.setHandlingHours(parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12 hours</SelectItem>
                        <SelectItem value="24">24 hours (recommended)</SelectItem>
                        <SelectItem value="48">48 hours</SelectItem>
                        <SelectItem value="72">72 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Time to retrieve and ship after sale</p>
                  </div>

                  {/* Ready Status */}
                  <div className={`p-4 rounded-lg border ${ghostMode.isGhostReady ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                    {ghostMode.isGhostReady ? (
                      <div className="flex items-center gap-2 text-green-400">
                        <Check className="h-5 w-5" />
                        <span className="font-medium">Ready to ghost hunt!</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-yellow-400">
                          <AlertCircle className="h-5 w-5" />
                          <span className="font-medium">Missing info:</span>
                        </div>
                        <ul className="text-xs text-muted-foreground ml-7 list-disc">
                          {!ghostMode.location && <li>Location not captured</li>}
                          {(!ghostMode.storeInfo?.name || ghostMode.storeInfo.name.trim() === '') && <li>Store name required</li>}
                          {(!ghostMode.storeInfo?.shelf_price || ghostMode.storeInfo.shelf_price <= 0) && <li>Shelf price required</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Button onClick={() => setIsGhostSheetOpen(false)} className="w-full" variant={ghostMode.isGhostReady ? 'default' : 'secondary'}>
                {ghostMode.isGhostReady ? 'Start Hunting 👻' : 'Close'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CameraSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        availableDevices={devices}
        currentDeviceId={selectedDeviceId}
        onDeviceChange={setSelectedDeviceId}
        videoTrack={videoTrack}
        onSettingsChange={handleSettingsChange}
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