// FILE: src/components/scanner/DualScanner.tsx
// Refactored multi-modal scanner with Ghost Protocol integration
// FIXED: Header layout - X button separate, Ghost button visible, grid/torch positioned correctly

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import {
  X, FlipHorizontal, Upload, Circle, Zap, Loader2, ScanLine,
  ImageIcon, Video, Settings as SettingsIcon, Focus, FileText, Bluetooth,
  Ghost, Grid3X3, Flashlight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Modular imports
import { useCapturedItems, useCameraCapture, useVideoRecording } from './hooks';
import { CapturePreviewGrid } from './components/CapturePreviewGrid';
import { getImageStorage, formatFileSize } from '@/lib/image-storage';
import CameraSettingsModal from '../CameraSettingsModal';
import DevicePairingModal from '../DevicePairingModal';
import type { AnalysisResult } from '@/types';
import '../DualScanner.css';

// Ghost Protocol imports
import { useGhostMode } from '@/hooks/useGhostMode';
import { GhostModeToggle } from './GhostModeToggle';
import { GhostLocationCapture } from './GhostLocationCapture';

// Sheet component - with fallback if not installed
let Sheet: any, SheetContent: any, SheetHeader: any, SheetTitle: any, SheetTrigger: any;
try {
  const sheetModule = require('@/components/ui/sheet');
  Sheet = sheetModule.Sheet;
  SheetContent = sheetModule.SheetContent;
  SheetHeader = sheetModule.SheetHeader;
  SheetTitle = sheetModule.SheetTitle;
  SheetTrigger = sheetModule.SheetTrigger;
} catch (e) {
  // Sheet not installed - will use dialog fallback
  console.warn('Sheet component not found, using fallback');
}

// =============================================================================
// TYPES
// =============================================================================

type ScanMode = 'image' | 'barcode' | 'video';

interface DualScannerProps {
  isOpen: boolean;
  onClose: () => void;
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

  // File inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // ========================================
  // GHOST MODE HOOK
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
  // MODULAR HOOKS
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
  // TORCH CONTROL
  // ========================================

  const toggleTorch = useCallback(async () => {
    try {
      const stream = videoRef.current?.srcObject as MediaStream;
      if (!stream) return;
      
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      
      const capabilities = track.getCapabilities?.() as any;
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
    } else {
      stopCamera();
      if (isGhostMode) {
        toggleGhostMode(false);
      }
      setTorchOn(false);
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  useEffect(() => {
    if (zxingRef && videoRef.current) {
      (zxingRef as any).current = videoRef.current;
    }
  }, [zxingRef, videoRef]);

  if (!isOpen) return null;

  // ========================================
  // GHOST SHEET CONTENT (reusable)
  // ========================================

  const ghostSheetContent = (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Ghost className="h-5 w-5 text-purple-400" />
        <h3 className="text-lg font-semibold">Ghost Protocol</h3>
      </div>
      
      <GhostModeToggle
        isEnabled={isGhostMode}
        onToggle={toggleGhostMode}
        location={ghostLocation}
        isCapturing={isCapturingLocation}
        error={locationError}
      />
      
      {isGhostMode && (
        <GhostLocationCapture
          location={ghostLocation}
          storeInfo={storeInfo}
          onUpdateStore={updateStoreInfo}
          onRefreshLocation={refreshLocation}
          handlingHours={handlingHours}
          onHandlingHoursChange={setHandlingHours}
          isCapturing={isCapturingLocation}
        />
      )}
    </div>
  );

  // ========================================
  // RENDER
  // ========================================

  return (
    <>
      <div className="dual-scanner-overlay" onClick={onClose}>
        <div className="dual-scanner-content" onClick={e => e.stopPropagation()}>
          
          {/* ============================================ */}
          {/* HEADER - Fixed Layout                        */}
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
              
              {/* Ghost Button - Always visible */}
              <Button
                variant={isGhostMode ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setIsGhostSheetOpen(true)}
                className={`h-9 w-9 ${isGhostMode ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
                title="Ghost Protocol"
              >
                <Ghost className={`h-5 w-5 ${isGhostMode ? 'animate-pulse' : ''}`} />
              </Button>
            </div>

            {/* CENTER: Counter and Select buttons */}
            <div className="flex items-center gap-2">
              {isGhostMode && (
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                  <Ghost className="h-3 w-3 text-purple-400 animate-pulse" />
                  <span className="text-[10px] text-purple-300 font-medium">GHOST</span>
                </div>
              )}
              
              <span className="text-sm text-muted-foreground font-mono">
                {selectedCount}/{totalCount}
              </span>
              
              {totalCount > 0 && (
                <div className="hidden sm:flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectedCount === totalCount ? deselectAll : selectAll}
                    className="h-7 text-xs"
                  >
                    {selectedCount === totalCount ? 'Deselect' : 'Select All'}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearAll}
                    className="h-7 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              )}
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
              
              {/* Close button - separate with margin */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="h-9 w-9 ml-2 hover:bg-red-500/20 hover:text-red-400"
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
                className="w-full h-full object-contain"
              />
              
              {/* Grid Overlay */}
              {showGrid && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Rule of thirds grid */}
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
                  <div className="absolute inset-2 border-2 border-purple-500/40 rounded-lg" />
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/80 text-white text-xs font-medium">
                    <Ghost className="h-3 w-3" />
                    Ghost Mode Active
                  </div>
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
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700'
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
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
      {/* GHOST PROTOCOL SHEET/MODAL                  */}
      {/* ============================================ */}
      {Sheet ? (
        <Sheet open={isGhostSheetOpen} onOpenChange={setIsGhostSheetOpen}>
          <SheetContent side="bottom" className="h-[80vh] bg-zinc-950 border-zinc-800 overflow-y-auto">
            <SheetHeader className="pb-4">
              <SheetTitle className="flex items-center gap-2">
                <Ghost className="h-5 w-5 text-purple-400" />
                Ghost Protocol
              </SheetTitle>
            </SheetHeader>
            {ghostSheetContent}
          </SheetContent>
        </Sheet>
      ) : (
        // Fallback modal if Sheet not installed
        isGhostSheetOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center" onClick={() => setIsGhostSheetOpen(false)}>
            <div 
              className="w-full max-w-lg bg-zinc-950 border-t border-zinc-800 rounded-t-2xl max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ghost className="h-5 w-5 text-purple-400" />
                  <h3 className="text-lg font-semibold">Ghost Protocol</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsGhostSheetOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              {ghostSheetContent}
            </div>
          </div>
        )
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