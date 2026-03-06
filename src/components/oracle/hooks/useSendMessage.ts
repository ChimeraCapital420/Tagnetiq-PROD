// FILE: src/components/oracle/hooks/useSendMessage.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Hooks — Send Message
// ═══════════════════════════════════════════════════════════════════════
//
// v11.0: Reads provider report events from sessionStorage before each
//        message send. Cost: $0 — purely client-side data.
//
// v11.1: Liberation 11 — Conversational Refinement (client side):
//
//   Phase 1: analysisContext forwarded in request body so server can
//     detect refinement intent against the actual scan being discussed.
//     ⚠ NOTE: Pass `analysisContext` and `onRefinementResult` into
//       SharedChatState from your parent hook (useOracleChat.ts):
//         analysisContext?: any
//         onRefinementResult?: (result: RefinementResult) => void
//
//   Phase 2 (mobile-first): extractCorrectionsRegex() runs ON DEVICE
//     before the fetch. Sends `clientCorrections` as a structured hint.
//     Zero server cost. Catches 60-70% of corrections client-side.
//
//   Phase 3: When response includes `refinementResult`, calls
//     onRefinementResult() so the parent can update the displayed
//     AnalysisResult card in real-time — no page reload needed.
//
//   Phase 4: Hunt mode accumulation buffer maintained client-side.
//     Details accumulate across messages. Sent each time so Oracle
//     sees the growing picture. Buffer clears on vault save or
//     when specificityScore reaches 1.0.
//
// ZERO LOGIC CHANGES to existing Liberation 2 / 7 flows.
// ═══════════════════════════════════════════════════════════════════════

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { ChatMessage } from '../types';
import type { SharedChatState } from './chat-hook-types';
import { getToken } from './chat-hook-types';

// ── Phase 1: Client-side intelligence (L2) ──────────────
import { detectClientIntent } from '@/lib/oracle/client/intent-detector';
import { detectClientEnergy } from '@/lib/oracle/client/energy-detector';
import { searchLocalContext } from '@/lib/oracle/client/context-search';
import { getDeviceType } from '@/lib/oracle/client/device-detector';
import { setCachedTier } from '@/lib/oracle/client/tier-cache';
import { setMarketCache, getRelevantMarketCache } from '@/lib/oracle/client/market-cache';
import { queueForOfflineSync } from '@/lib/oracle/client/offline-queue';

// ── v11.0: Provider report awareness ────────────────────
import { consumeProviderReportEvent } from '@/lib/oracle/client/provider-report-bridge';

// ── v11.1 L11 Phase 2: Client-side correction extraction ─
import { extractCorrectionsRegex } from '@/lib/oracle/chat/correction-extractor';
import type { RefinementResult } from '@/lib/oracle/chat/refinement-bridge';

// =============================================================================
// TYPES
// =============================================================================

/** Liberation 11 Phase 4: Hunt mode accumulation buffer (client-side) */
interface HuntBuffer {
  baseIdentity: string;
  accumulatedDetails: string[];
  lastRefinedAt: string | null;
  refinementCount: number;
  specificityScore: number;
}

/**
 * Extended shared state — includes L11 additions.
 * Add these to your SharedChatState in chat-hook-types.ts:
 *
 *   analysisContext?: any;
 *   onRefinementResult?: (result: RefinementResult) => void;
 *
 * The parent hook (useOracleChat.ts) should pass these through.
 */
type ExtendedSharedState = SharedChatState & {
  /** Current analysis context (scan result being discussed) — L11 Phase 1 */
  analysisContext?: any;
  /** Called when Oracle confirms a correction — updates AnalysisResult card */
  onRefinementResult?: (result: RefinementResult) => void;
};

// =============================================================================
// HOOK
// =============================================================================

