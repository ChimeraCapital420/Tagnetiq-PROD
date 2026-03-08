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
// v11.0: Added Step 8 — Provider report context injection.
//        When user taps a provider report card, sessionStorage event
//        flows through client → request body → here → system prompt.
//        Zero server cost. Device decides what context to send.
//
// ZERO LOGIC CHANGES to existing Steps 1-7. Purely additive.
// ═══════════════════════════════════════════════════════════════════════

import type { ChatContext } from './types.js';
import type { BuildPromptParams } from '../prompt/builder.js';
import { buildSystemPrompt } from '../index.js';
import {
  buildAnalysisContextBlock,
  buildVisualMemoryContext,
  buildProviderReportContext,
} from './context-builders.js';
import type { ProviderReportEvent } from './context-builders.js';
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
  /** v11.0: Provider report event from client sessionStorage (optional) */
  providerReportEvent?: ProviderReportEvent | null;
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
 *   8. Inject provider report context (v11.0 — if user recently tapped a report)
 *
 * Returns the fully assembled system prompt string.
 */
export function assembleSystemPrompt(input: PromptAssemblyInput): string {
  const {
    ctx, analysisContext, safetyScan, lightweight,
    currentEnergy, energyArc, messageExpertise,
    providerReportEvent,
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

  // ── 8. Provider report context (v11.0) ──────────────────
  //    Injected when user recently tapped a provider report card.
  //    Data flows: sessionStorage → client hook → request body → here.
  //    Cost: $0. Client decides whether to send.
  if (providerReportEvent) {
    systemPrompt += buildProviderReportContext(providerReportEvent);
  }

  return systemPrompt;
}// FILE: src/lib/oracle/chat/prompt-assembler.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Module — System Prompt Assembler
// ═══════════════════════════════════════════════════════════════════════
//
// Pure function. No async. No side effects.
//
// v11.0: Added Step 8 — Provider report context injection.
//        When user taps a provider report card, sessionStorage event
//        flows through client → request body → here → system prompt.
//
// v11.1: Liberation 11 — Added Steps 9 and 10:
//   Step 9  — REFINEMENT MODE prompt injection (Phase 1).
//             Fires only when refinementIntent.isRefinement AND
//             analysisContext is present. Oracle recognizes correction
//             intent and includes structured <!--CORRECTIONS:--> JSON.
//   Step 10 — Hunt Mode accumulation buffer injection (Phase 4).
//             When user is building a description across multiple
//             messages, Oracle sees the accumulated context and waits
//             for sufficient specificity before firing HYDRA.
//
// v11.2: Trust Escalation — Added Step 11:
//   Step 11 — Trust level context injection.
//             Oracle knows the user's trust level (1–4) and adapts
//             personality, complexity, options, language, urgency cues.
//             Estate persona override already baked into trustInstructions.
//             Cost: $0 — purely string append, zero new server calls.
//
// ZERO LOGIC CHANGES to Steps 1–10. Purely additive.
// ═══════════════════════════════════════════════════════════════════════

import type { ChatContext } from './types.js';
import type { BuildPromptParams } from '../prompt/builder.js';
import { buildSystemPrompt } from '../index.js';
import {
  buildAnalysisContextBlock,
  buildVisualMemoryContext,
  buildProviderReportContext,
} from './context-builders.js';
import type { ProviderReportEvent } from './context-builders.js';
import { buildRecallPromptBlock } from '../eyes/index.js';
import { buildSafetyPromptBlock, buildFollowUpBlock } from '../safety/index.js';
import type { RefinementIntentResult } from './detectors.js';

// =============================================================================
// TYPES
// =============================================================================

/** Liberation 11 Phase 4: Hunt mode accumulation buffer */
export interface HuntBuffer {
  baseIdentity: string;
  accumulatedDetails: string[];
  lastRefinedAt: string | null;
  refinementCount: number;
  specificityScore: number;
}

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
  /** v11.0: Provider report event from client sessionStorage (optional) */
  providerReportEvent?: ProviderReportEvent | null;
  /** v11.1 L11: Refinement intent detection result (Phase 1) */
  refinementIntent?: RefinementIntentResult | null;
  /** v11.1 L11: Client corrections hint from regex extraction (Phase 2) */
  clientCorrections?: any | null;
  /** v11.1 L11 Phase 4: Hunt mode accumulation buffer */
  huntBuffer?: HuntBuffer | null;
  /** v11.2 Trust Escalation: User trust level 1–4 */
  trustLevel?: number | null;
  /** v11.2 Trust Escalation: Human-readable trust level name */
  trustLevelName?: string | null;
  /** v11.2 Trust Escalation: Full instruction block from trust-level.ts */
  trustInstructions?: string | null;
}

