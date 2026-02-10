// FILE: src/lib/hydra/benchmarks/scorer.ts
// HYDRA v8.0 - Vote Scorer
// Scores each AI vote against market-verified ground truth
// Called non-blocking after each analysis completes

import type { ModelVote } from '../types.js';
import type { BenchmarkRecord, BenchmarkContext } from './types.js';

// =============================================================================
// SCORE A SINGLE VOTE
// =============================================================================

/**
 * Score one AI vote against market ground truth
 * Returns a BenchmarkRecord ready for database insertion
 */
export function scoreVote(
  vote: ModelVote,
  context: BenchmarkContext,
  stage: 'vision' | 'text' | 'market_search' | 'tiebreaker' = 'vision'
): BenchmarkRecord {
  const groundTruth = context.ground_truth_price;
  
  // Calculate price errors (only if we have ground truth)
  let priceErrorDollars: number | undefined;
  let priceErrorPercent: number | undefined;
  let priceDirection: 'over' | 'under' | 'accurate' | undefined;
  let decisionCorrect: boolean | undefined;
  
  if (groundTruth && groundTruth > 0) {
    priceErrorDollars = Math.abs(vote.estimatedValue - groundTruth);
    priceErrorPercent = (priceErrorDollars / groundTruth) * 100;
    
    // Direction: within 10% = accurate
    if (priceErrorPercent <= 10) {
      priceDirection = 'accurate';
    } else if (vote.estimatedValue > groundTruth) {
      priceDirection = 'over';
    } else {
      priceDirection = 'under';
    }
    
    // Decision correctness: BUY if item is worth more than typical threshold
    // For now: BUY is correct if ground truth > $2, SELL if < $2
    // This is a simplification — real logic would compare to acquisition cost
    const marketSupportsBuy = groundTruth >= 2.00;
    decisionCorrect = (vote.decision === 'BUY') === marketSupportsBuy;
  }
  
  return {
    analysis_id: context.analysis_id,
    
    // Provider data
    provider_id: vote.providerId,
    provider_model: undefined, // Set by caller if known
    provider_price: vote.estimatedValue,
    provider_decision: vote.decision,
    provider_confidence: vote.confidence,
    provider_item_name: vote.itemName,
    provider_category: (vote.rawResponse as any)?.category || undefined,
    response_time_ms: vote.responseTime,
    
    // Ground truth
    ground_truth_price: groundTruth || undefined,
    ground_truth_source: context.ground_truth_source || undefined,
    authority_source: context.authority_source || undefined,
    authority_price: context.authority_price || undefined,
    ebay_median_price: context.ebay_median_price || undefined,
    ebay_listing_count: context.ebay_listing_count || undefined,
    market_confidence: context.market_confidence,
    
    // Calculated scores
    price_error_dollars: priceErrorDollars,
    price_error_percent: priceErrorPercent,
    price_direction: priceDirection,
    decision_correct: decisionCorrect,
    
    // Context
    item_name: context.item_name,
    detected_category: context.detected_category,
    category_confidence: context.category_confidence,
    stage,
    had_image: context.had_image,
    
    // Consensus
    consensus_price: context.consensus_price,
    consensus_decision: context.consensus_decision,
    final_blended_price: context.final_blended_price,
    total_votes: context.total_votes,
    analysis_quality: context.analysis_quality,
  };
}

// =============================================================================
// SCORE ALL VOTES FROM AN ANALYSIS
// =============================================================================

/**
 * Score all votes from a completed analysis
 * Groups by stage (vision, text, tiebreaker)
 */
export function scoreAllVotes(
  visionVotes: ModelVote[],
  textVotes: ModelVote[],
  marketSearchVotes: ModelVote[],
  tiebreakerVotes: ModelVote[],
  context: BenchmarkContext
): BenchmarkRecord[] {
  const records: BenchmarkRecord[] = [];
  
  for (const vote of visionVotes) {
    records.push(scoreVote(vote, context, 'vision'));
  }
  
  for (const vote of textVotes) {
    records.push(scoreVote(vote, context, 'text'));
  }
  
  for (const vote of marketSearchVotes) {
    records.push(scoreVote(vote, context, 'market_search'));
  }
  
  for (const vote of tiebreakerVotes) {
    records.push(scoreVote(vote, context, 'tiebreaker'));
  }
  
  return records;
}

// =============================================================================
// QUICK ACCURACY CHECK (for real-time logging)
// =============================================================================

/**
 * Get a quick human-readable accuracy summary for console logging
 */
export function getAccuracySummary(records: BenchmarkRecord[]): string {
  if (records.length === 0) return 'No votes to score';
  
  const withGroundTruth = records.filter(r => r.ground_truth_price && r.ground_truth_price > 0);
  
  if (withGroundTruth.length === 0) return 'No ground truth available';
  
  const lines: string[] = [];
  
  for (const r of withGroundTruth) {
    const errorPct = r.price_error_percent?.toFixed(1) || '?';
    const direction = r.price_direction === 'accurate' ? '✅' : 
                      r.price_direction === 'over' ? '📈' : '📉';
    
    lines.push(
      `  ${direction} ${r.provider_id}: $${r.provider_price.toFixed(2)} ` +
      `(${r.price_direction} by ${errorPct}%) ` +
      `vs truth $${r.ground_truth_price?.toFixed(2)}`
    );
  }
  
  // Overall stats
  const avgError = withGroundTruth.reduce((sum, r) => sum + (r.price_error_percent || 0), 0) / withGroundTruth.length;
  const accurate = withGroundTruth.filter(r => r.price_direction === 'accurate').length;
  
  lines.push(`  📊 Avg error: ${avgError.toFixed(1)}% | ${accurate}/${withGroundTruth.length} within 10%`);
  
  return lines.join('\n');
}