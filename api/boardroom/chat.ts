// FILE: api/boardroom/chat.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARDROOM CHAT HANDLER — The Orchestrator
// ═══════════════════════════════════════════════════════════════════════
//
// This is the central conversation handler for the AI Board of Directors.
// Every 1:1 session, every board meeting, every committee meeting, every
// vote — all flow through this orchestrator.
//
// PIPELINE (per message):
//
//   1. AUTHENTICATE — Verify user, check boardroom access level
//   2. DETECT — Energy level + arc from message (zero cost, client-side capable)
//   3. DETECT — Topic category for cross-domain tracking
//   4. FETCH — Founder memory (what this member knows about the founder)
//   5. FETCH — Cross-board activity feed (what other members said recently)
//   6. FETCH — Recent board decisions (shared decision log)
//   7. BUILD — Rich prompt (identity + protocols + memory + energy + feed + trust + DNA + voice)
//   8. CALL — Provider via gateway with fallback chain
//   9. RESPOND — Return response with full metadata
//  10. BACKGROUND — Extract founder details from this conversation
//  11. BACKGROUND — Update energy state in memory
//  12. BACKGROUND — Track emotional arc (Prometheus special)
//  13. BACKGROUND — Compress thread if threshold reached
//  14. BACKGROUND — Post to cross-board activity feed
//  15. BACKGROUND — Evolve DNA (trust, performance, provider affinity)
//
// MEETING TYPES:
//   one_on_one     — Deep, personal 1:1 with a single member
//   full_board     — All members respond (concise, unique angles)
//   committee      — 2-4 members, deep collaboration
//   vote           — APPROVE / REJECT / ABSTAIN with reasoning
//   devils_advocate — Argue AGAINST the proposal
//   executive_session — Confidential, high-context
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

// ── Provider Gateway (Sprint 0d) ────────────────────────
import {
  callWithFallback,
  getSupaAdmin,
  logGatewayCall,
  type ProviderCallResult,
} from './lib/provider-caller.js';

// ── Evolution (DNA, trust, cross-domain) ────────────────
import {
  evolveBoarDna,
  isCrossDomain,
  detectTopicCategory,
  getTrustTier,
  type BoardMember,
} from '../../src/lib/boardroom/evolution.js';

// ── Prompt Builder (8-layer assembly) ───────────────────
import { buildBoardMemberPrompt } from './lib/prompt-builder.js';

// ── Energy Detection (pure functions, zero API cost) ────
import {
  detectEnergy,
  detectEnergyArc,
  getEnergyGuidance,
  type EnergyLevel,
  type EnergyArc,
} from '../../src/lib/boardroom/energy.js';

// ── Founder Memory System ───────────────────────────────
import {
  getFounderMemory,
  getCrossBoardFeed,
  getRecentDecisions,
  extractFounderDetails,
  compressBoardThread,
  trackEmotionalArc,
  updateFounderEnergy,
} from '../../src/lib/boardroom/memory/founder-memory.js';

// ═══════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════

export const config = {
  maxDuration: 60, // Vercel Pro — no more 504 timeouts
};

const supabaseAdmin = getSupaAdmin();

