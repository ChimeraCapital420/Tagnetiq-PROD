// FILE: src/components/scanner/DualScanner.tsx
// REFACTORED: Thin orchestrator composing modular hooks and components
// Mobile-first: Full viewport camera, device-side compression, haptic feedback
//
// v2.0 CHANGES:
//   - handleAnalyze now uses /api/analyze-stream (SSE) instead of /api/analyze
//   - Pipes real-time progress events to AppContext.setScanProgress
//   - OracleThinkingOverlay reads these events and renders the thinking experience
//   - Falls back to /api/analyze if streaming fails

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { v4 as uuidv4 } from 'uuid';
import {
  X, FlipHorizontal, Upload, Circle, Zap, Loader2, ScanLine,
  ImageIcon, Video, Settings as SettingsIcon, Focus,
  FileText, Bluetooth, Flashlight, Grid3X3, Ghost
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Modular imports
import type { ScanMode, DualScannerProps, AnalysisRequestPayload } from './types';
import { useGhostMode, useCameraStream, useCapturedItems, useGridOverlay, useVideoRecording } from './hooks';
import { GridOverlay, GhostProtocolSheet, CapturePreviewGrid } from './components';
import { compressImage } from './utils/compression';

// External components
import CameraSettingsModal from '../CameraSettingsModal';
import DevicePairingModal from '../DevicePairingModal';

// Types for scan progress
import type { ScanProgress, ScanProgressModel } from '@/contexts/AppContext';

// Styles
import '../DualScanner.css';

// =============================================================================
// SSE STREAM PARSER — Reads Server-Sent Events from analyze-stream
// =============================================================================

interface SSEEvent {
  type: string;
  timestamp: number;
  data: any;
}

/**
 * Reads the SSE response body and calls onEvent for each parsed event.
 * Returns when the stream ends or errors.
 */
async function readSSEStream(
  response: Response,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            onEvent(event);
          } catch {
            // Skip malformed events
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const DualScanner: React.FC<DualScannerProps> = ({ isOpen, onClose }) => {
  const {
    setLastAnalysisResult,
    setIsAnalyzing,
    selectedCategory,
    setScanProgress,
  } = useAppContext();
  const { session } = useAuth();

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const [scanMode, setScanMode] = useState<ScanMode>('image');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDevicePairingOpen, setIsDevicePairingOpen] = useState(false);
  const [isGhostSheetOpen, setIsGhostSheetOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ---------------------------------------------------------------------------
  // HOOKS
  // ---------------------------------------------------------------------------
  const ghostMode = useGhostMode();
  const gridOverlay = useGridOverlay();
  const camera = useCameraStream(scanMode === 'video');
  const items = useCapturedItems({ maxItems: 15 });
  const video = useVideoRecording();

  // ---------------------------------------------------------------------------
  // BARCODE SCANNER
  // ---------------------------------------------------------------------------
  const { ref: zxingRef } = useZxing({
    deviceId: camera.currentDeviceId,
    onResult(result) {
      if (scanMode === 'barcode' && !isProcessing) {
        handleBarcodeDetected(result.getText());
      }
    },
    paused: scanMode !== 'barcode' || !isOpen || isProcessing,
  });

  const handleBarcodeDetected = useCallback((barcode: string) => {
    setIsProcessing(true);

    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]);
    }

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
      tags: ['barcode']
    });
    setIsAnalyzing(true);
    onClose();
  }, [setLastAnalysisResult, setIsAnalyzing, onClose]);

  // ---------------------------------------------------------------------------
  // IMAGE CAPTURE
  // ---------------------------------------------------------------------------
  const captureImage = useCallback(async () => {
    if (!camera.videoRef.current || !canvasRef.current) return;

    const videoEl = camera.videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      await items.addItem({
        type: 'photo',
        data: dataUrl,
        thumbnail: dataUrl,
        name: `Photo ${items.items.filter(i => i.type === 'photo').length + 1}`
      });
    }
  }, [camera.videoRef, items]);

  // ---------------------------------------------------------------------------
  // VIDEO RECORDING
  // ---------------------------------------------------------------------------
  const handleVideoToggle = useCallback(async () => {
    if (video.isRecording) {
      const result = await video.stopRecording();
      if (result) {
        await items.addItem({
          type: 'video',
          data: result.videoUrl,
          thumbnail: result.thumbnail,
          name: `Video ${items.items.filter(i => i.type === 'video').length + 1}`,
          metadata: { videoFrames: result.frames }
        });
      }
    } else if (camera.stream) {
      video.startRecording(camera.stream);
    }
  }, [video, camera.stream, items]);

  // ---------------------------------------------------------------------------
  // FILE UPLOADS
  // ---------------------------------------------------------------------------
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          const dataUrl = e.target.result as string;
          await items.addItem({
            type: 'photo',
            data: dataUrl,
            thumbnail: dataUrl,
            name: file.name || `Upload ${items.items.filter(i => i.type === 'photo').length + 1}`
          });
        }
      };
      reader.readAsDataURL(file);
    }
    if (event.target) event.target.value = '';
  }, [items]);

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
          const thumbnail = canvas.toDataURL('image/png');

          const fileName = file.name.toLowerCase();
          let documentType: 'certificate' | 'grading' | 'appraisal' | 'receipt' | 'authenticity' | 'other' = 'other';
          if (fileName.includes('certificate') || fileName.includes('cert')) documentType = 'certificate';
          else if (fileName.includes('grade') || fileName.includes('psa') || fileName.includes('bgs')) documentType = 'grading';
          else if (fileName.includes('appraisal')) documentType = 'appraisal';
          else if (fileName.includes('receipt') || fileName.includes('invoice')) documentType = 'receipt';
          else if (fileName.includes('authentic') || fileName.includes('coa')) documentType = 'authenticity';

          await items.addItem({
            type: 'document',
            data: dataUrl,
            thumbnail,
            name: file.name,
            metadata: { documentType, description: `${documentType} document` }
          });

          toast.success(`Document: ${documentType}`);
        }
      };
      reader.readAsDataURL(file);
    }
    if (event.target) event.target.value = '';
  }, [items]);

  // ---------------------------------------------------------------------------
  // SSE EVENT HANDLER — Maps stream events to scanProgress state
  // ---------------------------------------------------------------------------
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'init':
        setScanProgress({
          stage: 'identifying',
          message: 'Initializing analysis engine...',
          aiModels: (event.data.models || []).map((m: any) => ({
            name: m.name,
            icon: m.icon,
            color: m.color,
            status: 'waiting' as const,
          })),
          modelsComplete: 0,
          modelsTotal: event.data.totalModels || 7,
          currentEstimate: 0,
          confidence: 0,
          category: null,
          marketApis: [],
        });
        break;

      case 'phase':
        setScanProgress(prev => {
          if (!prev) return prev;
          const stageMap: Record<string, ScanProgress['stage']> = {
            ai: 'ai_consensus',
            market: 'market_data',
            finalizing: 'finalizing',
          };
          return {
            ...prev,
            stage: stageMap[event.data.phase] || prev.stage,
            message: event.data.message || prev.message,
            marketApis: event.data.apis || prev.marketApis,
          };
        });
        break;

      case 'ai_start':
        setScanProgress(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            stage: 'ai_consensus',
            aiModels: prev.aiModels.map(m =>
              m.name === event.data.model ? { ...m, status: 'thinking' as const } : m
            ),
          };
        });
        break;

      case 'ai_complete':
        setScanProgress(prev => {
          if (!prev) return prev;
          const modelName = event.data.model;
          const newModels = prev.aiModels.map(m =>
            m.name === modelName
              ? {
                  ...m,
                  status: (event.data.success ? 'complete' : 'error') as 'complete' | 'error',
                  estimate: event.data.estimate,
                }
              : m
          );
          return {
            ...prev,
            aiModels: newModels,
            modelsComplete: newModels.filter(m => m.status === 'complete' || m.status === 'error').length,
          };
        });
        break;

      case 'price':
        setScanProgress(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            currentEstimate: event.data.estimate || prev.currentEstimate,
            confidence: event.data.confidence || prev.confidence,
          };
        });
        break;

      case 'category':
        setScanProgress(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            category: event.data.displayName || event.data.category || null,
          };
        });
        break;

      case 'api_start':
        setScanProgress(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            stage: 'market_data',
            message: `Checking ${event.data.api}...`,
          };
        });
        break;

      case 'api_complete':
        setScanProgress(prev => {
          if (!prev) return prev;
          const msg = event.data.success
            ? `${event.data.api}: ${event.data.listings || 0} listings found`
            : prev.message;
          return { ...prev, message: msg };
        });
        break;

      case 'complete':
        setScanProgress(prev => prev ? { ...prev, stage: 'complete', message: 'Analysis complete' } : prev);
        break;

      case 'error':
        setScanProgress(prev => prev ? {
          ...prev,
          stage: 'error',
          message: event.data.message || 'Analysis failed',
          error: event.data.message,
        } : prev);
        break;
    }
  }, [setScanProgress]);

  // ---------------------------------------------------------------------------
  // ANALYSIS SUBMISSION — Now uses SSE streaming with fallback
  // ---------------------------------------------------------------------------
  const handleAnalyze = useCallback(async () => {
    const selectedItems = items.getSelectedItems();

    if (selectedItems.length === 0) {
      toast.error('Select at least one item');
      return;
    }

    if (!session?.access_token || !session?.user?.id) {
      toast.error('Please sign in');
      return;
    }

    if (ghostMode.isGhostMode && !ghostMode.isReady) {
      toast.error('Complete ghost listing details', {
        description: 'Enter store name and shelf price',
      });
      setIsGhostSheetOpen(true);
      return;
    }

    // Abort any previous analysis
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsProcessing(true);
    setIsAnalyzing(true);

    // Initialize scan progress immediately
    setScanProgress({
      stage: 'preparing',
      message: ghostMode.isGhostMode
        ? '👻 Preparing ghost analysis...'
        : `Preparing ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''} for analysis...`,
      aiModels: [],
      modelsComplete: 0,
      modelsTotal: 7,
      currentEstimate: 0,
      confidence: 0,
      category: null,
      marketApis: [],
    });

    // Close scanner — the OracleThinkingOverlay will render in its place
    onClose();

    try {
      // Prepare items for analysis
      const analysisItems = await Promise.all(selectedItems.map(async (item) => {
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
            documentType: item.metadata?.documentType,
            extractedText: item.metadata?.extractedText || '',
            barcodes: item.metadata?.barcodes || [],
          }
        };
      }));

      const requestPayload: AnalysisRequestPayload = {
        scanType: 'multi-modal',
        items: analysisItems,
        category_id: selectedCategory?.split('-')[0] || 'general',
        subcategory_id: selectedCategory || 'general',
        originalImageUrls: items.getOriginalUrls(),
      };

      // Add ghost data if enabled
      if (ghostMode.isGhostMode && ghostMode.location && ghostMode.storeInfo) {
        requestPayload.ghostMode = {
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

      // =====================================================================
      // ATTEMPT STREAMING ANALYSIS (SSE)
      // Falls back to standard /api/analyze if streaming fails
      // =====================================================================
      let analysisResult: any = null;
      let usedStreaming = false;

      try {
        const streamResponse = await fetch('/api/analyze-stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestPayload),
          signal: abortRef.current.signal,
        });

        if (streamResponse.ok && streamResponse.body) {
          usedStreaming = true;

          // Read the SSE stream — each event updates scanProgress
          await readSSEStream(
            streamResponse,
            (event) => {
              handleSSEEvent(event);

              // Capture the final result from the 'complete' event
              if (event.type === 'complete') {
                analysisResult = event.data;
              }
            },
            abortRef.current.signal
          );
        }
      } catch (streamError: any) {
        if (streamError.name === 'AbortError') throw streamError;
        console.warn('Streaming failed, falling back to standard analysis:', streamError.message);
      }

      // Fallback: If streaming didn't produce a result, use standard endpoint
      if (!analysisResult) {
        setScanProgress(prev => prev ? {
          ...prev,
          stage: 'ai_consensus',
          message: 'Analyzing your item...',
        } : prev);

        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestPayload),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 413 || errorText.includes('PAYLOAD_TOO_LARGE')) {
            throw new Error('Image too large. Try a smaller image.');
          }
          throw new Error(`Analysis failed: ${response.status}`);
        }

        analysisResult = await response.json();
      }

      // Build ghost data for result
      const ghostData = ghostMode.isGhostMode
        ? ghostMode.buildGhostData(analysisResult.estimatedValue || 0)
        : null;

      // Signal completion
      setScanProgress(prev => prev ? { ...prev, stage: 'complete', message: 'Analysis complete' } : prev);

      // Small delay so user sees the "complete" state
      await new Promise(resolve => setTimeout(resolve, 400));

      setLastAnalysisResult({
        ...analysisResult,
        id: analysisResult.id || uuidv4(),
        imageUrls: requestPayload.originalImageUrls?.length
          ? requestPayload.originalImageUrls
          : selectedItems.map(item => item.thumbnail),
        ghostData: ghostData || undefined,
      });

      if (ghostMode.isGhostMode && ghostData) {
        const margin = ghostData.kpis.estimated_margin;
        toast.success('👻 Ghost Analysis Complete!', {
          description: `Potential profit: $${margin.toFixed(2)} (${ghostData.kpis.velocity_score} velocity)`,
        });
      }
      // No toast for regular analysis — the result appearing IS the feedback

    } catch (error: any) {
      if (error.name === 'AbortError') return; // User navigated away

      console.error('Analysis error:', error);
      setScanProgress(prev => prev ? {
        ...prev,
        stage: 'error',
        message: error.message || 'Analysis failed',
        error: error.message,
      } : prev);

      // Give user time to see the error before clearing
      await new Promise(resolve => setTimeout(resolve, 2000));

      setLastAnalysisResult(null);
      toast.error('Analysis Failed', { description: error.message });
    } finally {
      setIsProcessing(false);
      setIsAnalyzing(false);
    }
  }, [items, session, ghostMode, selectedCategory, onClose, setIsAnalyzing, setLastAnalysisResult, setScanProgress, handleSSEEvent]);

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      camera.startCamera();
    } else {
      camera.stopCamera();
      if (ghostMode.isGhostMode) {
        ghostMode.toggleGhostMode(false);
      }
    }
    return () => camera.stopCamera();
  }, [isOpen]);

  // Abort analysis if scanner reopens or component unmounts
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Connect zxing ref to video element
  useEffect(() => {
    if (zxingRef && camera.videoRef.current) {
      (zxingRef as React.MutableRefObject<HTMLVideoElement | null>).current = camera.videoRef.current;
    }
  }, [zxingRef, camera.videoRef]);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  if (!isOpen) return null;

  return (
    <>
      <div className="dual-scanner-overlay" onClick={onClose}>
        <div className="dual-scanner-content" onClick={e => e.stopPropagation()}>
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* HEADER */}
          <header className="dual-scanner-header">
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} className="touch-manipulation h-10 w-10">
                <SettingsIcon className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsDevicePairingOpen(true)} className="touch-manipulation h-10 w-10">
                <Bluetooth className="w-5 h-5" />
              </Button>
              <Button
                variant={ghostMode.isGhostMode ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setIsGhostSheetOpen(true)}
                className={`touch-manipulation h-10 w-10 ${ghostMode.isGhostMode ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
              >
                <Ghost className={`w-5 h-5 ${ghostMode.isGhostMode ? 'animate-pulse' : ''}`} />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {ghostMode.isGhostMode && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                  <Ghost className="h-3 w-3 text-purple-400 animate-pulse" />
                  <span className="text-[10px] text-purple-300 font-medium">GHOST</span>
                </div>
              )}
              <span className="text-sm text-muted-foreground">{items.selectedCount}/{items.totalCount}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => gridOverlay.toggle()}
                className={`p-2 rounded-full transition-all touch-manipulation ${
                  gridOverlay.settings.enabled ? 'bg-white/20 text-white' : 'text-white/70'
                }`}
              >
                <Grid3X3 className="w-5 h-5" />
              </button>

              {camera.capabilities.torch && (
                <button
                  onClick={() => camera.setTorch(!camera.settings.torch)}
                  className={`p-2 rounded-full transition-all touch-manipulation ${
                    camera.settings.torch ? 'bg-yellow-500 text-black' : 'text-white/70'
                  }`}
                >
                  <Flashlight className="w-5 h-5" />
                </button>
              )}

              <Button variant="destructive" size="icon" onClick={onClose} className="touch-manipulation h-10 w-10 ml-1">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </header>

          {/* MAIN VIDEO AREA */}
          <main className="dual-scanner-main">
            <div className="relative w-full h-full bg-black">
              <video
                ref={camera.videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              <GridOverlay
                width={camera.videoRef.current?.clientWidth || 0}
                height={camera.videoRef.current?.clientHeight || 0}
                enabled={gridOverlay.settings.enabled}
                type={gridOverlay.settings.type}
                opacity={gridOverlay.settings.opacity}
                color={gridOverlay.settings.color}
              />

              {scanMode === 'barcode' && <div className="barcode-reticle" />}

              {ghostMode.isGhostMode && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-2 border-2 border-purple-500/50 rounded-lg" />
                </div>
              )}

              {video.isRecording && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full" />
                  REC {video.duration}s
                </div>
              )}

              {(isProcessing || items.isCompressing) && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-blue-500/90 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                </div>
              )}
            </div>
          </main>

          {/* FOOTER */}
          <footer className="dual-scanner-footer">
            <div className="scanner-controls">
              <Button variant="ghost" size="icon" onClick={camera.switchCamera} className="touch-manipulation h-11 w-11">
                <FlipHorizontal className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={camera.triggerFocus} className="touch-manipulation h-11 w-11">
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
            </div>

            {/* Capture Button */}
            {scanMode === 'image' && (
              <div className="relative flex items-center justify-center py-2">
                <Button
                  onClick={captureImage}
                  className={`capture-button touch-manipulation ${ghostMode.isGhostMode ? 'ring-4 ring-purple-500/50' : ''}`}
                  size="icon"
                  disabled={isProcessing || items.isCompressing || items.totalCount >= 15}
                >
                  <Circle className="w-16 h-16 fill-white" />
                </Button>
              </div>
            )}

            {scanMode === 'video' && (
              <div className="relative flex items-center justify-center py-2">
                <Button
                  onClick={handleVideoToggle}
                  className="capture-button touch-manipulation"
                  size="icon"
                  disabled={isProcessing}
                  style={{ backgroundColor: video.isRecording ? '#ef4444' : 'transparent' }}
                >
                  <Circle className="w-16 h-16 fill-white" />
                </Button>
              </div>
            )}

            {/* Analyze Button */}
            {items.selectedCount > 0 && (
              <div className="absolute right-3 bottom-44 z-10">
                <Button
                  onClick={handleAnalyze}
                  disabled={isProcessing || items.isCompressing || (ghostMode.isGhostMode && !ghostMode.isReady)}
                  size="lg"
                  className={`touch-manipulation shadow-xl ${
                    ghostMode.isGhostMode
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700'
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                  }`}
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin mr-1.5 h-4 w-4" />
                  ) : ghostMode.isGhostMode ? (
                    <Ghost className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Zap className="mr-1.5 h-4 w-4" />
                  )}
                  {ghostMode.isGhostMode ? `👻 Ghost ${items.selectedCount}` : `Analyze ${items.selectedCount}`}
                </Button>
              </div>
            )}

            <CapturePreviewGrid
              items={items.items}
              onToggleSelection={items.toggleSelection}
              onRemove={items.removeItem}
            />

            {/* Mode Toggle */}
            <div className="mode-toggle">
              <Button onClick={() => setScanMode('image')} variant={scanMode === 'image' ? 'secondary' : 'ghost'} className="touch-manipulation">
                <ImageIcon className="mr-1 w-4 h-4" />Photo
              </Button>
              <Button onClick={() => setScanMode('barcode')} variant={scanMode === 'barcode' ? 'secondary' : 'ghost'} className="touch-manipulation">
                <ScanLine className="mr-1 w-4 h-4" />Barcode
              </Button>
              <Button onClick={() => setScanMode('video')} variant={scanMode === 'video' ? 'secondary' : 'ghost'} className="touch-manipulation">
                <Video className="mr-1 w-4 h-4" />Video
              </Button>
            </div>
          </footer>
        </div>
      </div>

      {/* Modals */}
      <GhostProtocolSheet
        isOpen={isGhostSheetOpen}
        onClose={() => setIsGhostSheetOpen(false)}
        ghostMode={ghostMode}
      />

      <CameraSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        availableDevices={camera.devices}
        currentDeviceId={camera.currentDeviceId}
        onDeviceChange={(id) => camera.startCamera(id)}
      />

      <DevicePairingModal
        isOpen={isDevicePairingOpen}
        onClose={() => setIsDevicePairingOpen(false)}
        onDeviceConnected={() => setIsDevicePairingOpen(false)}
      />
    </>
  );
};

export default DualScanner;