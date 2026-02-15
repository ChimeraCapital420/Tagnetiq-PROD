// FILE: src/components/scanner/DualScanner.tsx
// v3.3 — CAMERA DOUBLE-START FIX
//
// v3.0: Refactored ~900 → ~160 lines (black screen bug — no startCamera call)
// v3.1: Added camera lifecycle useEffect (fixed black screen)
// v3.2: Healing haptics integration — tier-aware feedback on every interaction
// v3.3: FIX — camera starting twice (two streams competing → black screen)
//   Root cause: useEffect fired, startCamera() completes + sets state,
//   state change triggers re-render, effect runs again → second stream.
//   Fix: cameraStartedRef tracks intent, skips redundant starts.
//
// All logic lives in hooks/, all UI in components/.
// Mobile-first: Full viewport camera, device-side compression, haptic feedback
//
// Hook responsibilities:
//   useHealingHaptics   — Tier-aware haptic feedback (NEW)
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

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ScanMode, DualScannerProps } from './types';

// Hooks
import {
  useHealingHaptics,
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

  // v3.3: Track camera start intent to prevent double-start
  // This persists across re-renders and effect re-fires
  const cameraStartedRef = useRef(false);

  // -------------------------------------------------------------------------
  // HEALING HAPTICS — initialized first, passed to other hooks
  //
  // During BETA_MODE (tier.ts), everyone is 'elite' → gets Oracle-tier haptics.
  // When tier gating goes live, read the real tier from AuthContext/AppContext.
  // TODO: Wire to real user tier when BETA_MODE = false
  // -------------------------------------------------------------------------
  const haptics = useHealingHaptics({
    tier: 'oracle',   // Beta: everyone gets the full experience
    enabled: true,     // TODO: User preference toggle in settings
  });

  // -------------------------------------------------------------------------
  // HOOKS — all logic delegated, haptics passed to hooks that need it
  // -------------------------------------------------------------------------
  const ghostMode = useGhostMode();
  const gridOverlay = useGridOverlay();

  const camera = useCameraStream({
    includeAudio: scanMode === 'video',
    haptics,
  });

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
    haptics,
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
  // CAMERA LIFECYCLE — start on open, stop on close
  //
  // v3.3 FIX: cameraStartedRef prevents the effect from starting the camera
  // more than once per open/mode-change cycle. Without this, state changes
  // from startCamera() (setIsActive, setDevices, setCapabilities) could
  // trigger re-renders that re-fire this effect → two competing streams
  // → black screen.
  //
  // Three modes, two camera systems:
  //   image/video → useCameraStream (our hook) controls the <video> element
  //   barcode     → useZxing controls its own <video> via zxingRef
  //
  // When switching TO barcode: stop our camera (save battery, avoid conflicts)
  // When switching FROM barcode: start our camera
  // When closing: stop our camera (useZxing pauses itself via its `paused` prop)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      camera.stopCamera();
      cameraStartedRef.current = false;
      return;
    }

    // Barcode mode: useZxing manages its own stream via zxingRef
    // Stop our camera to free the hardware + save battery
    if (scanMode === 'barcode') {
      camera.stopCamera();
      cameraStartedRef.current = false;
      return;
    }

    // v3.3: Already started for this mode? Skip.
    // This prevents the double-start that causes black screen.
    if (cameraStartedRef.current) {
      return;
    }

    // Mark as started BEFORE the timeout fires
    // This blocks any re-render-triggered re-fires during the 100ms wait
    cameraStartedRef.current = true;

    // Image or Video mode: we need our camera stream
    // Small delay lets the DOM mount the <video> element first
    const timer = setTimeout(() => {
      camera.startCamera();
    }, 100);

    return () => {
      clearTimeout(timer);
      // Don't reset cameraStartedRef here — the cleanup fires on every
      // re-render, which would defeat the purpose of the guard.
      // It's only reset on close or mode switch to barcode.
    };
  }, [isOpen, scanMode]);
  // NOTE: intentionally omitting camera from deps — startCamera/stopCamera
  // are stable refs but including camera object would cause infinite loop

  // -------------------------------------------------------------------------
  // CAPTURE HANDLER — captures frame from camera, adds to items
  // Haptics: fires capture() instead of inline navigator.vibrate()
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

    // Haptic feedback — tier-aware via hook
    if (ghostMode.isGhostMode) {
      haptics.ghostCapture();
    } else {
      haptics.capture();
    }

    await items.addItem({
      type: 'photo',
      data: dataUrl,
      thumbnail: dataUrl,
      name: `Photo ${items.items.filter((i) => i.type === 'photo').length + 1}`,
    });
  }, [camera.videoRef, items, ghostMode.isGhostMode, haptics]);

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
    haptics.tap();
  }, [video, haptics]);

  // -------------------------------------------------------------------------
  // MODE SWITCH — with haptic tap
  // v3.3: Reset cameraStartedRef so the effect will start camera for new mode
  // -------------------------------------------------------------------------
  const handleModeChange = useCallback(
    (mode: ScanMode) => {
      // Reset the guard so the useEffect will fire startCamera for the new mode
      cameraStartedRef.current = false;
      setScanMode(mode);
      haptics.tap();
    },
    [haptics]
  );

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
        onScanModeChange={handleModeChange}
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
        onDeviceChange={(id) => {
          cameraStartedRef.current = false; // Allow restart with new device
          camera.startCamera(id);
        }}
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