// Valid meeting types
const VALID_MEETING_TYPES = [
  'one_on_one',
  'full_board',
  'committee',
  'vote',
  'devils_advocate',
  'executive_session',
];

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // ── 1. AUTHENTICATE ─────────────────────────────────
    const user = await verifyUser(req);

    const {
      meeting_id,
      member_slug,
      message,
      conversation_history,
      mention_all,
      meeting_type,
      committee_members,
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'A "message" is required.' });
    }

    if (message.length > 10000) {
      return res.status(400).json({ error: 'Message exceeds 10,000 character limit.' });
    }

    // Verify boardroom access
    const { data: accessRow } = await supabaseAdmin
      .from('boardroom_access')
      .select('access_level, subscription_tier')
      .eq('user_id', user.id)
      .single();

    if (!accessRow) {
      return res.status(403).json({ error: 'You do not have boardroom access.' });
    }

    // Validate meeting type
    const effectiveMeetingType = meeting_type && VALID_MEETING_TYPES.includes(meeting_type)
      ? meeting_type
      : (mention_all ? 'full_board' : 'one_on_one');

    // ── 2. DETECT ENERGY (zero cost, instant) ───────────
    const founderEnergy = detectEnergy(message);
    const founderArc: EnergyArc = conversation_history?.length > 2
      ? detectEnergyArc(conversation_history)
      : 'steady';

    // ── 3. DETECT TOPIC CATEGORY ────────────────────────
    const topicCategory = detectTopicCategory(message);

    // ══════════════════════════════════════════════════════
    // ROUTE: SINGLE MEMBER CHAT
    // ══════════════════════════════════════════════════════

    if (member_slug && !mention_all) {
      return handleSingleMemberChat(req, res, {
        userId: user.id,
        meetingId: meeting_id,
        memberSlug: member_slug,
        message,
        conversationHistory: conversation_history || [],
        meetingType: effectiveMeetingType,
        founderEnergy,
        founderArc,
        topicCategory,
      });
    }

    // ══════════════════════════════════════════════════════
    // ROUTE: COMMITTEE MEETING (2-4 selected members)
    // ══════════════════════════════════════════════════════

    if (committee_members && Array.isArray(committee_members) && committee_members.length >= 2) {
      return handleCommitteeMeeting(req, res, {
        userId: user.id,
        meetingId: meeting_id,
        committeeSlugs: committee_members,
        message,
        meetingType: effectiveMeetingType,
        founderEnergy,
        founderArc,
        topicCategory,
      });
    }

    // ══════════════════════════════════════════════════════
    // ROUTE: FULL BOARD MEETING (@all)
    // ══════════════════════════════════════════════════════

    if (mention_all) {
      return handleFullBoardMeeting(req, res, {
        userId: user.id,
        meetingId: meeting_id,
        message,
        meetingType: effectiveMeetingType,
        founderEnergy,
        founderArc,
        topicCategory,
      });
    }

    // ══════════════════════════════════════════════════════
    // NO VALID ROUTE
    // ══════════════════════════════════════════════════════

    return res.status(400).json({
      error: 'Provide "member_slug" for a direct chat, "committee_members" for a committee, or "mention_all: true" for a full board meeting.',
    });

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication') || errMsg.includes('token')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('[Boardroom] Chat error:', errMsg);
    return res.status(500).json({ error: 'Board is in recess. Try again.' });
  }
}

// =============================================================================
// SINGLE MEMBER CHAT
// =============================================================================

interface SingleChatParams {
  userId: string;
  meetingId?: string;
  memberSlug: string;
  message: string;
  conversationHistory: any[];
  meetingType: string;
  founderEnergy: EnergyLevel;
  founderArc: EnergyArc;
  topicCategory: string;
}

