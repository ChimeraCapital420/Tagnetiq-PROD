// FILE: src/lib/hydra/consensus/voting.ts
// Vote Collection and Tallying Logic for HYDRA Consensus Engine
// Extracted from hydra-engine.ts
// FIXED: Added calculateConsensus() — was missing, crashed reason.ts Stage 3

import type { ModelVote, ParsedAnalysis, AIProvider } from '../types.js';
import { AI_MODEL_WEIGHTS } from '../config/constants.js';

// =============================================================================
// TYPES
// =============================================================================

export interface VoteTally {
  /** Total weight of BUY votes */
  buyWeight: number;
  /** Total weight of SELL votes */
  sellWeight: number;
  /** Total weight of all votes */
  totalWeight: number;
  /** Weighted difference as percentage (0-1) */
  weightDifference: number;
  /** Winning decision */
  decision: 'BUY' | 'SELL';
  /** Whether the vote is close (within threshold) */
  isCloseVote: boolean;
  /** Vote counts */
  counts: {
    buy: number;
    sell: number;
    total: number;
  };
}

export interface VoteStats {
  /** Average confidence across all votes */
  avgConfidence: number;
  /** Average response time in ms */
  avgResponseTime: number;
  /** Weighted average value */
  weightedValue: number;
  /** Value agreement score (0-1) */
  valueAgreement: number;
  /** Decision agreement score (0-1) */
  decisionAgreement: number;
  /** Most common item name */
  consensusItemName: string;
}

export interface VoteCollection {
  /** All collected votes */
  votes: ModelVote[];
  /** Votes by stage */
  byStage: {
    primaryVision: ModelVote[];
    textAnalysis: ModelVote[];
    marketSearch: ModelVote[];
    tiebreaker: ModelVote[];
  };
  /** Vote tally */
  tally: VoteTally;
  /** Vote statistics */
  stats: VoteStats;
}

export interface ConsensusResult {
  itemName: string;
  estimatedValue: number;
  decision: 'BUY' | 'SELL';
  confidence: number;
  reasoning: string;
  analysisQuality: string;
  tally: VoteTally;
  stats: VoteStats;
}

// =============================================================================
// WEIGHT CALCULATION
// =============================================================================

/**
 * Calculate dynamic weight for a vote based on provider and confidence
 * Mirrors the logic in hydra-engine.ts calculateWeight()
 */
export function calculateVoteWeight(
  provider: AIProvider | { name: string; baseWeight?: number; specialty?: string },
  confidence: number,
  options?: {
    isTiebreaker?: boolean;
    isMarketSearch?: boolean;
  }
): number {
  // Get base weight from provider or defaults
  const baseWeight = provider.baseWeight ??
    AI_MODEL_WEIGHTS[provider.name.toLowerCase()] ??
    0.75;

  // Calculate weight based on confidence (matches hydra-engine.ts)
  let weight = baseWeight * confidence;

  // Apply specialty bonuses (30% bonus for real-time pricing)
  if (provider.specialty === 'pricing' || provider.name === 'Perplexity') {
    weight *= 1.3;
  }

  // Apply market search boost (20% boost for real-time data)
  if (options?.isMarketSearch) {
    weight *= 1.2;
  }

  // Apply tiebreaker reduction (60% of normal weight)
  if (options?.isTiebreaker) {
    weight *= 0.6;
  }

  return weight;
}

/**
 * Create a ModelVote from provider response
 * Matches the vote creation logic in hydra-engine.ts
 */
export function createVote(
  provider: AIProvider | { id: string; name: string; baseWeight?: number; specialty?: string },
  analysis: ParsedAnalysis,
  confidence: number,
  responseTime: number,
  options?: {
    isTiebreaker?: boolean;
    isMarketSearch?: boolean;
    isEmergency?: boolean;
    fallbackItemName?: string;
  }
): ModelVote {
  // Safely parse estimatedValue with null checking (matches hydra-engine.ts)
  const safeEstimatedValue = analysis.estimatedValue != null
    ? parseFloat(analysis.estimatedValue.toString())
    : 0;

  // Build provider name with suffix
  let providerName = provider.name;
  if (options?.isTiebreaker) providerName += ' (TIEBREAKER)';
  if (options?.isEmergency) providerName += ' (EMERGENCY)';

  // Adjust confidence for special cases
  let adjustedConfidence = confidence;
  if (options?.isTiebreaker) adjustedConfidence *= 0.8;
  if (options?.isEmergency) adjustedConfidence *= 0.5;

  return {
    providerId: provider.id,
    providerName,
    itemName: analysis.itemName || options?.fallbackItemName || 'Unknown Item',
    estimatedValue: isNaN(safeEstimatedValue) ? 0 : safeEstimatedValue,
    decision: analysis.decision || 'SELL',
    confidence: adjustedConfidence,
    responseTime,
    weight: calculateVoteWeight(provider, confidence, options),
    rawResponse: analysis,
    success: true,
  };
}

