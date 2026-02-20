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
//   Build prompt (9 layers) → Cognitive bridge (enrich prompt) →
//   Call provider → Persist exchange → Respond →
//   Background tasks + cognitive postResponse (fire and forget)
//
// Sprint 3: Meeting summaries (Layer 9) fetched in parallel with
// existing memory/feed/decisions. Zero added latency.
//
// Sprint 8: Cognitive Bridge wired in.
//   preResponse() adds 3 layers on TOP of the 9-layer prompt:
//     - Trust boundaries (behavioral guardrails per trust tier)
//     - Room energy awareness (cross-member energy state)
//     - Oracle user context (memory bridge — user data for this member)
//   postResponse() runs fire-and-forget after response:
//     - Detects trust signals from the interaction
//     - Calibrates trust score (up or down)
//     - Evolves AI DNA (provider/model affinity)
//     - Persists energy state
//
//   SAFETY: Both hooks are wrapped in try/catch. If the bridge fails,
//   the original 9-layer prompt still works. Bridge is additive, never
//   required. The board never goes down because of Sprint 8.
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

// ── Sprint 8: Cognitive Bridge ──────────────────────────
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

  // ── Sprint 8: Cognitive Bridge — preResponse ──────────
  // Adds trust boundaries, room energy, and Oracle user context
  // on TOP of the 9-layer prompt. If it fails, we use the original.
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
    // Falls back to the 9-layer systemPrompt — bridge is additive, not required
  }

  // ── Call provider via gateway ─────────────────────────
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
      // Sprint 8: Cognitive bridge metadata
      cognitiveBridge: cognitiveState ? {
        routedTopic: cognitiveState.routing.topic,
        routedPrimary: cognitiveState.routing.primaryMember,
        roomEnergyState: cognitiveState.roomEnergy.overall,
        trustTierFromBridge: cognitiveState.trustTier,
        oracleContextInjected: !!cognitiveState.memberContext,
      } : null,
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

  // ── Sprint 8: Cognitive Bridge — postResponse ─────────
  // Runs AFTER response is sent. Detects trust signals, calibrates
  // trust score, evolves AI DNA, persists energy. Fire and forget.
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