// FILE: api/boardroom/lib/chat/multi-member.ts
// ═══════════════════════════════════════════════════════════════════════
// CHAT MODULE — Multi-Member Handlers
// ═══════════════════════════════════════════════════════════════════════
//
// Committee meetings (2-4 members) and full board meetings (@all).
// All members respond in parallel. Each gets their own memory context,
// cross-board feed, and prompt customization.
//
// These don't use conversation persistence (yet) — each meeting is
// treated as a one-shot discussion. Future sprint: persist committee
// threads with per-member message tracking.
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
import { runBackgroundTasks } from './background-tasks.js';
import type { CommitteeParams, FullBoardParams, MemberResponse } from './types.js';

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
  const recentDecisions = await getRecentDecisions(supabaseAdmin, userId).catch(() => []);

  // Each committee member responds in parallel
  const responses = await callMembersInParallel(
    members as BoardMember[],
    userId, message, meetingType || 'committee', meetingId,
    founderEnergy, founderArc, topicCategory, recentDecisions,
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
  const recentDecisions = await getRecentDecisions(supabaseAdmin, userId).catch(() => []);

  // All members respond in parallel
  const responses = await callMembersInParallel(
    members as BoardMember[],
    userId, message, meetingType || 'full_board', meetingId,
    founderEnergy, founderArc, topicCategory, recentDecisions,
    { feedLimit: 3 },
  );

  if (meetingId) persistMeetingTimestamp(meetingId);

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
 * Each member gets their own memory, feed, and prompt context.
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
        });

        const result = await callWithFallback(
          bm.dominant_provider || bm.ai_provider,
          bm.ai_model,
          systemPrompt,
          userPrompt,
          { maxTokens: 2000 },
        );

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
          crossDomain: isCrossDomain(bm, topicCategory),
          hasMemory: false,
          topicCategory,
          founderEnergy: founderEnergy as any,
          founderArc: founderArc as any,
          crossBoardFeed,
          meetingId,
          conversationId: undefined,
          messageCount: 0,
        });

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