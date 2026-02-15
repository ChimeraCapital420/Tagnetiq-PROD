// FILE: src/components/scanner/DualScanner.tsx
// v3.0 — SLIM ORCHESTRATOR
// ~900 lines → ~160 lines. All logic lives in hooks/, all UI in components/.
// Mobile-first: Full viewport camera, device-side compression, haptic feedback
//
// Hook responsibilities:
//   useGhostMode        — Ghost Protocol GPS + store capture
//   useCameraStream     — Camera lifecycle, torch, zoom, flip
//   useCapturedItems    — Item state, selection, compression
//   useGridOverlay      — Composition grid toggle
//   useVideoRecording   — Video capture + frame extraction
//   useAnalysisSubmit   — SSE streaming + fallback + data normalization
//   useFileUpload       — Gallery + document upload handlers
//   useBarcodeScanner   — ZXing barcode detection
//
// Component responsibilities:
//   ScannerHeader       — Top toolbar (ghost, settings, bluetooth, grid, torch, flip, close)
//   ScannerViewport     — Video feed + overlays + recording indicator
//   ScannerFooter       — Capture, analyze, upload, mode toggle, preview grid

import React, { useState, useCallback, useRef } from 'react';
import type { ScanMode, DualScannerProps } from './types';

// Hooks
import {
  useGhostMode,
  useCameraStream,
  useCapturedItems,
  useGridOverlay,
  useVideoRecording,
  useAnalysisSubmit,
  useFileUpload,
  useBarcodeScanner,
} from './hooks';

// Components
import {
  ScannerHeader,
  ScannerViewport,
  ScannerFooter,
  GhostProtocolSheet,
} from './components';

// External components (not yet extracted into scanner module)
import CameraSettingsModal from '../CameraSettingsModal';
import DevicePairingModal from '../DevicePairingModal';

// Styles
import '../DualScanner.css';

// =============================================================================
// MAIN COMPONENT — Pure orchestration, no business logic
// =============================================================================

