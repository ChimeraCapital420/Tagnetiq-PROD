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
// Sprint 8: Cognitive Bridge (Oracle ↔ Board shared engine)
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

// ═══════════════════════════════════════════════════════════════════════
// SPRINT 8: Cognitive Bridge (Oracle ↔ Board)
// ═══════════════════════════════════════════════════════════════════════
//
// These modules extend the boardroom with Oracle's cognitive engine:
//   - board-energy: Multi-member room energy (wraps Oracle energy.ts)
//   - board-trust: Trust signal detection + calibration (extends evolution.ts trust)
//   - expertise-router: Question routing to best-fit member
//   - memory-bridge: Oracle memory sharing filtered by member domain
//   - cognitive-bridge: Main orchestrator (preResponse / postResponse)
//
// NOTE: Some names are aliased to avoid collision with existing exports:
//   - getTrustTier (evolution.js) vs getTrustTierFromScore (board-trust.ts)
//   - detectEnergy (energy.js) vs detectMemberEnergy (board-energy.ts)
// ═══════════════════════════════════════════════════════════════════════

// ── Board Energy: Multi-member room energy detection ─────────────────
export {
  type MemberEnergy,
  type RoomEnergy,
  type BoardMessage,
  detectMemberEnergy,
  detectRoomEnergy,
  persistMemberEnergy,
  persistRoomEnergy,
  buildEnergyPromptBlock,
} from './board-energy.js';

// ── Board Trust: Signal detection + calibration ──────────────────────
// NOTE: getTrustTier already exported from evolution.js above.
//       Sprint 8 adds the richer TrustTier type + calibration engine.
//       Use getTrustTierLabel for human-readable tier names.
export {
  type TrustTier,
  type TrustSignal,
  type TrustSignalType,
  type TrustCalibration,
  type MemberTrustProfile,
  getTrustTierLabel,
  detectTrustSignals,
  calibrateTrust,
  applyTrustCalibration,
  getMemberTrustProfile,
  buildTrustPromptBlock,
} from './board-trust.js';

// ── Expertise Router: Question → best-fit member ─────────────────────
export {
  type RoutingResult,
  type ScoredMember,
  detectTopic,
  scoreMember,
  routeQuestion,
} from './expertise-router.js';

// ── Memory Bridge: Oracle memory → board context ─────────────────────
export {
  type BoardMemberContext,
  type FetchContextOptions,
  fetchBoardMemberContext,
  buildContextPromptBlock,
} from './memory-bridge.js';

// ── Cognitive Bridge: Main orchestrator ──────────────────────────────
export {
  type CognitiveState,
  type PreResponseInput,
  type PostResponseInput,
  type CognitiveDashboard,
  preResponse,
  postResponse,
  getCognitiveDashboard,
} from './cognitive-bridge.js';