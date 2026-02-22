// FILE: src/lib/boardroom/evolution/index.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD MEMBER EVOLUTION ENGINE — BARREL EXPORTS
// ═══════════════════════════════════════════════════════════════════════
//
// REFACTORED from single 550-line monolith into modular files:
//
//   types.ts        → All TypeScript interfaces
//   detection.ts    → Cross-domain detection + topic classification
//   dna.ts          → AI DNA evolution, interaction tracking, batch ops
//   trust.ts        → Trust tiers, descriptions, DNA flavor text
//   personality.ts  → Sprint 4 personality evolution engine
//   history.ts      → Evolution history retrieval + rollback
//
// IMPORT CONTRACT: This barrel re-exports everything that was public
// in the original monolith. Existing imports remain unchanged:
//
//   import { evolveBoarDna, detectTopicCategory } from '../../lib/boardroom/evolution';
//   import type { BoardMember, InteractionResult } from '../../lib/boardroom/evolution';
//
// ═══════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────
export type {
  BoardMember,
  InteractionResult,
  InteractionOutcome,
  PersonalityEvolutionData,
  EvolutionHistoryEntry,
} from './types.js';

// ── DNA Evolution ────────────────────────────────────────
export {
  evolveBoarDna,
  recordInteractionOutcome,
  evolveBoardAfterMeeting,
} from './dna.js';

// ── Detection ────────────────────────────────────────────
export {
  isCrossDomain,
  detectTopicCategory,
} from './detection.js';

// ── Trust ────────────────────────────────────────────────
export {
  getTrustTier,
  getTrustDescription,
  DNA_TRAITS,
} from './trust.js';

// ── Personality Evolution (Sprint 4) ─────────────────────
export { evolvePersonality } from './personality.js';

// ── History & Rollback ───────────────────────────────────
export {
  getEvolutionHistory,
  rollbackPersonality,
} from './history.js';