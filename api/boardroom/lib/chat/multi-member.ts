// FILE: api/boardroom/lib/chat/multi-member.ts
// ═══════════════════════════════════════════════════════════════════════
// CHAT MODULE — Multi-Member Handlers
// ═══════════════════════════════════════════════════════════════════════
//
// v10.0: mediaAttachments threaded through to every member's prompt.
//        Each member in a committee or full board meeting sees the same
//        document/URL/image but filtered through their domain lens.
//        CFO extracts cash flow. Legal extracts risk. CSO extracts moat.
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
import type {
  CommitteeParams,
  FullBoardParams,
  MemberResponse,
  MediaAttachment,
} from './types.js';

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
    mediaAttachments,   // v10.0
  } = params;

  const { data: members } = await supabaseAdmin
    .from('boardroom_members')
    .select('*')
    .in('slug', committeeSlugs)
    .eq('is_active', true);

  if (!members || members.length < 2) {
    res.status(400).json({ error: 'Committee requires at least 2 active members.' });
    return;
  }

  const [recentDecisions, meetingSummaries] = await Promise.all([
    getRecentDecisions(supabaseAdmin, userId).catch(() => []),
    getRecentMeetingSummaries(supabaseAdmin, userId, 3).catch(() => []),
  ]);

  const responses = await callMembersInParallel(
    members as BoardMember[],
    userId, message, meetingType || 'committee', meetingId,
    founderEnergy, founderArc, topicCategory,
    recentDecisions, meetingSummaries,
    { feedLimit: 5 },
    mediaAttachments,   // v10.0
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
      mediaAttachmentsProcessed: (mediaAttachments || []).length,  // v10.0
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
    mediaAttachments,   // v10.0
  } = params;

  const { data: members } = await supabaseAdmin
    .from('boardroom_members')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (!members || members.length === 0) {
    res.status(500).json({ error: 'No active board members found.' });
    return;
  }

  const [recentDecisions, meetingSummaries] = await Promise.all([
    getRecentDecisions(supabaseAdmin, userId).catch(() => []),
    getRecentMeetingSummaries(supabaseAdmin, userId, 3).catch(() => []),
  ]);

  const responses = await callMembersInParallel(
    members as BoardMember[],
    userId, message, meetingType || 'full_board', meetingId,
    founderEnergy, founderArc, topicCategory,
    recentDecisions, meetingSummaries,
    { feedLimit: 3 },
    mediaAttachments,   // v10.0
  );

  if (meetingId) persistMeetingTimestamp(meetingId);

  // Sprint 3: Compress meeting into shared memory
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
      mediaAttachmentsProcessed: (mediaAttachments || []).length,  // v10.0
    },
  });
}

// =============================================================================
// SHARED: PARALLEL MEMBER CALLS
// =============================================================================

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
  mediaAttachments?: MediaAttachment[],   // v10.0
): Promise<MemberResponse[]> {

  return Promise.all(
    members.map(async (bm) => {
      try {
        const [founderMemory, crossBoardFeed] = await Promise.all([
          getFounderMemory(supabaseAdmin, userId, bm.slug).catch(() => null),
          getCrossBoardFeed(supabaseAdmin, userId, bm.slug, 7, opts.feedLimit).catch(() => []),
        ]);

        // v10.0: Each member gets media through their own domain lens
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
          mediaAttachments: mediaAttachments || [],
        });

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
          console.warn(`[CognitiveBridge] preResponse failed for ${bm.slug}:`, bridgeErr.message);
        }

        const result = await callWithFallback(
          bm.dominant_provider || bm.ai_provider,
          bm.ai_model,
          finalSystemPrompt,
          userPrompt,
          { maxTokens: 2000 },
        );

        const crossDomain = isCrossDomain(bm, topicCategory);

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
            console.warn(`[CognitiveBridge] postResponse failed for ${bm.slug}:`, bridgeErr.message);
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

async function persistMeetingTimestamp(meetingId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('boardroom_meetings')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', meetingId);
  } catch {
    // Non-fatal
  }
}