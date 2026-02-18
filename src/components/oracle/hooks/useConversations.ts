// FILE: src/components/oracle/hooks/useConversations.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Hooks — Conversation CRUD (Phase 4 Extraction)
// ═══════════════════════════════════════════════════════════════════════
//
// Extracted from useOracleChat.ts — all conversation management:
//   loadRecentConversation()  — resume most recent
//   startNewConversation()    — create fresh (sends "Hey" greeting)
//   loadConversationHistory() — fetch history list
//   loadConversation()        — load specific past conversation
//   deleteConversation()      — delete + restart if active
//
// ZERO LOGIC CHANGES — pure code movement.
// ═══════════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ConversationSharedState } from './chat-hook-types';
import { getToken } from './chat-hook-types';
import { getDeviceType } from '@/lib/oracle/client/device-detector';
import { setCachedTier } from '@/lib/oracle/client/tier-cache';

// =============================================================================
// HOOK
// =============================================================================

export function useConversations(shared: ConversationSharedState) {
  const {
    setConversationId, setMessages, messageCountRef, setCurrentEnergy,
    setQuickChips, setScanCount, setVaultCount,
    conversationId,
    pastConversations, setPastConversations,
    isLoadingHistory, setIsLoadingHistory,
  } = shared;

  // ── Start a brand new conversation ────────────────────
  const startNewConversation = useCallback(async (accessToken?: string): Promise<string | null> => {
    setConversationId(null);
    setMessages([]);
    messageCountRef.current = 0;
    setCurrentEnergy('neutral');

    try {
      const token = accessToken || await getToken();
      if (!token) return null;

      const res = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: 'Hey',
          conversationHistory: [],
          clientContext: {
            detectedIntent: 'casual',
            detectedEnergy: 'neutral',
            localContext: [],
            deviceType: getDeviceType(),
            timestamp: Date.now(),
          },
        }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      setQuickChips(data.quickChips || []);
      setScanCount(data.scanCount || 0);
      setVaultCount(data.vaultCount || 0);
      setConversationId(data.conversationId || null);

      // Cache tier info from response
      if (data.tier) setCachedTier(data.tier);

      const greeting = {
        role: 'assistant' as const,
        content: data.response,
        timestamp: Date.now(),
      };
      setMessages([greeting]);
      messageCountRef.current = 1;

      return data.response as string;
    } catch (err) {
      console.error('Failed to start conversation:', err);
      return null;
    }
  }, [setConversationId, setMessages, messageCountRef, setCurrentEnergy, setQuickChips, setScanCount, setVaultCount]);

  // ── Load most recent conversation ─────────────────────
  const loadRecentConversation = useCallback(async (): Promise<string | null> => {
    try {
      const token = await getToken();
      if (!token) return null;

      const res = await fetch('/api/oracle/conversations', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return null;

      const { conversations } = await res.json();

      if (conversations?.length > 0) {
        const detailRes = await fetch(`/api/oracle/conversations?id=${conversations[0].id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (detailRes.ok) {
          const { conversation } = await detailRes.json();
          setConversationId(conversation.id);
          setMessages(conversation.messages || []);
          messageCountRef.current = (conversation.messages || []).length;
          return null;
        }
      }

      return await startNewConversation(token);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      return null;
    }
  }, [startNewConversation, setConversationId, setMessages, messageCountRef]);

  // ── Load conversation history list ────────────────────
  const loadConversationHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch('/api/oracle/conversations', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const { conversations } = await res.json();
        setPastConversations(conversations || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [setIsLoadingHistory, setPastConversations]);

  // ── Load a specific past conversation ─────────────────
  const loadConversation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const token = await getToken();
      if (!token) return false;

      const res = await fetch(`/api/oracle/conversations?id=${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const { conversation } = await res.json();
        setConversationId(conversation.id);
        setMessages(conversation.messages || []);
        messageCountRef.current = (conversation.messages || []).length;
        return true;
      }
    } catch {
      toast.error('Failed to load conversation');
    }
    return false;
  }, [setConversationId, setMessages, messageCountRef]);

  // ── Delete a conversation ─────────────────────────────
  const deleteConversation = useCallback(async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      await fetch(`/api/oracle/conversations?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      setPastConversations(prev => prev.filter(c => c.id !== id));

      if (id === conversationId) {
        await startNewConversation(token);
      }
    } catch {
      toast.error('Failed to delete conversation');
    }
  }, [conversationId, startNewConversation, setPastConversations]);

  return {
    loadRecentConversation,
    startNewConversation,
    loadConversationHistory,
    loadConversation,
    deleteConversation,
    pastConversations,
    isLoadingHistory,
  };
}