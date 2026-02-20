// FILE: src/lib/boardroom/board-energy.ts
// Sprint 8: Board Energy Detection
//
// Wraps the Oracle's energy detection engine for board member conversations.
// Oracle energy.ts handles single-user conversations.
// Board energy handles MULTI-MEMBER conversations where each member
// has their own energy state + there's a collective "room energy."
//
// Mobile-first: all detection runs on server at response time.
// Client-side: Sprint 7 components display energy via EnergyIndicator.

import type { SupabaseClient } from '@supabase/supabase-js';
import { detectEnergy, detectEnergyArc } from '../oracle/personality/energy.js';
import type { EnergyLevel, EnergyArc } from '../../components/oracle/types.js';

// =============================================================================
// TYPES
// =============================================================================

/** Energy state for a single board member in context */
export interface MemberEnergy {
  slug: string;
  energy: EnergyLevel;
  arc: EnergyArc;
  lastMessageAt: string | null;
  messageCount: number;
  /** How engaged this member is in the current conversation */
  engagement: 'active' | 'contributing' | 'listening' | 'idle';
}

/** Collective energy of the boardroom */
export interface RoomEnergy {
  overall: EnergyLevel;
  arc: EnergyArc;
  members: MemberEnergy[];
  /** Dominant mood — what most members are feeling */
  dominantMood: EnergyLevel;
  /** Tension level — disagreement or conflict detected */
  tension: 'none' | 'low' | 'medium' | 'high';
  /** Momentum — is the room moving toward decisions or stalling */
  momentum: 'stalled' | 'building' | 'peaked' | 'winding_down';
  updatedAt: string;
}

/** A message with its speaker for multi-member analysis */
export interface BoardMessage {
  role: 'user' | 'assistant';
  content: string;
  memberSlug?: string;
  timestamp?: string;
}

// =============================================================================
// SINGLE MEMBER ENERGY
// =============================================================================

/**
 * Detect energy for a single board member based on their recent messages.
 * Re-uses Oracle's detectEnergy for the latest message and detectEnergyArc
 * for trajectory across the conversation.
 */
export function detectMemberEnergy(
  memberSlug: string,
  messages: BoardMessage[],
): MemberEnergy {
  // Filter to this member's messages only
  const memberMessages = messages.filter(
    (m) => m.memberSlug === memberSlug && m.role === 'assistant'
  );

  if (memberMessages.length === 0) {
    return {
      slug: memberSlug,
      energy: 'neutral',
      arc: 'steady',
      lastMessageAt: null,
      messageCount: 0,
      engagement: 'idle',
    };
  }

  // Latest message energy (Oracle's engine)
  const latest = memberMessages[memberMessages.length - 1];
  const energy = detectEnergy(latest.content);

  // Arc across their recent messages
  const arcMessages = memberMessages.slice(-8).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const arc = detectEnergyArc(arcMessages);

  // Engagement based on message frequency and recency
  const engagement = classifyEngagement(memberMessages, messages);

  return {
    slug: memberSlug,
    energy,
    arc,
    lastMessageAt: latest.timestamp || null,
    messageCount: memberMessages.length,
    engagement,
  };
}

// =============================================================================
// ROOM ENERGY (COLLECTIVE)
// =============================================================================

/**
 * Analyze the energy of the entire boardroom.
 * Combines individual member energies into a collective state.
 */
export function detectRoomEnergy(
  messages: BoardMessage[],
  participantSlugs: string[],
): RoomEnergy {
  // Detect each member's energy
  const memberEnergies = participantSlugs.map((slug) =>
    detectMemberEnergy(slug, messages)
  );

  // Also factor in user messages for overall tone
  const userMessages = messages
    .filter((m) => m.role === 'user')
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content }));

  const userEnergy = userMessages.length > 0
    ? detectEnergy(userMessages[userMessages.length - 1].content)
    : 'neutral';
  const userArc = detectEnergyArc(userMessages);

  // Aggregate: find dominant mood
  const allEnergies = [
    userEnergy,
    ...memberEnergies.map((m) => m.energy),
  ];
  const dominantMood = findDominantEnergy(allEnergies);

  // Detect tension: conflicting energies between members
  const tension = detectTension(memberEnergies, userEnergy);

  // Detect momentum from the conversation arc
  const allMessages = messages.slice(-12).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const overallArc = detectEnergyArc(allMessages);
  const momentum = arcToMomentum(overallArc, allMessages.length);

  // Overall room energy blends user + dominant member energy
  const overall = blendEnergies(userEnergy, dominantMood);

  return {
    overall,
    arc: overallArc,
    members: memberEnergies,
    dominantMood,
    tension,
    momentum,
    updatedAt: new Date().toISOString(),
  };
}

// =============================================================================
// PERSIST ENERGY STATE
// =============================================================================

/**
 * Update a board member's energy in the database after a conversation turn.
 * Called from the chat endpoint after generating a response.
 */
export async function persistMemberEnergy(
  supabase: SupabaseClient,
  memberSlug: string,
  energy: EnergyLevel,
): Promise<void> {
  await supabase
    .from('boardroom_members')
    .update({
      current_energy: energy,
      last_active_at: new Date().toISOString(),
    })
    .eq('slug', memberSlug);
}

