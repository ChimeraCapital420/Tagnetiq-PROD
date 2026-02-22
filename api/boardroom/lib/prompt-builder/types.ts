// FILE: api/boardroom/lib/prompt-builder/types.ts
// ═══════════════════════════════════════════════════════════════════════
// PROMPT BUILDER TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

import type { EnergyLevel, EnergyArc } from '../../../../src/lib/boardroom/energy';
import type { FounderMemoryState, BoardActivityEntry } from '../../../../src/lib/boardroom/memory/founder-memory';
import type { MeetingSummary } from '../../../../src/lib/boardroom/memory/meeting-memory';

// ============================================================================
// BOARD MEMBER
// ============================================================================

export interface BoardMember {
  id: string;
  slug: string;
  name: string;
  title: string;
  role: string;
  ai_provider: string;
  ai_model?: string;
  system_prompt?: string;
  expertise: string[];
  personality: Record<string, any>;
  voice_style?: string;
  trust_level?: number;
  ai_dna?: Record<string, number>;
  // ── Sprint 4: Personality evolution fields ─────────────
  personality_evolution?: Record<string, any>;
  evolved_prompt?: string | null;
  total_interactions?: number;
}

// ============================================================================
// PROMPT CONTEXT — The full 9-layer input
// ============================================================================

/**
 * Prompt context — the full 9-layer input.
 *
 * chat.ts sends all Phase 0 fields + meeting summaries.
 * tasks.ts and briefing.ts may send legacy fields only.
 * Both work — Phase 0 fields take priority, legacy fields are fallbacks.
 */
export interface PromptContext {
  member: BoardMember;
  userMessage: string;
  meetingType: string;
  conversationHistory: Array<{ role: string; content: string }>;

  // ── Phase 0 fields (from chat.ts) ─────────────────────
  founderMemory?: FounderMemoryState | null;
  founderEnergy?: EnergyLevel;
  founderArc?: EnergyArc;
  crossBoardFeed?: BoardActivityEntry[];
  recentDecisions?: Array<{ decision: string; member_slug: string; category: string; created_at: string }>;

  // ── Sprint 3: Meeting summaries (from chat.ts) ────────
  meetingSummaries?: MeetingSummary[];

  // ── Legacy fields (backward compat for tasks/briefing) ─
  companyContext?: string;
  memories?: Array<{ type: string; content: string }>;
}

// ============================================================================
// RE-EXPORT EXTERNAL TYPES USED ACROSS MODULES
// ============================================================================
// These re-exports let other prompt-builder modules import from './types.js'
// instead of reaching into deep paths. Single source of truth for paths.

export type { EnergyLevel, EnergyArc };
export type { FounderMemoryState, BoardActivityEntry };
export type { MeetingSummary };