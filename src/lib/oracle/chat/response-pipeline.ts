// FILE: src/lib/oracle/chat/response-pipeline.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Module — Response Pipeline (Phase 3 Extraction)
// ═══════════════════════════════════════════════════════════════════════
//
// Extracted from api/oracle/chat.ts — the ~140-line response pipeline:
//   L7:  Market-aware conversation (live fetch, prompt injection)
//   Msg: Assemble conversation messages from history
//   L8:  Conversational HYDRA (multi-perspective synthesis)
//   Std: Standard single-model call
//   L9:  Adaptive token depth (truncation continuation)
//
// One function: executeResponsePipeline()
// Takes the assembled system prompt and returns the final response text
// plus all metadata needed for the response JSON.
//
// ZERO LOGIC CHANGES — pure code movement from chat.ts handler.
// ═══════════════════════════════════════════════════════════════════════

import { hasFeature } from '../tier.js';
import { callOracle } from '../providers/index.js';
import type { OracleMessage, RoutingResult } from '../providers/index.js';
import {
  multiPerspectiveCall,
  isComplexEnoughForMulti,
} from '../providers/multi-call.js';
import { isMarketQuery } from './detectors.js';
import {
  quickMarketFetch,
  buildMarketDataBlock,
  extractItemReference,
} from '../market/quick-fetch.js';

// =============================================================================
// TYPES
// =============================================================================

export interface PipelineInput {
  /** Assembled system prompt (from prompt-assembler) */
  systemPrompt: string;
  /** User's message */
  message: string;
  /** Conversation history from client */
  conversationHistory: any[];
  /** Routing result from routeMessage() */
  routing: RoutingResult;
  /** Oracle identity */
  identity: any;
  /** Lightweight mode flag */
  lightweight: boolean;
  /** User tier string */
  userTier: string;
  /** Privacy settings (for history inclusion check) */
  privacySettings: any;
  /** Vault items (for L7 market reference extraction) */
  vaultItems: any[];
  /** Scan history (for L7 market reference extraction) */
  scanHistory: any[];
  /** Client-cached market data (L7) */
  cachedMarketData: any;
}

export interface PipelineResult {
  /** Final response text (may include L9 continuation) */
  responseText: string;
  /** Provider that generated the response */
  providerId: string;
  /** Model used */
  model: string;
  /** Response time in ms */
  responseTime: number;
  /** Whether a fallback provider was used */
  isFallback: boolean;
  /** Whether L8 multi-perspective was used */
  usedMultiCall: boolean;
  /** Whether L9 continuation was triggered */
  didContinue: boolean;
  /** L7 market data (null if not fetched) */
  marketData: any | null;
  /** L7 market item reference (null if not fetched) */
  marketItemRef: any | null;
}

// =============================================================================
// PIPELINE
// =============================================================================

/**
 * Execute the full response pipeline:
 *   1. L7 market-aware fetch (Pro/Elite, modifies prompt)
 *   2. Assemble conversation messages
 *   3. L8 HYDRA or standard call
 *   4. L9 adaptive continuation if truncated
 *
 * Returns everything needed for the response JSON.
 */
