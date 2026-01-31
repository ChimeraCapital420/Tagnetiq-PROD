// FILE: src/hooks/index.ts
// Central export for all custom hooks
// Import from '@/hooks' for cleaner imports

// =============================================================================
// SCANNER HOOKS (Phase 2)
// =============================================================================

export { useCamera } from './scanner/useCamera';
export { useMediaCapture } from './scanner/useMediaCapture';
export { useBarcodeScanner } from './scanner/useBarcodeScanner';
export { useVideoRecording } from './scanner/useVideoRecording';

// =============================================================================
// CAMERA & DEVICE HOOKS (Phase 4)
// =============================================================================

export { useBluetoothManager } from './useBluetoothManager';
export type { 
  BluetoothDevice,
  BluetoothManagerState,
  BluetoothManagerActions,
  UseBluetoothManagerReturn 
} from './useBluetoothManager';

export { useCameraControls } from './useCameraControls';
export type { 
  CameraCapabilities,
  CameraSettings,
  UseCameraControlsReturn 
} from './useCameraControls';

export { useGridOverlay } from './useGridOverlay';
export type { 
  GridType,
  GridSettings,
  UseGridOverlayReturn 
} from './useGridOverlay';

export { useAudioLevel } from './useAudioLevel';
export type {
  AudioLevelData,
  UseAudioLevelReturn
} from './useAudioLevel';