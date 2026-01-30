// FILE: src/components/scanner/DualScanner.tsx
// Refactored multi-modal scanner - thin orchestrator using modular hooks
// Original quality preserved for marketplace, compressed for AI analysis

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import {
  X, FlipHorizontal, Upload, Circle, Zap, Loader2, ScanLine,
  ImageIcon, Video, Settings as SettingsIcon, Focus, FileText, Bluetooth,
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

  // File inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

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
  // ANALYSIS
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

    setIsProcessing(true);
    setIsAnalyzing(true);
    onClose();
    toast.info(`Analyzing ${selectedCount} items...`);

    try {
      // Get compressed data for AI (originals stay in storage for marketplace)
      const analysisPayload = getAnalysisPayload();
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          scanType: 'multi-modal',
          items: analysisPayload,
          category_id: selectedCategory?.split('-')[0] || 'general',
          subcategory_id: selectedCategory || 'general',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 413 || errorText.includes('PAYLOAD_TOO_LARGE')) {
          throw new Error('Images still too large. Please try with fewer items.');
        }
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const result: AnalysisResult = await response.json();
      
      // Include original URLs for marketplace uploads
      const originalUrls = getOriginalUrls();
      
      setLastAnalysisResult({
        ...result,
        id: uuidv4(),
        imageUrls: originalUrls, // Full quality for marketplace!
      });
      
      toast.success('Analysis complete!');
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
            </div>
            
            <div className="flex items-center gap-2">
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
                  className="capture-button"
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
                  disabled={isProcessing}
                  size="lg"
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin mr-2" />
                  ) : (
                    <Zap className="mr-2" />
                  )}
                  AI Analyze {selectedCount} Item{selectedCount > 1 ? 's' : ''}
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