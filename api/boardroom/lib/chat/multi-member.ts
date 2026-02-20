// FILE: api/boardroom/lib/chat/multi-member.ts
// ═══════════════════════════════════════════════════════════════════════
// CHAT MODULE — Multi-Member Handlers
// ═══════════════════════════════════════════════════════════════════════
//
// Committee meetings (2-4 members) and full board meetings (@all).
// All members respond in parallel. Each gets their own memory context,
// cross-board feed, and prompt customization.
//
// Sprint 3: Two additions:
//   1. Meeting summaries (Layer 9) fetched and injected into each
//      member's prompt — they know what happened in past @all meetings
//   2. After @all meetings, triggers compression to build shared
//      institutional memory for future Layer 9 injection
//
// Sprint 8: Cognitive Bridge wired in.
//   Each member in parallel gets:
//     preResponse() — trust boundaries + room energy + Oracle context
//     postResponse() — trust calibration + DNA evolution (fire-and-forget)
//
//   SAFETY: Both hooks are per-member try/catch. One member's bridge
//   failure doesn't affect the others. If bridge fails for a member,
//   that member gets the original 9-layer prompt. The meeting continues.
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callWithFallback, getSupaAdmin } from '../provider-caller.js';
import { buildBoardMemberPrompt } from '../prompt-builder.js';
import { isCrossDomain, type BoardMember } from '../../../../src/lib/boardroom/evolution.js';
import {
  getFounderMemory,
  getCrossBoardFeed,
  getRecentDecisions,
} from '../../../../src/lib/boardroom/memory/founder-memory.js';
import { getRecentMeetingSummaries } from '../../../../src/lib/boardroom/memory/meeting-memory.js';
import { runBackgroundTasks, runMeetingCompressionTask } from './background-tasks.js';
import type { CommitteeParams, FullBoardParams, MemberResponse } from './types.js';

// ── Sprint 8: Cognitive Bridge ──────────────────────────
import {
  preResponse,
  postResponse,
  type CognitiveState,
} from '../../../../src/lib/boardroom/cognitive-bridge.js';

const supabaseAdmin = getSupaAdmin();

// =============================================================================
// COMMITTEE MEETING (2-4 members)
// =============================================================================

export async function handleCommitteeMeeting(
  req: VercelRequest,
  res: VercelResponse,
  params: CommitteeParams,
): Promise<void> {
  const {
    userId, meetingId, committeeSlugs, message,
    meetingType, founderEnergy, founderArc, topicCategory,
  } = params;

  // Load committee members
  const { data: members } = await supabaseAdmin
    .from('boardroom_members')
    .select('*')
    .in('slug', committeeSlugs)
    .eq('is_active', true);

  if (!members || members.length < 2) {
    res.status(400).json({ error: 'Committee requires at least 2 active members.' });
    return;
  }

  // Shared context (fetched once, not per-member)
  const [recentDecisions, meetingSummaries] = await Promise.all([
    getRecentDecisions(supabaseAdmin, userId).catch(() => []),
    getRecentMeetingSummaries(supabaseAdmin, userId, 3).catch(() => []),
  ]);

  // Each committee member responds in parallel
  const responses = await callMembersInParallel(
    members as BoardMember[],
    userId, message, meetingType || 'committee', meetingId,
    founderEnergy, founderArc, topicCategory,
    recentDecisions, meetingSummaries,
    { feedLimit: 5 },
  );

  if (meetingId) persistMeetingTimestamp(meetingId);

  res.status(200).json({
    type: 'committee',
    user_message: message,
    responses,
    meeting_id: meetingId,
    topic: topicCategory,
    committee: committeeSlugs,
    _meta: {
      founderEnergy,
      founderArc,
      memberCount: responses.length,
      errorCount: responses.filter(r => r.error).length,
    },
  });
}

// =============================================================================
// FULL BOARD MEETING (@all)
// =============================================================================

export async function handleFullBoardMeeting(
  req: VercelRequest,
  res: VercelResponse,
  params: FullBoardParams,
): Promise<void> {
  const {
    userId, meetingId, message,
    meetingType, founderEnergy, founderArc, topicCategory,
  } = params;

  // Load all active members
  const { data: members } = await supabaseAdmin
    .from('boardroom_members')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (!members || members.length === 0) {
    res.status(500).json({ error: 'No active board members found.' });
    return;
  }

  // Shared context (fetched once)
  const [recentDecisions, meetingSummaries] = await Promise.all([
    getRecentDecisions(supabaseAdmin, userId).catch(() => []),
    getRecentMeetingSummaries(supabaseAdmin, userId, 3).catch(() => []),
  ]);

  // All members respond in parallel
  const responses = await callMembersInParallel(
    members as BoardMember[],
    userId, message, meetingType || 'full_board', meetingId,
    founderEnergy, founderArc, topicCategory,
    recentDecisions, meetingSummaries,
    { feedLimit: 3 },
  );

  if (meetingId) persistMeetingTimestamp(meetingId);

  // ── Sprint 3: Compress meeting into shared memory (fire-and-forget) ──
  // This runs AFTER all members respond. The meeting summary becomes
  // Layer 9 in prompt-builder.ts — next time any member is consulted 1:1,
  // they'll know what happened in this board meeting.
  runMeetingCompressionTask(userId, meetingId, message, responses);

  res.status(200).json({
    type: 'full_board',
    user_message: message,
    responses,
    meeting_id: meetingId,
    topic: topicCategory,
    _meta: {
      founderEnergy,
      founderArc,
      memberCount: responses.length,
      errorCount: responses.filter(r => r.error).length,
      respondedMembers: responses.filter(r => !r.error).map(r => r.member),
      failedMembers: responses.filter(r => r.error).map(r => r.member),
    },
  });
}

