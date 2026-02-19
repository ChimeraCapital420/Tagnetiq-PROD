// FILE: src/features/boardroom/hooks/useConversations.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARDROOM CONVERSATION HOOK — Mobile-First Persistence
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 1: Conversation Persistence
//
// This hook manages the client-side state for persistent board conversations.
// The TRUTH lives server-side in boardroom_conversations. This hook is a
// lightweight cache that:
//   - Tracks conversation_id per member (so chat.ts loads from DB)
//   - Loads conversation list for the sidebar (lightweight, no messages)
//   - Loads full messages when opening a specific conversation
//   - Creates new conversations (archives the old one server-side)
//
// MOBILE-FIRST DESIGN:
//   - Minimal payloads: list endpoint returns metadata only (no messages)
//   - Messages loaded on-demand when a conversation is opened
//   - conversation_id is the only state the client MUST track per chat
//   - Everything else can be re-fetched from the server
//
// INTEGRATION:
//   Works alongside the existing useBoardroomChat hook. The chat hook
//   now includes conversation_id in its POST to /api/boardroom/chat,
//   and receives conversation_id back in the response.
//
//   // In your chat component:
//   const { activeConversation, loadConversation } = useConversations();
//   const { sendMessage } = useBoardroomChat({
//     conversationId: activeConversation?.id,
//   });
//
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

/** Lightweight conversation metadata (no messages — for lists) */
export interface ConversationMeta {
  id: string;
  member_slug: string;
  meeting_type: string;
  title: string | null;
  message_count: number;
  compressed_summary: string | null;
  is_active: boolean;
  last_message_at: string;
  created_at: string;
}

/** Full conversation with messages (loaded on demand) */
export interface Conversation extends ConversationMeta {
  messages: ConversationMessage[];
  updated_at: string;
}

/** Single message in a conversation */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  member_slug?: string;
}

/** Hook return type */
export interface UseConversationsReturn {
  // ── State ─────────────────────────────────────────────
  /** Currently loaded conversation (with full messages) */
  activeConversation: Conversation | null;
  /** List of conversations for sidebar display */
  conversationList: ConversationMeta[];
  /** Loading states */
  isLoading: boolean;
  isLoadingList: boolean;
  /** Error state */
  error: string | null;

  // ── Actions ───────────────────────────────────────────
  /** Load the active conversation for a specific board member */
  loadConversation: (memberSlug: string) => Promise<Conversation | null>;
  /** Load a specific conversation by ID (with full messages) */
  loadConversationById: (id: string) => Promise<Conversation | null>;
  /** List all conversations for a member (or all members) */
  listConversations: (memberSlug?: string, showAll?: boolean) => Promise<ConversationMeta[]>;
  /** Create a new conversation (archives existing active one) */
  createConversation: (memberSlug: string, meetingType?: string) => Promise<Conversation | null>;
  /** Rename a conversation */
  renameConversation: (id: string, title: string) => Promise<boolean>;
  /** Archive a conversation */
  archiveConversation: (id: string) => Promise<boolean>;
  /** Clear active conversation (for UI state reset) */
  clearActive: () => void;
}

// =============================================================================
// API HELPERS
// =============================================================================

/**
 * Get the auth token for API calls.
 * Reuses the Supabase session — no extra auth flow.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

/** Base URL for the conversations API */
const API_BASE = '/api/boardroom/conversations';

// =============================================================================
// HOOK
// =============================================================================

