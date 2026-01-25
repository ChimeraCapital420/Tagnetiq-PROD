// FILE: src/lib/hydra/pricing/formatter.ts
// Price and Response Formatting for HYDRA
// Formats final output for API responses

import type { 
  ConsensusResult, 
  AuthorityData, 
  ModelVote,
  ParsedAnalysis,
} from '../types.js';
import type { BlendedPrice } from './blender.js';

// =============================================================================
// TYPES
// =============================================================================

export interface FormattedAnalysisResponse {
  /** Analysis ID */
  analysisId: string;
  /** Item identification */
  itemName: string;
  /** Category detected */
  category: string;
  /** BUY or SELL recommendation */
  decision: 'BUY' | 'SELL';
  /** Final estimated value */
  estimatedValue: number;
  /** Formatted price string */
  formattedPrice: string;
  /** Price range */
  priceRange: {
    low: number;
    high: number;
    formattedLow: string;
    formattedHigh: string;
  };
  /** Confidence score (0-100) */
  confidence: number;
  /** Analysis quality level */
  analysisQuality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
  /** Summary reasoning */
  summaryReasoning: string;
  /** Authority data if available */
  authorityData?: FormattedAuthorityData;
  /** Consensus metrics */
  metrics: {
    totalVotes: number;
    avgAIConfidence: number;
    decisionAgreement: number;
    valueAgreement: number;
  };
  /** Timestamp */
  timestamp: string;
  /** Processing time in ms */
  processingTime?: number;
}

export interface FormattedAuthorityData {
  source: string;
  catalogNumber?: string;
  title?: string;
  marketValue?: {
    low: string;
    mid: string;
    high: string;
  };
  verified: boolean;
}

export interface PriceDisplay {
  value: number;
  formatted: string;
  currency: string;
  range?: {
    low: string;
    high: string;
  };
}

// =============================================================================
// PRICE FORMATTING
// =============================================================================

/**
 * Format a price value for display
 */
export function formatPrice(
  value: number,
  currency: string = 'USD',
  options?: Intl.NumberFormatOptions
): string {
  if (value === 0 || isNaN(value)) return '$0.00';
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
  
  return formatter.format(value);
}

/**
 * Format price with appropriate precision
 * - Under $1: show cents ($0.50)
 * - $1-$100: show 2 decimals ($45.00)
 * - $100-$1000: show no decimals ($450)
 * - Over $1000: show with commas ($1,500)
 */
