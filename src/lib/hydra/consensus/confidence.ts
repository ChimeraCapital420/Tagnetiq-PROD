// FILE: src/lib/hydra/consensus/confidence.ts
// Confidence Calculation for HYDRA Consensus Engine
// Extracted from hydra-engine.ts calculateConsensus()

import type { ModelVote, AuthorityData, ConsensusMetrics } from '../types.js';
import { CONFIDENCE_THRESHOLDS, CONFIDENCE_WEIGHTS } from '../config/constants.js';
import { tallyVotes, calculateVoteStats } from './voting.js';

// =============================================================================
// TYPES
// =============================================================================

export type AnalysisQuality = 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';

export interface ConfidenceResult {
  /** Final confidence score (0-100) */
  confidence: number;
  /** Analysis quality level */
  quality: AnalysisQuality;
  /** Detailed metrics used in calculation */
  metrics: ConsensusMetrics;
  /** Breakdown of confidence components */
  breakdown: ConfidenceBreakdown;
}

export interface ConfidenceBreakdown {
  /** Contribution from AI confidence scores (35%) */
  aiScoreContribution: number;
  /** Contribution from decision agreement (25%) */
  decisionAgreementContribution: number;
  /** Contribution from value agreement (25%) */
  valueAgreementContribution: number;
  /** Contribution from participation rate (15%) */
  participationContribution: number;
  /** Contribution from authority verification (+5%) */
  authorityBoost: number;
  /** Base confidence before authority boost */
  baseConfidence: number;
  /** Final confidence after all adjustments */
  finalConfidence: number;
}

