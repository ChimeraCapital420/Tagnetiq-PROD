// FILE: src/lib/boardroom/index.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARDROOM MODULE — Barrel Exports
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint M: AI DNA + evolution
// Sprint P: Autonomous actions
// Phase 0: Memory, energy, cross-board awareness
// Sprint 2: Voice personality (energy-aware voice adjustments)
// Sprint 4: Personality evolution (voice signature, catchphrases,
//           cross-member opinions, inside references, rollback)
//
// ═══════════════════════════════════════════════════════════════════════
// BREAKING CHANGE LOG (Phase 0):
//
// ❌ REMOVED: buildBoardMemberPrompt
//    Was: export { buildBoardMemberPrompt } from './evolution.js'
//    Now: SERVER-ONLY at api/boardroom/lib/prompt-builder.ts
//    Why: Prompt building now requires memory, energy, and cross-board
//         feed data that only the server has. Client code calls the
//         chat API endpoint — it should never build prompts directly.
//
//    If an API route imported buildBoardMemberPrompt from here, update:
//      import { buildBoardMemberPrompt } from './lib/prompt-builder.js';
//    (relative to your api/boardroom/ directory)
//
// ═══════════════════════════════════════════════════════════════════════

// ── Evolution (DNA, trust, cross-domain, topic detection) ────────────
export {
  type BoardMember,
  type InteractionResult,
  type InteractionOutcome,
  evolveBoarDna,
  evolveBoardAfterMeeting,
  recordInteractionOutcome,
  isCrossDomain,
  detectTopicCategory,
  getTrustTier,
  getTrustDescription,
  DNA_TRAITS,
} from './evolution.js';

// ── Sprint 4: Personality Evolution ──────────────────────────────────
export {
  type PersonalityEvolutionData,
  type EvolutionHistoryEntry,
  evolvePersonality,
  getEvolutionHistory,
  rollbackPersonality,
} from './evolution.js';

// ── Energy Detection (pure functions — safe for client AND server) ───
export {
  type EnergyLevel,
  type EnergyArc,
  detectEnergy,
  detectEnergyArc,
  getEnergyGuidance,
} from './energy.js';

// ── Voice Personality (Sprint 2 — energy-aware voice adjustments) ────
export {
  type VoiceAdjustments,
  type MergedVoiceSettings,
  getVoiceAdjustments,
  mergeVoiceSettings,
  getEnergyAwareVoiceSettings,
} from './voice-personality.js';

// ── Founder Memory Types (safe for client — read-only types) ─────────
export type {
  FounderDetail,
  CompressedMemory,
  BoardActivityEntry,
  FounderMemoryState,
} from './memory/founder-memory.js';

// ── Autonomous Actions ───────────────────────────────────────────────
export {
  type ActionStatus,
  type ImpactLevel,
  type ActionType,
  type ProposeActionParams,
  type ActionResult,
  type ActionExecution,
  proposeAction,
  approveAction,
  rejectAction,
  getPendingActions,
  getMemberActions,
  getActionStats,
} from './actions.js';