async function handleSingleMemberChat(
  req: VercelRequest,
  res: VercelResponse,
  params: SingleChatParams,
) {
  const {
    userId, meetingId, memberSlug, message,
    conversationHistory, meetingType,
    founderEnergy, founderArc, topicCategory,
  } = params;

  // ── Load board member ─────────────────────────────────
  const { data: member } = await supabaseAdmin
    .from('boardroom_members')
    .select('*')
    .eq('slug', memberSlug)
    .single();

  if (!member) {
    return res.status(404).json({ error: `Board member "${memberSlug}" not found.` });
  }

  const boardMember = member as BoardMember;

  // ── 4-6. FETCH MEMORY + CONTEXT (parallel) ───────────
  const [founderMemory, crossBoardFeed, recentDecisions] = await Promise.all([
    getFounderMemory(supabaseAdmin, userId, memberSlug).catch((err) => {
      console.warn(`[Chat] Memory fetch failed for ${memberSlug}:`, err.message);
      return null;
    }),
    getCrossBoardFeed(supabaseAdmin, userId, memberSlug).catch(() => []),
    getRecentDecisions(supabaseAdmin, userId).catch(() => []),
  ]);

  // ── 7. BUILD RICH PROMPT (8 layers) ──────────────────
  const { systemPrompt, userPrompt } = buildBoardMemberPrompt({
    member: boardMember,
    userMessage: message,
    meetingType,
    conversationHistory: conversationHistory.slice(-20),
    founderMemory,
    founderEnergy,
    founderArc,
    crossBoardFeed,
    recentDecisions,
  });

  // ── 8. CALL PROVIDER VIA GATEWAY ─────────────────────
  const result = await callWithFallback(
    boardMember.dominant_provider || boardMember.ai_provider,
    boardMember.ai_model,
    systemPrompt,
    userPrompt,
    {
      maxTokens: 2000,
      taskContext: {
        memberSlug,
        source: 'chat',
        meetingId,
      },
    },
  );

  // ── 9. RESPOND ────────────────────────────────────────
  const crossDomain = isCrossDomain(boardMember, topicCategory);
  const hasMemory = !!(founderMemory && (
    (founderMemory.founder_details || []).length > 0 ||
    (founderMemory.compressed_memories || []).length > 0
  ));
  const trustTier = getTrustTier(boardMember.trust_level || 0);

  // Send response before starting background tasks
  res.status(200).json({
    member: memberSlug,
    response: result.text,
    meeting_id: meetingId,
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
      founderArc,
      energyGuidance: getEnergyGuidance(founderEnergy, memberSlug),
      memoryDepth: (founderMemory?.founder_details || []).length,
      compressedMemories: (founderMemory?.compressed_memories || []).length,
      feedSize: (crossBoardFeed || []).length,
      decisionsInPlay: recentDecisions.length,
      tokenEstimate: result.tokenEstimate,
    },
  });

  // ── 10-15. BACKGROUND TASKS (fire and forget) ────────
  // These run AFTER the response is sent. Non-blocking.
  runBackgroundTasks({
    userId,
    memberSlug,
    boardMember,
    message,
    conversationHistory,
    responseText: result.text,
    result,
    crossDomain,
    hasMemory,
    topicCategory,
    founderEnergy,
    founderArc,
    crossBoardFeed,
    meetingId,
  });
}

// =============================================================================
// COMMITTEE MEETING (2-4 members)
// =============================================================================

interface CommitteeParams {
  userId: string;
  meetingId?: string;
  committeeSlugs: string[];
  message: string;
  meetingType: string;
  founderEnergy: EnergyLevel;
  founderArc: EnergyArc;
  topicCategory: string;
}

