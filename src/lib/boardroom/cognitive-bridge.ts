// FILE: src/lib/boardroom/cognitive-bridge.ts
// Sprint 8: Cognitive Bridge — Oracle ↔ Board Orchestrator
//
// This is the main entry point for Sprint 8. It wires together:
//   - board-energy.ts    → Real-time energy detection for board conversations
//   - board-trust.ts     → Trust signal detection + calibration
//   - expertise-router.ts → Question routing to best-fit member
//   - memory-bridge.ts   → Oracle memory sharing with board context
//   - evolution.ts       → Existing DNA evolution (Sprint M)
//   - actions.ts         → Existing trust-gated actions (Sprint P)
//
// Called from: api/boardroom/chat.ts (per-message)
//              api/boardroom/cognitive.ts (dashboard)
//
// Flow per message:
//   1. Route question → identify primary + supporting members
//   2. Fetch user context from Oracle memory (filtered by member)
//   3. Detect room energy state
//   4. Build enriched prompt (base + trust + energy + context)
//   5. After response: detect trust signals, calibrate, persist
//   6. Evolve DNA (existing Sprint M logic)

import type { SupabaseClient } from '@supabase/supabase-js';
import { evolveBoarDna, type BoardMember, type InteractionResult } from './evolution.js';
// NOTE: buildBoardMemberPrompt was moved server-side (api/boardroom/lib/prompt-builder.ts)
// The caller passes a pre-built basePrompt into preResponse() instead.
import { detectMemberEnergy, detectRoomEnergy, persistMemberEnergy, buildEnergyPromptBlock, type BoardMessage, type RoomEnergy } from './board-energy.js';
import { detectTrustSignals, calibrateTrust, applyTrustCalibration, buildTrustPromptBlock, getTrustTier, type TrustSignal } from './board-trust.js';
import { routeQuestion, detectTopic, type RoutingResult } from './expertise-router.js';
import { fetchBoardMemberContext, buildContextPromptBlock, type BoardMemberContext } from './memory-bridge.js';

// =============================================================================
// TYPES
// =============================================================================

/** Full cognitive state for a board interaction */
export interface CognitiveState {
  routing: RoutingResult;
  roomEnergy: RoomEnergy;
  memberContext: BoardMemberContext;
  enrichedPrompt: string;
  trustTier: string;
}

/** Input for pre-response cognitive processing */
export interface PreResponseInput {
  userId: string;
  message: string;
  conversationHistory: BoardMessage[];
  participantSlugs: string[];
  /** The member who will respond (may be auto-routed or user-selected) */
  targetMember: BoardMember;
  /** Pre-built base system prompt from api/boardroom/lib/prompt-builder.ts */
  basePrompt: string;
  /** All available members (for routing) */
  allMembers: BoardMember[];
  /** Force this member (skip routing) — for 1:1 conversations */
  forceMember?: string;
}

/** Input for post-response cognitive processing */
export interface PostResponseInput {
  memberSlug: string;
  responseTime: number;
  wasFallback: boolean;
  wasCrossDomain: boolean;
  providerUsed: string;
  modelUsed: string;
  topicCategory: string;
  /** User reaction if known */
  userReaction?: 'accepted' | 'rejected' | 'neutral';
  /** Action outcome if an action was taken */
  actionOutcome?: 'succeeded' | 'failed' | null;
  /** Response quality assessment */
  responseQuality?: 'good' | 'hallucination' | 'missed_context' | 'normal';
}

/** Cognitive dashboard data (for API response) */
export interface CognitiveDashboard {
  roomEnergy: RoomEnergy;
  routing: RoutingResult;
  memberTrust: Array<{
    slug: string;
    name: string;
    trust: number;
    tier: string;
    energy: string;
  }>;
  recentSignals: TrustSignal[];
}

// =============================================================================
// PRE-RESPONSE: Prepare cognitive context before generating a response
// =============================================================================

/**
 * Run the full cognitive pipeline before generating a board member's response.
 * Returns an enriched system prompt with energy, trust, and user context.
 *
 * Called from api/boardroom/chat.ts BEFORE sending to the AI provider.
 */
export async function preResponse(
  supabase: SupabaseClient,
  input: PreResponseInput,
): Promise<CognitiveState> {
  const {
    userId,
    message,
    conversationHistory,
    participantSlugs,
    targetMember,
    basePrompt,
    allMembers,
    forceMember,
  } = input;

  // 1. Route the question (identifies topic + best member)
  const routing = routeQuestion(message, allMembers, {
    forceMember: forceMember || targetMember.slug,
  });

  // 2. Detect room energy
  const roomEnergy = detectRoomEnergy(conversationHistory, participantSlugs);

  // 3. Fetch user context from Oracle memory (filtered for this member)
  const memberContext = await fetchBoardMemberContext(supabase, {
    userId,
    memberSlug: targetMember.slug,
    memberRole: targetMember.role,
    memberExpertise: targetMember.expertise,
    currentTopic: routing.topic,
    maxMemories: 5,
  });

  // 4. Build enriched prompt (layers trust + energy + context on top of base)
  const enrichedPrompt = buildEnrichedPrompt(
    basePrompt,
    targetMember,
    roomEnergy,
    memberContext,
  );

  return {
    routing,
    roomEnergy,
    memberContext,
    enrichedPrompt,
    trustTier: getTrustTier(targetMember.trust_level),
  };
}

// =============================================================================
// POST-RESPONSE: Process signals after a response is generated
// =============================================================================

