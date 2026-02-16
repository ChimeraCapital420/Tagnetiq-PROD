// FILE: src/lib/oracle/personality/index.ts
// Sprint N: Added new energy exports while keeping backward compatibility
// detectUserEnergy is aliased to detectEnergy for existing callers

export { evolvePersonality } from './evolution.js';

// ── Energy (Sprint N: enhanced) ─────────────────────────
// Backward-compatible alias: old code calls detectUserEnergy, new code calls detectEnergy
export { detectEnergy as detectUserEnergy, detectEnergy } from './energy.js';
export { detectEnergyArc, detectExpertiseFromMessage } from './energy.js';

// Legacy type alias — old code imported UserEnergy, new code uses EnergyLevel from types
export type { EnergyLevel as UserEnergy } from '../../../components/oracle/types.js';
