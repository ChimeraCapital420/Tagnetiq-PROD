// FILE: src/lib/hydra/consensus/index.ts
// HYDRA Consensus Module Exports
// Phase 3: Consensus Engine

// =============================================================================
// ENGINE
// =============================================================================

export {
  calculateConsensus,
  calculateConsensusWithDetails,
  calculateStagedConsensus,
  createEmptyConsensus,
  createFallbackConsensus,
  mergeAndRecalculate,
  quickConsensusCheck,
  isConsensusAcceptable,
  type ConsensusEngineConfig,
  type ConsensusEngineResult,
} from './engine.js';

// =============================================================================
// VOTING
// =============================================================================

export {
  calculateVoteWeight,
  createVote,
  tallyVotes,
  calculateVoteStats,
  collectVotes,
  filterVotesByProvider,
  getBestVote,
  extractItemContext,
  createEnhancedPrompt,
  createMarketSearchPrompt,
  logVoteSummary,
  logVoteDetails,
  type VoteTally,
  type VoteStats,
  type VoteCollection,
} from './voting.js';

// =============================================================================
// CONFIDENCE
// =============================================================================

export {
  calculateConfidence,
  determineQuality,
  meetsMinimumConfidence,
  isOptimalConfidence,
  applyConfidencePenalty,
  applyConfidenceBonus,
  capConfidenceByVoteCount,
  estimateConfidence,
  type AnalysisQuality,
  type ConfidenceResult,
  type ConfidenceBreakdown,
  type ConfidenceOptions,
} from './confidence.js';

// =============================================================================
// TIEBREAKER
// =============================================================================

export {
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
  type TiebreakerTriggerResult,
  type TiebreakerResult,
  type TiebreakerOptions,
} from './tiebreaker.js';

// =============================================================================
// MODULE INFO
// =============================================================================

export const CONSENSUS_MODULE_VERSION = '6.0.0';