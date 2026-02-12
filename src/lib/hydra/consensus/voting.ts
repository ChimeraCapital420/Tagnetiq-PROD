// FILE: src/lib/hydra/consensus/voting.ts
// Vote Collection and Tallying Logic for HYDRA Consensus Engine
// Extracted from hydra-engine.ts
// FIXED: Added calculateConsensus() for reason.ts Stage 3
// FIXED: All exports present for engine.ts imports

import type { ModelVote, ParsedAnalysis, AIProvider } from '../types.js';
import { AI_MODEL_WEIGHTS } from '../config/constants.js';

// =============================================================================
// TYPES
// =============================================================================

export interface VoteTally {
  buyWeight: number;
  sellWeight: number;
  totalWeight: number;
  weightDifference: number;
  decision: 'BUY' | 'SELL';
  isCloseVote: boolean;
  counts: {
    buy: number;
    sell: number;
    total: number;
  };
}

export interface VoteStats {
  avgConfidence: number;
  avgResponseTime: number;
  weightedValue: number;
  valueAgreement: number;
  decisionAgreement: number;
  consensusItemName: string;
}

export interface VoteCollection {
  votes: ModelVote[];
  byStage: {
    primaryVision: ModelVote[];
    textAnalysis: ModelVote[];
    marketSearch: ModelVote[];
    tiebreaker: ModelVote[];
  };
  tally: VoteTally;
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

export function calculateVoteWeight(
  provider: AIProvider | { name: string; baseWeight?: number; specialty?: string },
  confidence: number,
  options?: {
    isTiebreaker?: boolean;
    isMarketSearch?: boolean;
  }
): number {
  const baseWeight = provider.baseWeight ??
    AI_MODEL_WEIGHTS[provider.name.toLowerCase()] ??
    0.75;

  let weight = baseWeight * confidence;

  if (provider.specialty === 'pricing' || provider.name === 'Perplexity') {
    weight *= 1.3;
  }

  if (options?.isMarketSearch) {
    weight *= 1.2;
  }

  if (options?.isTiebreaker) {
    weight *= 0.6;
  }

  return weight;
}

// =============================================================================
// VOTE CREATION
// =============================================================================

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
  const safeEstimatedValue = analysis.estimatedValue != null
    ? parseFloat(analysis.estimatedValue.toString())
    : 0;

  let providerName = provider.name;
  if (options?.isTiebreaker) providerName += ' (TIEBREAKER)';
  if (options?.isEmergency) providerName += ' (EMERGENCY)';

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

// =============================================================================
// VOTE STATISTICS
// =============================================================================

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

  const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
  const avgResponseTime = votes.reduce((sum, v) => sum + v.responseTime, 0) / votes.length;

  const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
  const weightedValue = totalWeight > 0
    ? votes.reduce((sum, v) => sum + (v.estimatedValue * v.weight), 0) / totalWeight
    : 0;

  const values = votes.map(v => v.estimatedValue).filter(v => v > 0);
  let valueAgreement = 1;
  if (values.length > 1) {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
    valueAgreement = Math.max(0, 1 - coefficientOfVariation);
  }

  const tally = tallyVotes(votes);
  const decisionAgreement = tally.totalWeight > 0
    ? Math.max(tally.buyWeight, tally.sellWeight) / tally.totalWeight
    : 0;

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
// CONSENSUS CALCULATION (used by reason.ts)
// =============================================================================

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

  if (authorityData?.price && authorityData.price > 0) {
    const authorityPrice = authorityData.price;
    estimatedValue = (authorityPrice * 0.4) + (stats.weightedValue * 0.6);

    const ratio = stats.weightedValue / authorityPrice;
    if (ratio > 3 || ratio < 0.33) {
      estimatedValue = (authorityPrice * 0.6) + (stats.weightedValue * 0.4);
    }
  }

  const rawConfidence = stats.avgConfidence * 100;
  let confidence = Math.round(rawConfidence);

  if (stats.valueAgreement > 0.8) confidence = Math.min(100, confidence + 5);
  if (tally.isCloseVote) confidence = Math.max(10, confidence - 10);
  if (votes.length < 2) confidence = Math.max(10, confidence - 15);
  confidence = Math.max(0, Math.min(100, confidence));

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

