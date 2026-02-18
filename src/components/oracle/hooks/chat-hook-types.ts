// FILE: src/components/oracle/hooks/chat-hook-types.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Hooks — Shared Types (Phase 4 Extraction)
// ═══════════════════════════════════════════════════════════════════════
//
// SharedChatState is the contract between useOracleChat (the composer)
// and all sub-hooks (useConversations, useSendMessage, useVision,
// useContentCreation). The composer owns all useState declarations,
// sub-hooks receive setters they need.
//
// getToken() is used by every sub-hook — extracted here once.
// ═══════════════════════════════════════════════════════════════════════

import type { MutableRefObject } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  ChatMessage, QuickChip, ConversationSummary, EnergyLevel,
} from '../types';

// =============================================================================
// SHARED STATE — passed from useOracleChat to each sub-hook
// =============================================================================

export interface SharedChatState {
  // Messages
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;

  // Input
  setInputValue: React.Dispatch<React.SetStateAction<string>>;

  // Loading
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;

  // Chips & counts
  setQuickChips: React.Dispatch<React.SetStateAction<QuickChip[]>>;
  setScanCount: React.Dispatch<React.SetStateAction<number>>;
  setVaultCount: React.Dispatch<React.SetStateAction<number>>;

  // Conversation
  conversationId: string | null;
  setConversationId: React.Dispatch<React.SetStateAction<string | null>>;

  // Energy
  setCurrentEnergy: React.Dispatch<React.SetStateAction<EnergyLevel>>;

  // Message count ref (for energy arc tracking)
  messageCountRef: MutableRefObject<number>;
}

/** Extended shared state for useConversations (adds history state) */
export interface ConversationSharedState extends SharedChatState {
  pastConversations: ConversationSummary[];
  setPastConversations: React.Dispatch<React.SetStateAction<ConversationSummary[]>>;
  isLoadingHistory: boolean;
  setIsLoadingHistory: React.Dispatch<React.SetStateAction<boolean>>;
}

// =============================================================================
// AUTH TOKEN UTILITY — used by every sub-hook
// =============================================================================

export async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}