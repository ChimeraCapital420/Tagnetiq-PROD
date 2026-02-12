// FILE: src/lib/hydra/pipeline/orchestrator.ts
// HYDRA v9.1 - Pipeline Orchestrator
// Evidence-based pipeline: IDENTIFY → FETCH → REASON → VALIDATE
// Each stage feeds into the next. Market data informs AI reasoning.
//
// v9.0: Original pipeline
// v9.1: Fixed stage timeouts — identify 20s (first-responder), reason 15s

import type { ItemCategory, ModelVote } from '../types.js';
import type {
  PipelineResult,
  PipelineConfig,
  DEFAULT_PIPELINE_CONFIG,
} from './types.js';

import { runIdentifyStage } from './stages/identify.js';
import { runFetchStage } from './stages/fetch-evidence.js';
import { runReasonStage } from './stages/reason.js';
import { runValidateStage } from './stages/validate.js';
import { recordBenchmarks, buildBenchmarkContext } from '../benchmarks/index.js';

// =============================================================================
// PIPELINE ORCHESTRATOR
// =============================================================================

/**
 * Run the full HYDRA v9.1 evidence-based pipeline
 * 
 * Flow:
 * 1. IDENTIFY — What is this item? (vision providers, first-responder)
 * 2. FETCH — Get market evidence (APIs + web search)
 * 3. REASON — Analyze with evidence (reasoning providers)
 * 4. VALIDATE — Sanity check (Groq speed-check)
 * 5. Benchmark + Self-Heal (non-blocking)
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
  } = {}
): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const config = { ...getDefaultConfig(), ...options.config };
  
  console.log(`\n🔥 === HYDRA v9.0 PIPELINE START ===`);
  
  // =========================================================================
  // STAGE 1: IDENTIFY
  // v9.1: First-responder pattern — returns on first valid ID (3-5s typical)
  // =========================================================================
  const identifyResult = await runIdentifyStage(
    images,
    itemNameHint,
    options.categoryHint,
    config.stageTimeouts.identify
  );
  
  const itemName = identifyResult.itemName;
  const category = identifyResult.category as ItemCategory;
  const condition = identifyResult.condition || options.condition || 'good';
  
  // Build additional context (VIN, ISBN, etc.)
  let additionalContext = options.additionalContext || '';
  if (identifyResult.identifiers.vin) {
    additionalContext = `VIN: ${identifyResult.identifiers.vin}`;
  }
  
  // =========================================================================
  // STAGE 2: FETCH EVIDENCE
  // Starts immediately after identification resolves
  // =========================================================================
  const fetchResult = await runFetchStage(
    itemName,
    category,
    additionalContext || undefined,
    config.stageTimeouts.fetch
  );
  
  // =========================================================================
  // STAGE 3: REASON WITH EVIDENCE
  // AIs receive market data and reason from it — no blind guessing
  // v9.1: 15s timeout — Anthropic/DeepSeek were timing out at 8s
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
  // Blend market data with evidence-based AI consensus
  // =========================================================================
  const { finalPrice, priceMethod, priceRange } = blendFinalPrice(
    fetchResult,
    reasonResult,
    validateResult
  );
  
  // Determine final decision
  const decision = finalPrice >= 2.0 ? 'BUY' as const : 'SELL' as const;
  
  // Determine overall confidence
  const confidence = calculateOverallConfidence(
    fetchResult.evidenceSummary.marketConfidence,
    reasonResult.consensus.confidence,
    validateResult.valid,
    reasonResult.votes.length
  );
  
  // Determine analysis quality
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
  // BENCHMARK + SELF-HEAL (non-blocking)
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
      
      recordBenchmarks(
        stageVotes.identify,
        stageVotes.reason,  // Reasoning votes (were "text" in v8.0)
        stageVotes.fetch,   // Fetch votes (Perplexity + xAI)
        [],                 // No tiebreaker in v9.0 — DeepSeek is now a reasoning provider
        benchmarkCtx
      );
      
      console.log(`  🎯 Benchmarks: ${allVotes.length} votes queued`);
    } catch (benchErr: any) {
      console.error(`  ⚠️ Benchmark setup failed (non-fatal): ${benchErr.message}`);
    }
  }
  
  // =========================================================================
  // BUILD RESULT
  // =========================================================================
  const totalTime = Date.now() - pipelineStart;
  
  // Extract eBay data for response
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
  
  // Get market-based price
  const marketPrice = marketData.blendedPrice?.value || 0;
  
  // Calculate market weight based on data quality
  let marketWeight = 0.50; // Base 50/50
  
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
  
  // v9.0: AI reasoning is evidence-based, so trust it more than v8.0
  // In v8.0 we needed 70-95% market weight because AI was guessing blind
  // In v9.0 the AI has seen the market data, so 50-75% market is sufficient
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
  
  // Apply validation adjustments
  if (!validateResult.valid && validateResult.flags.length > 0) {
    const errorFlags = validateResult.flags.filter((f: any) => f.severity === 'error');
    if (errorFlags.length > 0) {
      // If validation failed, lean more on market data
      if (marketPrice > 0) {
        const adjustedPrice = parseFloat((marketPrice * 0.85 + aiConsensus * 0.15).toFixed(2));
        console.log(`  ⚠️ Validation failed — adjusting to $${adjustedPrice.toFixed(2)} (85% market)`);
        finalPrice = adjustedPrice;
        priceMethod += '_validation_adjusted';
      }
    }
  }
  
  // Price range
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
  // Market confidence (0-1) contributes 40%
  // AI confidence (0-100) contributes 40%
  // Vote count contributes 10%
  // Validation contributes 10%
  
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
      identify: 20000,  // v9.1: Was 8000 — first-responder returns fast, but slow providers get time
      fetch: 10000,
      reason: 15000,    // v9.1: Was 8000 — Anthropic/DeepSeek were timing out at 6-8s
      validate: 3000,   // v9.1: Was 2000 — small buffer for Groq
    },
    enableValidation: true,
    enableBenchmarks: true,
  };
}

// Re-export the type to avoid circular imports
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