/**
 * Run post-response cognitive processing.
 * Detects trust signals, calibrates trust, evolves DNA, persists energy.
 *
 * Called from api/boardroom/chat.ts AFTER the AI response is sent.
 * Runs async — doesn't block the response to the user.
 */
export async function postResponse(
  supabase: SupabaseClient,
  input: PostResponseInput,
  roomEnergy: RoomEnergy,
): Promise<{
  trustSignals: TrustSignal[];
  trustDelta: number;
  newTrust: number;
  tierChanged: boolean;
}> {
  const {
    memberSlug,
    responseTime,
    wasFallback,
    wasCrossDomain,
    providerUsed,
    modelUsed,
    topicCategory,
    userReaction,
    actionOutcome,
    responseQuality,
  } = input;

  // 1. Detect trust signals from this interaction
  const trustSignals = detectTrustSignals({
    memberSlug,
    responseTime,
    wasFallback,
    wasCrossDomain,
    userReaction,
    actionOutcome,
    responseQuality,
  });

  // 2. Get current trust level
  const { data: member } = await supabase
    .from('boardroom_members')
    .select('trust_level')
    .eq('slug', memberSlug)
    .single();

  const currentTrust = member?.trust_level ?? 20;

  // 3. Calibrate trust
  let trustDelta = 0;
  let newTrust = currentTrust;
  let tierChanged = false;

  if (trustSignals.length > 0) {
    const calibration = calibrateTrust(currentTrust, trustSignals);
    trustDelta = calibration.trustDelta;
    newTrust = calibration.newTrust;
    tierChanged = calibration.tierChanged;

    // Persist trust changes
    await applyTrustCalibration(supabase, calibration);
  }

  // 4. Evolve DNA (existing Sprint M logic)
  const interactionResult: InteractionResult = {
    memberSlug,
    providerUsed,
    modelUsed,
    responseTime,
    wasFallback,
    wasCrossDomain,
    topicCategory,
    messageType: wasCrossDomain ? 'cross_domain' : 'chat',
  };
  await evolveBoarDna(supabase, interactionResult);

  // 5. Persist energy state for the member who just responded
  const memberEnergy = roomEnergy.members.find((m) => m.slug === memberSlug);
  if (memberEnergy) {
    await persistMemberEnergy(supabase, memberSlug, memberEnergy.energy);
  }

  return {
    trustSignals,
    trustDelta,
    newTrust,
    tierChanged,
  };
}

// =============================================================================
// ENRICHED PROMPT BUILDER
// =============================================================================

/**
 * Build the complete enriched system prompt for a board member.
 * Layers: base prompt (from server prompt-builder) + trust + energy + Oracle user context.
 */
function buildEnrichedPrompt(
  basePrompt: string,
  member: BoardMember,
  roomEnergy: RoomEnergy,
  context: BoardMemberContext,
): string {
  // Base prompt is pre-built by api/boardroom/lib/prompt-builder.ts
  // It already includes DNA, personality evolution, cross-domain capabilities

  // Trust layer (behavioral boundaries)
  const trustBlock = buildTrustPromptBlock(member.trust_level);

  // Energy layer (room awareness)
  const memberEnergy = roomEnergy.members.find((m) => m.slug === member.slug);
  const energyBlock = memberEnergy
    ? buildEnergyPromptBlock(memberEnergy, roomEnergy)
    : '';

  // User context layer (Oracle memory bridge)
  const contextBlock = buildContextPromptBlock(context, member.name);

  // Combine — order matters for prompt priority
  return [
    basePrompt,
    trustBlock,
    energyBlock,
    contextBlock,
  ]
    .filter(Boolean)
    .join('\n');
}

// =============================================================================
// DASHBOARD DATA (for API)
// =============================================================================

/**
 * Build cognitive dashboard data for the frontend.
 * Called by api/boardroom/cognitive.ts
 */
export async function getCognitiveDashboard(
  supabase: SupabaseClient,
  userId: string,
  message?: string,
): Promise<CognitiveDashboard> {
  // Get all members
  const { data: members } = await supabase
    .from('boardroom_members')
    .select('slug, name, title, role, ai_provider, trust_level, current_energy, expertise, total_interactions, cross_domain_assists, ai_dna, dominant_provider, personality, personality_evolution, system_prompt, evolved_prompt, ai_model, voice_style, provider_affinity, last_active_at')
    .order('display_order');

  const boardMembers = (members || []) as BoardMember[];

  // Room energy from current state
  const dummyMessages: BoardMessage[] = [];
  const participantSlugs = boardMembers.map((m) => m.slug);
  const roomEnergy = detectRoomEnergy(dummyMessages, participantSlugs);

  // Routing (if message provided)
  const routing = message
    ? routeQuestion(message, boardMembers)
    : routeQuestion('general board overview', boardMembers);

  // Member trust summary
  const memberTrust = boardMembers.map((m) => ({
    slug: m.slug,
    name: m.name,
    trust: m.trust_level,
    tier: getTrustTier(m.trust_level),
    energy: m.current_energy || 'neutral',
  }));

  // Recent trust signals
  const { data: recentSignalRows } = await supabase
    .from('board_trust_signals')
    .select('member_slug, signal_type, weight, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const recentSignals: TrustSignal[] = (recentSignalRows || []).map((s: any) => ({
    type: s.signal_type,
    weight: s.weight,
    reason: s.reason,
    memberSlug: s.member_slug,
    detectedAt: s.created_at,
  }));

  return {
    roomEnergy,
    routing,
    memberTrust,
    recentSignals,
  };
}