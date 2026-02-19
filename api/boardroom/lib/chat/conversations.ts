// FILE: api/boardroom/lib/chat/conversations.ts
// ═══════════════════════════════════════════════════════════════════════
// CHAT MODULE — Conversation Persistence
// ═══════════════════════════════════════════════════════════════════════
//
// Server-side conversation management for board member threads.
// Close the tab, come back tomorrow — the conversation is still there.
//
// Functions:
//   loadOrCreateConversation  — Find active thread or start a new one
//   persistExchange           — Append user msg + AI response to DB
//   compressAndArchive        — At threshold: compress → archive → fresh
//
// Mobile-first: Client sends conversation_id. Server holds truth.
//
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';
import { compressBoardThread } from '../../../../src/lib/boardroom/memory/founder-memory.js';
import { COMPRESSION_THRESHOLD, CONTINUITY_CARRYOVER } from './types.js';
import type { ConversationState, ConversationMessage } from './types.js';

// =============================================================================
// LOAD OR CREATE
// =============================================================================

/**
 * Load or create a persistent conversation for a 1:1 chat.
 *
 * Priority:
 *   1. If conversation_id provided → load that specific conversation
 *   2. Check for existing active conversation with this member
 *   3. Create a new conversation
 *
 * Mobile-first: The client only needs to track conversation_id.
 * All message history lives server-side.
 */
export async function loadOrCreateConversation(
  supabase: SupabaseClient,
  userId: string,
  memberSlug: string,
  meetingType: string,
  firstMessage: string,
  conversationId?: string,
): Promise<ConversationState> {

  // ── 1. Load by ID if provided ─────────────────────────
  if (conversationId) {
    const { data } = await supabase
      .from('boardroom_conversations')
      .select('id, messages, message_count')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (data) {
      return {
        id: data.id,
        messages: (data.messages || []) as ConversationMessage[],
        messageCount: data.message_count || 0,
        isNew: false,
      };
    }
    // ID provided but not found — fall through to find/create
    console.warn(`[Chat] Conversation ${conversationId} not found, finding active or creating new.`);
  }

  // ── 2. Find existing active conversation ──────────────
  const { data: active } = await supabase
    .from('boardroom_conversations')
    .select('id, messages, message_count')
    .eq('user_id', userId)
    .eq('member_slug', memberSlug)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active) {
    return {
      id: active.id,
      messages: (active.messages || []) as ConversationMessage[],
      messageCount: active.message_count || 0,
      isNew: false,
    };
  }

  // ── 3. Create new conversation ────────────────────────
  const title = firstMessage.substring(0, 100) + (firstMessage.length > 100 ? '...' : '');

  const { data: created, error } = await supabase
    .from('boardroom_conversations')
    .insert({
      user_id: userId,
      member_slug: memberSlug,
      meeting_type: meetingType,
      title,
      messages: [],
      message_count: 0,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error('[Chat] Failed to create conversation:', error?.message);
    // Return a transient state — conversation will work but won't persist
    return { id: '', messages: [], messageCount: 0, isNew: true };
  }

  return { id: created.id, messages: [], messageCount: 0, isNew: true };
}

// =============================================================================
// PERSIST EXCHANGE
// =============================================================================

/**
 * Persist the latest exchange (user message + AI response) to the conversation.
 * Non-blocking when called from response flow — errors are logged, not thrown.
 */
export async function persistExchange(
  supabase: SupabaseClient,
  conversationId: string,
  existingMessages: ConversationMessage[],
  userMessage: string,
  aiResponse: string,
  memberSlug: string,
): Promise<{ updatedMessages: ConversationMessage[]; newCount: number }> {
  const now = Date.now();

  const updatedMessages: ConversationMessage[] = [
    ...existingMessages,
    { role: 'user', content: userMessage, timestamp: now },
    { role: 'assistant', content: aiResponse, timestamp: now, member_slug: memberSlug },
  ];
  const newCount = updatedMessages.length;

  if (!conversationId) {
    // No conversation ID (creation failed earlier) — still return for context
    return { updatedMessages, newCount };
  }

  try {
    await supabase
      .from('boardroom_conversations')
      .update({
        messages: updatedMessages,
        message_count: newCount,
        last_message_at: new Date().toISOString(),
        // Set title from first message if not set yet
        ...(existingMessages.length === 0 ? {
          title: userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : ''),
        } : {}),
      })
      .eq('id', conversationId);
  } catch (err: any) {
    console.error('[Chat] Failed to persist exchange:', err.message);
  }

  return { updatedMessages, newCount };
}

// =============================================================================
// COMPRESS & ARCHIVE
// =============================================================================

/**
 * Compress a conversation thread, archive it, and start a fresh one.
 * Triggered when message_count exceeds COMPRESSION_THRESHOLD.
 *
 * Flow:
 *   1. Compress thread into board_founder_memory (long-term memory)
 *   2. Archive the conversation (is_active = false, add compressed_summary)
 *   3. Create a new active conversation carrying over recent messages
 *
 * Fire-and-forget — runs in the background after response is sent.
 */
export async function compressAndArchive(
  supabase: SupabaseClient,
  userId: string,
  memberSlug: string,
  conversationId: string,
  messages: ConversationMessage[],
): Promise<void> {
  try {
    // ── 1. Compress thread into founder memory ──────────
    await compressBoardThread(supabase, userId, memberSlug, messages);

    // ── 2. Generate a brief summary for the archive ─────
    const recentTopics = messages
      .filter(m => m.role === 'user')
      .slice(-5)
      .map(m => m.content.substring(0, 60))
      .join('; ');
    const summary = `${messages.length} messages. Topics: ${recentTopics}`;

    // ── 3. Archive the current conversation ─────────────
    await supabase
      .from('boardroom_conversations')
      .update({
        is_active: false,
        compressed_summary: summary.substring(0, 500),
      })
      .eq('id', conversationId);

    // ── 4. Create fresh conversation with continuity ────
    const carryoverMessages = messages.slice(-CONTINUITY_CARRYOVER);

    await supabase
      .from('boardroom_conversations')
      .insert({
        user_id: userId,
        member_slug: memberSlug,
        meeting_type: 'one_on_one',
        title: null, // Will be set on next message
        messages: carryoverMessages,
        message_count: carryoverMessages.length,
        is_active: true,
      });

    console.log(
      `[Chat] Compressed & archived ${conversationId} ` +
      `(${messages.length} msgs). Fresh thread with ${carryoverMessages.length} carryover.`
    );
  } catch (err: any) {
    console.error('[Chat] Compress & archive failed:', err.message);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if a conversation has reached the compression threshold.
 */
export function shouldCompress(messageCount: number): boolean {
  return messageCount >= COMPRESSION_THRESHOLD;
}