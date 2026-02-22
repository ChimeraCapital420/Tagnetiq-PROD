// FILE: src/components/oracle/hooks/useSendMessage.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Hooks — Send Message (Phase 4 Extraction)
// ═══════════════════════════════════════════════════════════════════════
//
// Extracted from useOracleChat.ts — the main sendMessage function.
// Includes Liberation 2 (client-side intelligence) and
// Liberation 7 (market data cache) integrations.
//
// v11.0: Reads provider report events from sessionStorage before each
//        message send. If the user recently tapped a provider report
//        card, Oracle gets awareness of what they were examining.
//        Cost: $0 — purely client-side data, consumed on read.
//
// ZERO LOGIC CHANGES to existing Liberation 2 / 7 flows.
// ═══════════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ChatMessage } from '../types';
import type { SharedChatState } from './chat-hook-types';
import { getToken } from './chat-hook-types';

// ── Phase 1: Client-side intelligence ───────────────────
import { detectClientIntent } from '@/lib/oracle/client/intent-detector';
import { detectClientEnergy } from '@/lib/oracle/client/energy-detector';
import { searchLocalContext } from '@/lib/oracle/client/context-search';
import { getDeviceType } from '@/lib/oracle/client/device-detector';
import { setCachedTier } from '@/lib/oracle/client/tier-cache';
import { setMarketCache, getRelevantMarketCache } from '@/lib/oracle/client/market-cache';
import { queueForOfflineSync } from '@/lib/oracle/client/offline-queue';

// ── v11.0: Provider report awareness ────────────────────
import { consumeProviderReportEvent } from '@/lib/oracle/client/provider-report-bridge';

// =============================================================================
// HOOK
// =============================================================================

export function useSendMessage(shared: SharedChatState) {
  const {
    messages, setMessages, isLoading, setIsLoading,
    setInputValue, conversationId, setConversationId,
    setQuickChips, setScanCount, setVaultCount,
    setCurrentEnergy, messageCountRef,
  } = shared;

  // ══════════════════════════════════════════════════════════
  // SEND MESSAGE — Liberation 2 + 7: client intelligence + market cache
  // ══════════════════════════════════════════════════════════
  const sendMessage = useCallback(async (text: string): Promise<string | null> => {
    if (!text.trim() || isLoading) return null;

    // ── Client-side intelligence (runs BEFORE network) ──
    const energy = detectClientEnergy(text);
    const intent = detectClientIntent(text);
    const localContext = searchLocalContext(text, messages);
    const deviceType = getDeviceType();

    // ── Liberation 7: Check market cache for this message ──
    const cachedMarket = getRelevantMarketCache(text);

    // ── v11.0: Check if user recently viewed a provider report ──
    // consumeProviderReportEvent reads + deletes from sessionStorage
    // so it only fires once per report tap. Returns null if none/stale.
    const providerReportEvent = consumeProviderReportEvent();

    setCurrentEnergy(energy);

    const userMessage: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    messageCountRef.current++;

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
          // ── Liberation 2: enriched client context ──────
          clientContext: {
            detectedIntent: intent,
            detectedEnergy: energy,
            localContext,
            deviceType,
            timestamp: Date.now(),
          },
          // ── Liberation 7: cached market data ──────────
          cachedMarketData: cachedMarket || undefined,
          // ── v11.0: provider report context ─────────────
          providerReportEvent: providerReportEvent || undefined,
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
      messageCountRef.current++;

      if (data.conversationId) setConversationId(data.conversationId);
      if (data.quickChips) setQuickChips(data.quickChips);
      if (data.scanCount !== undefined) setScanCount(data.scanCount);
      if (data.vaultCount !== undefined) setVaultCount(data.vaultCount);

      // Cache tier from response
      if (data.tier) setCachedTier(data.tier);

      // ── Liberation 7: Cache market data from response ─
      if (data.marketData) {
        setMarketCache(data.marketData);
      }

      return data.response as string;
    } catch (err) {
      console.error('Oracle chat error:', err);

      if (err instanceof TypeError && err.message.includes('fetch')) {
        queueForOfflineSync(text);
        toast.error('Offline — message queued for when you\'re back online.');
      } else {
        toast.error('Oracle had trouble responding. Try again.');
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, conversationId, setMessages, setInputValue, setIsLoading, setConversationId, setQuickChips, setScanCount, setVaultCount, setCurrentEnergy, messageCountRef]);

  return { sendMessage };
}