// =============================================================================
// VOTE TALLYING
// =============================================================================

/**
 * Tally votes by decision
 * Matches the tally logic in hydra-engine.ts
 *
 * @param votes - Array of model votes
 * @param closeVoteThreshold - Threshold for considering a vote "close" (default 15%)
 */
export function tallyVotes(
  votes: ModelVote[],
  closeVoteThreshold: number = 0.15
): VoteTally {
  if (votes.length === 0) {
    return {
      buyWeight: 0,
      sellWeight: 0,
      totalWeight: 0,
      weightDifference: 0,
      decision: 'SELL',
      isCloseVote: false,
      counts: { buy: 0, sell: 0, total: 0 },
    };
  }

  const buyVotes = votes.filter(v => v.decision === 'BUY');
  const sellVotes = votes.filter(v => v.decision === 'SELL');

  const buyWeight = buyVotes.reduce((sum, v) => sum + v.weight, 0);
  const sellWeight = sellVotes.reduce((sum, v) => sum + v.weight, 0);
  const totalWeight = buyWeight + sellWeight;

  const weightDifference = totalWeight > 0
    ? Math.abs(buyWeight - sellWeight) / totalWeight
    : 0;

  return {
    buyWeight,
    sellWeight,
    totalWeight,
    weightDifference,
    decision: buyWeight > sellWeight ? 'BUY' : 'SELL',
    isCloseVote: weightDifference < closeVoteThreshold,
    counts: {
      buy: buyVotes.length,
      sell: sellVotes.length,
      total: votes.length,
    },
  };
}

/**
 * Calculate vote statistics
 * Extracted from hydra-engine.ts calculateConsensus()
 */
export function calculateVoteStats(votes: ModelVote[]): VoteStats {
  if (votes.length === 0) {
    return {
      avgConfidence: 0,
      avgResponseTime: 0,
      weightedValue: 0,
      valueAgreement: 0,
      decisionAgreement: 0,
      consensusItemName: 'Unknown Item',
    };
  }

  // Average confidence
  const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;

  // Average response time
  const avgResponseTime = votes.reduce((sum, v) => sum + v.responseTime, 0) / votes.length;

  // Weighted average value
  const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
  const weightedValue = totalWeight > 0
    ? votes.reduce((sum, v) => sum + (v.estimatedValue * v.weight), 0) / totalWeight
    : 0;

  // Value agreement (coefficient of variation) - matches hydra-engine.ts
  const values = votes.map(v => v.estimatedValue).filter(v => v > 0);
  let valueAgreement = 1;
  if (values.length > 1) {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
    valueAgreement = Math.max(0, 1 - coefficientOfVariation);
  }

  // Decision agreement
  const tally = tallyVotes(votes);
  const decisionAgreement = tally.totalWeight > 0
    ? Math.max(tally.buyWeight, tally.sellWeight) / tally.totalWeight
    : 0;

  // Most common item name (weighted by confidence) - matches hydra-engine.ts
  const nameVotes = votes.reduce((acc, v) => {
    const name = v.itemName || 'Unknown Item';
    acc[name] = (acc[name] || 0) + (v.weight * v.confidence);
    return acc;
  }, {} as Record<string, number>);

  const sortedNames = Object.entries(nameVotes).sort((a, b) => b[1] - a[1]);
  const consensusItemName = sortedNames.length > 0 ? sortedNames[0][0] : 'Unknown Item';

  return {
    avgConfidence,
    avgResponseTime,
    weightedValue,
    valueAgreement,
    decisionAgreement,
    consensusItemName,
  };
}

// =============================================================================
// CONSENSUS CALCULATION
// =============================================================================

