// FILE: src/components/index.ts
// Central export for scanner-related components
// Import from '@/components' for cleaner imports

// =============================================================================
// SCANNER COMPONENTS
// =============================================================================

export { default as DualScanner } from './DualScanner';

// =============================================================================
// CAMERA UI COMPONENTS (Phase 4)
// =============================================================================

export { default as CameraSettingsModal } from './CameraSettingsModal';
export { default as DevicePairingModal } from './DevicePairingModal';

// Grid overlay components
export { 
  default as GridOverlay,
  GridOverlay as GridOverlayControlled,
  GridOverlayWithHook,
  GridToggleButton 
} from './GridOverlay';

// Audio monitoring components
export {
  default as AudioLevelMeter,
  AudioLevelMeter as AudioMeter,
  FloatingAudioMeter
} from './AudioLevelMeter';