// =============================================================================
// SHARED: PARALLEL MEMBER CALLS
// =============================================================================

/**
 * Call multiple board members in parallel.
 * Shared between committee and full board handlers.
 * Each member gets their own memory + feed, but meeting summaries
 * are shared (fetched once, passed to all).
 *
 * Sprint 8: Each member also gets cognitive bridge processing.
 * preResponse() enriches the prompt with trust + energy + Oracle context.
 * postResponse() fires after each member's response (fire-and-forget).
 * If the bridge fails for one member, that member uses the original
 * 9-layer prompt. Other members are unaffected.
 */
async function callMembersInParallel(
  members: BoardMember[],
  userId: string,
  message: string,
  meetingType: string,
  meetingId: string | undefined,
  founderEnergy: string,
  founderArc: string,
  topicCategory: string,
  recentDecisions: any[],
  meetingSummaries: any[],
  opts: { feedLimit: number },
): Promise<MemberResponse[]> {

  return Promise.all(
    members.map(async (bm) => {
      try {
        const [founderMemory, crossBoardFeed] = await Promise.all([
          getFounderMemory(supabaseAdmin, userId, bm.slug).catch(() => null),
          getCrossBoardFeed(supabaseAdmin, userId, bm.slug, 7, opts.feedLimit).catch(() => []),
        ]);

        const { systemPrompt, userPrompt } = buildBoardMemberPrompt({
          member: bm,
          userMessage: message,
          meetingType,
          conversationHistory: [],
          founderMemory,
          founderEnergy: founderEnergy as any,
          founderArc: founderArc as any,
          crossBoardFeed,
          recentDecisions,
          meetingSummaries,
        });

        // ── Sprint 8: Cognitive Bridge — preResponse ────
        // Adds trust boundaries, room energy, Oracle context per member.
        // If it fails, we use the original 9-layer systemPrompt.
        let finalSystemPrompt = systemPrompt;
        let cognitiveState: CognitiveState | null = null;

        try {
          cognitiveState = await preResponse(supabaseAdmin, {
            userId,
            message,
            conversationHistory: [],
            participantSlugs: members.map(m => m.slug),
            targetMember: bm,
            basePrompt: systemPrompt,
            allMembers: members,
            forceMember: bm.slug,
          });
          finalSystemPrompt = cognitiveState.enrichedPrompt;
        } catch (bridgeErr: any) {
          console.warn(`[CognitiveBridge] preResponse failed for ${bm.slug} in meeting:`, bridgeErr.message);
          // Falls back to 9-layer prompt — bridge is additive, not required
        }

        const result = await callWithFallback(
          bm.dominant_provider || bm.ai_provider,
          bm.ai_model,
          finalSystemPrompt,
          userPrompt,
          { maxTokens: 2000 },
        );

        const crossDomain = isCrossDomain(bm, topicCategory);

        // Background tasks per member
        runBackgroundTasks({
          userId,
          memberSlug: bm.slug,
          boardMember: bm,
          message,
          conversationMessages: [
            { role: 'user', content: message },
            { role: 'assistant', content: result.text },
          ],
          responseText: result.text,
          result,
          crossDomain,
          hasMemory: false,
          topicCategory,
          founderEnergy: founderEnergy as any,
          founderArc: founderArc as any,
          crossBoardFeed,
          meetingId,
          conversationId: undefined,
          messageCount: 0,
        });

        // ── Sprint 8: Cognitive Bridge — postResponse ───
        // Fire-and-forget: trust calibration + DNA evolution + energy persist.
        if (cognitiveState) {
          postResponse(supabaseAdmin, {
            memberSlug: bm.slug,
            responseTime: result.responseTime,
            wasFallback: result.isFallback,
            wasCrossDomain: crossDomain,
            providerUsed: result.provider,
            modelUsed: result.model,
            topicCategory,
          }, cognitiveState.roomEnergy).catch((bridgeErr) => {
            console.warn(`[CognitiveBridge] postResponse failed for ${bm.slug} in meeting:`, bridgeErr.message);
          });
        }

        return {
          member: bm.slug,
          name: bm.name,
          title: bm.title,
          response: result.text,
          provider: result.provider,
          model: result.model,
          responseTime: result.responseTime,
          isFallback: result.isFallback,
          error: false,
        };
      } catch (err: any) {
        return {
          member: bm.slug,
          name: bm.name,
          title: bm.title,
          response: `[${bm.name} is unavailable: ${err.message}]`,
          provider: bm.ai_provider,
          model: bm.ai_model,
          responseTime: 0,
          isFallback: false,
          error: true,
        };
      }
    }),
  );
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Update meeting timestamp. Non-blocking.
 */
async function persistMeetingTimestamp(meetingId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('boardroom_meetings')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', meetingId);
  } catch {
    // Non-fatal: meeting table might not exist yet
  }
}