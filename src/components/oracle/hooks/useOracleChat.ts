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
// This hook ONLY owns state and composes sub-hooks.
// ~450 lines → ~100 lines.
//
// v11.1 — Liberation 11 wire complete:
//   TWO changes from the previous version:
//
//   1. analysisContext now comes from AppContext.oracleAnalysisContext
//      (derived from lastAnalysisResult) instead of local useState.
//      Zero manual wiring required anywhere — scan completes →
//      setLastAnalysisResult() fires → oracleAnalysisContext updates →
//      next Oracle message automatically carries the scan context.
//
//   2. onRefinementResult calls AppContext.applyOracleCorrection which
//      patches both lastAnalysisResult AND liveAnalysisResult to the
//      same object reference, so the history useEffect guard
//      (lastAnalysisResult !== liveAnalysisResult) stays FALSE and
//      addAnalysisToHistory does NOT fire a duplicate save.
//      AnalysisResult.tsx re-renders immediately via lastAnalysisResult.
//
//   RETURN SHAPE: identical to previous version — zero consumer changes.
//   AnalysisResult.tsx, useAnalysisData.ts — untouched.
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';
import type {
  ChatMessage, QuickChip, ConversationSummary, EnergyLevel,
} from '../types';

// ── AppContext — source of truth for analysis context ────
import { useAppContext } from '@/contexts/AppContext';
import type { RefinementResult } from '@/lib/oracle/chat/refinement-bridge';

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

  // ── v11.1 L11: Analysis context from AppContext ───────
  // oracleAnalysisContext is derived inline from lastAnalysisResult in
  // AppContext — no local state, no useEffect, no manual wiring.
  // It is null when no scan is active, which makes the refinement intent
  // detector's critical guard fire and skip correction logic safely.
  const { oracleAnalysisContext, applyOracleCorrection } = useAppContext();

  // ── v11.1 L11: Real-time card update on correction ────
  // Oracle's refinement bridge confirmed a correction.
  // applyOracleCorrection in AppContext:
  //   - Patches lastAnalysisResult.itemName + estimatedValue
  //   - Sets liveAnalysisResult to the SAME new object reference
  //   - History useEffect guard stays FALSE → no duplicate save
  //   - AnalysisResult card re-renders immediately
  const onRefinementResult = useCallback((result: RefinementResult) => {
    if (!result.success) return;
    if (!result.correctedItemName && !result.estimatedValue) return;

    applyOracleCorrection(
      result.correctedItemName,
      result.estimatedValue,
    );
  }, [applyOracleCorrection]);

  // ── Shared state bag ──────────────────────────────────
  const shared = {
    messages, setMessages,
    setInputValue,
    isLoading, setIsLoading,
    setQuickChips, setScanCount, setVaultCount,
    conversationId, setConversationId,
    setCurrentEnergy,
    messageCountRef,
    // v11.1 L11 — read from AppContext, not local state
    analysisContext: oracleAnalysisContext,
    onRefinementResult,
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

  // ── Return (identical shape to previous version) ──────
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