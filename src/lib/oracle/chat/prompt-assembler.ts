// FILE: src/lib/oracle/chat/prompt-assembler.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Module — System Prompt Assembler (Phase 3 Extraction)
// ═══════════════════════════════════════════════════════════════════════
//
// Extracted from api/oracle/chat.ts — the ~55-line prompt-building block.
// Takes ChatContext + pre-processed signals, returns the complete system
// prompt string with all context blocks injected.
//
// Pure function. No async. No side effects.
//
// ZERO LOGIC CHANGES — pure code movement from chat.ts handler.
// ═══════════════════════════════════════════════════════════════════════

import type { ChatContext } from './types.js';
import type { BuildPromptParams } from '../prompt/builder.js';
import { buildSystemPrompt } from '../index.js';
import { buildAnalysisContextBlock, buildVisualMemoryContext } from './context-builders.js';
import { buildRecallPromptBlock } from '../eyes/index.js';
import { buildSafetyPromptBlock, buildFollowUpBlock } from '../safety/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface PromptAssemblyInput {
  /** Full context bag from data-fetchers */
  ctx: ChatContext;
  /** Analysis context from ask.ts compatibility layer */
  analysisContext: any;
  /** Safety scan result from scanMessage() */
  safetyScan: any;
  /** Lightweight mode flag */
  lightweight: boolean;
  /** Validated current energy (from client hint or detection) */
  currentEnergy: string;
  /** Energy arc over conversation history */
  energyArc: string;
  /** Message-level expertise detection result */
  messageExpertise: { level: string; indicators: string[] };
}

// =============================================================================
// ASSEMBLER
// =============================================================================

/**
 * Build the complete system prompt from ChatContext + pre-processed signals.
 *
 * Steps:
 *   1. Build promptParams from ChatContext
 *   2. Call buildSystemPrompt() for the base prompt
 *   3. Inject analysis context (ask.ts compat)
 *   4. Inject visual memory context (full mode only)
 *   5. Inject active recall results (full mode only)
 *   6. Inject safety context (always)
 *   7. Inject follow-up block (full mode only, recent safety events)
 *
 * Returns the fully assembled system prompt string.
 */
export function assembleSystemPrompt(input: PromptAssemblyInput): string {
  const {
    ctx, analysisContext, safetyScan, lightweight,
    currentEnergy, energyArc, messageExpertise,
  } = input;

  const {
    identity, scanHistory, vaultItems, profile, argosData,
    relevantMemories, unfulfilledPromises, aggregatedInterests,
    expertiseLevel, trustMetrics, emotionalMoments, personalDetails,
    visualMemories, recallResult, recentSafety, userTier,
  } = ctx;

  // ── 1. Build prompt params ──────────────────────────────
  const promptParams: BuildPromptParams = {
    identity,
    scanHistory,
    vaultItems,
    userProfile: profile,
    argosData: lightweight ? undefined : argosData,
    memories: relevantMemories,
    unfulfilledPromises: lightweight ? undefined : unfulfilledPromises,
    aggregatedInterests: lightweight ? undefined : aggregatedInterests,
    expertiseLevel: expertiseLevel.conversationsAnalyzed >= 2 ? expertiseLevel : {
      level: messageExpertise.level,
      indicators: messageExpertise.indicators,
      conversationsAnalyzed: 0,
    },
    trustMetrics,
    energyArc: energyArc as any,
    currentEnergy,
    emotionalMoments,          // L3
    personalDetails,           // L4
    userTier: userTier as any, // L5
    capabilitiesStats: !lightweight ? {
      vaultItemCount: vaultItems.length,
      scanCount: scanHistory.length,
      argosAlertCount: argosData?.unreadCount || 0,
      watchlistCount: argosData?.watchlistCount || 0,
      conversationCount: relevantMemories.length,
      visualMemoryCount: visualMemories.length,
    } : undefined,             // L5
  };

  // ── 2. Base system prompt ───────────────────────────────
  let systemPrompt = buildSystemPrompt(promptParams);

  // ── 3. Analysis context (ask.ts compat) ─────────────────
  if (analysisContext) {
    systemPrompt += buildAnalysisContextBlock(analysisContext);
  }

  // ── 4. Visual memory context (full mode only) ───────────
  if (!lightweight && visualMemories.length > 0) {
    systemPrompt += buildVisualMemoryContext(visualMemories);
  }

  // ── 5. Active recall results (full mode only) ───────────
  if (!lightweight && recallResult && recallResult.memories.length > 0) {
    systemPrompt += buildRecallPromptBlock(recallResult);
  }

  // ── 6. Safety context (always) ──────────────────────────
  if (safetyScan.injectSafetyContext) {
    systemPrompt += buildSafetyPromptBlock(safetyScan);
  }

  // ── 7. Safety follow-up (full mode, recent events) ─────
  if (!lightweight && recentSafety.hasRecentEvents) {
    systemPrompt += buildFollowUpBlock(recentSafety);
  }

  return systemPrompt;
}