const DualScanner: React.FC<DualScannerProps> = ({ isOpen, onClose }) => {
  // -------------------------------------------------------------------------
  // LOCAL UI STATE (only what's needed for modal visibility + mode)
  // -------------------------------------------------------------------------
  const [scanMode, setScanMode] = useState<ScanMode>('image');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDevicePairingOpen, setIsDevicePairingOpen] = useState(false);
  const [isGhostSheetOpen, setIsGhostSheetOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // -------------------------------------------------------------------------
  // HOOKS — all logic delegated
  // -------------------------------------------------------------------------
  const ghostMode = useGhostMode();
  const gridOverlay = useGridOverlay();
  const camera = useCameraStream(scanMode === 'video');
  const items = useCapturedItems({ maxItems: 15 });
  const video = useVideoRecording();

  const barcode = useBarcodeScanner({
    deviceId: camera.currentDeviceId,
    enabled: scanMode === 'barcode',
    isOpen,
    isProcessing,
    onDetected: () => onClose(),
  });

  const analysis = useAnalysisSubmit({
    ghostMode,
    onComplete: () => {
      setIsProcessing(false);
      onClose();
    },
    onError: () => {
      setIsProcessing(false);
    },
  });

  const fileUpload = useFileUpload({
    addItem: items.addItem,
    photoCount: items.items.filter((i) => i.type === 'photo').length,
    totalCount: items.totalCount,
  });

  // -------------------------------------------------------------------------
  // CAPTURE HANDLER — captures frame from camera, adds to items
  // -------------------------------------------------------------------------
  const handleCapture = useCallback(async () => {
    if (!camera.videoRef.current || !canvasRef.current) return;

    const videoEl = camera.videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Haptic feedback
    if ('vibrate' in navigator) navigator.vibrate(50);

    await items.addItem({
      type: 'photo',
      data: dataUrl,
      thumbnail: dataUrl,
      name: `Photo ${items.items.filter((i) => i.type === 'photo').length + 1}`,
    });
  }, [camera.videoRef, items]);

  // -------------------------------------------------------------------------
  // ANALYZE HANDLER — delegates to useAnalysisSubmit
  // -------------------------------------------------------------------------
  const handleAnalyze = useCallback(async () => {
    const selected = items.getSelectedItems();
    if (selected.length === 0) return;

    if (ghostMode.isGhostMode && !ghostMode.isReady) {
      setIsGhostSheetOpen(true);
      return;
    }

    setIsProcessing(true);
    await analysis.handleAnalyze(selected);
  }, [items, ghostMode, analysis]);

  // -------------------------------------------------------------------------
  // VIDEO TOGGLE
  // -------------------------------------------------------------------------
  const handleVideoToggle = useCallback(() => {
    if (video.isRecording) {
      video.stopRecording();
    } else {
      video.startRecording();
    }
  }, [video]);

  // -------------------------------------------------------------------------
  // RENDER — no early returns, scanner is a full-screen modal
  // -------------------------------------------------------------------------
  if (!isOpen) return null;

  return (
    <div className="dual-scanner-overlay fixed inset-0 z-50 bg-black flex flex-col">
      <ScannerHeader
        onClose={onClose}
        onGhostToggle={() => setIsGhostSheetOpen(true)}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        onBluetoothOpen={() => setIsDevicePairingOpen(true)}
        onGridToggle={() => gridOverlay.setEnabled(!gridOverlay.isEnabled)}
        onTorchToggle={() => camera.setTorch(!camera.settings.torch)}
        onFlipCamera={camera.switchCamera}
        onFocus={camera.triggerFocus}
        isGhostMode={ghostMode.isGhostMode}
        isGridEnabled={gridOverlay.isEnabled}
        isTorchOn={camera.settings.torch}
        hasTorch={camera.capabilities.torch}
      />

      <ScannerViewport
        videoRef={camera.videoRef}
        canvasRef={canvasRef}
        zxingRef={barcode.zxingRef}
        scanMode={scanMode}
        isCameraActive={camera.isActive}
        isRecording={video.isRecording}
        recordingDuration={video.duration}
        isGhostMode={ghostMode.isGhostMode}
        gridOverlay={{
          isEnabled: gridOverlay.isEnabled,
          type: gridOverlay.type,
          opacity: gridOverlay.opacity,
        }}
      />

      <ScannerFooter
        scanMode={scanMode}
        onScanModeChange={setScanMode}
        onCapture={handleCapture}
        onVideoToggle={handleVideoToggle}
        onAnalyze={handleAnalyze}
        onImageUpload={fileUpload.openImagePicker}
        onDocumentUpload={fileUpload.openDocumentPicker}
        isProcessing={isProcessing}
        isCompressing={items.isCompressing}
        isRecording={video.isRecording}
        isGhostMode={ghostMode.isGhostMode}
        isGhostReady={ghostMode.isReady}
        items={items.items}
        selectedCount={items.selectedCount}
        totalCount={items.totalCount}
        onToggleSelection={items.toggleSelection}
        onRemoveItem={items.removeItem}
      />

      {/* Hidden file inputs */}
      <input
        ref={fileUpload.imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={fileUpload.handleImageUpload}
      />
      <input
        ref={fileUpload.documentInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        multiple
        className="hidden"
        onChange={fileUpload.handleDocumentUpload}
      />

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
        onDeviceChange={(id) => camera.startCamera(id)}
        currentDeviceId={camera.currentDeviceId}
        videoTrack={
          (camera.videoRef.current?.srcObject as MediaStream)
            ?.getVideoTracks()[0] || null
        }
        onSettingsChange={(settings) => {
          if (camera.videoRef.current && settings.filter) {
            camera.videoRef.current.style.filter = settings.filter;
          }
        }}
      />

      <DevicePairingModal
        isOpen={isDevicePairingOpen}
        onClose={() => setIsDevicePairingOpen(false)}
      />
    </div>
  );
};

export default DualScanner;