export function useConversations(): UseConversationsReturn {
  // ── State ─────────────────────────────────────────────
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [conversationList, setConversationList] = useState<ConversationMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent duplicate requests (mobile double-tap protection)
  const loadingRef = useRef<string | null>(null);

  // ── Load active conversation for a member ─────────────
  // This is the primary entry point: "I'm chatting with Athena,
  // give me the active conversation."
  const loadConversation = useCallback(async (
    memberSlug: string,
  ): Promise<Conversation | null> => {
    // Dedup: don't reload if already loading this member
    if (loadingRef.current === `load-${memberSlug}`) return activeConversation;
    loadingRef.current = `load-${memberSlug}`;

    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();

      // First: check if there's an active conversation (lightweight)
      const metaRes = await fetch(
        `${API_BASE}?member_slug=${memberSlug}&include_messages=true`,
        { headers },
      );

      if (!metaRes.ok) {
        throw new Error(`Failed to load conversation: ${metaRes.status}`);
      }

      const metaData = await metaRes.json();

      if (metaData.active) {
        // Active conversation exists — it already includes messages
        const conv = metaData.active as Conversation;
        setActiveConversation(conv);
        return conv;
      }

      // No active conversation — return null (chat.ts will create one)
      setActiveConversation(null);
      return null;

    } catch (err: any) {
      console.error('[useConversations] loadConversation failed:', err.message);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
      loadingRef.current = null;
    }
  }, [activeConversation]);

  // ── Load specific conversation by ID ──────────────────
  // Used when clicking a conversation in the history sidebar
  const loadConversationById = useCallback(async (
    id: string,
  ): Promise<Conversation | null> => {
    if (loadingRef.current === `id-${id}`) return activeConversation;
    loadingRef.current = `id-${id}`;

    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}?id=${id}`, { headers });

      if (!res.ok) {
        throw new Error(`Conversation not found: ${res.status}`);
      }

      const conv = await res.json() as Conversation;
      setActiveConversation(conv);
      return conv;

    } catch (err: any) {
      console.error('[useConversations] loadConversationById failed:', err.message);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
      loadingRef.current = null;
    }
  }, [activeConversation]);

  // ── List conversations ────────────────────────────────
  // Lightweight list for sidebar. No messages — just metadata.
  const listConversations = useCallback(async (
    memberSlug?: string,
    showAll = false,
  ): Promise<ConversationMeta[]> => {
    setIsLoadingList(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();

      let url = API_BASE;
      const params = new URLSearchParams();

      if (memberSlug) {
        params.set('member_slug', memberSlug);
        if (showAll) params.set('all', 'true');
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url, { headers });

      if (!res.ok) {
        throw new Error(`Failed to list conversations: ${res.status}`);
      }

      const data = await res.json();
      const list = data.conversations || (data.active ? [data.active] : []);
      setConversationList(list);
      return list;

    } catch (err: any) {
      console.error('[useConversations] listConversations failed:', err.message);
      setError(err.message);
      return [];
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  // ── Create new conversation ───────────────────────────
  // Archives the existing active conversation for this member
  // and starts a fresh thread.
  const createConversation = useCallback(async (
    memberSlug: string,
    meetingType: string = 'one_on_one',
  ): Promise<Conversation | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();

      const res = await fetch(API_BASE, {
        method: 'POST',
        headers,
        body: JSON.stringify({ member_slug: memberSlug, meeting_type: meetingType }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to create conversation: ${res.status}`);
      }

      const conv = await res.json() as Conversation;
      setActiveConversation(conv);
      return conv;

    } catch (err: any) {
      console.error('[useConversations] createConversation failed:', err.message);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Rename conversation ───────────────────────────────
  const renameConversation = useCallback(async (
    id: string,
    title: string,
  ): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();

      const res = await fetch(API_BASE, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id, action: 'rename', title }),
      });

      if (!res.ok) return false;

      // Update local state if this is the active conversation
      setActiveConversation(prev =>
        prev?.id === id ? { ...prev, title } : prev,
      );

      // Update list state
      setConversationList(prev =>
        prev.map(c => c.id === id ? { ...c, title } : c),
      );

      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Archive conversation ──────────────────────────────
  const archiveConversation = useCallback(async (
    id: string,
  ): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();

      const res = await fetch(`${API_BASE}?id=${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) return false;

      // Clear active if this was it
      setActiveConversation(prev =>
        prev?.id === id ? null : prev,
      );

      // Remove from list
      setConversationList(prev =>
        prev.filter(c => c.id !== id),
      );

      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Clear active (UI reset) ───────────────────────────
  const clearActive = useCallback(() => {
    setActiveConversation(null);
    setError(null);
  }, []);

  // ═══════════════════════════════════════════════════════
  return {
    activeConversation,
    conversationList,
    isLoading,
    isLoadingList,
    error,
    loadConversation,
    loadConversationById,
    listConversations,
    createConversation,
    renameConversation,
    archiveConversation,
    clearActive,
  };
}

export default useConversations;