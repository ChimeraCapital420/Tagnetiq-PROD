// FILE: src/components/scanner/components/ScannerViewport.tsx
// Extracted from DualScanner.tsx — main camera viewport area
// Mobile-first: Full viewport video, CSS overlays only (no JS animation loops)

import React from 'react';
import { ScanLine, Video } from 'lucide-react';
import { GridOverlay } from './GridOverlay';
import type { ScanMode } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface ScannerViewportProps {
  /** Camera video ref */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Hidden canvas for capture */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Barcode scanner video ref (separate from main camera) */
  zxingRef?: React.RefObject<HTMLVideoElement>;
  /** Current scan mode */
  scanMode: ScanMode;
  /** Camera is active */
  isCameraActive: boolean;
  /** Currently recording video */
  isRecording: boolean;
  /** Recording duration in seconds */
  recordingDuration: number;
  /** Ghost mode active */
  isGhostMode: boolean;
  /** Grid overlay settings */
  gridOverlay: {
    isEnabled: boolean;
    type: string;
    opacity: number;
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export const ScannerViewport: React.FC<ScannerViewportProps> = ({
  videoRef,
  canvasRef,
  zxingRef,
  scanMode,
  isCameraActive,
  isRecording,
  recordingDuration,
  isGhostMode,
  gridOverlay,
}) => {
  return (
    <div className="dual-scanner-main relative flex-1 overflow-hidden bg-black">
      {/* Main camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: isCameraActive ? 'block' : 'none' }}
      />

      {/* Hidden barcode scanner video (zxing needs its own element) */}
      {scanMode === 'barcode' && zxingRef && (
        <video
          ref={zxingRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Grid overlay */}
      {gridOverlay.isEnabled && (
        <GridOverlay
          type={gridOverlay.type as any}
          opacity={gridOverlay.opacity}
        />
      )}

      {/* Barcode scan line animation */}
      {scanMode === 'barcode' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="relative w-64 h-64 border-2 border-green-400/60 rounded-lg">
            <div className="barcode-scan-line absolute left-0 right-0 h-0.5 bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
            <ScanLine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-green-400/40" />
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-red-600/90 text-white px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm">
          <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
          <Video className="w-4 h-4" />
          <span>{recordingDuration}s</span>
        </div>
      )}

      {/* Ghost mode banner */}
      {isGhostMode && (
        <div className="absolute top-14 right-3 z-20 bg-purple-600/80 text-white px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm flex items-center gap-1">
          👻 Ghost Mode
        </div>
      )}

      {/* Camera loading state */}
      {!isCameraActive && scanMode !== 'barcode' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center text-gray-400">
            <div className="w-12 h-12 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Starting camera...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScannerViewport;