// FILE: src/lib/hydra/consensus/tiebreaker.ts
// Tiebreaker Logic for HYDRA Consensus Engine
// Extracted from hydra-engine.ts Stage 4: TIEBREAKER LOGIC

import type { ModelVote, ParsedAnalysis, AIProvider } from '../types.js';
import { TIEBREAKER_THRESHOLDS } from '../config/constants.js';
import { tallyVotes, createVote, type VoteTally } from './voting.js';

// =============================================================================
// TYPES
// =============================================================================

export interface TiebreakerTriggerResult {
  /** Whether tiebreaker should be triggered */
  shouldTrigger: boolean;
  /** Reason for the decision */
  reason: string;
  /** Vote tally that led to this decision */
  tally: VoteTally;
  /** Weight difference percentage */
  weightDifference: number;
}

export interface TiebreakerResult {
  /** Whether tiebreaker was successful */
  success: boolean;
  /** The tiebreaker vote if successful */
  vote: ModelVote | null;
  /** The parsed analysis if successful */
  analysis: ParsedAnalysis | null;
  /** Error message if failed */
  error?: string;
  /** Time taken for tiebreaker */
  responseTime?: number;
}

export interface TiebreakerOptions {
  /** Minimum vote difference threshold (default: 0.15 = 15%) */
  closeVoteThreshold?: number;
  /** Minimum number of primary votes before considering tiebreaker (default: 4) */
  minPrimaryVotes?: number;
  /** Item name for context and fallback */
  itemName?: string;
  /** Whether to log detailed info */
  verbose?: boolean;
}

// =============================================================================
// TIEBREAKER TRIGGER LOGIC
// =============================================================================

/**
 * Determine if a tiebreaker should be triggered based on vote distribution
 * 
 * Matches hydra-engine.ts Stage 4 tiebreaker logic:
 * - Need minimum 4 votes to assess ties
 * - Close vote is within 15% weight difference
 * 
 * @param votes - Array of primary ModelVote objects
 * @param options - Configuration options
 * @returns TiebreakerTriggerResult
 */
export function shouldTriggerTiebreaker(
  votes: ModelVote[],
  options: TiebreakerOptions = {}
): TiebreakerTriggerResult {
  const {
    closeVoteThreshold = TIEBREAKER_THRESHOLDS.minVoteDifference / 100 || 0.15,
    minPrimaryVotes = 4,
    verbose = false,
  } = options;

  // Not enough votes to assess (matches hydra-engine.ts check)
  if (votes.length < minPrimaryVotes) {
    return {
      shouldTrigger: false,
      reason: `Insufficient votes: ${votes.length} < ${minPrimaryVotes} minimum required`,
      tally: tallyVotes(votes),
      weightDifference: 0,
    };
  }

  // Calculate vote tally
  const tally = tallyVotes(votes, closeVoteThreshold);

  if (verbose) {
    console.log(`🤔 Consensus check: BUY(${tally.buyWeight.toFixed(2)}) vs SELL(${tally.sellWeight.toFixed(2)}) - difference: ${(tally.weightDifference * 100).toFixed(1)}%`);
  }

  // Check if close vote (matches hydra-engine.ts: weightDifference < 0.15)
  if (tally.isCloseVote) {
    return {
      shouldTrigger: true,
      reason: `Close vote detected: ${(tally.weightDifference * 100).toFixed(1)}% difference < ${(closeVoteThreshold * 100).toFixed(0)}% threshold`,
      tally,
      weightDifference: tally.weightDifference,
    };
  }

  return {
    shouldTrigger: false,
    reason: `Clear consensus: ${(tally.weightDifference * 100).toFixed(1)}% difference >= ${(closeVoteThreshold * 100).toFixed(0)}% threshold`,
    tally,
    weightDifference: tally.weightDifference,
  };
}

/**
 * Check if there are tiebreaker providers available
 */
export function hasTiebreakerProvider(
  providers: Array<{ name: string }>
): boolean {
  const tiebreakerNames = ['DeepSeek'];
  return providers.some(p => tiebreakerNames.includes(p.name));
}

/**
 * Get tiebreaker providers from a list
 */
export function getTiebreakerProviders<T extends { name: string }>(
  providers: T[]
): T[] {
  const tiebreakerNames = ['DeepSeek'];
  return providers.filter(p => tiebreakerNames.includes(p.name));
}

// =============================================================================
// TIEBREAKER VOTE CREATION
// =============================================================================

/**
 * Create a tiebreaker vote from provider response
 * Matches hydra-engine.ts tiebreaker vote creation with reduced weight/confidence
 */
export function createTiebreakerVote(
  provider: AIProvider | { id: string; name: string; baseWeight?: number },
  analysis: ParsedAnalysis,
  confidence: number,
  responseTime: number,
  itemName?: string
): ModelVote {
  return createVote(provider, analysis, confidence, responseTime, {
    isTiebreaker: true,
    fallbackItemName: itemName,
  });
}

// =============================================================================
// VOTE MERGING
// =============================================================================

/**
 * Merge tiebreaker vote with primary votes
 * Returns new array with tiebreaker appended
 */
export function mergeWithTiebreaker(
  primaryVotes: ModelVote[],
  tiebreakerResult: TiebreakerResult
): ModelVote[] {
  if (!tiebreakerResult.success || !tiebreakerResult.vote) {
    return primaryVotes;
  }

  return [...primaryVotes, tiebreakerResult.vote];
}

/**
 * Recalculate consensus after tiebreaker
 * Returns the new majority decision
 */
export function getPostTiebreakerDecision(
  primaryVotes: ModelVote[],
  tiebreakerVote: ModelVote
): 'BUY' | 'SELL' {
  const allVotes = [...primaryVotes, tiebreakerVote];
  const tally = tallyVotes(allVotes);
  return tally.decision;
}

// =============================================================================
// TIEBREAKER ANALYTICS
// =============================================================================

/**
 * Analyze the impact of the tiebreaker vote
 */
export function analyzeTiebreakerImpact(
  primaryVotes: ModelVote[],
  tiebreakerVote: ModelVote
): {
  changedDecision: boolean;
  previousDecision: 'BUY' | 'SELL';
  newDecision: 'BUY' | 'SELL';
  weightShift: number;
  newWeightDifference: number;
} {
  const primaryTally = tallyVotes(primaryVotes);
  const combinedTally = tallyVotes([...primaryVotes, tiebreakerVote]);

  const previousDecision = primaryTally.decision;
  const newDecision = combinedTally.decision;

  // Calculate weight shift
  const previousDiff = primaryTally.buyWeight - primaryTally.sellWeight;
  const newDiff = combinedTally.buyWeight - combinedTally.sellWeight;
  const weightShift = newDiff - previousDiff;

  return {
    changedDecision: previousDecision !== newDecision,
    previousDecision,
    newDecision,
    weightShift,
    newWeightDifference: combinedTally.weightDifference,
  };
}

// =============================================================================
// LOGGING
// =============================================================================

/**
 * Log tiebreaker trigger decision
 */
export function logTiebreakerTrigger(
  result: TiebreakerTriggerResult,
  verbose: boolean = true
): void {
  if (!verbose) return;

  if (result.shouldTrigger) {
    console.log('🔄 CLOSE VOTE DETECTED! Running tiebreaker...');
    console.log(`   └── ${result.reason}`);
  } else {
    console.log('✅ Clear consensus achieved, tiebreaker not needed');
    console.log(`   └── ${result.reason}`);
  }
}

/**
 * Log tiebreaker result
 */
export function logTiebreakerResult(
  providerName: string,
  result: TiebreakerResult,
  verbose: boolean = true
): void {
  if (!verbose) return;

  if (result.success && result.vote) {
    console.log(`🎯 TIEBREAKER ${providerName} decided: "${result.vote.decision}" (confidence: ${(result.vote.confidence * 100).toFixed(0)}%)`);
    console.log(`✅ Stage 4 complete: Tiebreaker vote added`);
  } else {
    console.log(`❌ TIEBREAKER failed: ${result.error || 'Unknown error'}`);
  }
}

/**
 * Log full tiebreaker summary
 */
export function logTiebreakerSummary(
  triggerResult: TiebreakerTriggerResult,
  tiebreakerResult: TiebreakerResult | null
): void {
  if (!triggerResult.shouldTrigger) {
    console.log('✅ Tiebreaker not needed:', triggerResult.reason);
    return;
  }

  console.log('🔄 Tiebreaker triggered:', triggerResult.reason);

  if (tiebreakerResult?.success && tiebreakerResult.vote) {
    console.log(`   └── Decision: ${tiebreakerResult.vote.decision}`);
    console.log(`   └── Value: $${tiebreakerResult.vote.estimatedValue.toFixed(2)}`);
    console.log(`   └── Confidence: ${(tiebreakerResult.vote.confidence * 100).toFixed(0)}%`);
    if (tiebreakerResult.responseTime) {
      console.log(`   └── Response time: ${tiebreakerResult.responseTime}ms`);
    }
  } else {
    console.log(`   └── Failed: ${tiebreakerResult?.error || 'No result'}`);
  }
}

// =============================================================================
// CONVENIENCE WRAPPER
// =============================================================================

/**
 * Run tiebreaker check and return whether it should be triggered
 * Convenience function that combines check and logging
 */
export function checkTiebreakerNeeded(
  primaryVotes: ModelVote[],
  options: TiebreakerOptions = {}
): {
  needed: boolean;
  trigger: TiebreakerTriggerResult;
} {
  const trigger = shouldTriggerTiebreaker(primaryVotes, options);
  
  if (options.verbose) {
    logTiebreakerTrigger(trigger);
  }

  return {
    needed: trigger.shouldTrigger,
    trigger,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  shouldTriggerTiebreaker,
  hasTiebreakerProvider,
  getTiebreakerProviders,
  createTiebreakerVote,
  mergeWithTiebreaker,
  getPostTiebreakerDecision,
  analyzeTiebreakerImpact,
  logTiebreakerTrigger,
  logTiebreakerResult,
  logTiebreakerSummary,
  checkTiebreakerNeeded,
};