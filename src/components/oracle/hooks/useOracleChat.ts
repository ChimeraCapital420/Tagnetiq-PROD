// FILE: src/components/oracle/hooks/useOracleChat.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Hook — THIN COMPOSER
// ═══════════════════════════════════════════════════════════════════════
//
// Phase 1: Extracted client-side intelligence to src/lib/oracle/client/
// Phase 4: Extracted sub-hooks:
//   useConversations    → load, start, history, delete
//   useSendMessage      → sendMessage (L2 + L7)
//   useVision           → sendImage, sendHunt
//   useContentCreation  → createContent
//
// This hook now ONLY owns state and composes sub-hooks.
// ~450 lines → ~100 lines.
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';
import type {
  ChatMessage, QuickChip, ConversationSummary, EnergyLevel,
} from '../types';

// ── Sub-hooks ───────────────────────────────────────────
import { useConversations } from './useConversations';
import { useSendMessage } from './useSendMessage';
import { useVision } from './useVision';
import { useContentCreation } from './useContentCreation';

// =============================================================================
// HOOK
// =============================================================================

export function useOracleChat() {
  // ── State (owned here, shared with sub-hooks) ─────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickChips, setQuickChips] = useState<QuickChip[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [vaultCount, setVaultCount] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pastConversations, setPastConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentEnergy, setCurrentEnergy] = useState<EnergyLevel>('neutral');
  const messageCountRef = useRef(0);

  // ── Shared state bag ──────────────────────────────────
  const shared = {
    messages, setMessages,
    setInputValue,
    isLoading, setIsLoading,
    setQuickChips, setScanCount, setVaultCount,
    conversationId, setConversationId,
    setCurrentEnergy,
    messageCountRef,
  };

  // ── Compose sub-hooks ─────────────────────────────────
  const conversations = useConversations({
    ...shared,
    pastConversations, setPastConversations,
    isLoadingHistory, setIsLoadingHistory,
  });

  const { sendMessage } = useSendMessage(shared);
  const { sendImage, sendHunt } = useVision(shared);
  const { createContent } = useContentCreation(shared);

  // ── Append message (for useOracleExtras bridge) ───────
  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
    messageCountRef.current++;
  }, []);

  // ── Return (same shape as before — zero consumer changes) ──
  return {
    // State
    messages,
    inputValue,
    setInputValue,
    isLoading,
    quickChips,
    scanCount,
    vaultCount,
    conversationId,
    pastConversations: conversations.pastConversations,
    isLoadingHistory: conversations.isLoadingHistory,
    currentEnergy,

    // Text
    sendMessage,

    // Vision
    sendImage,
    sendHunt,

    // Content creation
    createContent,

    // Navigation
    loadRecentConversation: conversations.loadRecentConversation,
    startNewConversation: conversations.startNewConversation,
    loadConversationHistory: conversations.loadConversationHistory,
    loadConversation: conversations.loadConversation,
    deleteConversation: conversations.deleteConversation,

    // Bridge (for useOracleExtras)
    appendMessage,
    setIsLoading,
  };
}