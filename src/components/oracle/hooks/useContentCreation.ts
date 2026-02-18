// FILE: src/components/oracle/hooks/useContentCreation.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Hooks — Content Creation (Phase 4 Extraction)
// ═══════════════════════════════════════════════════════════════════════
//
// Extracted from useOracleChat.ts — content creation endpoint:
//   createContent() — listings, video scripts, images, brag cards
//
// ZERO LOGIC CHANGES — pure code movement.
// ═══════════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ChatMessage, ContentResult } from '../types';
import type { SharedChatState } from './chat-hook-types';
import { getToken } from './chat-hook-types';

// =============================================================================
// HOOK
// =============================================================================

export function useContentCreation(shared: SharedChatState) {
  const {
    isLoading, setIsLoading, setMessages, messageCountRef,
  } = shared;

  // ── Create content (listing, video, image, brag card) ─
  const createContent = useCallback(async (params: {
    mode: string;
    itemId?: string;
    itemName?: string;
    platform?: string;
    instructions?: string;
    style?: string;
    [key: string]: any;
  }): Promise<ContentResult | null> => {
    if (isLoading) return null;

    setIsLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/oracle/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          toast.error(errorData.message || 'Upgrade required for this feature');
          return null;
        }
        throw new Error('Content creation failed');
      }

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.listing
          ? `Here's your ${data.listing.platform} listing — ready to review:`
          : data.script
          ? 'Script generated — take a look:'
          : data.text || 'Here you go:',
        timestamp: Date.now(),
        contentData: data,
        attachments: data.listing
          ? [{ type: 'listing', data: data.listing }]
          : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
      messageCountRef.current++;

      return data as ContentResult;
    } catch (err) {
      console.error('Oracle create error:', err);
      toast.error('Content creation failed. Try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, setIsLoading, setMessages, messageCountRef]);

  return { createContent };
}