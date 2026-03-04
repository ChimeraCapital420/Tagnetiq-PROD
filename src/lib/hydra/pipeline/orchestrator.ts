// ============================================================
// FILE:  src/lib/hydra/pipeline/orchestrator.ts
// ============================================================
// HYDRA v9.3 — CI Engine Phase 3 Wired
// Evidence-based pipeline: IDENTIFY → FETCH → REASON → VALIDATE
//
// v9.0: Original pipeline
// v9.1: Fixed stage timeouts — identify 20s (first-responder), reason 15s
// v9.2: FIXED — Benchmark recording is now awaited (with timeout) to prevent
//        Vercel teardown from killing inserts and leaking timeout logs into
//        the next request's output.
// v9.3: CI ENGINE PHASE 3 — collectiveKnowledge threaded through to
//        runIdentifyStage(). Identify is the correct injection point because
//        brand/model confusion (Green Bull vs Green Line) happens at the
//        vision identification step, not the reasoning step.
//
// ⚠️  ONE LINE NEEDED IN identify.ts — see Section 1 below.

import type { ItemCategory, ModelVote } from '../types.js';
import type {
  PipelineResult,
  PipelineConfig,
} from './types.js';

// v9.3: CI Engine type import
import type { CollectiveKnowledgeBlock } from '../knowledge/types.js';

import { runIdentifyStage } from './stages/identify.js';
import { runFetchStage } from './stages/fetch-evidence.js';
import { runReasonStage } from './stages/reason.js';
import { runValidateStage } from './stages/validate.js';
import { recordBenchmarks, buildBenchmarkContext } from '../benchmarks/index.js';

// =============================================================================
// PIPELINE ORCHESTRATOR
// =============================================================================