  const bestVote = votes.reduce((a, b) => a.weight > b.weight ? a : b);
  const reasoning = bestVote.rawResponse?.summary_reasoning
    || bestVote.rawResponse?.reasoning
    || `${votes.length} AI models analyzed this item. Weighted consensus: ${tally.decision} at $${estimatedValue.toFixed(2)}.`;

  return {
    itemName: stats.consensusItemName,
    estimatedValue: Math.round(estimatedValue * 100) / 100,
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

// =============================================================================
// VOTE FILTERING & EXTRACTION (used by engine.ts)
// =============================================================================

export function filterVotesByProvider(
  votes: ModelVote[],
  providerNames: string[]
): ModelVote[] {
  const normalizedNames = providerNames.map(n => n.toLowerCase());
  return votes.filter(v =>
    normalizedNames.includes(v.providerName.toLowerCase().replace(' (tiebreaker)', '').replace(' (emergency)', ''))
  );
}

export function getBestVote(votes: ModelVote[]): ModelVote | null {
  if (votes.length === 0) return null;
  return votes.reduce((best, vote) => vote.weight > best.weight ? vote : best, votes[0]);
}

/**
 * Get item description from best vote for context sharing
 * Used by engine.ts calculateStagedConsensus() to enhance prompts for text-only providers
 */
export function extractItemContext(votes: ModelVote[]): {
  itemName: string;
  description: string;
} {
  const bestVote = getBestVote(votes);

  if (!bestVote) {
    return { itemName: '', description: '' };
  }

  const itemName = bestVote.itemName || 'Unknown Item';
  const reasoning = bestVote.rawResponse?.summary_reasoning || '';
  const description = reasoning ? `${itemName}: ${reasoning}` : itemName;

  return { itemName, description };
}

/**
 * Create enhanced prompt for text-only providers
 */
export function createEnhancedPrompt(
  basePrompt: string,
  itemContext: { itemName: string; description: string }
): string {
  if (!itemContext.description) {
    return basePrompt;
  }

  return `${basePrompt}

Based on expert visual analysis by multiple AI systems, this item has been identified as: "${itemContext.description}"

Please provide your valuation analysis for this ${itemContext.itemName}.`;
}

/**
 * Create market search prompt for Perplexity
 */
export function createMarketSearchPrompt(
  basePrompt: string,
  itemName: string
): string {
  return `${basePrompt}

IMPORTANT: Search for recent eBay sold listings, Amazon prices, and current market values for: "${itemName}". Include specific sold prices from the last 30 days with dates and conditions.`;
}

// =============================================================================
// VOTE LOGGING
// =============================================================================

export function logVoteSummary(collection: VoteCollection): void {
  const { byStage, tally, stats } = collection;

  console.log(`🎯 Vote Collection Summary:`);
  console.log(`   └── Primary vision: ${byStage.primaryVision.length}`);
  console.log(`   └── Text analysis: ${byStage.textAnalysis.length}`);
  console.log(`   └── Market search: ${byStage.marketSearch.length}`);
  console.log(`   └── Tiebreaker: ${byStage.tiebreaker.length}`);
  console.log(`   └── Total: ${collection.votes.length}`);
  console.log(`🗳️ Vote Tally:`);
  console.log(`   └── BUY: ${tally.counts.buy} (weight: ${tally.buyWeight.toFixed(2)})`);
  console.log(`   └── SELL: ${tally.counts.sell} (weight: ${tally.sellWeight.toFixed(2)})`);
  console.log(`   └── Decision: ${tally.decision} (diff: ${(tally.weightDifference * 100).toFixed(1)}%)`);
  console.log(`📊 Vote Stats:`);
  console.log(`   └── Avg Confidence: ${(stats.avgConfidence * 100).toFixed(1)}%`);
  console.log(`   └── Value Agreement: ${(stats.valueAgreement * 100).toFixed(1)}%`);
  console.log(`   └── Weighted Value: $${stats.weightedValue.toFixed(2)}`);
}

export function logVoteDetails(stageName: string, vote: ModelVote): void {
  console.log(`🎯 ${stageName} ${vote.providerName} identified: "${vote.itemName}" (confidence: ${vote.confidence.toFixed(2)})`);
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  calculateVoteWeight,
  createVote,
  tallyVotes,
  calculateVoteStats,
  calculateConsensus,
  collectVotes,
  filterVotesByProvider,
  getBestVote,
  extractItemContext,
  createEnhancedPrompt,
  createMarketSearchPrompt,
  logVoteSummary,
  logVoteDetails,
};