// FILE: src/lib/oracle/chat/post-call.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Module — Post-Call Tasks (Phase 3 Extraction)
// ═══════════════════════════════════════════════════════════════════════
//
// Extracted from api/oracle/chat.ts — the ~30-line post-call block.
// All operations are fire-and-forget (.catch(() => {})).
// None of these affect the response — they run after the AI call
// and before (or in parallel with) persistence.
//
// Tasks:
//   1. Safety event logging (crisis/harm signals)
//   2. Trust signal recording
//   3. Name ceremony check
//   4. Identity stats update
//   5. Personality evolution (full mode only)
//   6. Character voice evolution (full mode only)
//
// ZERO LOGIC CHANGES — pure code movement from chat.ts handler.
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';
import { logSafetyEvent } from '../safety/index.js';
import { recordTrustEvent } from '../trust/tracker.js';
import {
  checkForNameCeremony,
  updateIdentityAfterChat,
  evolvePersonality,
} from '../index.js';
import { evolveCharacter } from '../personality/character.js';

// =============================================================================
// TYPES
// =============================================================================

export interface PostCallInput {
  supabase: SupabaseClient;
  /** OpenAI client instance (for evolvePersonality) */
  openai: any;
  /** OpenAI API key string (for evolveCharacter) */
  openaiApiKey: string;
  userId: string;
  conversationId: string | null;
  message: string;
  responseText: string;
  scanHistory: any[];
  /** Safety scan result from scanMessage() */
  safetyScan: any;
  /** Trust signal from detectTrustSignals() — may be null */
  trustSignal: any;
  /** Oracle identity object */
  identity: any;
  /** Lightweight mode flag */
  lightweight: boolean;
  /** Conversation history (for evolution) */
  conversationHistory: any[];
}

// =============================================================================
// POST-CALL TASKS
// =============================================================================

/**
 * Run all post-call background tasks. Fire-and-forget — none of
 * these affect the response. All operations swallow errors silently.
 *
 * Called AFTER the AI response is received, BEFORE persistence.
 */
export function runPostCallTasks(input: PostCallInput): void {
  const {
    supabase, openai, openaiApiKey,
    userId, conversationId,
    message, responseText, scanHistory,
    safetyScan, trustSignal, identity,
    lightweight, conversationHistory,
  } = input;

  // ── Safety event logging ────────────────────────────────
  if (safetyScan.shouldLog) {
    logSafetyEvent(supabase, {
      user_id: userId,
      conversation_id: conversationId || undefined,
      event_type: safetyScan.signal,
      severity: safetyScan.signal === 'crisis_signal' ? 'critical'
        : safetyScan.signal === 'harm_to_others' ? 'high'
        : 'moderate',
      action_taken: safetyScan.responseGuidance,
      resources_given: safetyScan.availableResources,
      trigger_category: safetyScan.category,
      oracle_response_excerpt: responseText.substring(0, 300),
    }).catch(() => {});
  }

  // ── Trust signal recording ──────────────────────────────
  if (trustSignal) {
    recordTrustEvent(userId, trustSignal).catch(() => {});
  }

  // ── Name ceremony check ─────────────────────────────────
  checkForNameCeremony(supabase, identity, responseText).catch(() => {});

  // ── Identity stats update ───────────────────────────────
  updateIdentityAfterChat(supabase, identity, message, scanHistory).catch(() => {});

  // ── Personality + character evolution (full mode only) ──
  if (!lightweight) {
    evolvePersonality(openai, supabase, identity, conversationHistory).catch(() => {});
    evolveCharacter(openaiApiKey, supabase, identity, conversationHistory).catch(() => {});
  }
}