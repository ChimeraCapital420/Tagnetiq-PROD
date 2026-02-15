// FILE: src/components/scanner/DualScanner.tsx
// v3.4 — ROOT CAUSE FIX: Conditional modal rendering
//
// v3.4: FIX — CameraSettingsModal was always mounted even when closed.
//   Its useCameraControls hook created a SECOND camera stream on mount,
//   competing with useCameraStream → black screen. Now conditionally
//   rendered so the hook only mounts when user opens settings.
// v3.3: cameraStartedRef guard (still present as defense-in-depth)
// v3.2: Healing haptics integration
// v3.1: Camera lifecycle useEffect
// v3.0: Refactored to slim orchestrator
//
// All logic lives in hooks/, all UI in components/.
// Mobile-first: Full viewport camera, device-side compression, haptic feedback

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
  const cameraStartedRef = useRef(false);

  // -------------------------------------------------------------------------
  // HEALING HAPTICS — initialized first, passed to other hooks
  // -------------------------------------------------------------------------
  const haptics = useHealingHaptics({
    tier: 'oracle',
    enabled: true,
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
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      camera.stopCamera();
      cameraStartedRef.current = false;
      return;
    }

    if (scanMode === 'barcode') {
      camera.stopCamera();
      cameraStartedRef.current = false;
      return;
    }

    if (cameraStartedRef.current) {
      return;
    }

    cameraStartedRef.current = true;

    const timer = setTimeout(() => {
      camera.startCamera();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, scanMode]);

  // -------------------------------------------------------------------------
  // CAPTURE HANDLER
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
  // ANALYZE HANDLER
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
  // MODE SWITCH
  // -------------------------------------------------------------------------
  const handleModeChange = useCallback(
    (mode: ScanMode) => {
      cameraStartedRef.current = false;
      setScanMode(mode);
      haptics.tap();
    },
    [haptics]
  );

  // -------------------------------------------------------------------------
  // RENDER
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

      {/* Modals — CONDITIONALLY RENDERED
          v3.4 FIX: CameraSettingsModal was always mounted even when closed.
          Its useCameraControls hook called getUserMedia on mount, creating a
          SECOND camera stream that competed with useCameraStream → black screen.
          Now only mounts when the user actually opens the modal. */}
      <GhostProtocolSheet
        isOpen={isGhostSheetOpen}
        onClose={() => setIsGhostSheetOpen(false)}
        ghostMode={ghostMode}
      />

      {isSettingsOpen && (
        <CameraSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          availableDevices={camera.devices}
          onDeviceChange={(id) => {
            cameraStartedRef.current = false;
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
      )}

      {isDevicePairingOpen && (
        <DevicePairingModal
          isOpen={isDevicePairingOpen}
          onClose={() => setIsDevicePairingOpen(false)}
        />
      )}
    </div>
  );
};

export default DualScanner;