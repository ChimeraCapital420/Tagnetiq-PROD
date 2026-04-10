// FILE: api/boardroom/chat.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARDROOM CHAT — Thin Orchestrator
// ═══════════════════════════════════════════════════════════════════════
//
// v10.0: Added mediaAttachments field.
//   CEO can now attach documents, URLs, and images to board messages.
//   Each member receives media pre-filtered through their domain lens.
//   Zero breaking changes — mediaAttachments is optional.
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';
import { getSupaAdmin } from './lib/provider-caller.js';

import { detectEnergy, detectEnergyArc } from '../../src/lib/boardroom/energy.js';
import { detectTopicCategory } from '../../src/lib/boardroom/evolution.js';

import {
  handleSingleMemberChat,
  handleCommitteeMeeting,
  handleFullBoardMeeting,
  VALID_MEETING_TYPES,
} from './lib/chat/index.js';

import type { MediaAttachment } from './lib/prompt-builder/media-context.js';

// ── Client Context Validation (Sprint 9) ────────────────

const VALID_ENERGIES = new Set([
  'fired_up', 'focused', 'neutral', 'frustrated',
  'anxious', 'exhausted', 'curious', 'celebratory',
  'excited', 'casual',
]);

const VALID_TOPICS = new Set([
  'strategy', 'technical', 'marketing', 'legal', 'hr',
  'data', 'product', 'research', 'science', 'innovation',
  'operations', 'psychology', 'financial', 'general',
]);

const VALID_DEVICES = new Set(['mobile', 'tablet', 'desktop']);

function validateClientContext(clientContext: any): {
  energy: string | null;
  topic: string | null;
  routingSlug: string | null;
  deviceType: string;
} {
  if (!clientContext || typeof clientContext !== 'object') {
    return { energy: null, topic: null, routingSlug: null, deviceType: 'unknown' };
  }

  const clientEnergy = clientContext.energy?.type;
  const energy = (typeof clientEnergy === 'string' && VALID_ENERGIES.has(clientEnergy))
    ? clientEnergy : null;

  const clientTopic = clientContext.routing?.topic;
  const topic = (typeof clientTopic === 'string' && VALID_TOPICS.has(clientTopic))
    ? clientTopic : null;

  const clientSlug = clientContext.routing?.predictedPrimarySlug;
  const routingSlug = (typeof clientSlug === 'string' && clientSlug.length > 0 && clientSlug.length < 50)
    ? clientSlug : null;

  const clientDevice = clientContext.device?.type;
  const deviceType = (typeof clientDevice === 'string' && VALID_DEVICES.has(clientDevice))
    ? clientDevice : 'unknown';

  return { energy, topic, routingSlug, deviceType };
}

// ── Media Attachment Validation (v10.0) ──────────────────

function validateMediaAttachments(raw: any): MediaAttachment[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(a => a && typeof a === 'object')
    .filter(a => ['document', 'url', 'image'].includes(a.type))
    .filter(a => typeof a.content === 'string' && a.content.length > 0)
    .slice(0, 5) // Cap at 5 attachments per message
    .map(a => ({
      type: a.type,
      fileName:         a.fileName         || undefined,
      mimeType:         a.mimeType         || undefined,
      wordCount:        a.wordCount        || undefined,
      pageCount:        a.pageCount        || undefined,
      truncated:        a.truncated        || false,
      url:              a.url              || undefined,
      domain:           a.domain           || undefined,
      title:            a.title            || undefined,
      domainFiltered:   a.domainFiltered   || false,
      imageDescription: a.imageDescription || undefined,
      visionMode:       a.visionMode       || undefined,
      content:          a.content.substring(0, 10000), // Cap per attachment
      summary:          a.summary          || undefined,
      citations:        Array.isArray(a.citations) ? a.citations : [],
    }));
}

// ════════════════════════════════════════════════════════

export const config = {
  maxDuration: 60,
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
      mediaAttachments: rawMediaAttachments, // v10.0
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

    // ── Validate client context (Sprint 9) ──────────────
    const validated = validateClientContext(clientContext);

    // ── Validate media attachments (v10.0) ──────────────
    const mediaAttachments = validateMediaAttachments(rawMediaAttachments);

    if (mediaAttachments.length > 0) {
      console.log(`[Boardroom] ${mediaAttachments.length} media attachment(s) for ${member_slug || 'board'}`);
    }

    // ── Detect energy + topic ────────────────────────────
    const founderEnergy = validated.energy
      ? (validated.energy as any)
      : detectEnergy(message);

    const founderArc = conversation_history?.length > 2
      ? detectEnergyArc(conversation_history)
      : 'steady';

    const topicCategory = validated.topic
      ? validated.topic
      : detectTopicCategory(message);

    const effectiveMeetingType = meeting_type && VALID_MEETING_TYPES.includes(meeting_type)
      ? meeting_type
      : (mention_all ? 'full_board' : 'one_on_one');

    // ── Route to handler ─────────────────────────────────

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
        mediaAttachments,    // v10.0
      });
    }

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
        mediaAttachments,    // v10.0
      });
    }

    if (mention_all) {
      return handleFullBoardMeeting(req, res, {
        userId: user.id,
        meetingId: meeting_id,
        message,
        meetingType: effectiveMeetingType,
        founderEnergy,
        founderArc,
        topicCategory,
        mediaAttachments,    // v10.0
      });
    }

    return res.status(400).json({
      error: 'Provide "member_slug", "committee_members", or "mention_all: true".',
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