export interface ConfidenceOptions {
  /** Target number of AI providers for participation rate (default: 10) */
  targetAICount?: number;
  /** Authority data if available */
  authorityData?: AuthorityData | null;
  /** Minimum votes for full confidence (default: 3) */
  minVotesForFullConfidence?: number;
  /** Cap confidence for low vote count (default: 75) */
  lowVoteCap?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

// =============================================================================
// MAIN CONFIDENCE CALCULATION
// =============================================================================

/**
 * Calculate comprehensive confidence score for consensus
 * 
 * This matches the ENHANCED CONFIDENCE CALCULATION in hydra-engine.ts:
 * - avgConfidence * 0.35           (35% weight on average AI confidence)
 * - decisionAgreement * 0.25       (25% weight on decision consensus)
 * - valueAgreement * 0.25          (25% weight on value consensus)
 * - participationRate * 0.15       (15% weight on AI participation)
 * - authorityBoost (+5% if verified)
 * 
 * @param votes - Array of ModelVote objects
 * @param options - Configuration options
 * @returns ConfidenceResult with score, quality, and metrics
 */
export function calculateConfidence(
  votes: ModelVote[],
  options: ConfidenceOptions = {}
): ConfidenceResult {
  const {
    targetAICount = 10, // Updated target for 8 core AIs + authority sources
    authorityData = null,
    minVotesForFullConfidence = 3,
    lowVoteCap = 75,
    verbose = false,
  } = options;

  // Handle empty votes
  if (votes.length === 0) {
    return createEmptyConfidenceResult();
  }

  // Check for critically low participation
  const criticallyLowVotes = votes.length < minVotesForFullConfidence;

  // Calculate component metrics (matches hydra-engine.ts exactly)
  const voteStats = calculateVoteStats(votes);
  const tally = tallyVotes(votes);
  
  // Average AI confidence
  const avgAIConfidence = voteStats.avgConfidence;
  
  // Decision agreement (how strongly AIs agree on BUY vs SELL)
  const decisionAgreement = voteStats.decisionAgreement;
  
  // Value agreement (how closely values align using coefficient of variation)
  const valueAgreement = voteStats.valueAgreement;
  
  // Participation rate (more AIs = higher confidence)
  const participationRate = Math.min(1, votes.length / targetAICount);
  
  // Authority boost (+5% if authority data exists)
  const authorityBoost = authorityData ? 0.05 : 0;

  // Calculate weighted contributions (matches hydra-engine.ts weights)
  const aiScoreContribution = avgAIConfidence * 0.35;
  const decisionAgreementContribution = decisionAgreement * 0.25;
  const valueAgreementContribution = valueAgreement * 0.25;
  const participationContribution = participationRate * 0.15;

  // Calculate base confidence (0-1 scale)
  const baseConfidence = 
    aiScoreContribution +
    decisionAgreementContribution +
    valueAgreementContribution +
    participationContribution;

  // Apply authority boost
  const boostedConfidence = baseConfidence + authorityBoost;

  // Convert to percentage and cap at 99 (matches hydra-engine.ts)
  let finalConfidence = Math.min(99, Math.round(boostedConfidence * 100));

  // Cap confidence if critically low votes (matches hydra-engine.ts)
  if (criticallyLowVotes) {
    finalConfidence = Math.min(finalConfidence, lowVoteCap);
  }

  // Determine analysis quality (matches hydra-engine.ts thresholds)
  const quality = determineQuality(finalConfidence, criticallyLowVotes);

  // Build metrics object
  const metrics: ConsensusMetrics = {
    avgAIConfidence,
    decisionAgreement,
    valueAgreement,
    participationRate,
    authorityVerified: !!authorityData,
  };

  // Build breakdown for debugging
  const breakdown: ConfidenceBreakdown = {
    aiScoreContribution,
    decisionAgreementContribution,
    valueAgreementContribution,
    participationContribution,
    authorityBoost,
    baseConfidence,
    finalConfidence,
  };

  // Verbose logging (matches hydra-engine.ts console output)
  if (verbose) {
    logConfidenceCalculation(finalConfidence, metrics, targetAICount, authorityData);
  }

  return {
    confidence: finalConfidence,
    quality,
    metrics,
    breakdown,
  };
}

// =============================================================================
// QUALITY DETERMINATION
// =============================================================================

/**
 * Determine analysis quality level based on confidence and vote count
 * Matches hydra-engine.ts quality thresholds
 */
export function determineQuality(
  confidence: number,
  criticallyLowVotes: boolean
): AnalysisQuality {
  // Fallback if critically low votes regardless of confidence
  if (criticallyLowVotes) {
    return 'FALLBACK';
  }

  // Quality based on confidence thresholds (matches hydra-engine.ts)
  if (confidence >= 97) {
    return 'OPTIMAL';
  }

  if (confidence >= 90) {
    return 'DEGRADED';
  }

  return 'FALLBACK';
}

/**
 * Check if confidence meets minimum threshold
 */
export function meetsMinimumConfidence(
  confidence: number,
  threshold: number = CONFIDENCE_THRESHOLDS.minimum
): boolean {
  return confidence >= threshold;
}

/**
 * Check if confidence is optimal (97%+)
 */
export function isOptimalConfidence(
  confidence: number,
  threshold: number = 97
): boolean {
  return confidence >= threshold;
}

// =============================================================================
// CONFIDENCE ADJUSTMENTS
// =============================================================================

/**
 * Apply penalty to confidence for specific conditions
 */
export function applyConfidencePenalty(
  confidence: number,
  reason: 'low_votes' | 'high_variance' | 'single_provider' | 'tiebreaker_used',
  severity: number = 10
): number {
  const penalties: Record<string, number> = {
    low_votes: 25,
    high_variance: 15,
    single_provider: 50,
    tiebreaker_used: 5,
  };
  
  const penalty = penalties[reason] ?? severity;
  return Math.max(0, confidence - penalty);
}

/**
 * Apply bonus to confidence for specific conditions
 */
export function applyConfidenceBonus(
  confidence: number,
  reason: 'authority_verified' | 'high_agreement' | 'many_votes',
  bonus: number = 5
): number {
  const bonuses: Record<string, number> = {
    authority_verified: 5,
    high_agreement: 3,
    many_votes: 2,
  };
  
  const bonusAmount = bonuses[reason] ?? bonus;
  return Math.min(99, confidence + bonusAmount);
}

/**
 * Cap confidence based on vote count
 */
export function capConfidenceByVoteCount(
  confidence: number,
  voteCount: number,
  minVotes: number = 3,
  cap: number = 75
): number {
  if (voteCount < minVotes) {
    return Math.min(confidence, cap);
  }
  return confidence;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create empty confidence result for edge cases
 */
function createEmptyConfidenceResult(): ConfidenceResult {
  return {
    confidence: 0,
    quality: 'FALLBACK',
    metrics: {
      avgAIConfidence: 0,
      decisionAgreement: 0,
      valueAgreement: 0,
      participationRate: 0,
      authorityVerified: false,
    },
    breakdown: {
      aiScoreContribution: 0,
      decisionAgreementContribution: 0,
      valueAgreementContribution: 0,
      participationContribution: 0,
      authorityBoost: 0,
      baseConfidence: 0,
      finalConfidence: 0,
    },
  };
}

/**
 * Log confidence calculation details
 * Matches the console output in hydra-engine.ts
 */
function logConfidenceCalculation(
  finalConfidence: number,
  metrics: ConsensusMetrics,
  targetAICount: number,
  authorityData: AuthorityData | null
): void {
  console.log(`📊 Consensus Metrics:`);
  console.log(`   Average AI Confidence: ${(metrics.avgAIConfidence * 100).toFixed(1)}%`);
  console.log(`   Decision Agreement: ${(metrics.decisionAgreement * 100).toFixed(1)}%`);
  console.log(`   Value Agreement: ${(metrics.valueAgreement * 100).toFixed(1)}%`);
  console.log(`   AI Participation: ${(metrics.participationRate * targetAICount).toFixed(0)}/${targetAICount} (${(metrics.participationRate * 100).toFixed(1)}%)`);
  
  if (authorityData) {
    console.log(`   Authority Verification: ✅ +5% boost`);
  }
  
  console.log(`   Final Confidence: ${finalConfidence}% (Target: 97%+)`);
}

// =============================================================================
// CONFIDENCE ESTIMATION
// =============================================================================

/**
 * Estimate confidence before running analysis
 * Useful for determining if analysis is worth running
 */
export function estimateConfidence(
  availableProviderCount: number,
  hasAuthoritySource: boolean,
  targetAICount: number = 10
): {
  estimatedConfidence: number;
  quality: AnalysisQuality;
  recommendation: string;
} {
  // Assume average performance for estimation
  const assumedAvgConfidence = 0.75;
  const assumedAgreement = 0.80;
  const participationRate = Math.min(1, availableProviderCount / targetAICount);
  
  const baseEstimate = 
    assumedAvgConfidence * 0.35 +
    assumedAgreement * 0.25 +
    assumedAgreement * 0.25 +
    participationRate * 0.15;
  
  let estimatedConfidence = Math.round(baseEstimate * 100);
  
  if (hasAuthoritySource) {
    estimatedConfidence += 5;
  }
  
  const quality = determineQuality(estimatedConfidence, availableProviderCount < 3);
  
  let recommendation: string;
  if (quality === 'OPTIMAL') {
    recommendation = 'Good to proceed with analysis';
  } else if (quality === 'DEGRADED') {
    recommendation = 'Analysis may have reduced accuracy';
  } else {
    recommendation = 'Consider adding more providers or authority sources';
  }
  
  return {
    estimatedConfidence,
    quality,
    recommendation,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  calculateConfidence,
  determineQuality,
  meetsMinimumConfidence,
  isOptimalConfidence,
  applyConfidencePenalty,
  applyConfidenceBonus,
  capConfidenceByVoteCount,
  estimateConfidence,
};