async function handleCommitteeMeeting(
  req: VercelRequest,
  res: VercelResponse,
  params: CommitteeParams,
) {
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
    return res.status(400).json({ error: 'Committee requires at least 2 active members.' });
  }

  // Shared context (fetched once, not per-member)
  const recentDecisions = await getRecentDecisions(supabaseAdmin, userId).catch(() => []);

  // Each committee member responds in parallel
  const responses = await Promise.all(
    members.map(async (member) => {
      const bm = member as BoardMember;
      try {
        const [founderMemory, crossBoardFeed] = await Promise.all([
          getFounderMemory(supabaseAdmin, userId, bm.slug).catch(() => null),
          getCrossBoardFeed(supabaseAdmin, userId, bm.slug, 7, 5).catch(() => []),
        ]);

        const { systemPrompt, userPrompt } = buildBoardMemberPrompt({
          member: bm,
          userMessage: message,
          meetingType: meetingType || 'committee',
          conversationHistory: [],
          founderMemory,
          founderEnergy,
          founderArc,
          crossBoardFeed,
          recentDecisions,
        });

        const result = await callWithFallback(
          bm.dominant_provider || bm.ai_provider,
          bm.ai_model,
          systemPrompt,
          userPrompt,
          {
            maxTokens: 2000,
            taskContext: { memberSlug: bm.slug, source: 'chat', meetingId },
          },
        );

        // Background tasks per member
        runBackgroundTasks({
          userId,
          memberSlug: bm.slug,
          boardMember: bm,
          message,
          conversationHistory: [],
          responseText: result.text,
          result,
          crossDomain: isCrossDomain(bm, topicCategory),
          hasMemory: false,
          topicCategory,
          founderEnergy,
          founderArc,
          crossBoardFeed,
          meetingId,
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

  if (meetingId) persistMeetingTimestamp(meetingId);

  return res.status(200).json({
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

interface FullBoardParams {
  userId: string;
  meetingId?: string;
  message: string;
  meetingType: string;
  founderEnergy: EnergyLevel;
  founderArc: EnergyArc;
  topicCategory: string;
}

async function handleFullBoardMeeting(
  req: VercelRequest,
  res: VercelResponse,
  params: FullBoardParams,
) {
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
    return res.status(500).json({ error: 'No active board members found.' });
  }

  // Shared context (fetched once)
  const recentDecisions = await getRecentDecisions(supabaseAdmin, userId).catch(() => []);

  // All members respond in parallel
  const responses = await Promise.all(
    members.map(async (member) => {
      const bm = member as BoardMember;
      try {
        // Per-member memory fetch (parallel within the Promise.all)
        const [founderMemory, crossBoardFeed] = await Promise.all([
          getFounderMemory(supabaseAdmin, userId, bm.slug).catch(() => null),
          getCrossBoardFeed(supabaseAdmin, userId, bm.slug, 7, 3).catch(() => []),
        ]);

        const { systemPrompt, userPrompt } = buildBoardMemberPrompt({
          member: bm,
          userMessage: message,
          meetingType: meetingType || 'full_board',
          conversationHistory: [],
          founderMemory,
          founderEnergy,
          founderArc,
          crossBoardFeed,
          recentDecisions,
        });

        const result = await callWithFallback(
          bm.dominant_provider || bm.ai_provider,
          bm.ai_model,
          systemPrompt,
          userPrompt,
          {
            maxTokens: 2000,
            taskContext: { memberSlug: bm.slug, source: 'chat', meetingId },
          },
        );

        // Background tasks per member
        runBackgroundTasks({
          userId,
          memberSlug: bm.slug,
          boardMember: bm,
          message,
          conversationHistory: [],
          responseText: result.text,
          result,
          crossDomain: isCrossDomain(bm, topicCategory),
          hasMemory: false,
          topicCategory,
          founderEnergy,
          founderArc,
          crossBoardFeed,
          meetingId,
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

  if (meetingId) persistMeetingTimestamp(meetingId);

  return res.status(200).json({
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
// BACKGROUND TASK RUNNER
// =============================================================================
// All background tasks are fire-and-forget. They run AFTER the response
// is sent to the client. If any fail, it's logged but doesn't affect
// the user experience.

interface BackgroundTaskParams {
  userId: string;
  memberSlug: string;
  boardMember: BoardMember;
  message: string;
  conversationHistory: any[];
  responseText: string;
  result: ProviderCallResult;
  crossDomain: boolean;
  hasMemory: boolean;
  topicCategory: string;
  founderEnergy: EnergyLevel;
  founderArc: EnergyArc;
  crossBoardFeed: any[];
  meetingId?: string;
}

function runBackgroundTasks(params: BackgroundTaskParams) {
  const {
    userId, memberSlug, boardMember, message,
    conversationHistory, responseText, result,
    crossDomain, hasMemory, topicCategory,
    founderEnergy, founderArc, crossBoardFeed,
  } = params;

  // Build the full message array for extraction
  const fullMessages = [
    ...conversationHistory.slice(-20),
    { role: 'user', content: message },
    { role: 'assistant', content: responseText },
  ];

  // ── 10. EXTRACT FOUNDER DETAILS ───────────────────────
  // Uses the member's extraction template to pull facts from the conversation.
  // Athena extracts strategic goals, Griffin extracts financial data, etc.
  extractFounderDetails(
    supabaseAdmin, userId, memberSlug, fullMessages,
  ).catch((err) => {
    console.warn(`[Background] extractFounderDetails failed for ${memberSlug}:`, err.message);
  });

  // ── 11. UPDATE ENERGY STATE ───────────────────────────
  // Persists detected energy level + arc to founder memory.
  // Used by future conversations and briefings.
  updateFounderEnergy(
    supabaseAdmin, userId, memberSlug, founderEnergy, founderArc,
  ).catch((err) => {
    console.warn(`[Background] updateFounderEnergy failed:`, err.message);
  });

  // ── 12. PROMETHEUS: EMOTIONAL ARC TRACKING ────────────
  // Only Prometheus tracks emotional patterns over time.
  // Builds the wellness picture for briefings and 1:1s.
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

  // ── 13. COMPRESS THREAD (if threshold reached) ────────
  // After 25 messages, compress into a summary for long-term memory.
  // Then again every 10 messages after that.
  const msgCount = conversationHistory.length + 2;
  if (msgCount >= 25 && msgCount % 10 === 0) {
    compressBoardThread(
      supabaseAdmin, userId, memberSlug, fullMessages,
    ).catch((err) => {
      console.warn(`[Background] compressBoardThread failed for ${memberSlug}:`, err.message);
    });
  }

  // ── 14. POST TO ACTIVITY FEED ─────────────────────────
  // Other board members will see this in their cross-board feed.
  // "Athena just advised on pricing strategy" helps prevent silos.
  postToActivityFeed(
    userId, memberSlug, message, responseText, topicCategory,
  ).catch((err) => {
    console.warn(`[Background] postToActivityFeed failed:`, err.message);
  });

  // ── 15. EVOLVE DNA ────────────────────────────────────
  // Track provider performance, trust building, cross-domain assists.
  // This is how members get BETTER over time.
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

  // ── AUDIT LOG ─────────────────────────────────────────
  logGatewayCall({
    memberSlug,
    provider: result.provider,
    model: result.model,
    source: 'chat',
    responseTime: result.responseTime,
    isFallback: result.isFallback,
    success: true,
    tokenEstimate: result.tokenEstimate,
  });
}

// =============================================================================
// ACTIVITY FEED
// =============================================================================

/**
 * Post a summary of this conversation to the cross-board activity feed.
 * Other members will see this when they build their context.
 *
 * Format: "[Member] discussed [topic] with the founder"
 * Content: Brief summary (not full messages, to save tokens)
 */
async function postToActivityFeed(
  userId: string,
  memberSlug: string,
  userMessage: string,
  aiResponse: string,
  topicCategory: string,
) {
  // Summarize the exchange briefly (first 200 chars of each)
  const summary = `Discussed ${topicCategory}: "${userMessage.substring(0, 120)}${userMessage.length > 120 ? '...' : ''}"`;

  try {
    await supabaseAdmin
      .from('board_activity_feed')
      .insert({
        user_id: userId,
        member_slug: memberSlug,
        activity_type: 'conversation',
        summary,
        topic_category: topicCategory,
        metadata: {
          message_preview: userMessage.substring(0, 200),
          response_preview: aiResponse.substring(0, 200),
        },
      });
  } catch (err: any) {
    // Check if table doesn't exist yet (pre-migration)
    if (err.message?.includes('relation') && err.message?.includes('does not exist')) {
      // Table not created yet — this is fine, will work after SQL migration
      return;
    }
    throw err;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Update meeting timestamp. Non-blocking.
 */
async function persistMeetingTimestamp(meetingId: string) {
  try {
    await supabaseAdmin
      .from('boardroom_meetings')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', meetingId);
  } catch {
    // Non-fatal: meeting table might not exist yet
  }
}