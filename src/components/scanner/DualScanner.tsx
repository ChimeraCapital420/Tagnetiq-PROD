// FILE: src/components/scanner/DualScanner.tsx
// COMPLETE SELF-CONTAINED Ghost Protocol Scanner
// All Ghost functionality is INLINE - no external imports needed
// FIXES: Console spam, Ghost button visibility, description crash

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import {
  X, FlipHorizontal, Upload, Circle, Zap, Loader2, ScanLine,
  ImageIcon, Video, Settings as SettingsIcon, Focus, FileText, Bluetooth,
  Ghost, Grid3X3, Flashlight, MapPin, Store, DollarSign, Clock, RefreshCw,
  Check, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Modular imports (your existing ones)
import { useCapturedItems, useCameraCapture, useVideoRecording } from './hooks';
import { CapturePreviewGrid } from './components/CapturePreviewGrid';
import { getImageStorage, formatFileSize } from '@/lib/image-storage';
import CameraSettingsModal from '../CameraSettingsModal';
import DevicePairingModal from '../DevicePairingModal';
import type { AnalysisResult } from '@/types';
import '../DualScanner.css';

// =============================================================================
// TYPES
// =============================================================================

type ScanMode = 'image' | 'barcode' | 'video';

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
// GHOST MODE HOOK (INLINE - NO EXTERNAL IMPORTS)
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
// COMPONENT
// =============================================================================

const DualScanner: React.FC<DualScannerProps> = ({ isOpen, onClose }) => {
  const { setLastAnalysisResult, setIsAnalyzing, selectedCategory } = useAppContext();
  const { session } = useAuth();
  const userId = session?.user?.id || '';

  // ========================================
  // STATE
  // ========================================
  
  const [scanMode, setScanMode] = useState<ScanMode>('image');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDevicePairingOpen, setIsDevicePairingOpen] = useState(false);
  const [isGhostSheetOpen, setIsGhostSheetOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const hasLoggedCapabilities = useRef(false);

  // File inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // ========================================
  // GHOST MODE (INLINE HOOK)
  // ========================================

  const {
    isGhostMode,
    location: ghostLocation,
    storeInfo,
    isCapturingLocation,
    locationError,
    handlingHours,
    toggleGhostMode,
    refreshLocation,
    updateStoreInfo,
    setHandlingHours,
    buildGhostData,
    isGhostReady,
  } = useGhostMode();

  // ========================================
  // MODULAR HOOKS (YOUR EXISTING)
  // ========================================

  const {
    items,
    selectedCount,
    totalCount,
    addItem,
    removeItem,
    clearAll,
    toggleSelection,
    selectAll,
    deselectAll,
    getAnalysisPayload,
    getOriginalUrls,
  } = useCapturedItems({ maxItems: 15 });

  const {
    videoRef,
    isCapturing,
    devices,
    currentDeviceId,
    startCamera,
    stopCamera,
    switchCamera,
    captureFrame,
    triggerFocus,
  } = useCameraCapture({ preferRearCamera: true });

  const {
    isRecording,
    duration: recordingDuration,
    startRecording,
    stopRecording,
  } = useVideoRecording();

  // ========================================
  // TORCH CONTROL (FIXED - logs only once)
  // ========================================

  const toggleTorch = useCallback(async () => {
    try {
      const stream = videoRef.current?.srcObject as MediaStream;
      if (!stream) return;
      
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      
      const capabilities = track.getCapabilities?.() as any;
      
      // Only log ONCE per session
      if (!hasLoggedCapabilities.current) {
        console.log('📷 [CONTROLS] Camera capabilities:', {
          torch: capabilities?.torch || false,
          zoom: capabilities?.zoom ? 'Yes' : 'No',
        });
        hasLoggedCapabilities.current = true;
      }
      
      if (!capabilities?.torch) {
        toast.error('Torch not available on this device');
        return;
      }
      
      const newTorchState = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: newTorchState } as any]
      });
      setTorchOn(newTorchState);
    } catch (error) {
      console.error('Torch error:', error);
      toast.error('Failed to toggle torch');
    }
  }, [torchOn, videoRef]);

  // ========================================
  // BARCODE SCANNING
  // ========================================

  const { ref: zxingRef } = useZxing({
    deviceId: currentDeviceId,
    onResult(result) {
      if (scanMode === 'barcode' && !isProcessing) {
        handleBarcodeDetected(result.getText());
      }
    },
    paused: scanMode !== 'barcode' || !isOpen || isProcessing,
  });

  const handleBarcodeDetected = (barcode: string) => {
    setIsProcessing(true);
    toast.success(`Barcode detected: ${barcode}`);
    setLastAnalysisResult({
      id: uuidv4(),
      decision: 'BUY',
      itemName: `Barcode: ${barcode}`,
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
      tags: ['barcode'],
    });
    setIsAnalyzing(true);
    onClose();
  };

  // ========================================
  // IMAGE CAPTURE & PROCESSING
  // ========================================

  const handleCaptureImage = async () => {
    const dataUrl = await captureFrame();
    if (!dataUrl) return;

    setIsProcessing(true);
    try {
      const storage = getImageStorage(userId);
      const storedImage = await storage.processAndStore(dataUrl, 'captures');
      
      addItem({
        id: storedImage.id,
        type: 'photo',
        storedImage,
        name: `Photo ${items.filter(i => i.type === 'photo').length + 1}`,
      });
      
      toast.success(`Captured (${formatFileSize(storedImage.originalSize)} → ${formatFileSize(storedImage.compressedSize)} for AI)`);
    } catch (error) {
      console.error('Capture error:', error);
      toast.error('Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    const storage = getImageStorage(userId);

    for (const file of files) {
      try {
        const storedImage = await storage.processAndStore(file, 'uploads');
        
        addItem({
          id: storedImage.id,
          type: 'photo',
          storedImage,
          name: file.name || `Upload ${items.filter(i => i.type === 'photo').length + 1}`,
        });
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to process ${file.name}`);
      }
    }

    setIsProcessing(false);
    event.target.value = '';
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    const storage = getImageStorage(userId);

    for (const file of files) {
      try {
        const storedImage = await storage.processAndStore(file, 'documents');
        const docType = detectDocumentType(file.name);
        
        addItem({
          id: storedImage.id,
          type: 'document',
          storedImage,
          name: file.name,
          metadata: { documentType: docType },
        });
        
        toast.success(`Document uploaded: ${docType} detected`);
      } catch (error) {
        console.error('Document error:', error);
        toast.error(`Failed to process ${file.name}`);
      }
    }

    setIsProcessing(false);
    event.target.value = '';
  };

  // ========================================
  // VIDEO RECORDING
  // ========================================

  const handleVideoToggle = async () => {
    if (isRecording) {
      const result = await stopRecording();
      if (result) {
        const storage = getImageStorage(userId);
        const storedImage = await storage.processAndStore(result.frames[0] || result.thumbnail, 'videos');
        
        addItem({
          id: storedImage.id,
          type: 'video',
          storedImage,
          name: `Video ${items.filter(i => i.type === 'video').length + 1}`,
          metadata: { videoFrames: result.frames },
        });
        
        toast.success('Video recorded!');
      }
    } else {
      const stream = (videoRef.current as any)?.srcObject as MediaStream;
      if (stream) startRecording(stream);
    }
  };

  // ========================================
  // ANALYSIS - WITH GHOST DATA
  // ========================================

  const handleAnalyze = async () => {
    if (selectedCount === 0) {
      toast.error('Please select at least one item');
      return;
    }

    if (!session?.access_token) {
      toast.error('Please sign in to analyze');
      return;
    }

    if (isGhostMode && !isGhostReady) {
      toast.error('Complete ghost listing details', {
        description: 'Enter store name and shelf price',
      });
      setIsGhostSheetOpen(true);
      return;
    }

    setIsProcessing(true);
    setIsAnalyzing(true);
    onClose();
    
    const toastMessage = isGhostMode 
      ? `👻 Ghost analyzing ${selectedCount} items...`
      : `Analyzing ${selectedCount} items...`;
    toast.info(toastMessage);

    try {
      const analysisPayload = getAnalysisPayload();
      const originalUrls = getOriginalUrls().filter(url => !url.startsWith('blob:'));
      
      const requestPayload: any = {
        scanType: 'multi-modal',
        items: analysisPayload.map((item, index) => ({
          ...item,
          originalUrl: originalUrls[index] || null,
        })),
        category_id: selectedCategory?.split('-')[0] || 'general',
        subcategory_id: selectedCategory || 'general',
        originalImageUrls: originalUrls,
      };

      if (isGhostMode && ghostLocation && storeInfo) {
        requestPayload.ghostMode = {
          enabled: true,
          shelfPrice: storeInfo.shelf_price,
          handlingHours,
          storeType: storeInfo.type,
          storeName: storeInfo.name,
          storeAisle: storeInfo.aisle,
          location: {
            lat: ghostLocation.lat,
            lng: ghostLocation.lng,
            accuracy: ghostLocation.accuracy,
          },
        };
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 413 || errorText.includes('PAYLOAD_TOO_LARGE')) {
          throw new Error('Images still too large. Please try with fewer items.');
        }
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const result: AnalysisResult = await response.json();
      const ghostData = isGhostMode ? buildGhostData(result.estimatedValue || 0) : null;
      
      const finalImageUrls = result.imageUrls?.length > 0 
        ? result.imageUrls 
        : originalUrls;
      
      setLastAnalysisResult({
        ...result,
        id: result.id || uuidv4(),
        imageUrls: finalImageUrls,
        imageUrl: finalImageUrls[0] || '',
        thumbnailUrl: result.thumbnailUrl || finalImageUrls[0] || '',
        ghostData: ghostData || undefined,
      });

      if (isGhostMode && ghostData) {
        const margin = ghostData.kpis.estimated_margin;
        toast.success('👻 Ghost Analysis Complete!', {
          description: `Potential profit: $${margin.toFixed(2)} (${ghostData.kpis.velocity_score} velocity)`,
        });
      } else {
        toast.success('Analysis complete!');
      }

    } catch (error) {
      console.error('Analysis error:', error);
      setLastAnalysisResult(null);
      toast.error('Analysis failed', { description: (error as Error).message });
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
    }
  };

  // ========================================
  // LIFECYCLE
  // ========================================

  useEffect(() => {
    if (isOpen) {
      startCamera();
      hasLoggedCapabilities.current = false; // Reset logging flag
    } else {
      stopCamera();
      if (isGhostMode) {
        toggleGhostMode(false);
      }
      setTorchOn(false);
    }
    return () => stopCamera();
  }, [isOpen]);

  useEffect(() => {
    if (zxingRef && videoRef.current) {
      (zxingRef as any).current = videoRef.current;
    }
  }, [zxingRef, videoRef]);

  if (!isOpen) return null;

  // ========================================
  // RENDER
  // ========================================

  return (
    <>
      <div className="dual-scanner-overlay" onClick={onClose}>
        <div className="dual-scanner-content" onClick={e => e.stopPropagation()}>
          
          {/* ============================================ */}
          {/* HEADER                                       */}
          {/* ============================================ */}
          <header className="dual-scanner-header">
            {/* LEFT GROUP: Settings, Bluetooth, Ghost */}
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsSettingsOpen(true)}
                className="h-9 w-9"
              >
                <SettingsIcon className="h-5 w-5" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsDevicePairingOpen(true)}
                className="h-9 w-9"
              >
                <Bluetooth className="h-5 w-5" />
              </Button>
              
              {/* GHOST BUTTON - ALWAYS VISIBLE */}
              <Button
                variant={isGhostMode ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setIsGhostSheetOpen(true)}
                className={`h-9 w-9 ${isGhostMode ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'hover:bg-purple-500/20'}`}
                title="Ghost Protocol"
              >
                <Ghost className={`h-5 w-5 ${isGhostMode ? 'animate-pulse' : ''}`} />
              </Button>
            </div>

            {/* CENTER: Counter */}
            <div className="flex items-center gap-2">
              {isGhostMode && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                  <Ghost className="h-3 w-3 text-purple-400 animate-pulse" />
                  <span className="text-[10px] text-purple-300 font-medium">GHOST</span>
                </div>
              )}
              
              <span className="text-sm text-muted-foreground font-mono">
                {selectedCount}/{totalCount}
              </span>
            </div>

            {/* RIGHT GROUP: Grid, Torch, Close */}
            <div className="flex items-center gap-1">
              <Button
                variant={showGrid ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setShowGrid(!showGrid)}
                className="h-9 w-9"
                title="Toggle Grid"
              >
                <Grid3X3 className="h-5 w-5" />
              </Button>
              
              <Button
                variant={torchOn ? 'secondary' : 'ghost'}
                size="icon"
                onClick={toggleTorch}
                className={`h-9 w-9 ${torchOn ? 'text-yellow-400' : ''}`}
                title="Toggle Torch"
              >
                <Flashlight className="h-5 w-5" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="h-9 w-9 ml-2 bg-red-500/80 hover:bg-red-600 text-white"
                title="Close Scanner"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </header>

          {/* ============================================ */}
          {/* MAIN VIDEO AREA                             */}
          {/* ============================================ */}
          <main className="dual-scanner-main">
            <div className="relative w-full h-full bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {/* Grid Overlay */}
              {showGrid && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                    <div className="border-r border-b border-white/30" />
                    <div className="border-r border-b border-white/30" />
                    <div className="border-b border-white/30" />
                    <div className="border-r border-b border-white/30" />
                    <div className="border-r border-b border-white/30" />
                    <div className="border-b border-white/30" />
                    <div className="border-r border-white/30" />
                    <div className="border-r border-white/30" />
                    <div />
                  </div>
                </div>
              )}
              
              {/* Barcode reticle */}
              {scanMode === 'barcode' && <div className="barcode-reticle" />}
              
              {/* Ghost Mode Overlay */}
              {isGhostMode && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-2 border-2 border-purple-500/50 rounded-lg" />
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-600/90 text-white text-xs font-medium shadow-lg">
                    <Ghost className="h-3.5 w-3.5" />
                    Ghost Mode
                  </div>
                  {ghostLocation && (
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-600/90 text-white text-[10px] font-medium">
                      <MapPin className="h-3 w-3" />
                      GPS Locked
                    </div>
                  )}
                </div>
              )}
              
              {/* Recording indicator */}
              {isRecording && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-bold">
                  ● REC {recordingDuration}s
                </div>
              )}
              
              {/* Processing indicator */}
              {isProcessing && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-blue-500/90 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                </div>
              )}
            </div>
          </main>

          {/* ============================================ */}
          {/* FOOTER                                       */}
          {/* ============================================ */}
          <footer className="dual-scanner-footer">
            {/* Controls Row */}
            <div className="scanner-controls">
              <Button variant="ghost" size="icon" onClick={switchCamera}>
                <FlipHorizontal className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={triggerFocus}>
                <Focus className="h-5 w-5" />
              </Button>
              
              <input
                type="file"
                ref={imageInputRef}
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button variant="ghost" size="icon" onClick={() => imageInputRef.current?.click()}>
                <Upload className="h-5 w-5" />
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
                <FileText className="h-5 w-5" />
              </Button>
            </div>

            {/* Capture Button */}
            {scanMode === 'image' && (
              <div className="flex justify-center">
                <Button
                  onClick={handleCaptureImage}
                  className={`capture-button ${isGhostMode ? 'ring-4 ring-purple-500/50' : ''}`}
                  size="icon"
                  disabled={isProcessing || isCapturing || totalCount >= 15}
                >
                  <Circle className="w-16 h-16 fill-white" />
                </Button>
              </div>
            )}

            {scanMode === 'video' && (
              <div className="flex justify-center">
                <Button
                  onClick={handleVideoToggle}
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
                  onClick={handleAnalyze}
                  disabled={isProcessing || (isGhostMode && !isGhostReady)}
                  size="lg"
                  className={
                    isGhostMode
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg'
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg'
                  }
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin mr-2" />
                  ) : isGhostMode ? (
                    <Ghost className="mr-2" />
                  ) : (
                    <Zap className="mr-2" />
                  )}
                  {isGhostMode ? '👻 Ghost' : 'AI'} Analyze {selectedCount}
                </Button>
              </div>
            )}

            {/* Preview Grid */}
            <CapturePreviewGrid
              items={items}
              onToggleSelection={toggleSelection}
              onRemove={removeItem}
            />

            {/* Mode Toggle */}
            <div className="mode-toggle">
              <Button
                onClick={() => setScanMode('image')}
                variant={scanMode === 'image' ? 'secondary' : 'ghost'}
              >
                <ImageIcon className="mr-2 h-4 w-4" />Photo
              </Button>
              <Button
                onClick={() => setScanMode('barcode')}
                variant={scanMode === 'barcode' ? 'secondary' : 'ghost'}
              >
                <ScanLine className="mr-2 h-4 w-4" />Barcode
              </Button>
              <Button
                onClick={() => setScanMode('video')}
                variant={scanMode === 'video' ? 'secondary' : 'ghost'}
              >
                <Video className="mr-2 h-4 w-4" />Video
              </Button>
            </div>
          </footer>
        </div>
      </div>

      {/* ============================================ */}
      {/* GHOST PROTOCOL SHEET (INLINE)              */}
      {/* ============================================ */}
      {isGhostSheetOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/80 flex items-end justify-center"
          onClick={() => setIsGhostSheetOpen(false)}
        >
          <div 
            className="w-full max-w-lg bg-zinc-950 border-t border-zinc-800 rounded-t-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <div className="sticky top-0 bg-zinc-950 p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ghost className="h-5 w-5 text-purple-400" />
                <h3 className="text-lg font-semibold">Ghost Protocol</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsGhostSheetOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Sheet Content */}
            <div className="p-4 space-y-6">
              {/* Toggle Section */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-center gap-3">
                  <Ghost className={`h-6 w-6 ${isGhostMode ? 'text-purple-400 animate-pulse' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium">Ghost Mode</p>
                    <p className="text-xs text-muted-foreground">
                      List items you don't own yet
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isGhostMode}
                  onCheckedChange={() => toggleGhostMode()}
                />
              </div>

              {isGhostMode && (
                <>
                  {/* Location Status */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location
                    </Label>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                      {isCapturingLocation ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                          <span className="text-sm">Getting location...</span>
                        </>
                      ) : ghostLocation ? (
                        <>
                          <Check className="h-4 w-4 text-green-400" />
                          <span className="text-sm text-green-400">
                            GPS locked (±{ghostLocation.accuracy.toFixed(0)}m)
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={refreshLocation}
                            className="ml-auto"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </>
                      ) : locationError ? (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-400" />
                          <span className="text-sm text-red-400">{locationError}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={refreshLocation}
                            className="ml-auto"
                          >
                            Retry
                          </Button>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-yellow-400" />
                          <span className="text-sm">Location needed</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={refreshLocation}
                            className="ml-auto"
                          >
                            Get Location
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Store Info */}
                  <div className="space-y-4">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Store Details
                    </Label>
                    
                    <Select
                      value={storeInfo?.type || 'thrift'}
                      onValueChange={(value) => updateStoreInfo({ type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Store type" />
                      </SelectTrigger>
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
                    
                    <Input
                      placeholder="Store name (e.g. Goodwill on Main St)"
                      value={storeInfo?.name || ''}
                      onChange={(e) => updateStoreInfo({ name: e.target.value })}
                    />
                    
                    <Input
                      placeholder="Aisle/Section (optional)"
                      value={storeInfo?.aisle || ''}
                      onChange={(e) => updateStoreInfo({ aisle: e.target.value })}
                    />
                  </div>

                  {/* Shelf Price */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Shelf Price
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={storeInfo?.shelf_price || ''}
                        onChange={(e) => updateStoreInfo({ shelf_price: parseFloat(e.target.value) || 0 })}
                        className="pl-7"
                      />
                    </div>
                  </div>

                  {/* Handling Time */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Handling Time
                    </Label>
                    <Select
                      value={handlingHours.toString()}
                      onValueChange={(value) => setHandlingHours(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12 hours</SelectItem>
                        <SelectItem value="24">24 hours (recommended)</SelectItem>
                        <SelectItem value="48">48 hours</SelectItem>
                        <SelectItem value="72">72 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Time to retrieve and ship after sale
                    </p>
                  </div>

                  {/* Ready Status */}
                  <div className={`p-4 rounded-lg border ${isGhostReady ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                    {isGhostReady ? (
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
                          {!ghostLocation && <li>Location not captured</li>}
                          {(!storeInfo?.name || storeInfo.name.trim() === '') && <li>Store name required</li>}
                          {(!storeInfo?.shelf_price || storeInfo.shelf_price <= 0) && <li>Shelf price required</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Close button */}
              <Button
                onClick={() => setIsGhostSheetOpen(false)}
                className="w-full"
                variant={isGhostReady ? 'default' : 'secondary'}
              >
                {isGhostReady ? 'Start Hunting 👻' : 'Close'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* OTHER MODALS                                */}
      {/* ============================================ */}
      <CameraSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        availableDevices={devices.map(d => ({ deviceId: d.deviceId, label: d.label, kind: 'videoinput' } as MediaDeviceInfo))}
        currentDeviceId={currentDeviceId}
        onDeviceChange={(id) => startCamera(id)}
      />
      <DevicePairingModal
        isOpen={isDevicePairingOpen}
        onClose={() => setIsDevicePairingOpen(false)}
        onDeviceConnected={() => setIsDevicePairingOpen(false)}
      />
    </>
  );
};

// =============================================================================
// HELPERS
// =============================================================================

function detectDocumentType(filename: string): 'certificate' | 'grading' | 'appraisal' | 'receipt' | 'authenticity' | 'other' {
  const lower = filename.toLowerCase();
  if (lower.includes('certificate') || lower.includes('cert')) return 'certificate';
  if (lower.includes('grade') || lower.includes('grading') || lower.includes('psa') || lower.includes('bgs')) return 'grading';
  if (lower.includes('appraisal')) return 'appraisal';
  if (lower.includes('receipt') || lower.includes('invoice')) return 'receipt';
  if (lower.includes('authentic') || lower.includes('coa')) return 'authenticity';
  return 'other';
}

export default DualScanner;