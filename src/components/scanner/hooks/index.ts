// FILE: src/components/scanner/hooks/index.ts
// Export all scanner hooks — existing + newly extracted

// Healing haptics — tier-aware feedback synced to SSE events (NEW v3.2)
export { useHealingHaptics } from './useHealingHaptics';
export type { HapticTier, UseHealingHapticsOptions, UseHealingHapticsReturn } from './useHealingHaptics';

// Existing hooks (already extracted)
export { useGhostMode } from './useGhostMode';
export type { UseGhostModeReturn } from './useGhostMode';

export { useCameraStream } from './useCameraStream';
export type { UseCameraStreamOptions, UseCameraStreamReturn } from './useCameraStream';

export { useCapturedItems } from './useCapturedItems';
export type { UseCapturedItemsReturn, UseCapturedItemsOptions } from './useCapturedItems';

export { useGridOverlay } from './useGridOverlay';
export type { UseGridOverlayReturn } from './useGridOverlay';

export { useVideoRecording } from './useVideoRecording';
export type { UseVideoRecordingReturn, VideoRecordingResult } from './useVideoRecording';

// NEW — extracted from DualScanner.tsx
export { useAnalysisSubmit } from './useAnalysisSubmit';
export type { UseAnalysisSubmitReturn, UseAnalysisSubmitOptions } from './useAnalysisSubmit';

export { useFileUpload } from './useFileUpload';
export type { UseFileUploadReturn, UseFileUploadOptions } from './useFileUpload';

export { useBarcodeScanner } from './useBarcodeScanner';
export type { UseBarcodeScannerReturn, UseBarcodeScannerOptions } from './useBarcodeScanner';