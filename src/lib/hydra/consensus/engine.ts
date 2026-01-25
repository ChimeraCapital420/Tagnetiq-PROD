// FILE: src/lib/hydra/consensus/engine.ts
// HYDRA Consensus Engine - Main Orchestration
// Extracted from hydra-engine.ts calculateConsensus()

import type {
  ModelVote,
  ConsensusResult,
  ConsensusMetrics,
  AuthorityData,
} from '../types.js';

import {
  tallyVotes,
  calculateVoteStats,
  collectVotes,
  extractItemContext,
  type VoteTally,
  type VoteStats,
  type VoteCollection,
} from './voting.js';

import {
  calculateConfidence,
  type ConfidenceResult,
} from './confidence.js';

import {
  shouldTriggerTiebreaker,
  mergeWithTiebreaker,
  type TiebreakerTriggerResult,
  type TiebreakerResult,
} from './tiebreaker.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ConsensusEngineConfig {
  targetAICount?: number;
  minVotesForConsensus?: number;
  lowVoteCap?: number;
  verbose?: boolean;
  tiebreakerThreshold?: number;
}

export interface ConsensusEngineResult {
  consensus: ConsensusResult;
  tally: VoteTally;
  stats: VoteStats;
  confidenceResult: ConfidenceResult;
  tiebreakerTriggered: boolean;
  tiebreakerTrigger?: TiebreakerTriggerResult;
}

// =============================================================================
// MAIN CONSENSUS CALCULATION
// =============================================================================

/**
 * Calculate consensus from votes
 * Extracted from hydra-engine.ts calculateConsensus()
 */
export function calculateConsensus(
  votes: ModelVote[],
  authorityData?: AuthorityData | null,
  config: ConsensusEngineConfig = {}
): ConsensusResult {
  const {
    targetAICount = 10,
    minVotesForConsensus = 3,
    lowVoteCap = 75,
    verbose = false,
  } = config;

  if (votes.length === 0) {
    return createEmptyConsensus();
  }

  const tally = tallyVotes(votes);
  const stats = calculateVoteStats(votes);

  const confidenceResult = calculateConfidence(votes, {
    targetAICount,
    authorityData,
    minVotesForFullConfidence: minVotesForConsensus,
    lowVoteCap,
    verbose,
  });

  return {
    itemName: stats.consensusItemName,
    estimatedValue: parseFloat(stats.weightedValue.toFixed(2)),
    decision: tally.decision,
    confidence: confidenceResult.confidence,
    totalVotes: votes.length,
    analysisQuality: confidenceResult.quality,
    consensusMetrics: confidenceResult.metrics,
  };
}

/**
 * Calculate consensus with full result details
 */
export function calculateConsensusWithDetails(
  votes: ModelVote[],
  authorityData?: AuthorityData | null,
  config: ConsensusEngineConfig = {}
): ConsensusEngineResult {
  const {
    targetAICount = 10,
    minVotesForConsensus = 3,
    lowVoteCap = 75,
    verbose = false,
    tiebreakerThreshold = 0.15,
  } = config;

  const tally = tallyVotes(votes, tiebreakerThreshold);
  const stats = calculateVoteStats(votes);
  
  const tiebreakerTrigger = shouldTriggerTiebreaker(votes, {
    closeVoteThreshold: tiebreakerThreshold,
    minPrimaryVotes: 4,
    verbose,
  });

  const confidenceResult = calculateConfidence(votes, {
    targetAICount,
    authorityData,
    minVotesForFullConfidence: minVotesForConsensus,
    lowVoteCap,
    verbose,
  });

  const consensus: ConsensusResult = {
    itemName: stats.consensusItemName,
    estimatedValue: parseFloat(stats.weightedValue.toFixed(2)),
    decision: tally.decision,
    confidence: confidenceResult.confidence,
    totalVotes: votes.length,
    analysisQuality: confidenceResult.quality,
    consensusMetrics: confidenceResult.metrics,
  };

  return {
    consensus,
    tally,
    stats,
    confidenceResult,
    tiebreakerTriggered: tiebreakerTrigger.shouldTrigger,
    tiebreakerTrigger,
  };
}

/**
 * Calculate staged consensus from categorized votes
 */
export function calculateStagedConsensus(
  primaryVisionVotes: ModelVote[],
  textAnalysisVotes: ModelVote[],
  marketSearchVotes: ModelVote[],
  tiebreakerVotes: ModelVote[],
  authorityData?: AuthorityData | null,
  config: ConsensusEngineConfig = {}
): {
  consensus: ConsensusResult;
  collection: VoteCollection;
  itemContext: { itemName: string; description: string };
} {
  const collection = collectVotes(
    primaryVisionVotes,
    textAnalysisVotes,
    marketSearchVotes,
    tiebreakerVotes
  );

  const itemContext = extractItemContext(primaryVisionVotes);

  const consensus = calculateConsensus(
    collection.votes,
    authorityData,
    config
  );

  return {
    consensus,
    collection,
    itemContext,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function createEmptyConsensus(): ConsensusResult {
  return {
    itemName: 'Unknown Item',
    estimatedValue: 0,
    decision: 'SELL',
    confidence: 0,
    totalVotes: 0,
    analysisQuality: 'FALLBACK',
    consensusMetrics: {
      avgAIConfidence: 0,
      decisionAgreement: 0,
      valueAgreement: 0,
      participationRate: 0,
      authorityVerified: false,
    },
  };
}

export function createFallbackConsensus(vote: ModelVote): ConsensusResult {
  return {
    itemName: vote.itemName,
    estimatedValue: vote.estimatedValue,
    decision: vote.decision,
    confidence: Math.min(50, Math.round(vote.confidence * 100)),
    totalVotes: 1,
    analysisQuality: 'FALLBACK',
    consensusMetrics: {
      avgAIConfidence: vote.confidence,
      decisionAgreement: 1,
      valueAgreement: 1,
      participationRate: 0.1,
      authorityVerified: false,
    },
  };
}

export function mergeAndRecalculate(
  primaryVotes: ModelVote[],
  tiebreakerResult: TiebreakerResult,
  authorityData?: AuthorityData | null,
  config: ConsensusEngineConfig = {}
): ConsensusResult {
  const allVotes = mergeWithTiebreaker(primaryVotes, tiebreakerResult);
  return calculateConsensus(allVotes, authorityData, config);
}

export function quickConsensusCheck(votes: ModelVote[]): {
  decision: 'BUY' | 'SELL';
  confidence: number;
  isCloseVote: boolean;
  itemName: string;
  value: number;
} {
  const tally = tallyVotes(votes);
  const stats = calculateVoteStats(votes);
  const confidenceResult = calculateConfidence(votes);

  return {
    decision: tally.decision,
    confidence: confidenceResult.confidence,
    isCloseVote: tally.isCloseVote,
    itemName: stats.consensusItemName,
    value: stats.weightedValue,
  };
}

export function isConsensusAcceptable(
  consensus: ConsensusResult,
  minConfidence: number = 70
): boolean {
  return (
    consensus.confidence >= minConfidence &&
    consensus.analysisQuality !== 'FALLBACK' &&
    consensus.totalVotes >= 3
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  calculateConsensus,
  calculateConsensusWithDetails,
  calculateStagedConsensus,
  createEmptyConsensus,
  createFallbackConsensus,
  mergeAndRecalculate,
  quickConsensusCheck,
  isConsensusAcceptable,
};