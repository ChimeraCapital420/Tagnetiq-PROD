// FILE: api/boardroom/lib/prompt-builder/index.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD PROMPT BUILDER — BARREL EXPORTS
// ═══════════════════════════════════════════════════════════════════════
//
// Turns a generic AI model into Athena, Griffin, Prometheus.
//
// REFACTORED from single 900-line monolith into modular files:
//
//   types.ts       → BoardMember, PromptContext interfaces
//   constants.ts   → BILLIONAIRE_CORE, MEETING_MODIFIERS, energy maps
//   elevation.ts   → Protocol integration (member-specific frameworks)
//   formatters.ts  → All format* functions (9 prompt layers)
//   builder.ts     → buildBoardMemberPrompt (9-layer assembly)
//   tasks.ts       → TASK_PROMPTS + buildTaskPrompt
//   briefing.ts    → buildBriefingPrompt
//
// LAYERS (injected into every board conversation):
//   1. Identity      — Name, title, expertise, personality, voice
//                      + evolved personality (Sprint 4)
//   2. Elevation     — Billionaire mental models + member-specific protocols
//   3. Memory        — Founder details extracted from past conversations
//   4. Energy        — CEO's current emotional state + adaptation guidance
//   5. Cross-Board   — What other board members recently discussed (1:1s)
//   6. Decisions     — Recent board decisions for institutional continuity
//   7. Meeting Type  — Context modifier (1:1, committee, vote, etc.)
//   8. Voice         — Communication style directives
//   9. Meetings      — Shared memory from full board meetings (@all)
//
// IMPORT CONTRACT: This barrel re-exports everything that was public
// in the original monolith. Existing imports remain unchanged:
//
//   import { buildBoardMemberPrompt } from '../lib/prompt-builder';
//   import { buildTaskPrompt }        from '../lib/prompt-builder';
//   import { buildBriefingPrompt }    from '../lib/prompt-builder';
//
// ═══════════════════════════════════════════════════════════════════════

// ── The 3 public builder functions ───────────────────────
export { buildBoardMemberPrompt } from './builder.js';
export { buildTaskPrompt } from './tasks.js';
export { buildBriefingPrompt } from './briefing.js';

// ── Types (for consumers that need them) ─────────────────
export type { BoardMember, PromptContext } from './types.js';

// ── Sub-module access for advanced usage ─────────────────
// (e.g., evolution dashboard, custom prompt assembly)
export { BILLIONAIRE_CORE, MEETING_MODIFIERS, ENERGY_ADAPTATIONS, ARC_GUIDANCE } from './constants.js';
export { getMemberProtocolPrompt, getUniversalProtocolPrompt, getActiveProtocolGuidance } from './elevation.js';
export {
  formatPersonalityEvolution,
  formatFounderMemory,
  formatEnergyGuidance,
  formatCrossBoardFeed,
  formatRecentDecisions,
  formatMeetingSummaries,
  formatCompanyContext,
  formatLegacyMemories,
  formatConversationHistory,
} from './formatters.js';// FILE: api/boardroom/lib/prompt-builder/index.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD PROMPT BUILDER — BARREL EXPORTS
// ═══════════════════════════════════════════════════════════════════════
//
// v10.0: Added MediaAttachment export for consumers.
//
// LAYERS:
//   1. Identity      6. Decisions
//   2. Elevation     7. Meeting Type
//   3. Memory        8. Voice + Inversion
//   4. Energy        9. Board Meetings
//   5. Cross-Board  10. Media Intelligence ← NEW
// ═══════════════════════════════════════════════════════════════════════

export { buildBoardMemberPrompt } from './builder.js';
export { buildTaskPrompt } from './tasks.js';
export { buildBriefingPrompt } from './briefing.js';

export type { BoardMember, PromptContext } from './types.js';
export type { MediaAttachment } from './media-context.js';   // v10.0

export {
  BILLIONAIRE_CORE,
  MEETING_MODIFIERS,
  ENERGY_ADAPTATIONS,
  ARC_GUIDANCE,
} from './constants.js';

export {
  getMemberProtocolPrompt,
  getUniversalProtocolPrompt,
  getActiveProtocolGuidance,
} from './elevation.js';

export {
  formatPersonalityEvolution,
  formatFounderMemory,
  formatEnergyGuidance,
  formatCrossBoardFeed,
  formatRecentDecisions,
  formatMeetingSummaries,
  formatCompanyContext,
  formatLegacyMemories,
  formatConversationHistory,
} from './formatters.js';

export {
  formatMediaAttachment,
  formatMediaAttachments,
} from './media-context.js';    // v10.0