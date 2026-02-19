// FILE: api/boardroom/conversations.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARDROOM CONVERSATIONS — Persistence Layer
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 1: Conversation Persistence
//
// Close the tab, come back tomorrow — the conversation is still there.
// Board members remember because the server remembers.
//
// ROUTES:
//   GET    ?member_slug=athena          → Active conversation with Athena
//   GET    ?member_slug=athena&all=true → All conversations with Athena
//   GET    ?id=<uuid>                   → Specific conversation by ID
//   GET    (no params)                  → All active conversations (sidebar)
//   POST   { member_slug, meeting_type? } → Create new conversation
//   PATCH  { id, action, ... }          → Update (rename, archive, add message)
//   DELETE ?id=<uuid>                   → Soft delete (is_active = false)
//
// MOBILE-FIRST:
//   - List endpoints return lightweight payloads (no messages JSONB)
//   - Full messages only loaded when opening a specific conversation
//   - message_count and last_message_at are denormalized for fast reads
//   - Partial index on (user_id, member_slug) WHERE is_active = true
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';
import { getSupaAdmin } from './lib/provider-caller.js';

// ═══════════════════════════════════════════════════════════════════════

export const config = {
  maxDuration: 30, // Lightweight CRUD — no AI calls
};

const supabaseAdmin = getSupaAdmin();

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // ── Verify boardroom access ─────────────────────────
    const { data: accessRow } = await supabaseAdmin
      .from('boardroom_access')
      .select('access_level')
      .eq('user_id', user.id)
      .single();

    if (!accessRow) {
      return res.status(403).json({ error: 'You do not have boardroom access.' });
    }

    // ══════════════════════════════════════════════════════
    // GET: List or fetch conversations
    // ══════════════════════════════════════════════════════

    if (req.method === 'GET') {
      return handleGet(req, res, user.id);
    }

    // ══════════════════════════════════════════════════════
    // POST: Create new conversation
    // ══════════════════════════════════════════════════════

    if (req.method === 'POST') {
      return handlePost(req, res, user.id);
    }

    // ══════════════════════════════════════════════════════
    // PATCH: Update conversation
    // ══════════════════════════════════════════════════════

    if (req.method === 'PATCH') {
      return handlePatch(req, res, user.id);
    }

    // ══════════════════════════════════════════════════════
    // DELETE: Soft delete (archive)
    // ══════════════════════════════════════════════════════

    if (req.method === 'DELETE') {
      return handleDelete(req, res, user.id);
    }

    // ── Method not allowed ──────────────────────────────
    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication') || errMsg.includes('token')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('[Conversations] Error:', errMsg);
    return res.status(500).json({ error: 'Failed to process conversation request.' });
  }
}

// =============================================================================
// GET HANDLER
// =============================================================================