/**
 * Batch update energy for all active members after a meeting turn.
 */
export async function persistRoomEnergy(
  supabase: SupabaseClient,
  roomEnergy: RoomEnergy,
): Promise<void> {
  const updates = roomEnergy.members
    .filter((m) => m.engagement !== 'idle')
    .map((m) =>
      supabase
        .from('boardroom_members')
        .update({
          current_energy: m.energy,
          last_active_at: m.lastMessageAt || new Date().toISOString(),
        })
        .eq('slug', m.slug)
    );

  await Promise.allSettled(updates);
}

// =============================================================================
// ENERGY → PROMPT INJECTION
// =============================================================================

/**
 * Build a prompt block that tells a board member about the room's energy.
 * Injected into their system prompt so they can adapt their tone.
 */
export function buildEnergyPromptBlock(
  memberEnergy: MemberEnergy,
  roomEnergy: RoomEnergy,
): string {
  const lines: string[] = ['\nROOM ENERGY STATUS:'];

  // Their own state
  lines.push(`Your current energy: ${memberEnergy.energy} (${memberEnergy.arc})`);

  // Room state
  lines.push(`Room mood: ${roomEnergy.dominantMood}, momentum: ${roomEnergy.momentum}`);

  if (roomEnergy.tension !== 'none') {
    lines.push(`Tension level: ${roomEnergy.tension} — tread thoughtfully`);
  }

  // Behavioral guidance based on energy
  const guidance = getEnergyGuidance(memberEnergy.energy, roomEnergy);
  if (guidance) {
    lines.push(`Guidance: ${guidance}`);
  }

  return lines.join('\n');
}

// =============================================================================
// HELPERS
// =============================================================================

function classifyEngagement(
  memberMessages: BoardMessage[],
  allMessages: BoardMessage[],
): MemberEnergy['engagement'] {
  if (memberMessages.length === 0) return 'idle';

  const totalMessages = allMessages.length;
  const memberCount = memberMessages.length;
  const ratio = memberCount / Math.max(totalMessages, 1);

  // Check recency — are they in the last few messages?
  const lastFew = allMessages.slice(-5);
  const recentlySpoke = lastFew.some(
    (m) => m.memberSlug === memberMessages[0]?.memberSlug
  );

  if (recentlySpoke && ratio > 0.15) return 'active';
  if (recentlySpoke) return 'contributing';
  if (memberCount > 0) return 'listening';
  return 'idle';
}

function findDominantEnergy(energies: EnergyLevel[]): EnergyLevel {
  const counts: Record<string, number> = {};
  for (const e of energies) {
    counts[e] = (counts[e] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (sorted[0]?.[0] as EnergyLevel) || 'neutral';
}

function detectTension(
  memberEnergies: MemberEnergy[],
  userEnergy: EnergyLevel,
): RoomEnergy['tension'] {
  const energies = [userEnergy, ...memberEnergies.map((m) => m.energy)];

  const hasExcited = energies.includes('excited');
  const hasFrustrated = energies.includes('frustrated');
  const hasFocused = energies.includes('focused');
  const hasCasual = energies.includes('casual');

  // Direct conflict: excited vs frustrated
  if (hasExcited && hasFrustrated) return 'high';

  // Mild tension: focused work vs casual chat
  if (hasFocused && hasCasual) return 'low';

  // Multiple frustrated members
  const frustratedCount = energies.filter((e) => e === 'frustrated').length;
  if (frustratedCount >= 2) return 'medium';

  return 'none';
}

function arcToMomentum(
  arc: EnergyArc,
  messageCount: number,
): RoomEnergy['momentum'] {
  if (messageCount < 3) return 'building';

  switch (arc) {
    case 'building_excitement':
    case 'exploring':
    case 'learning':
      return 'building';
    case 'celebrating':
    case 'problem_solving':
      return 'peaked';
    case 'losing_interest':
    case 'venting':
      return 'stalled';
    default:
      return messageCount > 15 ? 'winding_down' : 'building';
  }
}

function blendEnergies(
  userEnergy: EnergyLevel,
  memberDominant: EnergyLevel,
): EnergyLevel {
  // User energy has priority — the room should respond to them
  if (userEnergy === 'frustrated') return 'focused'; // Room focuses to help
  if (userEnergy === 'excited') return 'excited'; // Room matches enthusiasm
  return memberDominant;
}

function getEnergyGuidance(
  memberEnergy: EnergyLevel,
  room: RoomEnergy,
): string | null {
  if (room.tension === 'high') {
    return 'Room is tense. Acknowledge the friction, seek common ground.';
  }
  if (room.momentum === 'stalled') {
    return 'Conversation is stalling. Inject energy — ask a provocative question or propose a concrete next step.';
  }
  if (room.overall === 'frustrated' && memberEnergy !== 'frustrated') {
    return 'User is frustrated. Be empathetic but solution-oriented. No corporate platitudes.';
  }
  if (room.overall === 'excited') {
    return 'Positive energy. Build on it, but ground decisions in data.';
  }
  return null;
}