// =============================================================================
// REFINEMENT MODE PROMPT BLOCK (Liberation 11 — Phase 1)
// =============================================================================

/**
 * Build the REFINEMENT MODE injection block.
 *
 * Tells Oracle:
 *   1. A correction is being made (not a general question)
 *   2. What was originally identified
 *   3. To respond conversationally AND embed structured JSON
 *
 * The JSON is hidden from the user in an HTML comment.
 * response-pipeline.ts strips it before the response reaches the client.
 */
function buildRefinementModeBlock(
  analysisContext: any,
  clientCorrections: any | null
): string {
  const clientHint = clientCorrections
    ? `\nClient pre-extracted hints (use as starting point, not gospel):
${JSON.stringify(clientCorrections, null, 2)}`
    : '';

  return `

================================================================================
REFINEMENT MODE ACTIVE
================================================================================
The user is correcting a recent scan result. This is NOT a general question.

Their last scan identified:
  Item:     ${analysisContext.itemName || 'Unknown Item'}
  Value:    $${analysisContext.estimatedValue || 'Unknown'}
  Category: ${analysisContext.category || 'Unknown'}
  ID:       ${analysisContext.analysisId || analysisContext.id || 'N/A'}
${clientHint}

YOUR TASK:
1. Acknowledge the correction warmly and conversationally.
2. Confirm the updated item identity/details.
3. Give an updated value estimate if the correction affects value.
4. Ask if they want to save this to their vault (if you haven't already).

MANDATORY: At the very end of your response, include this hidden JSON block
(the user will NOT see it — it is stripped server-side):

<!--CORRECTIONS:{
  "correctedTitle": "Full corrected item title or null if unchanged",
  "corrections": [
    {
      "field": "brand|size|model|color|year|type|identity|other",
      "from": "what was originally identified",
      "to": "what the user says it actually is"
    }
  ],
  "additionalContext": "any other useful context from the user's message or null",
  "changeType": "cosmetic|value_affecting|identity_change",
  "shouldReanalyze": true or false
}-->

changeType guide:
  cosmetic        — spelling fix, formatting (no value impact)
  value_affecting — brand, size, model, year change (affects price)
  identity_change — completely different item (requires re-analysis)

shouldReanalyze: true when identity_change, usually false otherwise.
================================================================================
`;
}

// =============================================================================
// HUNT MODE BUFFER BLOCK (Liberation 11 — Phase 4)
// =============================================================================

/**
 * Inject hunt mode accumulation context.
 *
 * Oracle sees the growing picture across multiple messages and
 * waits until specificityScore is high enough before firing HYDRA.
 * Mobile-first: minimum server calls, maximum user value.
 */
function buildHuntBufferBlock(huntBuffer: HuntBuffer): string {
  const details = huntBuffer.accumulatedDetails.length > 0
    ? huntBuffer.accumulatedDetails.map(d => `  - ${d}`).join('\n')
    : '  (none yet)';

  return `

================================================================================
HUNT MODE — ACCUMULATION BUFFER
================================================================================
The user is building a description across multiple messages.
Do NOT fire HYDRA until you have enough specificity.

Current picture:
  Base identity:    ${huntBuffer.baseIdentity || 'Unknown'}
  Details gathered:
${details}
  Specificity score: ${(huntBuffer.specificityScore * 100).toFixed(0)}% (fire HYDRA at ~80%)
  Refinements so far: ${huntBuffer.refinementCount}

RULES:
- If specificity < 0.5: Ask one clarifying question. Do NOT analyze yet.
- If specificity 0.5–0.79: Acknowledge what you know, ask for the key missing detail.
- If specificity >= 0.8: You have enough — trigger analysis now.
- After each message, update your mental model of what this item is.
================================================================================
`;
}

