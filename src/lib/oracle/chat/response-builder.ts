// FILE: src/lib/oracle/chat/response-builder.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Module — Response Builder (Phase 5 Extraction)
// ═══════════════════════════════════════════════════════════════════════
//
// Extracted from api/oracle/chat.ts — the ~50-line response JSON block.
// Pure function: takes all gathered data, returns the final response shape.
//
// Also includes the quickChips call (previously step 10 in the handler).
//
// ZERO LOGIC CHANGES — pure code movement from chat.ts handler.
// ═══════════════════════════════════════════════════════════════════════

import type { ChatContext, ChatResponse, ContentDetectionResult } from './types.js';
import type { PipelineResult } from './response-pipeline.js';
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
}

// =============================================================================
// BUILDER
// =============================================================================

/**
 * Build the final chat response JSON.
 *
 * Pure function — no side effects, no async.
 * Takes all gathered data and assembles the response shape
 * that the client expects.
 */
export function buildChatResponse(input: ResponseBuilderInput): ChatResponse {
  const {
    pipeline, ctx, activeConversationId, routingIntent,
    lightweight, currentEnergy, energyArc, contentDetection,
    deviceType, access, userTier,
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