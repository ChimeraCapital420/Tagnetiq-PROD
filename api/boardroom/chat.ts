// FILE: api/boardroom/chat.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARDROOM CHAT — Thin Orchestrator
// ═══════════════════════════════════════════════════════════════════════
//
// BEFORE: 1,008 lines — types, persistence, handlers, background tasks,
//         helpers all tangled in one file. One typo breaks everything.
//
// AFTER:  ~180 lines — validates the request, detects energy/topic,
//         routes to the correct handler. All logic lives in:
//
//   api/boardroom/lib/chat/
//   ├── index.ts              # Barrel exports
//   ├── types.ts              # All types + config constants
//   ├── conversations.ts      # DB persistence (load/create/compress)
//   ├── single-member.ts      # 1:1 chat handler
//   ├── multi-member.ts       # Committee + full board handlers
//   └── background-tasks.ts   # Post-response fire-and-forget work
//
// A bug in compression? Fix conversations.ts. Doesn't touch handlers.
// New meeting type? Add a handler file. Doesn't touch persistence.
// Energy detection change? This file + energy.ts. Nothing else.
//
// Sprint 9 (Gap #2): Server validation of clientContext.
//   The boardroom frontend (useMeeting.ts → useBoardroomIntelligence.ts)
//   sends clientContext with every message: energy, routing hints, room
//   state, cached trust data, and device info. This was previously
//   ignored — the server re-detected energy and topic from scratch.
//
//   Now: server VALIDATES client hints against known valid values.
//   If valid, uses them (skips ~50ms of server-side detection).
//   If invalid or missing, falls back to server-side detection.
//   Zero risk — client hints are convenience, never trusted blindly.
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';
import { getSupaAdmin } from './lib/provider-caller.js';

// ── Energy Detection (pure functions, zero API cost) ────
import { detectEnergy, detectEnergyArc } from '../../src/lib/boardroom/energy.js';

// ── Topic Detection ─────────────────────────────────────
import { detectTopicCategory } from '../../src/lib/boardroom/evolution.js';

// ── Modular Chat Handlers ───────────────────────────────
import {
  handleSingleMemberChat,
  handleCommitteeMeeting,
  handleFullBoardMeeting,
  VALID_MEETING_TYPES,
} from './lib/chat/index.js';

// ═══════════════════════════════════════════════════════════════════════
// Sprint 9: Client Context Validation
// ═══════════════════════════════════════════════════════════════════════

/** Valid energy types — must match EnergyLevel from boardroom/energy.ts */
const VALID_ENERGIES = new Set([
  'fired_up', 'focused', 'neutral', 'frustrated',
  'anxious', 'exhausted', 'curious', 'celebratory',
  // Also accept Oracle-side energy names (client may use either)
  'excited', 'casual',
]);

/** Valid topic categories — must match detectTopicCategory output */
const VALID_TOPICS = new Set([
  'strategy', 'technical', 'marketing', 'legal', 'hr',
  'data', 'product', 'research', 'science', 'innovation',
  'operations', 'psychology', 'financial', 'general',
]);

/** Valid device types */
const VALID_DEVICES = new Set(['mobile', 'tablet', 'desktop']);

/**
 * Validate and extract usable hints from clientContext.
 * Returns validated values or null for each field.
 * Server detection is used as fallback for any invalid/missing hint.
 */
function validateClientContext(clientContext: any): {
  energy: string | null;
  topic: string | null;
  routingSlug: string | null;
  deviceType: string;
} {
  if (!clientContext || typeof clientContext !== 'object') {
    return { energy: null, topic: null, routingSlug: null, deviceType: 'unknown' };
  }

  // Validate energy
  const clientEnergy = clientContext.energy?.type;
  const energy = (typeof clientEnergy === 'string' && VALID_ENERGIES.has(clientEnergy))
    ? clientEnergy
    : null;

  // Validate topic
  const clientTopic = clientContext.routing?.topic;
  const topic = (typeof clientTopic === 'string' && VALID_TOPICS.has(clientTopic))
    ? clientTopic
    : null;

  // Validate routing slug (basic string check — handler verifies member exists)
  const clientSlug = clientContext.routing?.predictedPrimarySlug;
  const routingSlug = (typeof clientSlug === 'string' && clientSlug.length > 0 && clientSlug.length < 50)
    ? clientSlug
    : null;

  // Validate device type
  const clientDevice = clientContext.device?.type;
  const deviceType = (typeof clientDevice === 'string' && VALID_DEVICES.has(clientDevice))
    ? clientDevice
    : 'unknown';

  return { energy, topic, routingSlug, deviceType };
}

// ═══════════════════════════════════════════════════════════════════════

export const config = {
  maxDuration: 60, // Vercel Pro — no more 504 timeouts
};

const supabaseAdmin = getSupaAdmin();

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
      conversation_id,
      conversation_history,
      mention_all,
      meeting_type,
      committee_members,
      clientContext,
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
      .select('access_level, expires_at')
      .eq('user_id', user.id)
      .single();

    if (!accessRow) {
      return res.status(403).json({ error: 'You do not have boardroom access.' });
    }

    // ── 2. VALIDATE CLIENT CONTEXT (Sprint 9) ───────────
    // Trust client hints when valid, fall back to server detection.
    // Saves ~50ms server-side when client gets it right.
    const validated = validateClientContext(clientContext);

    // ── 3. DETECT ENERGY + TOPIC ────────────────────────
    // Use validated client hint → skip server detection.
    // If client hint is null (missing or invalid) → server detects.
    const founderEnergy = validated.energy
      ? (validated.energy as any)
      : detectEnergy(message);

    const founderArc = conversation_history?.length > 2
      ? detectEnergyArc(conversation_history)
      : 'steady';

    const topicCategory = validated.topic
      ? validated.topic
      : detectTopicCategory(message);

    // Resolve meeting type
    const effectiveMeetingType = meeting_type && VALID_MEETING_TYPES.includes(meeting_type)
      ? meeting_type
      : (mention_all ? 'full_board' : 'one_on_one');

    // ── 4. ROUTE TO HANDLER ─────────────────────────────

    // 1:1 Chat
    if (member_slug && !mention_all) {
      return handleSingleMemberChat(req, res, {
        userId: user.id,
        meetingId: meeting_id,
        memberSlug: member_slug,
        message,
        conversationId: conversation_id,
        legacyHistory: conversation_history || [],
        meetingType: effectiveMeetingType,
        founderEnergy,
        founderArc,
        topicCategory,
      });
    }

    // Committee (2-4 members)
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

    // Full Board (@all)
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

    // No valid route
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
