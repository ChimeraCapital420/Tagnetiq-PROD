// FILE: src/components/scanner/DualScanner.tsx
// Refactored multi-modal scanner with Ghost Protocol integration
// UPDATED: Ghost Mode toggle, GPS capture, and ghost data passthrough

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import {
  X, FlipHorizontal, Upload, Circle, Zap, Loader2, ScanLine,
  ImageIcon, Video, Settings as SettingsIcon, Focus, FileText, Bluetooth,
  Ghost,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Modular imports
import { useCapturedItems, useCameraCapture, useVideoRecording } from './hooks';
import { CapturePreviewGrid } from './components/CapturePreviewGrid';
import { getImageStorage, formatFileSize, type StoredImage } from '@/lib/image-storage';
import CameraSettingsModal from '../CameraSettingsModal';
import DevicePairingModal from '../DevicePairingModal';
import type { AnalysisResult } from '@/types';
import '../DualScanner.css';

// Ghost Protocol imports
import { useGhostMode } from '@/hooks/useGhostMode';
import { GhostModeToggle } from './GhostModeToggle';
import { GhostLocationCapture } from './GhostLocationCapture';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

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
    selectedItems,
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
    isReady: isCameraReady,
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
      // Store original, get compressed for analysis
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
        // Use first frame as the stored image
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

    // Validate ghost mode if enabled
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
      // Get compressed data for AI
      const analysisPayload = getAnalysisPayload();
      
      // Get original URLs for marketplace (filter out blob: URLs)
      const originalUrls = getOriginalUrls().filter(url => !url.startsWith('blob:'));
      
      // Build request payload with ghost data if enabled
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

      // Add ghost data if enabled
      if (isGhostMode && ghostLocation && storeInfo) {
        requestPayload.ghostMode = {
          enabled: true,
          shelfPrice: storeInfo.shelf_price,
          handlingHours,
          storeType: storeInfo.type,
          storeName: storeInfo.name,
        };
      }

      console.log('📤 Sending analysis request', {
        images: originalUrls.length,
        ghostMode: isGhostMode,
      });

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
      
      // Build ghost data with estimated value from analysis
      const ghostData = isGhostMode ? buildGhostData(result.estimatedValue || 0) : null;
      
      // The API now returns imageUrls - use them, or fallback to local URLs
      const finalImageUrls = result.imageUrls?.length > 0 
        ? result.imageUrls 
        : originalUrls;
      
      setLastAnalysisResult({
        ...result,
        id: result.id || uuidv4(),
        imageUrls: finalImageUrls,
        imageUrl: finalImageUrls[0] || '',
        thumbnailUrl: result.thumbnailUrl || finalImageUrls[0] || '',
        // Attach ghost data to result
        ghostData: ghostData || undefined,
      });
      
      console.log('✅ Analysis complete', {
        images: finalImageUrls.length,
        ghostMode: isGhostMode,
        ghostReady: !!ghostData,
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
      // Reset ghost mode when scanner closes
      if (isGhostMode) {
        toggleGhostMode(false);
      }
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  // Connect zxing to our video ref
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
          
          {/* HEADER */}
          <header className="dual-scanner-header">
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
                <SettingsIcon />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsDevicePairingOpen(true)}>
                <Bluetooth />
              </Button>
              
              {/* Ghost Mode Button */}
              <Sheet open={isGhostSheetOpen} onOpenChange={setIsGhostSheetOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant={isGhostMode ? 'default' : 'ghost'}
                    size="icon"
                    className={isGhostMode ? 'bg-purple-500 hover:bg-purple-600' : ''}
                  >
                    <Ghost className={isGhostMode ? 'animate-pulse' : ''} />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80vh] bg-zinc-950 border-zinc-800">
                  <SheetHeader className="pb-4">
                    <SheetTitle className="flex items-center gap-2">
                      <Ghost className="h-5 w-5 text-purple-400" />
                      Ghost Protocol
                    </SheetTitle>
                  </SheetHeader>
                  
                  <div className="space-y-4 overflow-y-auto max-h-[calc(80vh-100px)]">
                    {/* Ghost Toggle */}
                    <GhostModeToggle
                      isEnabled={isGhostMode}
                      onToggle={toggleGhostMode}
                      location={ghostLocation}
                      isCapturing={isCapturingLocation}
                      error={locationError}
                    />
                    
                    {/* Location Capture Form */}
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
                </SheetContent>
              </Sheet>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Ghost Mode Indicator */}
              {isGhostMode && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                  <Ghost className="h-3 w-3 text-purple-400 animate-pulse" />
                  <span className="text-[10px] text-purple-300 font-medium">GHOST</span>
                </div>
              )}
              
              <span className="text-sm text-muted-foreground">
                {selectedCount}/{totalCount} selected
              </span>
              {totalCount > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectedCount === totalCount ? deselectAll : selectAll}
                  >
                    {selectedCount === totalCount ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAll}>
                    Clear All
                  </Button>
                </>
              )}
            </div>
            
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X />
            </Button>
          </header>

          {/* MAIN VIDEO AREA */}
          <main className="dual-scanner-main">
            <div className="relative w-full h-full bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
              
              {scanMode === 'barcode' && <div className="barcode-reticle" />}
              
              {/* Ghost Mode Overlay */}
              {isGhostMode && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 border-4 border-purple-500/30 rounded-lg" />
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/80 text-white text-xs font-medium">
                    <Ghost className="h-3 w-3" />
                    Ghost Mode Active
                  </div>
                </div>
              )}
              
              {isRecording && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-bold">
                  ● REC {recordingDuration}s
                </div>
              )}
              
              {isProcessing && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-blue-500/90 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                </div>
              )}
            </div>
          </main>

          {/* FOOTER */}
          <footer className="dual-scanner-footer">
            {/* Controls */}
            <div className="scanner-controls">
              <Button variant="ghost" size="icon" onClick={switchCamera}>
                <FlipHorizontal />
              </Button>
              <Button variant="ghost" size="icon" onClick={triggerFocus}>
                <Focus />
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
                <ImageIcon className="mr-2" />Photo
              </Button>
              <Button
                onClick={() => setScanMode('barcode')}
                variant={scanMode === 'barcode' ? 'secondary' : 'ghost'}
              >
                <ScanLine className="mr-2" />Barcode
              </Button>
              <Button
                onClick={() => setScanMode('video')}
                variant={scanMode === 'video' ? 'secondary' : 'ghost'}
              >
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