/**
 * Calculate full consensus from votes with optional authority data anchoring
 * This is the function that reason.ts and other stages call to produce
 * the final consensus object from a set of model votes.
 *
 * If authorityData is provided (e.g., Numista price for coins, Brickset for LEGO),
 * the estimated value is anchored toward the authority price to reduce hallucination.
 */
export function calculateConsensus(
  votes: ModelVote[],
  authorityData?: {
    source: string;
    itemDetails?: any;
    price?: number;
  } | null
): ConsensusResult {
  if (votes.length === 0) {
    return {
      itemName: 'Unknown Item',
      estimatedValue: 0,
      decision: 'SELL',
      confidence: 0,
      reasoning: 'No votes received',
      analysisQuality: 'FAILED',
      tally: tallyVotes([]),
      stats: calculateVoteStats([]),
    };
  }

  const tally = tallyVotes(votes);
  const stats = calculateVoteStats(votes);

  let estimatedValue = stats.weightedValue;

  // Authority anchoring — if we have a known market price, blend toward it
  // This prevents AI hallucination on well-catalogued items
  if (authorityData?.price && authorityData.price > 0) {
    const authorityPrice = authorityData.price;
    // Weight authority at 40%, AI consensus at 60%
    // This keeps AI influence but prevents wild outliers
    estimatedValue = (authorityPrice * 0.4) + (stats.weightedValue * 0.6);

    // If AI consensus is wildly off (>3x or <0.3x authority), pull harder toward authority
    const ratio = stats.weightedValue / authorityPrice;
    if (ratio > 3 || ratio < 0.33) {
      estimatedValue = (authorityPrice * 0.6) + (stats.weightedValue * 0.4);
    }
  } else if (authorityData?.itemDetails) {
    // We have authority identification but no price — just use for context
    // No value anchoring, but boost confidence if item was positively identified
  }

  // Determine confidence as percentage (0-100)
  const rawConfidence = stats.avgConfidence * 100;
  let confidence = Math.round(rawConfidence);

  // Boost confidence if votes agree on value
  if (stats.valueAgreement > 0.8) {
    confidence = Math.min(100, confidence + 5);
  }

  // Reduce confidence if vote is close
  if (tally.isCloseVote) {
    confidence = Math.max(10, confidence - 10);
  }

  // Reduce confidence if few votes
  if (votes.length < 2) {
    confidence = Math.max(10, confidence - 15);
  }

  // Clamp
  confidence = Math.max(0, Math.min(100, confidence));

  // Determine analysis quality tier
  let analysisQuality: string;
  if (confidence >= 80 && stats.valueAgreement > 0.7 && votes.length >= 3) {
    analysisQuality = 'HIGH';
  } else if (confidence >= 60 && votes.length >= 2) {
    analysisQuality = 'GOOD';
  } else if (confidence >= 40) {
    analysisQuality = 'MODERATE';
  } else if (votes.length >= 1) {
    analysisQuality = 'LOW';
  } else {
    analysisQuality = 'DEGRADED';
  }

  // Build reasoning summary from best vote
  const bestVote = votes.reduce((a, b) => a.weight > b.weight ? a : b);
  const reasoning = bestVote.rawResponse?.summary_reasoning
    || bestVote.rawResponse?.reasoning
    || `${votes.length} AI models analyzed this item. Weighted consensus: ${tally.decision} at $${estimatedValue.toFixed(2)}.`;

  return {
    itemName: stats.consensusItemName,
    estimatedValue: Math.round(estimatedValue * 100) / 100, // Round to cents
    decision: tally.decision,
    confidence,
    reasoning: typeof reasoning === 'string' ? reasoning : String(reasoning),
    analysisQuality,
    tally,
    stats,
  };
}

// =============================================================================
// VOTE COLLECTION
// =============================================================================

/**
 * Collect and organize votes by stage
 */
export function collectVotes(
  primaryVision: ModelVote[],
  textAnalysis: ModelVote[],
  marketSearch: ModelVote[],
  tiebreaker: ModelVote[]
): VoteCollection {
  const allVotes = [...primaryVision, ...textAnalysis, ...marketSearch, ...tiebreaker];

  return {
    votes: allVotes,
    byStage: {
      primaryVision,
      textAnalysis,
      marketSearch,
      tiebreaker,
    },
    tally: tallyVotes(allVotes),
    stats: calculateVoteStats(allVotes),
  };
}

/**
 * Filter votes by provider type
 */
e