export async function executeResponsePipeline(input: PipelineInput): Promise<PipelineResult> {
  const {
    message, conversationHistory, routing, identity,
    lightweight, userTier, privacySettings,
    vaultItems, scanHistory, cachedMarketData,
  } = input;

  let systemPrompt = input.systemPrompt;

  // ══════════════════════════════════════════════════════
  // LIBERATION 7: MARKET-AWARE CONVERSATION
  // ══════════════════════════════════════════════════════

  let marketData: any = null;
  let marketItemRef: any = null;

  if (
    !lightweight &&
    hasFeature(userTier as any, 'live_market') &&
    isMarketQuery(message, routing.intent)
  ) {
    marketItemRef = extractItemReference(message, vaultItems, scanHistory);

    if (marketItemRef) {
      try {
        marketData = await quickMarketFetch(
          marketItemRef.itemName,
          marketItemRef.category,
          {
            timeoutMs: 3000,
            cachedData: cachedMarketData || undefined,
          },
        );

        if (marketData) {
          systemPrompt += buildMarketDataBlock(marketItemRef.itemName, marketData);
          console.log(
            `[L7] Live market data injected: ${marketData.sources.join(',')} ` +
            `${marketData.activeListings} listings, ${marketData.fetchTimeMs}ms`
          );
        }
      } catch (err) {
        console.error('[L7] Quick market fetch failed (non-fatal):', err);
      }
    }
  }

  // ── Assemble conversation messages ──────────────────────
  const includeHistory = privacySettings?.allow_oracle_memory !== false;

  const messages: OracleMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (includeHistory && Array.isArray(conversationHistory)) {
    const historyLimit = lightweight ? 10 : 20;
    const recentHistory = conversationHistory.slice(-historyLimit);
    for (const turn of recentHistory) {
      if (turn.role === 'user' || turn.role === 'assistant') {
        messages.push({ role: turn.role, content: turn.content });
      }
    }
  }

  messages.push({ role: 'user', content: message });

  // ══════════════════════════════════════════════════════
  // LIBERATION 8: CONVERSATIONAL HYDRA
  // ══════════════════════════════════════════════════════

  let result: any;
  let usedMultiCall = false;

  if (
    !lightweight &&
    hasFeature(userTier as any, 'conversational_hydra') &&
    isComplexEnoughForMulti(message, routing.intent)
  ) {
    console.log('[L8] Triggering multi-perspective synthesis');
    const multiResult = await multiPerspectiveCall(messages, identity, routing);
    result = {
      text: multiResult.text,
      providerId: multiResult.providers.join('+'),
      model: 'multi-perspective',
      responseTime: multiResult.totalTimeMs,
      isFallback: multiResult.isFallback,
    };
    usedMultiCall = !multiResult.isFallback;
  } else {
    // ── Standard single-model call ────────────────────────
    result = await callOracle(routing, messages);
  }

  let responseText = result.text;
  if (!responseText) throw new Error('Oracle returned empty response');

  // ══════════════════════════════════════════════════════
  // LIBERATION 9: ADAPTIVE TOKEN DEPTH
  // ══════════════════════════════════════════════════════

  let didContinue = false;

  if (!lightweight && !usedMultiCall) {
    const estimatedTokens = responseText.length / 4;
    const maxTokens = routing.maxTokens || 500;
    const utilizationRatio = estimatedTokens / maxTokens;

    const looksComplete = /[.!?…"')\]]\s*$/.test(responseText);
    const isTruncated = utilizationRatio > 0.92 && utilizationRatio < 1.05 && !looksComplete;

    if (isTruncated) {
      console.log(`[L9] Response appears truncated (${Math.floor(utilizationRatio * 100)}% utilization), continuing`);

      try {
        const continuationMessages: OracleMessage[] = [
          ...messages,
          { role: 'assistant', content: responseText },
          { role: 'user', content: 'Continue your thought.' },
        ];

        const successfulProviderId = result.providerId as any;
        const successfulModel = result.model;

        const continuationRouting: RoutingResult = {
          ...routing,
          providerId: successfulProviderId,
          model: successfulModel,
          maxTokens: Math.min(maxTokens, 500),
          reason: `${routing.reason}→continuation(${successfulProviderId})`,
          fallbacks: routing.fallbacks,
        };

        const continuation = await callOracle(continuationRouting, continuationMessages);

        if (continuation.text && continuation.text.trim().length > 10) {
          const needsSpace = !responseText.endsWith(' ') && !continuation.text.startsWith(' ');
          responseText = responseText + (needsSpace ? ' ' : '') + continuation.text;
          didContinue = true;
          console.log(`[L9] Continuation added: +${continuation.text.length} chars via ${continuation.providerId}`);
        }
      } catch (err) {
        console.error('[L9] Continuation failed (non-fatal):', err);
      }
    } else if (utilizationRatio > 1.05) {
      console.log(`[L9] Response over budget (${Math.floor(utilizationRatio * 100)}% utilization) but NOT truncated — model finished naturally`);
    }
  }

  if (result.isFallback) {
    console.log(`Oracle routed: ${routing.reason} → FALLBACK to ${result.providerId} (${result.responseTime}ms)`);
  }

  // ── Return pipeline result ──────────────────────────────
  return {
    responseText,
    providerId: result.providerId,
    model: result.model,
    responseTime: result.responseTime,
    isFallback: result.isFallback,
    usedMultiCall,
    didContinue,
    marketData,
    marketItemRef,
  };
}