// =============================================================================
// TRUST CONTEXT BLOCK (Trust Escalation v11.2 — Step 11)
// =============================================================================

/**
 * Inject trust level context into the system prompt.
 *
 * trustInstructions already contains the estate persona override when active
 * (baked in by trust-level.ts calculateTrustLevel). No separate flag needed.
 *
 * Cost: $0. Pure string append. Zero server calls.
 */
function buildTrustContextBlock(
  trustLevel: number,
  trustLevelName: string,
  trustInstructions: string,
): string {
  return `

================================================================================
USER TRUST LEVEL: ${trustLevel} (${trustLevelName})
================================================================================
${trustInstructions}
================================================================================
`;
}

// =============================================================================
// ASSEMBLER
// =============================================================================

/**
 * Build the complete system prompt from ChatContext + pre-processed signals.
 *
 * Steps:
 *   1.  Build promptParams from ChatContext
 *   2.  Call buildSystemPrompt() for the base prompt
 *   3.  Inject analysis context (ask.ts compat)
 *   4.  Inject visual memory context (full mode only)
 *   5.  Inject active recall results (full mode only)
 *   6.  Inject safety context (always)
 *   7.  Inject follow-up block (full mode only, recent safety events)
 *   8.  Inject provider report context (v11.0)
 *   9.  Inject REFINEMENT MODE block (v11.1 L11 Phase 1)
 *   10. Inject Hunt Mode buffer (v11.1 L11 Phase 4)
 *   11. Inject Trust Level context (v11.2 Trust Escalation)
 *
 * Returns the fully assembled system prompt string.
 */
export function assembleSystemPrompt(input: PromptAssemblyInput): string {
  const {
    ctx, analysisContext, safetyScan, lightweight,
    currentEnergy, energyArc, messageExpertise,
    providerReportEvent,
    refinementIntent,
    clientCorrections,
    huntBuffer,
    trustLevel,
    trustLevelName,
    trustInstructions,
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
    emotionalMoments,
    personalDetails,
    userTier: userTier as any,
    capabilitiesStats: !lightweight ? {
      vaultItemCount: vaultItems.length,
      scanCount: scanHistory.length,
      argosAlertCount: argosData?.unreadCount || 0,
      watchlistCount: argosData?.watchlistCount || 0,
      conversationCount: relevantMemories.length,
      visualMemoryCount: visualMemories.length,
    } : undefined,
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

  // ── 8. Provider report context (v11.0) ──────────────────
  if (providerReportEvent) {
    systemPrompt += buildProviderReportContext(providerReportEvent);
  }

  // ── 9. REFINEMENT MODE (v11.1 L11 Phase 1) ─────────────
  // Only injects when:
  //   a) refinementIntent.isRefinement is true (score >= 0.6)
  //   b) analysisContext exists (has a scan to refine against)
  // Zero cost when neither condition is met — pure string append.
  if (refinementIntent?.isRefinement && analysisContext) {
    systemPrompt += buildRefinementModeBlock(analysisContext, clientCorrections || null);
  }

  // ── 10. Hunt Mode buffer (v11.1 L11 Phase 4) ────────────
  // Fires when user is in active hunt mode with accumulated details.
  // Oracle uses this to pace HYDRA calls (minimum server cost).
  if (huntBuffer && huntBuffer.baseIdentity) {
    systemPrompt += buildHuntBufferBlock(huntBuffer);
  }

  // ── 11. Trust Level context (v11.2 Trust Escalation) ────
  // Injects only when trust data is present in the request body.
  // Client sends trustLevel + trustInstructions from AppContext.
  // Oracle adapts personality, complexity, and tone to match user's level.
  // Estate persona override is already baked into trustInstructions by
  // trust-level.ts — no separate flag needed here.
  if (trustLevel && trustLevelName && trustInstructions) {
    systemPrompt += buildTrustContextBlock(trustLevel, trustLevelName, trustInstructions);
  }

  return systemPrompt;
}