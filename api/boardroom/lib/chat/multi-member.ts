// FILE: api/boardroom/lib/chat/single-member.ts
// ═══════════════════════════════════════════════════════════════════════
// CHAT MODULE — Single Member Handler
// ═══════════════════════════════════════════════════════════════════════
//
// The primary chat path: 1:1 conversations between the CEO and one
// board member. This is the most common interaction pattern and the
// only path with full conversation persistence.
//
// Pipeline:
//   Load member → Load conversation → Fetch memory (parallel) →
//   Build prompt (9 layers) → Call provider → Persist exchange →
//   Respond → Background tasks (fire and forget)
//
// Sprint 3: Meeting summaries (Layer 9) fetched in parallel with
// existing memory/feed/decisions. Zero added latency.
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callWithFallback, getSupaAdmin } from '../provider-caller.js';
import { buildBoardMemberPrompt } from '../prompt-builder.js';
import {
  isCrossDomain,
  getTrustTier,
  type BoardMember,
} from '../../../../src/lib/boardroom/evolution.js';
import {
  detectEnergyArc,
  getEnergyGuidance,
} from '../../../../src/lib/boardroom/energy.js';
import {
  getFounderMemory,
  getCrossBoardFeed,
  getRecentDecisions,
} from '../../../../src/lib/boardroom/memory/founder-memory.js';
import { getRecentMeetingSummaries } from '../../../../src/lib/boardroom/memory/meeting-memory.js';
import { loadOrCreateConversation, persistExchange } from './conversations.js';
import { runBackgroundTasks } from './background-tasks.js';
import { MAX_CONTEXT_MESSAGES } from './types.js';
import type { SingleChatParams, EnergyArc } from './types.js';

const supabaseAdmin = getSupaAdmin();

// =============================================================================
// HANDLER
// =============================================================================

export async function handleSingleMemberChat(
  req: VercelRequest,
  res: VercelResponse,
  params: SingleChatParams,
): Promise<void> {
  const {
    userId, meetingId, memberSlug, message,
    conversationId, legacyHistory, meetingType,
    founderEnergy, founderArc, topicCategory,
  } = params;

  // ── Load board member ─────────────────────────────────
  const { data: member } = await supabaseAdmin
    .from('boardroom_members')
    .select('*')
    .eq('slug', memberSlug)
    .single();

  if (!member) {
    res.status(404).json({ error: `Board member "${memberSlug}" not found.` });
    return;
  }

  const boardMember = member as BoardMember;

  // ── Load / create conversation ────────────────────────
  const conversation = await loadOrCreateConversation(
    supabaseAdmin, userId, memberSlug, meetingType, message, conversationId,
  );

  // Use server-side messages if available, fall back to legacy client history
  const conversationHistory = conversation.messages.length > 0
    ? conversation.messages
    : legacyHistory;

  // Re-detect energy arc from the full conversation (server-side messages)
  const effectiveArc: EnergyArc = conversationHistory.length > 2
    ? detectEnergyArc(conversationHistory)
    : founderArc;

  // ── Fetch memory + context (parallel) ─────────────────
  // Sprint 3: meetingSummaries added — fetched alongside existing data.
  // All 4 fetches run in parallel. Zero added latency.
  const [founderMemory, crossBoardFeed, recentDecisions, meetingSummaries] = await Promise.all([
    getFounderMemory(supabaseAdmin, userId, memberSlug).catch((err) => {
      console.warn(`[Chat] Memory fetch failed for ${memberSlug}:`, err.message);
      return null;
    }),
    getCrossBoardFeed(supabaseAdmin, userId, memberSlug).catch(() => []),
    getRecentDecisions(supabaseAdmin, userId).catch(() => []),
    getRecentMeetingSummaries(supabaseAdmin, userId, 3).catch(() => []),
  ]);

  // ── Build rich prompt (9 layers) ──────────────────────
  const { systemPrompt, userPrompt } = buildBoardMemberPrompt({
    member: boardMember,
    userMessage: message,
    meetingType,
    conversationHistory: conversationHistory.slice(-MAX_CONTEXT_MESSAGES),
    founderMemory,
    founderEnergy,
    founderArc: effectiveArc,
    crossBoardFeed,
    recentDecisions,
    meetingSummaries,
  });

  // ── Call provider via gateway ─────────────────────────
  const result = await callWithFallback(
    boardMember.dominant_provider || boardMember.ai_provider,
    boardMember.ai_model,
    systemPrompt,
    userPrompt,
    { maxTokens: 2000 },
  );

  // ── Persist exchange ──────────────────────────────────
  const { updatedMessages, newCount } = await persistExchange(
    supabaseAdmin,
    conversation.id,
    conversation.messages,
    message,
    result.text,
    memberSlug,
  );

  // ── Build response metadata ───────────────────────────
  const crossDomain = isCrossDomain(boardMember, topicCategory);
  const hasMemory = !!(founderMemory && (
    (founderMemory.founder_details || []).length > 0 ||
    (founderMemory.compressed_memories || []).length > 0
  ));
  const trustTier = getTrustTier(boardMember.trust_level || 0);

  // ── Respond ───────────────────────────────────────────
  res.status(200).json({
    member: memberSlug,
    response: result.text,
    meeting_id: meetingId,
    conversation_id: conversation.id || undefined,
    _meta: {
      provider: result.provider,
      model: result.model,
      responseTime: result.responseTime,
      isFallback: result.isFallback,
      topic: topicCategory,
      crossDomain,
      trustLevel: boardMember.trust_level,
      trustTier,
      aiDna: boardMember.ai_dna,
      founderEnergy,
      founderArc: effectiveArc,
      energyGuidance: getEnergyGuidance(memberSlug, founderEnergy, effectiveArc),
      memoryDepth: (founderMemory?.founder_details || []).length,
      compressedMemories: (founderMemory?.compressed_memories || []).length,
      feedSize: (crossBoardFeed || []).length,
      decisionsInPlay: recentDecisions.length,
      meetingSummariesLoaded: meetingSummaries.length,
      conversationMessageCount: newCount,
    },
  });

  // ── Background tasks (fire and forget) ────────────────
  runBackgroundTasks({
    userId,
    memberSlug,
    boardMember,
    message,
    conversationMessages: updatedMessages,
    responseText: result.text,
    result,
    crossDomain,
    hasMemory,
    topicCategory,
    founderEnergy,
    founderArc: effectiveArc,
    crossBoardFeed,
    meetingId,
    conversationId: conversation.id,
    messageCount: newCount,
  });
}// FILE: api/boardroom/lib/chat/multi-member.ts
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