/**
 * Run the full HYDRA v9.3 evidence-based pipeline
 *
 * Flow:
 * 1. IDENTIFY — What is this item? (vision providers, first-responder)
 *              ← collectiveKnowledge injected here (v9.3)
 * 2. FETCH    — Get market evidence (APIs + web search)
 * 3. REASON   — Analyze with evidence (reasoning providers)
 * 4. VALIDATE — Sanity check (Groq speed-check)
 * 5. Benchmark + Self-Heal (awaited with timeout)
 *
 * ─── CI ENGINE PHASE 3 — HOW IT WORKS ───────────────────────────────────────
 *
 * api/analyze.ts calls lookupPatterns(categoryHint) before this function.
 * The resulting CollectiveKnowledgeBlock (or null) is passed here via options.
 *
 * This function passes collectiveKnowledge to runIdentifyStage().
 * runIdentifyStage() passes it to buildAnalysisPrompt() as the
 * collectiveKnowledge context parameter (v6.2 addition in prompts/analysis.ts).
 *
 * Every AI provider that runs in the identify stage receives the
 * === COLLECTIVE KNOWLEDGE === block prepended to their system prompt.
 *
 * If collectiveKnowledge is null (no confirmed patterns yet, DB down,
 * or no categoryHint supplied), the identify stage is completely unchanged —
 * identical output to v9.2. Zero risk.
 *
 * ⚠️  ONE LINE NEEDED IN src/lib/hydra/pipeline/stages/identify.ts:
 *
 *     1. Add to the function signature:
 *          collectiveKnowledge?: CollectiveKnowledgeBlock | null
 *
 *     2. Pass it into buildAnalysisPrompt():
 *          buildAnalysisPrompt({ categoryHint, itemNameHint, collectiveKnowledge })
 *
 *     That is the ONLY change required in identify.ts.
 *     Everything else in that file stays exactly as-is.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function runPipeline(
  images: string[],
  itemNameHint: string,
  options: {
    categoryHint?: string;
    condition?: string;
    additionalContext?: string;
    analysisId?: string;
    hasImage?: boolean;
    config?: Partial<PipelineConfig>;
    dynamicWeights?: Record<string, number>;
    // v9.3: CI Engine — confirmed correction patterns from the knowledge base.
    // Passed through to runIdentifyStage() → buildAnalysisPrompt().
    // null/undefined = no confirmed patterns yet, prompt unchanged.
    collectiveKnowledge?: CollectiveKnowledgeBlock | null;
  } = {}
): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const config = { ...getDefaultConfig(), ...options.config };

  console.log(`\n🔥 === HYDRA v9.3 PIPELINE START ===`);

  // =========================================================================
  // STAGE 1: IDENTIFY
  // v9.3: collectiveKnowledge passed as 5th argument.
  //       runIdentifyStage() must accept it and forward to buildAnalysisPrompt().
  //       See the ⚠️ note in the file header above for the exact one-liner.
  // =========================================================================
  const identifyResult = await runIdentifyStage(
    images,
    itemNameHint,
    options.categoryHint,
    config.stageTimeouts.identify,
    options.collectiveKnowledge ?? null   // v9.3: CI Engine
  );

  const itemName = identifyResult.itemName;
  const category = identifyResult.category as ItemCategory;
  const condition = identifyResult.condition || options.condition || 'good';

  let additionalContext = options.additionalContext || '';
  if (identifyResult.identifiers?.vin) {
    additionalContext = `VIN: ${identifyResult.identifiers.vin}`;
  }

  // =========================================================================
  // STAGE 2: FETCH EVIDENCE
  // =========================================================================
  const fetchResult = await runFetchStage(
    itemName,
    category,
    additionalContext || undefined,
    config.stageTimeouts.fetch
  );

  // =========================================================================
  // STAGE 3: REASON WITH EVIDENCE
  // =========================================================================
  const reasonResult = await runReasonStage(
    itemName,
    category,
    condition,
    fetchResult.evidenceSummary,
    options.dynamicWeights,
    config.stageTimeouts.reason
  );

  // =========================================================================
  // STAGE 4: VALIDATE (optional, fast)
  // =========================================================================
  let validateResult = { valid: true, flags: [], responseTimeMs: 0, vote: null as ModelVote | null };

  if (config.enableValidation) {
    validateResult = await runValidateStage(
      itemName,
      category,
      fetchResult.evidenceSummary,
      reasonResult.consensus,
      config.stageTimeouts.validate
    );
  }

  // =========================================================================
  // PRICE BLENDING
  // =========================================================================
  const { finalPrice, priceMethod, priceRange } = blendFinalPrice(
    fetchResult,
    reasonResult,
    validateResult
  );

  const decision = finalPrice >= 2.0 ? 'BUY' as const : 'SELL' as const;

  const confidence = calculateOverallConfidence(
    fetchResult.evidenceSummary.marketConfidence,
    reasonResult.consensus.confidence,
    validateResult.valid,
    reasonResult.votes.length
  );

  const analysisQuality = confidence >= 80 ? 'EXCELLENT'
    : confidence >= 65 ? 'GOOD'
    : confidence >= 50 ? 'FAIR'
    : 'DEGRADED';

  // =========================================================================
  // COLLECT ALL VOTES FOR BENCHMARKS
  // =========================================================================
  const stageVotes = {
    identify: identifyResult.votes,
    fetch: fetchResult.votes,
    reason: reasonResult.votes,
    validate: validateResult.vote ? [validateResult.vote] : [],
  };

  const allVotes: ModelVote[] = [
    ...stageVotes.identify,
    ...stageVotes.fetch,
    ...stageVotes.reason,
    ...stageVotes.validate,
  ];

  // =========================================================================
  // BENCHMARK + SELF-HEAL
  // v9.2: Now AWAITED with a 2s timeout. This prevents:
  //   1. Vercel teardown killing the insert mid-flight
  //   2. Timeout logs from this analysis bleeding into next request
  // The 2s timeout means benchmarks won't delay response significantly
  // but will complete reliably when Supabase is healthy.
  // =========================================================================
  if (config.enableBenchmarks) {
    try {
      const ebaySource = fetchResult.marketData.sources?.find((s: any) => s.source === 'ebay');

      const benchmarkCtx = buildBenchmarkContext({
        analysisId: options.analysisId || `analysis_${Date.now()}`,
        itemName,
        category,
        categoryConfidence: 0,
        hasImage: options.hasImage ?? images.length > 0,
        blendedPrice: { finalPrice, method: priceMethod, confidence },
        authorityData: fetchResult.evidenceSummary.authority
          ? { source: fetchResult.evidenceSummary.authority.source, itemDetails: fetchResult.evidenceSummary.authority.details }
          : null,
        ebaySource: ebaySource || null,
        consensus: {
          estimatedValue: reasonResult.consensus.estimatedValue,
          decision: reasonResult.consensus.decision,
          analysisQuality,
        },
        totalVotes: allVotes.length,
      });

      // v9.2: Await with timeout instead of fire-and-forget
      await Promise.race([
        recordBenchmarks(
          stageVotes.identify,
          stageVotes.reason,
          stageVotes.fetch,
          [],
          benchmarkCtx
        ),
        new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      ]);

      console.log(`  🎯 Benchmarks: ${allVotes.length} votes queued`);
    } catch (benchErr: any) {
      console.error(`  ⚠️ Benchmark setup failed (non-fatal): ${benchErr.message}`);
    }
  }

  // =========================================================================
  // BUILD RESULT
  // =========================================================================
  const totalTime = Date.now() - pipelineStart;

  const ebaySource = fetchResult.marketData.sources?.find((s: any) => s.source === 'ebay');
  const ebayData = ebaySource?.available ? {
    totalListings: ebaySource.totalListings || 0,
    priceAnalysis: ebaySource.priceAnalysis || null,
    sampleListings: ebaySource.sampleListings?.slice(0, 5) || [],
    suggestedPrices: ebaySource.suggestedPrices || null,
  } : null;

  const marketSources = fetchResult.marketData.sources
    ?.filter((s: any) => s.available)
    .map((s: any) => ({
      source: s.source,
      totalListings: s.totalListings || 0,
      priceAnalysis: s.priceAnalysis || null,
      hasAuthorityData: !!s.authorityData,
    })) || [];

  const authorityData = fetchResult.marketData.primaryAuthority || null;

  console.log(`\n  📊 === PIPELINE COMPLETE ===`);
  console.log(`  💰 Final price: $${finalPrice.toFixed(2)} (${priceMethod})`);
  console.log(`  🎯 Decision: ${decision} | Confidence: ${confidence}%`);
  console.log(`  ⏱️ Total: ${totalTime}ms (ID:${identifyResult.stageTimeMs} + Fetch:${fetchResult.stageTimeMs} + Reason:${reasonResult.stageTimeMs} + Validate:${validateResult.responseTimeMs}ms)`);
  if (options.collectiveKnowledge) {
    console.log(`  [CI-Engine] 🧠 ${options.collectiveKnowledge.items.length} patterns injected at identify stage`);
  }

  return {
    itemName,
    category,
    categoryConfidence: 0.98,
    finalPrice,
    priceMethod,
    decision,
    confidence,
    analysisQuality,
    priceRange,
    allVotes,
    stageVotes,
    stages: {
      identify: identifyResult,
      fetch: fetchResult,
      reason: reasonResult,
      validate: validateResult,
    },
    ebayData,
    marketSources,
    authorityData,
    totalTimeMs: totalTime,
    timing: {
      identify: identifyResult.stageTimeMs,
      fetch: fetchResult.stageTimeMs,
      reason: reasonResult.stageTimeMs,
      validate: validateResult.responseTimeMs,
      total: totalTime,
    },
  };
}

// =============================================================================
// PRICE BLENDING (v9.0)
// =============================================================================

function blendFinalPrice(
  fetchResult: any,
  reasonResult: any,
  validateResult: any
): { finalPrice: number; priceMethod: string; priceRange: { low: number; high: number } } {

  const marketData = fetchResult.marketData;
  const evidence = fetchResult.evidenceSummary;
  const aiConsensus = reasonResult.consensus.estimatedValue;

  const marketPrice = marketData.blendedPrice?.value || 0;

  let marketWeight = 0.50;

  if (evidence.ebay && evidence.ebay.listings >= 10) {
    marketWeight += 0.20;
  } else if (evidence.ebay && evidence.ebay.listings >= 3) {
    marketWeight += 0.10;
  }

  if (evidence.authority) {
    marketWeight += 0.10;
  }

  if (evidence.webPrices) {
    marketWeight += 0.05;
  }

  marketWeight = Math.min(marketWeight, 0.75);

  const aiWeight = 1 - marketWeight;

  let finalPrice: number;
  let priceMethod: string;

  if (marketPrice > 0 && aiConsensus > 0) {
    finalPrice = parseFloat((marketPrice * marketWeight + aiConsensus * aiWeight).toFixed(2));
    priceMethod = `evidence_blend_${Math.round(marketWeight * 100)}pct_market`;
  } else if (marketPrice > 0) {
    finalPrice = marketPrice;
    priceMethod = 'market_only';
  } else if (aiConsensus > 0) {
    finalPrice = aiConsensus;
    priceMethod = 'ai_reasoning_only';
  } else {
    finalPrice = 0;
    priceMethod = 'no_data';
  }

  console.log(`\n  ⚖️ Price blend: ${Math.round(marketWeight * 100)}% market ($${marketPrice.toFixed(2)}) + ${Math.round(aiWeight * 100)}% AI ($${aiConsensus.toFixed(2)}) = $${finalPrice.toFixed(2)}`);

  if (!validateResult.valid && validateResult.flags.length > 0) {
    const errorFlags = validateResult.flags.filter((f: any) => f.severity === 'error');
    if (errorFlags.length > 0) {
      if (marketPrice > 0) {
        const adjustedPrice = parseFloat((marketPrice * 0.85 + aiConsensus * 0.15).toFixed(2));
        console.log(`  ⚠️ Validation failed — adjusting to $${adjustedPrice.toFixed(2)} (85% market)`);
        finalPrice = adjustedPrice;
        priceMethod += '_validation_adjusted';
      }
    }
  }

  const allPrices = [marketPrice, aiConsensus].filter(p => p > 0);
  const priceRange = allPrices.length > 0 ? {
    low: Math.min(...allPrices) * 0.8,
    high: Math.max(...allPrices) * 1.2,
  } : { low: 0, high: 0 };

  return { finalPrice, priceMethod, priceRange };
}

// =============================================================================
// CONFIDENCE CALCULATION
// =============================================================================

function calculateOverallConfidence(
  marketConfidence: number,
  aiConfidence: number,
  validationPassed: boolean,
  reasoningVoteCount: number
): number {
  let confidence = 0;

  confidence += (marketConfidence * 40);
  confidence += (aiConfidence * 0.4);
  confidence += Math.min(reasoningVoteCount / 3, 1.0) * 10;
  confidence += (validationPassed ? 10 : 0);

  return Math.round(Math.min(confidence, 98));
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

function getDefaultConfig(): PipelineConfig {
  return {
    maxDuration: 55000,
    stageTimeouts: {
      identify: 20000,
      fetch: 10000,
      reason: 15000,
      validate: 3000,
    },
    enableValidation: true,
    enableBenchmarks: true,
  };
}

interface PipelineConfig {
  maxDuration: number;
  stageTimeouts: {
    identify: number;
    fetch: number;
    reason: number;
    validate: number;
  };
  enableValidation: boolean;
  enableBenchmarks: boolean;
  dynamicWeights?: Record<string, number>;
  categoryOverrides?: Record<string, any>;
}