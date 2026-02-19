// FILE: api/boardroom/chat.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARDROOM CHAT — Thin Orchestrator
// ═══════════════════════════════════════════════════════════════════════
//
// BEFORE: 1,008 lines — types, persistence, handlers, background tasks,
//         helpers all tangled in one file. One typo breaks everything.
//
// AFTER:  ~140 lines — validates the request, detects energy/topic,
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

    // ── 2. DETECT ENERGY + TOPIC (zero cost, instant) ──
    const founderEnergy = detectEnergy(message);
    const founderArc = conversation_history?.length > 2
      ? detectEnergyArc(conversation_history)
      : 'steady';
    const topicCategory = detectTopicCategory(message);

    // Resolve meeting type
    const effectiveMeetingType = meeting_type && VALID_MEETING_TYPES.includes(meeting_type)
      ? meeting_type
      : (mention_all ? 'full_board' : 'one_on_one');

    // ── 3. ROUTE TO HANDLER ─────────────────────────────

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