async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
) {
  const {
    id,
    member_slug,
    all,
    limit: queryLimit,
    include_messages,
  } = req.query;

  // ── Specific conversation by ID ───────────────────────
  // Returns FULL messages payload (only when opening a conversation)
  if (id) {
    const { data: conversation, error } = await supabaseAdmin
      .from('boardroom_conversations')
      .select('*')
      .eq('id', id as string)
      .eq('user_id', userId)
      .single();

    if (error || !conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    return res.status(200).json(conversation);
  }

  // ── Conversations with a specific member ──────────────
  if (member_slug) {
    const slug = member_slug as string;

    // Default: return only the active conversation (lightweight)
    if (all !== 'true') {
      const { data: active } = await supabaseAdmin
        .from('boardroom_conversations')
        .select(include_messages === 'true'
          ? '*'
          : 'id, member_slug, meeting_type, title, message_count, compressed_summary, is_active, last_message_at, created_at'
        )
        .eq('user_id', userId)
        .eq('member_slug', slug)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return res.status(200).json({
        active: active || null,
        member_slug: slug,
      });
    }

    // all=true: return full conversation history for this member
    const limit = Math.min(parseInt(queryLimit as string) || 20, 50);

    const { data: conversations } = await supabaseAdmin
      .from('boardroom_conversations')
      .select('id, member_slug, meeting_type, title, message_count, compressed_summary, is_active, last_message_at, created_at')
      .eq('user_id', userId)
      .eq('member_slug', slug)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    return res.status(200).json({
      conversations: conversations || [],
      member_slug: slug,
      count: (conversations || []).length,
    });
  }

  // ── All active conversations (sidebar list) ───────────
  // Lightweight: no messages, just metadata for the conversation list
  const limit = Math.min(parseInt(queryLimit as string) || 30, 50);

  const { data: conversations } = await supabaseAdmin
    .from('boardroom_conversations')
    .select('id, member_slug, meeting_type, title, message_count, is_active, last_message_at, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false })
    .limit(limit);

  return res.status(200).json({
    conversations: conversations || [],
    count: (conversations || []).length,
  });
}

// =============================================================================
// POST HANDLER — Create new conversation
// =============================================================================

async function handlePost(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
) {
  const { member_slug, meeting_type, title } = req.body;

  if (!member_slug) {
    return res.status(400).json({ error: 'member_slug is required.' });
  }

  // Validate member exists
  const { data: member } = await supabaseAdmin
    .from('boardroom_members')
    .select('slug, name')
    .eq('slug', member_slug)
    .single();

  if (!member) {
    return res.status(404).json({ error: `Board member "${member_slug}" not found.` });
  }

  // Archive any existing active conversation with this member
  // One active conversation per user × member at a time
  await supabaseAdmin
    .from('boardroom_conversations')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('member_slug', member_slug)
    .eq('is_active', true);

  // Create new conversation
  const { data: conversation, error } = await supabaseAdmin
    .from('boardroom_conversations')
    .insert({
      user_id: userId,
      member_slug,
      meeting_type: meeting_type || 'one_on_one',
      title: title || null,
      messages: [],
      message_count: 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[Conversations] Create failed:', error);
    return res.status(500).json({ error: 'Failed to create conversation.' });
  }

  return res.status(201).json(conversation);
}

// =============================================================================
// PATCH HANDLER — Update conversation
// =============================================================================

async function handlePatch(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
) {
  const { id, action, title } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Conversation id is required.' });
  }

  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .from('boardroom_conversations')
    .select('id, user_id, is_active, message_count')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!existing) {
    return res.status(404).json({ error: 'Conversation not found.' });
  }

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  switch (action) {
    // ── Rename ──────────────────────────────────────────
    case 'rename':
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'title is required for rename.' });
      }
      updates.title = title.substring(0, 200);
      break;

    // ── Archive (soft close) ────────────────────────────
    case 'archive':
      updates.is_active = false;
      break;

    // ── Reactivate ──────────────────────────────────────
    case 'reactivate':
      // Archive any other active conversation with same member first
      const { data: conv } = await supabaseAdmin
        .from('boardroom_conversations')
        .select('member_slug')
        .eq('id', id)
        .single();

      if (conv) {
        await supabaseAdmin
          .from('boardroom_conversations')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('member_slug', conv.member_slug)
          .eq('is_active', true)
          .neq('id', id);
      }
      updates.is_active = true;
      break;

    // ── Direct field updates (fallthrough) ──────────────
    default:
      if (title !== undefined) updates.title = title;
      break;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('boardroom_conversations')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, member_slug, meeting_type, title, message_count, is_active, last_message_at, created_at, updated_at')
    .single();

  if (error) {
    console.error('[Conversations] Update failed:', error);
    return res.status(500).json({ error: 'Failed to update conversation.' });
  }

  return res.status(200).json(updated);
}

// =============================================================================
// DELETE HANDLER — Soft delete
// =============================================================================

async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Conversation id required (query param).' });
  }

  const { data: conversation, error } = await supabaseAdmin
    .from('boardroom_conversations')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id as string)
    .eq('user_id', userId)
    .select('id, member_slug, is_active')
    .single();

  if (error || !conversation) {
    return res.status(404).json({ error: 'Conversation not found.' });
  }

  return res.status(200).json({
    success: true,
    conversation,
  });
}