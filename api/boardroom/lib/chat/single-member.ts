// FILE: api/boardroom/lib/chat/single-member.ts
// ═══════════════════════════════════════════════════════════════════════
// CHAT MODULE — Single Member Handler
// ═══════════════════════════════════════════════════════════════════════
//
// v10.0: mediaAttachments passed into buildBoardMemberPrompt as Layer 10.
//        Each member receives documents/URLs/images domain-filtered
//        through their expertise lens. Zero breaking changes.
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

import {
  preResponse,
  postResponse,
  type CognitiveState,
} from '../../../../src/lib/boardroom/cognitive-bridge.js';

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
    mediaAttachments,   // v10.0
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

  const conversationHistory = conversation.messages.length > 0
    ? conversation.messages
    : legacyHistory;

  const effectiveArc: EnergyArc = conversationHistory.length > 2
    ? detectEnergyArc(conversationHistory)
    : founderArc;

  // ── Fetch memory + context (parallel) ─────────────────
  const [founderMemory, crossBoardFeed, recentDecisions, meetingSummaries] = await Promise.all([
    getFounderMemory(supabaseAdmin, userId, memberSlug).catch((err) => {
      console.warn(`[Chat] Memory fetch failed for ${memberSlug}:`, err.message);
      return null;
    }),
    getCrossBoardFeed(supabaseAdmin, userId, memberSlug).catch(() => []),
    getRecentDecisions(supabaseAdmin, userId).catch(() => []),
    getRecentMeetingSummaries(supabaseAdmin, userId, 3).catch(() => []),
  ]);

  // ── Build rich prompt (10 layers) ─────────────────────
  // v10.0: mediaAttachments injected as Layer 10
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
    mediaAttachments: mediaAttachments || [],   // v10.0
  });

  // ── Sprint 8: Cognitive Bridge — preResponse ──────────
  let finalSystemPrompt = systemPrompt;
  let cognitiveState: CognitiveState | null = null;

  try {
    cognitiveState = await preResponse(supabaseAdmin, {
      userId,
      message,
      conversationHistory: conversationHistory as any[],
      participantSlugs: [memberSlug],
      targetMember: boardMember,
      basePrompt: systemPrompt,
      allMembers: [boardMember],
      forceMember: memberSlug,
    });
    finalSystemPrompt = cognitiveState.enrichedPrompt;
  } catch (err: any) {
    console.warn(`[CognitiveBridge] preResponse failed for ${memberSlug}:`, err.message);
  }

  // ── Call provider ─────────────────────────────────────
  const result = await callWithFallback(
    boardMember.dominant_provider || boardMember.ai_provider,
    boardMember.ai_model,
    finalSystemPrompt,
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
      mediaAttachmentsProcessed: (mediaAttachments || []).length,  // v10.0
      cognitiveBridge: cognitiveState ? {
        routedTopic: cognitiveState.routing.topic,
        roomEnergyState: cognitiveState.roomEnergy.overall,
        trustTierFromBridge: cognitiveState.trustTier,
        oracleContextInjected: !!cognitiveState.memberContext,
      } : null,
    },
  });

  // ── Background tasks ──────────────────────────────────
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

  // ── Sprint 8: Cognitive Bridge — postResponse ─────────
  if (cognitiveState) {
    postResponse(supabaseAdmin, {
      memberSlug,
      responseTime: result.responseTime,
      wasFallback: result.isFallback,
      wasCrossDomain: crossDomain,
      providerUsed: result.provider,
      modelUsed: result.model,
      topicCategory,
    }, cognitiveState.roomEnergy).catch((err) => {
      console.warn(`[CognitiveBridge] postResponse failed for ${memberSlug}:`, err.message);
    });
  }
}