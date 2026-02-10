// FILE: src/lib/hydra/benchmarks/index.ts
// HYDRA v8.0 - AI Provider Benchmark System
// Ground truth tracking for every AI vote
//
// Usage in analyze.ts:
//   import { recordBenchmarks } from '../src/lib/hydra/benchmarks/index.js';
//   recordBenchmarks(visionVotes, textVotes, [], tiebreakerVotes, context);
//
// Scalable: Add new providers just by giving them votes.
// No code changes needed when adding provider #9, #10, etc.

import { createClient } from '@supabase/supabase-js';
import type { ModelVote } from '../types.js';
import type { BenchmarkRecord, BenchmarkContext } from './types.js';
import { scoreVote, scoreAllVotes, getAccuracySummary } from './scorer.js';

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type {
  BenchmarkRecord,
  BenchmarkContext,
  WeeklyScorecard,
  CategoryScore,
  CompetitiveRanking,
  RankEntry,
  ProviderContact,
  ScorecardEmail,
  InvestorBenchmarkReport,
} from './types.js';

export { scoreVote, scoreAllVotes, getAccuracySummary } from './scorer.js';

export {
  aggregateProviderWeek,
  aggregateAllProviders,
  buildCompetitiveRankings,
  buildInvestorReport,
  persistWeeklyAggregates,
} from './aggregator.js';

export { buildScorecardEmail } from './email-builder.js';

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

// =============================================================================
// MAIN ENTRY: Record benchmarks from an analysis (non-blocking)
// =============================================================================

/**
 * Record all AI votes against ground truth.
 * Call this after blended price is calculated.
 * NON-BLOCKING — fires and forgets, logs errors but never throws.
 * 
 * @example
 * // In analyze.ts, after Stage 7 (price blending):
 * recordBenchmarks(
 *   visionVotes, textVotes, perplexityVotes, tiebreakerVotes,
 *   {
 *     analysis_id: analysisId,
 *     item_name: identifiedItemName,
 *     detected_category: finalCategory,
 *     category_confidence: categoryResult.confidence,
 *     had_image: hasImage,
 *     ground_truth_price: blendedPrice.finalPrice,
 *     ground_truth_source: blendedPrice.method,
 *     authority_source: authorityData?.source || null,
 *     authority_price: authorityData?.priceByCondition?.good || null,
 *     ebay_median_price: ebaySource?.priceAnalysis?.median || null,
 *     ebay_listing_count: ebaySource?.totalListings || null,
 *     market_confidence: blendedPrice.confidence / 100,
 *     consensus_price: consensus.estimatedValue,
 *     consensus_decision: consensus.decision,
 *     final_blended_price: blendedPrice.finalPrice,
 *     total_votes: allVotes.length,
 *     analysis_quality: consensus.analysisQuality,
 *   }
 * );
 */
export function recordBenchmarks(
  visionVotes: ModelVote[],
  textVotes: ModelVote[],
  marketSearchVotes: ModelVote[],
  tiebreakerVotes: ModelVote[],
  context: BenchmarkContext
): void {
  // Fire and forget — never block the response
  recordBenchmarksAsync(visionVotes, textVotes, marketSearchVotes, tiebreakerVotes, context)
    .catch(err => console.error('⚠️ Benchmark recording failed (non-fatal):', err.message));
}

/**
 * Async implementation — scores votes and inserts into Supabase
 */
async function recordBenchmarksAsync(
  visionVotes: ModelVote[],
  textVotes: ModelVote[],
  marketSearchVotes: ModelVote[],
  tiebreakerVotes: ModelVote[],
  context: BenchmarkContext
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    console.log('⚠️ Benchmarks: Supabase not configured, skipping');
    return;
  }
  
  // Score all votes against ground truth
  const records = scoreAllVotes(
    visionVotes, textVotes, marketSearchVotes, tiebreakerVotes, context
  );
  
  if (records.length === 0) {
    console.log('⚠️ Benchmarks: No votes to record');
    return;
  }
  
  // Log accuracy summary to console
  console.log(`\n🎯 === PROVIDER BENCHMARK (${records.length} votes) ===`);
  console.log(getAccuracySummary(records));
  
  // Insert into Supabase (batch insert)
  const { error } = await supabase
    .from('provider_benchmarks')
    .insert(records);
  
  if (error) {
    console.error('⚠️ Benchmark insert failed:', error.message);
    // Don't throw — this is non-blocking telemetry
  } else {
    console.log(`✅ Benchmarks: ${records.length} votes recorded`);
  }
}

// =============================================================================
// HELPER: Build context from analyze.ts variables
// =============================================================================

/**
 * Convenience function to build BenchmarkContext from analyze.ts variables
 * Keeps the integration clean — one function call in analyze.ts
 */
export function buildBenchmarkContext(params: {
  analysisId: string;
  itemName: string;
  category: string;
  categoryConfidence: number;
  hasImage: boolean;
  blendedPrice: any;
  authorityData: any;
  ebaySource: any;
  consensus: any;
  totalVotes: number;
}): BenchmarkContext {
  return {
    analysis_id: params.analysisId,
    item_name: params.itemName,
    detected_category: params.category,
    category_confidence: params.categoryConfidence,
    had_image: params.hasImage,
    
    ground_truth_price: params.blendedPrice?.finalPrice || null,
    ground_truth_source: params.blendedPrice?.method || null,
    authority_source: params.authorityData?.source || null,
    authority_price: params.authorityData?.priceByCondition?.good || null,
    ebay_median_price: params.ebaySource?.priceAnalysis?.median || null,
    ebay_listing_count: params.ebaySource?.totalListings || null,
    market_confidence: (params.blendedPrice?.confidence || 0) / 100,
    
    consensus_price: params.consensus?.estimatedValue || 0,
    consensus_decision: params.consensus?.decision || 'SELL',
    final_blended_price: params.blendedPrice?.finalPrice || 0,
    total_votes: params.totalVotes,
    analysis_quality: params.consensus?.analysisQuality || 'FALLBACK',
  };
}