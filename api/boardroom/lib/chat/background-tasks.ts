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
// Sprint 3:
//   7. Compress board meeting (after @all — shared meeting memory)
//
// Sprint 4:
//   8. Evolve personality (every 25 interactions — voice, catchphrases,
//      cross-member opinions, inside references)
//
// ═══════════════════════════════════════════════════════════════════════

import { getSupaAdmin } from '../provider-caller.js';
import {
  extractFounderDetails,
  trackEmotionalArc,
  updateFounderEnergy,
} from '../../../../src/lib/boardroom/memory/founder-memory.js';
import { compressBoardMeeting, type MeetingResponse } from '../../../../src/lib/boardroom/memory/meeting-memory.js';
import { evolveBoarDna, evolvePersonality } from '../../../../src/lib/boardroom/evolution.js';
import { compressAndArchive, shouldCompress } from './conversations.js';
import type { BackgroundTaskParams } from './types.js';

const supabaseAdmin = getSupaAdmin();

// ── Sprint 4: Evolution cadence ──────────────────────────────────────
// Personality evolves every EVOLUTION_CADENCE interactions.
// total_interactions in params is the count BEFORE this interaction,
// so we check (count + 1) to see if this interaction hits the mark.
const EVOLUTION_CADENCE = 25;

// =============================================================================
// PER-MESSAGE BACKGROUND TASKS
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

  // ── 8. PERSONALITY EVOLUTION (Sprint 4) ───────────────
  // Check if this interaction pushes the member past the evolution cadence.
  // boardMember.total_interactions is the count BEFORE this chat.
  // evolveBoarDna (task #5) will increment it by 1.
  // So the "after" count is total_interactions + 1.
  const afterCount = (boardMember.total_interactions || 0) + 1;
  if (afterCount >= EVOLUTION_CADENCE && afterCount % EVOLUTION_CADENCE === 0) {
    evolvePersonality(supabaseAdmin, userId, memberSlug).catch((err) => {
      console.warn(`[Background] evolvePersonality failed for ${memberSlug}:`, err.message);
    });
  }
}

// =============================================================================
// SPRINT 3: MEETING COMPRESSION TASK
// =============================================================================

/**
 * Compress a full board meeting (@all) into shared institutional memory.
 * Called ONCE after all members respond — NOT per-member.
 *
 * Fire-and-forget. Non-blocking. Errors are caught and logged.
 *
 * @param userId - Founder's user ID
 * @param meetingId - Optional FK to boardroom_meetings
 * @param userMessage - The CEO's original @all message
 * @param responses - All member responses from the parallel call
 */
export function runMeetingCompressionTask(
  userId: string,
  meetingId: string | undefined,
  userMessage: string,
  responses: MeetingResponse[],
): void {
  compressBoardMeeting(
    supabaseAdmin,
    userId,
    meetingId,
    userMessage,
    responses,
  ).catch((err) => {
    console.warn(`[Background] compressBoardMeeting failed:`, err.message);
  });
}