export function formatPriceSmart(value: number, currency: string = 'USD'): string {
  if (value === 0 || isNaN(value)) return '$0';
  
  if (value < 1) {
    return formatPrice(value, currency, { minimumFractionDigits: 2 });
  }
  
  if (value < 100) {
    return formatPrice(value, currency, { minimumFractionDigits: 2 });
  }
  
  if (value < 1000) {
    return formatPrice(value, currency, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
  }
  
  return formatPrice(value, currency, { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  });
}

/**
 * Format a price range
 */
export function formatPriceRange(
  low: number,
  high: number,
  currency: string = 'USD'
): string {
  return `${formatPriceSmart(low, currency)} - ${formatPriceSmart(high, currency)}`;
}

/**
 * Create price display object
 */
export function createPriceDisplay(
  value: number,
  range?: { low: number; high: number },
  currency: string = 'USD'
): PriceDisplay {
  return {
    value,
    formatted: formatPriceSmart(value, currency),
    currency,
    range: range ? {
      low: formatPriceSmart(range.low, currency),
      high: formatPriceSmart(range.high, currency),
    } : undefined,
  };
}

// =============================================================================
// RESPONSE FORMATTING
// =============================================================================

/**
 * Format full analysis response
 */
export function formatAnalysisResponse(
  analysisId: string,
  consensus: ConsensusResult,
  category: string,
  blendedPrice: BlendedPrice | null,
  authorityData: AuthorityData | null,
  processingTime?: number
): FormattedAnalysisResponse {
  const estimatedValue = blendedPrice?.finalPrice ?? consensus.estimatedValue;
  const priceRange = blendedPrice?.range ?? {
    low: estimatedValue * 0.8,
    high: estimatedValue * 1.2,
  };

  return {
    analysisId,
    itemName: consensus.itemName,
    category,
    decision: consensus.decision,
    estimatedValue,
    formattedPrice: formatPriceSmart(estimatedValue),
    priceRange: {
      low: priceRange.low,
      high: priceRange.high,
      formattedLow: formatPriceSmart(priceRange.low),
      formattedHigh: formatPriceSmart(priceRange.high),
    },
    confidence: consensus.confidence,
    analysisQuality: consensus.analysisQuality,
    summaryReasoning: generateSummaryReasoning(consensus, blendedPrice),
    authorityData: authorityData ? formatAuthorityData(authorityData) : undefined,
    metrics: {
      totalVotes: consensus.totalVotes,
      avgAIConfidence: Math.round(consensus.consensusMetrics.avgAIConfidence * 100),
      decisionAgreement: Math.round(consensus.consensusMetrics.decisionAgreement * 100),
      valueAgreement: Math.round(consensus.consensusMetrics.valueAgreement * 100),
    },
    timestamp: new Date().toISOString(),
    processingTime,
  };
}

/**
 * Format authority data for response
 */
export function formatAuthorityData(authority: AuthorityData): FormattedAuthorityData {
  const formatted: FormattedAuthorityData = {
    source: authority.source,
    verified: true,
  };
  
  if (authority.catalogNumber) {
    formatted.catalogNumber = authority.catalogNumber;
  }
  
  if (authority.title) {
    formatted.title = authority.title;
  }
  
  if (authority.marketValue) {
    const mv = authority.marketValue;
    formatted.marketValue = {
      low: formatPriceSmart(mv.fair || mv.poor || 0),
      mid: formatPriceSmart(mv.good || mv.average || 0),
      high: formatPriceSmart(mv.excellent || mv.mint || 0),
    };
  }
  
  return formatted;
}

/**
 * Generate summary reasoning text
 */
export function generateSummaryReasoning(
  consensus: ConsensusResult,
  blendedPrice: BlendedPrice | null
): string {
  const parts: string[] = [];
  
  // Decision reasoning
  if (consensus.decision === 'BUY') {
    parts.push(`This ${consensus.itemName} appears to be a good purchase opportunity.`);
  } else {
    parts.push(`This ${consensus.itemName} may not be the best value at this time.`);
  }
  
  // Confidence statement
  if (consensus.confidence >= 90) {
    parts.push(`Analysis confidence is high (${consensus.confidence}%).`);
  } else if (consensus.confidence >= 70) {
    parts.push(`Analysis confidence is moderate (${consensus.confidence}%).`);
  } else {
    parts.push(`Analysis confidence is limited (${consensus.confidence}%). Consider additional research.`);
  }
  
  // Authority verification
  if (blendedPrice?.authorityVerified) {
    parts.push('Price verified against authority database.');
  }
  
  // Quality note
  if (consensus.analysisQuality === 'FALLBACK') {
    parts.push('Limited data available; estimate may vary.');
  }
  
  return parts.join(' ');
}

// =============================================================================
// VOTE FORMATTING
// =============================================================================

/**
 * Format model votes for response
 */
export function formatVotes(votes: ModelVote[]): Array<{
  provider: string;
  decision: string;
  value: string;
  confidence: number;
  weight: number;
}> {
  return votes.map(vote => ({
    provider: vote.providerName,
    decision: vote.decision,
    value: formatPriceSmart(vote.estimatedValue),
    confidence: Math.round(vote.confidence * 100),
    weight: parseFloat(vote.weight.toFixed(2)),
  }));
}

/**
 * Format vote summary for logging
 */
export function formatVoteSummaryText(votes: ModelVote[]): string {
  if (votes.length === 0) return 'No votes collected';
  
  const buyVotes = votes.filter(v => v.decision === 'BUY');
  const sellVotes = votes.filter(v => v.decision === 'SELL');
  
  const lines = [
    `Total: ${votes.length} votes`,
    `BUY: ${buyVotes.length} | SELL: ${sellVotes.length}`,
    `Providers: ${votes.map(v => v.providerName).join(', ')}`,
  ];
  
  return lines.join('\n');
}

// =============================================================================
// CONFIDENCE FORMATTING
// =============================================================================

/**
 * Format confidence for display
 */
export function formatConfidence(confidence: number): {
  value: number;
  label: string;
  color: string;
} {
  if (confidence >= 90) {
    return { value: confidence, label: 'High', color: 'green' };
  }
  if (confidence >= 70) {
    return { value: confidence, label: 'Moderate', color: 'yellow' };
  }
  if (confidence >= 50) {
    return { value: confidence, label: 'Low', color: 'orange' };
  }
  return { value: confidence, label: 'Very Low', color: 'red' };
}

/**
 * Format quality level
 */
export function formatQuality(quality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK'): {
  level: string;
  description: string;
  icon: string;
} {
  switch (quality) {
    case 'OPTIMAL':
      return {
        level: 'Optimal',
        description: 'Full multi-AI consensus achieved',
        icon: '✅',
      };
    case 'DEGRADED':
      return {
        level: 'Degraded',
        description: 'Partial consensus, some providers unavailable',
        icon: '⚠️',
      };
    case 'FALLBACK':
      return {
        level: 'Fallback',
        description: 'Limited data, single source estimate',
        icon: '❌',
      };
  }
}

// =============================================================================
// JSON FORMATTING
// =============================================================================

/**
 * Format response for API JSON output
 */
export function formatAPIResponse(response: FormattedAnalysisResponse): Record<string, unknown> {
  return {
    success: true,
    data: {
      analysisId: response.analysisId,
      item: {
        name: response.itemName,
        category: response.category,
      },
      valuation: {
        decision: response.decision,
        estimatedValue: response.estimatedValue,
        formattedPrice: response.formattedPrice,
        priceRange: response.priceRange,
        confidence: response.confidence,
        quality: response.analysisQuality,
      },
      reasoning: response.summaryReasoning,
      authority: response.authorityData,
      metrics: response.metrics,
      meta: {
        timestamp: response.timestamp,
        processingTime: response.processingTime,
      },
    },
  };
}

/**
 * Format error response
 */
export function formatErrorResponse(
  error: Error | string,
  analysisId?: string
): Record<string, unknown> {
  return {
    success: false,
    error: {
      message: typeof error === 'string' ? error : error.message,
      analysisId,
      timestamp: new Date().toISOString(),
    },
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  formatPrice,
  formatPriceSmart,
  formatPriceRange,
  createPriceDisplay,
  formatAnalysisResponse,
  formatAuthorityData,
  generateSummaryReasoning,
  formatVotes,
  formatVoteSummaryText,
  formatConfidence,
  formatQuality,
  formatAPIResponse,
  formatErrorResponse,
};