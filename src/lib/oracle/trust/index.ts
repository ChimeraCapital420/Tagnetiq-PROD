// FILE: src/lib/oracle/trust/index.ts
// ═══════════════════════════════════════════════════════════════════════
// Trust Module — Barrel Exports
// ═══════════════════════════════════════════════════════════════════════
//
// Single import point for all trust-related utilities.
// Import from here, not from individual files directly.
//
// Usage:
//   import { calculateTrustLevel, type TrustLevel } from '@/lib/oracle/trust';
// ═══════════════════════════════════════════════════════════════════════

export {
  calculateTrustLevel,
  type TrustLevel,
  type TrustProfile,
  type TrustResult,
} from './trust-level.js';

export {
  analyzeSignals,
  recordPause,
  recordNavigation,
  emptySignals,
  type RawSignals,
  type SignalAnalysis,
} from './behavioral-signals.js';

export {
  NAVIGATION_MAP,
  getNavInstructions,
  type NavDestination,
} from './navigation-map.js';

export {
  GUIDANCE_STEPS,
  getNextGuidanceStep,
  markStepShown,
  type GuidanceStep,
} from './guidance-config.js';