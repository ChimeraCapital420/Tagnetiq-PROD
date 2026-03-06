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

// =============================================================================
// GHOST PROTOCOL HOOKS (Phase 5)
// =============================================================================

export { useGhostMode, STORE_TYPES } from './useGhostMode';
export type { 
  GhostLocation, 
  StoreInfo, 
  StoreType, 
  GhostData, 
  GhostModeState 
} from './useGhostMode';

// =============================================================================
// ORACLE HOOKS
// =============================================================================

// Oracle Voice — TTS output for the user's AI partner.
// Each user names their Oracle through learning (e.g. "Dash").
// This hook is name-agnostic — it knows nothing about that name.
export { useOracleVoice } from './useOracleVoice';