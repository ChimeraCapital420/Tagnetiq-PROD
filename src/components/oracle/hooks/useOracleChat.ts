// FILE: src/components/oracle/hooks/useOracleChat.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Hook — THIN COMPOSER
// ═══════════════════════════════════════════════════════════════════════
//
// v11.1 — Liberation 11 wired (see previous handoff)
//
// v12.0 — Universal Media Ingestion:
//   useIngest added to composition:
//     sendDocument(file, question?) → extracts client-side → oracle/chat
//     sendUrl(url, question?)       → oracle/ingest → oracle/chat
//   Videos route through useVision as thumbnail images.
//   Zero changes to existing sub-hooks or return shape consumers use.
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';
import type {
  ChatMessage, QuickChip, ConversationSummary, EnergyLevel,
} from '../types';

import { useAppContext } from '@/contexts/AppContext';
import type { RefinementResult } from '@/lib/oracle/chat/refinement-bridge';

import { useConversations }    from './useConversations';
import { useSendMessage }      from './useSendMessage';
import { useVision }           from './useVision';
import { useContentCreation }  from './useContentCreation';
import { useIngest }           from './useIngest';

// =============================================================================
// HOOK
// =============================================================================

export function useOracleChat() {
  // ── State ─────────────────────────────────────────────────────────────
  const [messages,            setMessages]           = useState<ChatMessage[]>([]);
  const [inputValue,          setInputValue]         = useState('');
  const [isLoading,           setIsLoading]          = useState(false);
  const [quickChips,          setQuickChips]         = useState<QuickChip[]>([]);
  const [scanCount,           setScanCount]          = useState(0);
  const [vaultCount,          setVaultCount]         = useState(0);
  const [conversationId,      setConversationId]     = useState<string | null>(null);
  const [pastConversations,   setPastConversations]  = useState<ConversationSummary[]>([]);
  const [isLoadingHistory,    setIsLoadingHistory]   = useState(false);
  const [currentEnergy,       setCurrentEnergy]      = useState<EnergyLevel>('neutral');
  const messageCountRef = useRef(0);

  // ── v11.1: Analysis context from AppContext ───────────────────────────
  const { oracleAnalysisContext, applyOracleCorrection } = useAppContext();

  const onRefinementResult = useCallback((result: RefinementResult) => {
    if (!result.success) return;
    if (!result.correctedItemName && !result.estimatedValue) return;
    applyOracleCorrection(result.correctedItemName, result.estimatedValue);
  }, [applyOracleCorrection]);

  // ── Shared state bag ──────────────────────────────────────────────────
  const shared = {
    messages, setMessages,
    setInputValue,
    isLoading, setIsLoading,
    setQuickChips, setScanCount, setVaultCount,
    conversationId, setConversationId,
    setCurrentEnergy,
    messageCountRef,
    analysisContext: oracleAnalysisContext,
    onRefinementResult,
  };

  // ── Compose sub-hooks ─────────────────────────────────────────────────
  const conversations = useConversations({
    ...shared,
    pastConversations, setPastConversations,
    isLoadingHistory, setIsLoadingHistory,
  });

  const { sendMessage }   = useSendMessage(shared);
  const { sendImage, sendHunt } = useVision(shared);
  const { createContent } = useContentCreation(shared);

  // v12.0 — Universal media ingestion
  const { sendDocument, sendUrl } = useIngest(shared);

  // ── Append message (for useOracleExtras bridge) ───────────────────────
  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
    messageCountRef.current++;
  }, []);

  // ── Return ────────────────────────────────────────────────────────────
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
    isLoadingHistory:  conversations.isLoadingHistory,
    currentEnergy,

    // Text
    sendMessage,

    // Vision (images + video thumbnails)
    sendImage,
    sendHunt,

    // v12.0 — Media ingestion
    sendDocument,
    sendUrl,

    // Content creation
    createContent,

    // Navigation
    loadRecentConversation:    conversations.loadRecentConversation,
    startNewConversation:      conversations.startNewConversation,
    loadConversationHistory:   conversations.loadConversationHistory,
    loadConversation:          conversations.loadConversation,
    deleteConversation:        conversations.deleteConversation,

    // Bridge
    appendMessage,
    setIsLoading,
  };
}