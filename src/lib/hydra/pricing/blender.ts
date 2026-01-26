// FILE: src/lib/hydra/pricing/blender.ts
// Price Blending Logic for HYDRA
// Combines AI estimates with authority/market data for final valuation

import type { AuthorityData, ModelVote } from '../types.js';
import { MARKET_SOURCE_WEIGHTS } from '../config/constants.js';

// =============================================================================
// TYPES
// =============================================================================

export interface PriceSource {
  /** Source name (e.g., 'ai_consensus', 'ebay', 'numista') */
  source: string;
  /** Price value */
  value: number;
  /** Confidence in this price (0-1) */
  confidence: number;
  /** Weight for blending */
  weight: number;
  /** Condition this price applies to */
  condition?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface BlendedPrice {
  /** Final blended price */
  finalPrice: number;
  /** Method used for blending */
  method: string;
  /** Confidence in the blended price (0-100) */
  confidence: number;
  /** Price range */
  range: {
    low: number;
    high: number;
  };
  /** Breakdown of contributing sources */
  sources: PriceSource[];
  /** Whether authority data was used */
  authorityVerified: boolean;
}

export interface BlendOptions {
  /** Prefer authority sources over AI (default: true) */
  preferAuthority?: boolean;
  /** Maximum weight for any single source (default: 0.6) */
  maxSourceWeight?: number;
  /** Minimum sources required for high confidence (default: 2) */
  minSourcesForHighConfidence?: number;
  /** Item condition for price adjustment */
  condition?: string;
}

// =============================================================================
// MAIN BLENDING FUNCTIONS
// =============================================================================

/**
 * Blend prices from multiple sources into a final estimate
 *
 * Priority:
 * 1. Authority sources (Numista, PSA, Brickset, etc.) - highest trust
 * 2. Market sources (eBay sold listings) - real market data
 * 3. AI consensus - synthesized estimate from multiple models
 * 
 * IMPORTANT: Authority sources (Numista, PSA, Brickset) are TRUSTED databases.
 * They should NOT be filtered out based on AI estimates, which are often wrong.
 */
export function blendPrices(
  aiConsensusValue: number,
  authorityData: AuthorityData | null,
  marketData: { source: string; prices: number[] }[] | null,
  options: BlendOptions = {}
): BlendedPrice {
  const {
    preferAuthority = true,
    maxSourceWeight = 0.7, // Increased from 0.6 to allow authority more weight
    minSourcesForHighConfidence = 2,
    condition = 'good',
  } = options;

  const sources: PriceSource[] = [];
  let totalWeight = 0;
  let weightedSum = 0;

  // Track if we have authority data for weighting decisions
  let hasValidAuthority = false;
  let authorityValue = 0;

  // 1. Check authority data FIRST (highest priority)
  if (authorityData?.marketValue && preferAuthority) {
    authorityValue = getAuthorityPriceForCondition(authorityData, condition);

    if (authorityValue > 0) {
      hasValidAuthority = true;
      
      // Authority sources are TRUSTED - give them high weight
      // When authority exists, it should dominate the blend
      const authorityWeight = Math.min(
        MARKET_SOURCE_WEIGHTS.authority || 0.6,
        maxSourceWeight
      );

      const authoritySource: PriceSource = {
        source: authorityData.source || 'authority',
        value: authorityValue,
        confidence: 0.95, // High confidence in authority data
        weight: authorityWeight,
        condition,
        metadata: { catalogNumber: authorityData.catalogNumber },
      };
      sources.push(authoritySource);
      totalWeight += authoritySource.weight;
      weightedSum += authoritySource.value * authoritySource.weight;
      
      console.log(`  💰 Authority price (${authorityData.source}): $${authorityValue.toFixed(2)} [weight: ${authorityWeight}]`);
    }
  }

  // 2. Add AI consensus (reduced weight when authority exists)
  if (aiConsensusValue > 0) {
    // When authority data exists, reduce AI weight significantly
    // AI often underestimates collectible values
    const aiBaseWeight = MARKET_SOURCE_WEIGHTS.ai_consensus || 0.4;
    const aiWeight = hasValidAuthority ? aiBaseWeight * 0.5 : aiBaseWeight; // Half weight if authority exists

    const aiSource: PriceSource = {
      source: 'ai_consensus',
      value: aiConsensusValue,
      confidence: hasValidAuthority ? 0.5 : 0.7, // Lower confidence when authority disagrees
      weight: aiWeight,
    };
    sources.push(aiSource);
    totalWeight += aiSource.weight;
    weightedSum += aiSource.value * aiSource.weight;
    
    console.log(`  🤖 AI consensus: $${aiConsensusValue.toFixed(2)} [weight: ${aiWeight.toFixed(2)}]`);
  }

  // 3. Add market data (eBay, etc.)
  if (marketData && marketData.length > 0) {
    for (const market of marketData) {
      if (market.prices && market.prices.length > 0) {
        const medianPrice = calculateMedian(market.prices);
        
        // Market data weight - reduced if authority exists
        const baseMarketWeight = MARKET_SOURCE_WEIGHTS[market.source] || 0.3;
        const marketWeight = hasValidAuthority 
          ? Math.min(baseMarketWeight * 0.7, maxSourceWeight)
          : Math.min(baseMarketWeight, maxSourceWeight);

        const marketSource: PriceSource = {
          source: market.source,
          value: medianPrice,
          confidence: 0.8,
          weight: marketWeight,
          metadata: {
            sampleSize: market.prices.length,
            priceRange: {
              low: Math.min(...market.prices),
              high: Math.max(...market.prices),
            },
          },
        };
        sources.push(marketSource);
        totalWeight += marketSource.weight;
        weightedSum += marketSource.value * marketSource.weight;
        
        console.log(`  📊 Market (${market.source}): $${medianPrice.toFixed(2)} [weight: ${marketWeight.toFixed(2)}]`);
      }
    }
  }

  // Calculate final blended price
  let finalPrice = totalWeight > 0
    ? parseFloat((weightedSum / totalWeight).toFixed(2))
    : aiConsensusValue;

  // If authority exists and final price is dramatically different, lean toward authority
  if (hasValidAuthority && authorityValue > 0) {
    const authorityRatio = finalPrice / authorityValue;
    
    // If blended price is less than 50% of authority, adjust upward
    if (authorityRatio < 0.5) {
      // Blend more aggressively toward authority (70% authority, 30% current blend)
      finalPrice = parseFloat((authorityValue * 0.7 + finalPrice * 0.3).toFixed(2));
      console.log(`  ⚠️ Adjusted final price toward authority: $${finalPrice.toFixed(2)}`);
    }
  }

  // Calculate price range
  const allValues = sources.map(s => s.value).filter(v => v > 0);
  const range = allValues.length > 0
    ? { low: Math.min(...allValues), high: Math.max(...allValues) }
    : { low: finalPrice * 0.8, high: finalPrice * 1.2 };

  // Determine blending method
  const method = determineBlendMethod(sources);

  // Calculate confidence
  const confidence = calculateBlendConfidence(sources, minSourcesForHighConfidence);

  console.log(`  ✅ Final blended price: $${finalPrice.toFixed(2)} (${method})`);

  return {
    finalPrice,
    method,
    confidence,
    range,
    sources,
    authorityVerified: hasValidAuthority,
  };
}

/**
 * Simple blend using only AI and authority
 * Used when market data isn't available
 */
export function blendAIWithAuthority(
  aiValue: number,
  authorityValue: number,
  aiWeight: number = 0.3, // Reduced from 0.6 - authority should dominate
  authorityWeight: number = 0.7 // Increased from 0.4
): number {
  if (authorityValue <= 0) return aiValue;
  if (aiValue <= 0) return authorityValue;

  return parseFloat(
    ((aiValue * aiWeight) + (authorityValue * authorityWeight)).toFixed(2)
  );
}

/**
 * Blend prices from model votes
 */
export function blendFromVotes(
  votes: ModelVote[],
  authorityData?: AuthorityData | null
): BlendedPrice {
  if (votes.length === 0) {
    return {
      finalPrice: 0,
      method: 'no_data',
      confidence: 0,
      range: { low: 0, high: 0 },
      sources: [],
      authorityVerified: false,
    };
  }

  // Calculate weighted average from votes
  const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
  const weightedValue = votes.reduce((sum, v) => sum + (v.estimatedValue * v.weight), 0) / totalWeight;

  return blendPrices(weightedValue, authorityData || null, null);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get authority price for specific condition
 */
function getAuthorityPriceForCondition(
  authorityData: AuthorityData,
  condition: string
): number {
  const mv = authorityData.marketValue;
  if (!mv) return 0;

  const conditionMap: Record<string, keyof typeof mv> = {
    'mint': 'mint',
    'near_mint': 'nearMint',
    'excellent': 'excellent',
    'good': 'good',
    'fair': 'fair',
    'poor': 'poor',
    'average': 'average',
  };

  const key = conditionMap[condition.toLowerCase()] || 'good';
  const value = mv[key] || mv.average || mv.good || 0;
  
  // If still no value, try to get any available price
  if (!value) {
    const availableValues = Object.values(mv).filter(v => typeof v === 'number' && v > 0);
    if (availableValues.length > 0) {
      return availableValues[0] as number;
    }
  }
  
  return value;
}

/**
 * Calculate median of an array
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Determine blending method description
 */
function determineBlendMethod(sources: PriceSource[]): string {
  if (sources.length === 0) return 'no_data';
  if (sources.length === 1) return `single_source_${sources[0].source}`;

  const hasAuthority = sources.some(s =>
    s.source !== 'ai_consensus' && s.source !== 'ebay'
  );
  const hasMarket = sources.some(s => s.source === 'ebay');
  const hasAI = sources.some(s => s.source === 'ai_consensus');

  if (hasAuthority && hasMarket && hasAI) return 'full_blend';
  if (hasAuthority && hasAI) return 'ai_authority_blend';
  if (hasMarket && hasAI) return 'ai_market_blend';

  return `weighted_${sources.length}_sources`;
}

/**
 * Calculate confidence in blended price
 */
function calculateBlendConfidence(
  sources: PriceSource[],
  minSourcesForHigh: number
): number {
  if (sources.length === 0) return 0;

  // Base confidence from source count
  let confidence = sources.length >= minSourcesForHigh ? 80 : 60;

  // Bonus for authority verification (+15% for trusted sources)
  if (sources.some(s => s.source !== 'ai_consensus' && s.source !== 'ebay')) {
    confidence += 15;
  }

  // Check value agreement
  const values = sources.map(s => s.value).filter(v => v > 0);
  if (values.length > 1) {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;

    // High agreement bonus
    if (cv < 0.2) confidence += 5;
    // Low agreement penalty (but less severe when authority exists)
    if (cv > 0.5) {
      const hasAuthority = sources.some(s => s.source !== 'ai_consensus' && s.source !== 'ebay');
      confidence -= hasAuthority ? 5 : 10; // Less penalty when authority exists
    }
  }

  return Math.min(99, Math.max(0, confidence));
}

// =============================================================================
// CONDITION ADJUSTMENTS
// =============================================================================

/**
 * Adjust price based on condition
 */
export function adjustPriceForCondition(
  basePrice: number,
  fromCondition: string,
  toCondition: string
): number {
  const conditionMultipliers: Record<string, number> = {
    'mint': 1.5,
    'near_mint': 1.3,
    'excellent': 1.15,
    'good': 1.0,
    'fair': 0.7,
    'poor': 0.4,
  };

  const fromMult = conditionMultipliers[fromCondition.toLowerCase()] || 1.0;
  const toMult = conditionMultipliers[toCondition.toLowerCase()] || 1.0;

  return parseFloat((basePrice * (toMult / fromMult)).toFixed(2));
}

/**
 * Get condition multiplier
 */
export function getConditionMultiplier(condition: string): number {
  const multipliers: Record<string, number> = {
    'mint': 1.5,
    'near_mint': 1.3,
    'excellent': 1.15,
    'good': 1.0,
    'fair': 0.7,
    'poor': 0.4,
  };

  return multipliers[condition.toLowerCase()] || 1.0;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  blendPrices,
  blendAIWithAuthority,
  blendFromVotes,
  adjustPriceForCondition,
  getConditionMultiplier,
};