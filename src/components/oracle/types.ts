// FILE: src/components/oracle/types.ts
// Shared types for Oracle components and hooks

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface QuickChip {
  label: string;
  message: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface OracleChatState {
  messages: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  quickChips: QuickChip[];
  scanCount: number;
  vaultCount: number;
  conversationId: string | null;
  pastConversations: ConversationSummary[];
  isLoadingHistory: boolean;
}