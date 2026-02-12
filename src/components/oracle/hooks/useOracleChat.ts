// FILE: src/components/oracle/hooks/useOracleChat.ts
// All chat state management + API calls
// Extracted from Oracle.tsx monolith

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { ChatMessage, QuickChip, ConversationSummary } from '../types';

// =============================================================================
// HELPERS
// =============================================================================

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useOracleChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickChips, setQuickChips] = useState<QuickChip[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [vaultCount, setVaultCount] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pastConversations, setPastConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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
          return null; // No greeting needed
        }
      }

      // No existing conversation — start fresh
      return await startNewConversation(token);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      return null;
    }
  }, []);

  // ── Start a brand new conversation ────────────────────
  const startNewConversation = useCallback(async (accessToken?: string): Promise<string | null> => {
    setConversationId(null);
    setMessages([]);

    try {
      const token = accessToken || await getToken();
      if (!token) return null;

      const res = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: 'Hey', conversationHistory: [] }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      setQuickChips(data.quickChips || []);
      setScanCount(data.scanCount || 0);
      setVaultCount(data.vaultCount || 0);
      setConversationId(data.conversationId || null);

      const greeting: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      };
      setMessages([greeting]);

      return data.response as string;
    } catch (err) {
      console.error('Failed to start conversation:', err);
      return null;
    }
  }, []);

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
  }, []);

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
        return true;
      }
    } catch {
      toast.error('Failed to load conversation');
    }
    return false;
  }, []);

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
  }, [conversationId, startNewConversation]);

  // ── Send message — returns response text or null ──────
  const sendMessage = useCallback(async (text: string): Promise<string | null> => {
    if (!text.trim() || isLoading) return null;

    const userMessage: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          conversationHistory: history.slice(-20),
          conversationId,
        }),
      });

      if (!res.ok) throw new Error('Oracle request failed');

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.conversationId) setConversationId(data.conversationId);
      if (data.quickChips) setQuickChips(data.quickChips);
      if (data.scanCount !== undefined) setScanCount(data.scanCount);
      if (data.vaultCount !== undefined) setVaultCount(data.vaultCount);

      return data.response as string;
    } catch (err) {
      console.error('Oracle chat error:', err);
      toast.error('Oracle had trouble responding. Try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, conversationId]);

  return {
    messages,
    inputValue,
    setInputValue,
    isLoading,
    quickChips,
    scanCount,
    vaultCount,
    conversationId,
    pastConversations,
    isLoadingHistory,
    sendMessage,
    loadRecentConversation,
    startNewConversation,
    loadConversationHistory,
    loadConversation,
    deleteConversation,
  };
}