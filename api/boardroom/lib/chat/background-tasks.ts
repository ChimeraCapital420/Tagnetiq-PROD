// FILE: api/boardroom/lib/chat/background-tasks.ts
// ═══════════════════════════════════════════════════════════════════════
// CHAT MODULE — Background Tasks
// ═══════════════════════════════════════════════════════════════════════
//
// Everything that runs AFTER the response is sent to the client.
// All fire-and-forget. If any fail, it's logged but the user
// experience is unaffected.
//
// Tasks:
//   1. Extract founder details (role-specific memory extraction)
//   2. Update energy state (persist detected energy to memory)
//   3. Track emotional arc (Prometheus only — wellness patterns)
//   4. Compress & archive (at threshold — managed by conversations.ts)
//   5. Evolve DNA (trust, provider performance, cross-domain tracking)
//   6. Audit log (structured console log for now, DB table later)
//
// ═══════════════════════════════════════════════════════════════════════

import { getSupaAdmin } from '../provider-caller.js';
import {
  extractFounderDetails,
  trackEmotionalArc,
  updateFounderEnergy,
} from '../../../../src/lib/boardroom/memory/founder-memory.js';
import { evolveBoarDna } from '../../../../src/lib/boardroom/evolution.js';
import { compressAndArchive, shouldCompress } from './conversations.js';
import type { BackgroundTaskParams } from './types.js';

const supabaseAdmin = getSupaAdmin();

// =============================================================================
// MAIN RUNNER
// =============================================================================

/**
 * Run all background tasks after a chat response is sent.
 * Non-blocking. Errors are caught and logged per-task.
 */
export function runBackgroundTasks(params: BackgroundTaskParams): void {
  const {
    userId, memberSlug, boardMember, message,
    conversationMessages, responseText, result,
    crossDomain, hasMemory, topicCategory,
    founderEnergy, founderArc, crossBoardFeed,
    conversationId, messageCount,
  } = params;

  // ── 1. EXTRACT FOUNDER DETAILS ────────────────────────
  // Uses the member's extraction template to pull facts from the conversation.
  // This ALSO posts to the activity feed (no separate postToActivityFeed needed).
  extractFounderDetails(
    supabaseAdmin, userId, memberSlug, conversationMessages,
  ).catch((err) => {
    console.warn(`[Background] extractFounderDetails failed for ${memberSlug}:`, err.message);
  });

  // ── 2. UPDATE ENERGY STATE ────────────────────────────
  updateFounderEnergy(
    supabaseAdmin, userId, memberSlug, founderEnergy, founderArc,
  ).catch((err) => {
    console.warn(`[Background] updateFounderEnergy failed:`, err.message);
  });

  // ── 3. PROMETHEUS: EMOTIONAL ARC TRACKING ─────────────
  if (memberSlug === 'prometheus') {
    const note = message.length > 100
      ? message.substring(0, 100) + '...'
      : message;
    trackEmotionalArc(
      supabaseAdmin, userId, founderEnergy, founderArc, note,
    ).catch((err) => {
      console.warn(`[Background] trackEmotionalArc failed:`, err.message);
    });
  }

  // ── 4. COMPRESS & ARCHIVE (at threshold) ──────────────
  if (conversationId && shouldCompress(messageCount)) {
    compressAndArchive(
      supabaseAdmin, userId, memberSlug, conversationId, conversationMessages,
    ).catch((err) => {
      console.warn(`[Background] compressAndArchive failed for ${memberSlug}:`, err.message);
    });
  }

  // ── 5. EVOLVE DNA ─────────────────────────────────────
  evolveBoarDna(supabaseAdmin, {
    memberSlug,
    providerUsed: result.provider,
    modelUsed: result.model,
    responseTime: result.responseTime,
    wasFallback: result.isFallback,
    wasCrossDomain: crossDomain,
    topicCategory,
    messageType: crossDomain ? 'cross_domain' : 'chat',
    founderEnergy,
    founderArc,
    memoryHit: hasMemory,
    feedInjected: crossBoardFeed.length > 0,
  }).catch((err) => {
    console.warn(`[Background] evolveBoarDna failed for ${memberSlug}:`, err.message);
  });

  // ── 6. AUDIT LOG ──────────────────────────────────────
  console.log(
    `[Audit] ${memberSlug} | ${result.provider}/${result.model} | ` +
    `${result.responseTime}ms | fallback=${result.isFallback} | ` +
    `energy=${founderEnergy} | msgs=${messageCount}`
  );
}