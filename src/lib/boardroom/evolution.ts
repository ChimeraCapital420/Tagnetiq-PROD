// FILE: src/lib/boardroom/evolution.ts
// ═══════════════════════════════════════════════════════════════════════
// EVOLUTION ENGINE — FLAT BARREL
// ═══════════════════════════════════════════════════════════════════════
//
// Bridge file: cognitive-bridge.ts and other API files import from
// './evolution.js' (flat path) but the actual implementation lives in
// the './evolution/' folder with its own index.ts barrel.
//
// Node ESM cannot resolve a directory as './evolution.js' — it needs
// either a flat file or an explicit './evolution/index.js' path.
// This file bridges the gap without touching the importers.
//
// All exports pass through from ./evolution/index.ts unchanged.
// Adding new exports: add them to ./evolution/index.ts first.
//
// ═══════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────
export type {
  BoardMember,
  InteractionResult,
  InteractionOutcome,
  PersonalityEvolutionData,
  EvolutionHistoryEntry,
} from './evolution/types.js';

// ── DNA Evolution ────────────────────────────────────────
export {
  evolveBoarDna,
  recordInteractionOutcome,
  evolveBoardAfterMeeting,
} from './evolution/dna.js';

// ── Detection ────────────────────────────────────────────
export {
  isCrossDomain,
  detectTopicCategory,
} from './evolution/detection.js';

// ── Trust ────────────────────────────────────────────────
export {
  getTrustTier,
  getTrustDescription,
  DNA_TRAITS,
} from './evolution/trust.js';

// ── Personality Evolution (Sprint 4) ─────────────────────
export { evolvePersonality } from './evolution/personality.js';

// ── History & Rollback ───────────────────────────────────
export {
  getEvolutionHistory,
  rollbackPersonality,
} from './evolution/history.js';