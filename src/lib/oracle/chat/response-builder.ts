// FILE: src/lib/oracle/chat/response-builder.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Module — Response Builder
// ═══════════════════════════════════════════════════════════════════════
//
// Pure function. No side effects, no async.
// Takes all gathered data, returns the final response shape.
//
// v11.1 Liberation 11 Phase 3:
//   Added `refinementResult` to response shape.
//   When Oracle corrected a scan result conversationally, the bridge
//   result flows back to the client so useSendMessage can update
//   the displayed AnalysisResult card in real-time — no page reload.
//   Field is undefined when no refinement occurred (zero impact).
// ═══════════════════════════════════════════════════════════════════════

import type { ChatContext, ChatResponse, ContentDetectionResult } from './types.js';
import type { PipelineResult } from './response-pipeline.js';
import type { RefinementResult } from './refinement-bridge.js';
import { getQuickChips } from '../index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ResponseBuilderInput {
  /** Pipeline result (response text, provider info, market data) */
  pipeline: PipelineResult;
  /** Full context bag from data-fetchers */
  ctx: ChatContext;
  /** Active conversation ID (from persistence or passthrough) */
  activeConversationId: string | null;
  /** Routing result (for intent) */
  routingIntent: string;
  /** Lightweight mode flag */
  lightweight: boolean;
  /** Validated current energy */
  currentEnergy: string;
  /** Energy arc over conversation */
  energyArc: string;
  /** Content detection result */
  contentDetection: ContentDetectionResult;
  /** Device type string */
  deviceType: string;
  /** Tier access object (for usage stats) */
  access: any;
  /** User tier string */
  userTier: string;
  /** v11.1 L11 Phase 3: Refinement bridge result (null if no correction occurred) */
  refinementResult?: RefinementResult | null;
}

// =============================================================================
// BUILDER
// =============================================================================

/**
 * Build the final chat response JSON.
 *
 * Pure function — no side effects, no async.
 * Takes all gathered data and assembles the response shape the client expects.
 *
 * When refinementResult is present, the client (useSendMessage) uses it
 * to update the displayed AnalysisResult card in real-time:
 *   correctedItemName → replaces card title
 *   estimatedValue    → replaces displayed price
 */
export function buildChatResponse(input: ResponseBuilderInput): ChatResponse {
  const {
    pipeline, ctx, activeConversationId, routingIntent,
    lightweight, currentEnergy, energyArc, contentDetection,
    deviceType, access, userTier,
    refinementResult,
  } = input;

  const quickChips = lightweight
    ? []
    : getQuickChips(ctx.scanHistory, ctx.vaultItems, ctx.identity);

  return {
    response: pipeline.responseText,
    conversationId: activeConversationId,
    quickChips,
    scanCount: ctx.scanHistory.length,
    vaultCount: ctx.vaultItems.length,
    memoryCount: ctx.visualMemories.length,
    oracleName: ctx.identity.oracle_name,
    energy: currentEnergy,
    energyArc,
    recallUsed: !!(ctx.recallResult && ctx.recallResult.memories.length > 0),
    recallCount: ctx.recallResult?.memories.length || 0,
    contentHint: contentDetection.isCreation ? contentDetection : undefined,
    lightweight,
    tier: {
      current: userTier,
      messagesUsed: access.usage.messagesUsed,
      messagesLimit: access.usage.messagesLimit,
      messagesRemaining: access.usage.messagesRemaining,
    },
    argos: {
      unreadAlerts: ctx.argosData.unreadCount || 0,
      hasProactiveContent: ctx.argosData.hasProactiveContent || false,
    },
    marketData: pipeline.marketData ? {
      result: pipeline.marketData,
      itemName: pipeline.marketItemRef?.itemName,
      cachedAt: pipeline.marketData.fetchedAt,
    } : undefined,
    // ── v11.1 Liberation 11 Phase 3 ─────────────────────────────────
    // Present when Oracle processed a scan correction conversationally.
    // Client uses correctedItemName + estimatedValue to update the card.
    // Omitted entirely when undefined — no impact on non-refinement calls.
    ...(refinementResult ? { refinementResult } : {}),
    _provider: {
      used: pipeline.providerId,
      model: pipeline.model,
      intent: routingIntent,
      responseTime: pipeline.responseTime,
      isFallback: pipeline.isFallback,
      deviceType,
      multiPerspective: pipeline.usedMultiCall,
      continued: pipeline.didContinue,
    },
  };
}