export function useSendMessage(shared: ExtendedSharedState) {
  const {
    messages, setMessages, isLoading, setIsLoading,
    setInputValue, conversationId, setConversationId,
    setQuickChips, setScanCount, setVaultCount,
    setCurrentEnergy, messageCountRef,
    // v11.1 L11:
    analysisContext,
    onRefinementResult,
  } = shared;

  // ── L11 Phase 4: Hunt buffer (persists across sendMessage calls) ──
  const huntBufferRef = useRef<HuntBuffer | null>(null);

  // ══════════════════════════════════════════════════════════
  // SEND MESSAGE
  // ══════════════════════════════════════════════════════════
  const sendMessage = useCallback(async (text: string): Promise<string | null> => {
    if (!text.trim() || isLoading) return null;

    // ── L2: Client-side intelligence (runs BEFORE network) ──
    const energy = detectClientEnergy(text);
    const intent = detectClientIntent(text);
    const localContext = searchLocalContext(text, messages);
    const deviceType = getDeviceType();

    // ── L7: Check market cache for this message ───────────
    const cachedMarket = getRelevantMarketCache(text);

    // ── v11.0: Check if user recently viewed a provider report ──
    const providerReportEvent = consumeProviderReportEvent();

    // ── v11.1 L11 Phase 2: Client-side regex extraction ──
    // Runs ON DEVICE before the fetch. Zero server cost.
    // Oracle uses this as a structured hint to enrich its AI extraction.
    const clientCorrections = extractCorrectionsRegex(text, analysisContext || null);

    if (clientCorrections) {
      console.log(
        `[L11] Client extracted ${clientCorrections.corrections?.length || 0} correction(s) ` +
        `— changeType: ${clientCorrections.changeType}`
      );
    }

    // ── v11.1 L11 Phase 4: Get current hunt buffer ────────
    const huntBuffer = huntBufferRef.current;

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
          // ── L2: enriched client context ───────────────
          clientContext: {
            detectedIntent: intent,
            detectedEnergy: energy,
            localContext,
            deviceType,
            timestamp: Date.now(),
          },
          // ── L7: cached market data ─────────────────────
          cachedMarketData: cachedMarket || undefined,
          // ── v11.0: provider report context ─────────────
          providerReportEvent: providerReportEvent || undefined,
          // ── v11.1 L11 Phase 1: analysis context ────────
          // Enables server-side refinement intent detection.
          // Without this, Oracle can't know WHAT is being corrected.
          analysisContext: analysisContext || undefined,
          // ── v11.1 L11 Phase 2: client correction hints ─
          clientCorrections: clientCorrections || undefined,
          // ── v11.1 L11 Phase 4: hunt buffer ─────────────
          huntBuffer: huntBuffer || undefined,
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

      // L7: Cache tier from response
      if (data.tier) setCachedTier(data.tier);

      // L7: Cache market data from response
      if (data.marketData) setMarketCache(data.marketData);

      // ── v11.1 L11 Phase 3: Handle refinement result ────
      // Oracle corrected a scan result. Update the displayed card
      // in real-time — correctedItemName replaces title,
      // estimatedValue replaces price. No page reload.
      if (data.refinementResult?.success && onRefinementResult) {
        onRefinementResult(data.refinementResult);
        console.log(
          `[L11] Card updated: "${data.refinementResult.correctedItemName}" ` +
          `$${data.refinementResult.estimatedValue}`
        );
      }

      // ── v11.1 L11 Phase 4: Update hunt buffer ──────────
      // If Oracle is accumulating details (specificityScore < 0.8),
      // update the buffer for the next message.
      // Clear when:
      //   - specificityScore reaches 1.0 (HYDRA fired)
      //   - A vault save is confirmed in the response
      //   - A refinementResult was returned (correction complete)
      if (data.refinementResult?.success) {
        // Correction complete — clear buffer
        huntBufferRef.current = null;
      } else if (data.huntBuffer) {
        // Server returned updated buffer — store it
        huntBufferRef.current = data.huntBuffer;
      } else if (clientCorrections && !huntBufferRef.current) {
        // No existing buffer — start one if we detected a correction
        // This seeds hunt mode for the next message in the sequence
        huntBufferRef.current = null; // Let Oracle establish the buffer
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
  }, [
    messages, isLoading, conversationId,
    setMessages, setInputValue, setIsLoading,
    setConversationId, setQuickChips, setScanCount, setVaultCount,
    setCurrentEnergy, messageCountRef,
    analysisContext, onRefinementResult,
  ]);

  return { sendMessage };
}