// FILE: src/lib/oracle/chat/persistence.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Module — Conversation Persistence (Phase 3 Extraction)
// ═══════════════════════════════════════════════════════════════════════
//
// Extracted from api/oracle/chat.ts — the ~60-line persistence block.
// Handles:
//   1. Update existing conversation (append messages)
//   2. Create new conversation (with title generation)
//   3. Trigger memory compression (every 10 messages after 25)
//   4. Trigger personal detail extraction (every 10 messages after 8)
//
// ZERO LOGIC CHANGES — pure code movement from chat.ts handler.
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  shouldCompress,
  compressConversation,
} from '../memory/index.js';
import { extractPersonalDetails } from '../memory/personal-details.js';
import { generateTitle } from './validators.js';

// =============================================================================
// TYPES
// =============================================================================

export interface PersistenceInput {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string | null;
  message: string;
  responseText: string;
  scanHistory: any[];
  privacySettings: any;
}

// =============================================================================
// PERSISTENCE
// =============================================================================

/**
 * Persist the current chat turn to the database.
 *
 * - If conversationId exists: fetch existing, append messages, update.
 * - If no conversationId: create new conversation with generated title.
 * - Non-blocking triggers for compression and detail extraction.
 *
 * Returns the active conversation ID (existing or newly created).
 */
export async function persistConversation(input: PersistenceInput): Promise<string | null> {
  const {
    supabase, userId, conversationId,
    message, responseText, scanHistory, privacySettings,
  } = input;

  let activeConversationId = conversationId || null;

  const userMsg = { role: 'user', content: message, timestamp: Date.now() };
  const assistantMsg = { role: 'assistant', content: responseText, timestamp: Date.now() };

  try {
    if (activeConversationId) {
      // ── Update existing conversation ──────────────────────
      const { data: existing } = await supabase
        .from('oracle_conversations')
        .select('messages')
        .eq('id', activeConversationId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        const updatedMessages = [...(existing.messages as any[]), userMsg, assistantMsg];
        await supabase
          .from('oracle_conversations')
          .update({ messages: updatedMessages })
          .eq('id', activeConversationId);

        const msgCount = updatedMessages.length;

        // Memory compression (every 10 messages after 25)
        if (msgCount >= 25 && msgCount % 10 === 0) {
          shouldCompress(userId, activeConversationId, msgCount)
            .then(needsCompression => {
              if (needsCompression) {
                compressConversation(userId, activeConversationId!, updatedMessages).catch(() => {});
              }
            }).catch(() => {});
        }

        // L4: Extract personal details (every 10 messages after 8)
        if (msgCount >= 8 && msgCount % 10 === 0) {
          extractPersonalDetails(userId, updatedMessages).catch(() => {});
        }
      }
    } else {
      // ── Create new conversation ───────────────────────────
      const defaultPrivacy = privacySettings?.default_privacy || 'private';

      const { data: newConvo } = await supabase
        .from('oracle_conversations')
        .insert({
          user_id: userId,
          title: generateTitle(message),
          messages: [userMsg, assistantMsg],
          scan_count_at_creation: scanHistory.length,
          is_active: true,
          privacy_level: defaultPrivacy,
        })
        .select('id')
        .single();

      activeConversationId = newConvo?.id || null;
    }
  } catch (convError: any) {
    console.warn('Conversation persistence failed (non-fatal):', convError.message);
  }

  return activeConversationId;
}