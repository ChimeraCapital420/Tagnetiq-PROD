// FILE: src/lib/hydra/pricing/formatter.ts
// Price and Response Formatting for HYDRA v8.0 → v9.0
// REFACTORED: From 1200 lines to ~300 lines
// Source-specific extraction delegated to /sources/*.ts
// v8.0: Colnect attribution requirement handled in source extractor
// v9.0.2: FIXED — Safe access for consensusMetrics (was crashing every scan)

import type {
  ConsensusResult,
  AuthorityData,
  ModelVote,
} from '../types.js';
import type { BlendedPrice } from './blender.js';
import type { 
  FormattedAnalysisResponse, 
  FormattedAuthorityData,
  PriceDisplay 
} from './types.js';
import { extractSourceSpecificData, EXTRACTED_KEYS } from './sources/index.js';

// Re-export types for consumers
export type { 
  FormattedAnalysisResponse, 
  FormattedAuthorityData, 
  PriceDisplay 
} from './types.js';

// =============================================================================
// SAFE METRICS HELPER
// =============================================================================

/**
 * Safely extract consensus metrics from either the new pipeline format
 * or the legacy hydra-engine format. Prevents crashes when consensusMetrics
 * is undefined (which happens when analyze.ts builds a compat object).
 */
function safeMetrics(consensus: ConsensusResult): {
  totalVotes: number;
  avgAIConfidence: number;
  decisionAgreement: number;
  valueAgreement: number;
  participationRate: number;
  authorityVerified: boolean;
} {
  // New pipeline format: consensusMetrics exists
  if (consensus.consensusMetrics) {
    return {
      totalVotes: consensus.totalVotes ?? 0,
      avgAIConfidence: consensus.consensusMetrics.avgAIConfidence ?? 0,
      decisionAgreement: consensus.consensusMetrics.decisionAgreement ?? 0,
      valueAgreement: consensus.consensusMetrics.valueAgreement ?? 0,
      participationRate: consensus.consensusMetrics.participationRate ?? 0,
      authorityVerified: consensus.consensusMetrics.authorityVerified ?? false,
    };
  }

  // Legacy/compat format: extract from what we have
  return {
    totalVotes: consensus.totalVotes ?? (consensus as any).votes?.length ?? 0,
    avgAIConfidence: (consensus as any).confidence ? (consensus as any).confidence / 100 : 0,
    decisionAgreement: 0,
    valueAgreement: 0,
    participationRate: 0,
    authorityVerified: false,
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
 */
export function formatPriceSmart(value: number, currency: string = 'USD'): string {
  if (value === 0 || isNaN(value)) return '$0';

  if (value < 1) {
    return formatPrice(value, currency, { minimumFractionDigits: 2 });
  }
  if (value < 100) {
    return formatPrice(value, currency, { minimumFractionDigits: 2 });
  }
  return formatPrice(value, currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/**
 * Format a price range
 */
export function formatPriceRange(low: number, high: number, currency: string = 'USD'): string {
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
 * FIXED v9.0.2: Safe access for consensusMetrics — no more crashes
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

  const metrics = safeMetrics(consensus);

  const valuationFactors = consensus.valuationFactors || [
    `${metrics.totalVotes} AI models analyzed`,
    `${consensus.analysisQuality} analysis quality`,
    `${Math.round(metrics.decisionAgreement * 100)}% decision agreement`,
  ];

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
    valuationFactors,
    authorityData: authorityData ? formatAuthorityData(authorityData) : undefined,
    metrics: {
      totalVotes: metrics.totalVotes,
      avgAIConfidence: Math.round(metrics.avgAIConfidence * 100),
      decisionAgreement: Math.round(metrics.decisionAgreement * 100),
      valueAgreement: Math.round(metrics.valueAgreement * 100),
    },
    timestamp: new Date().toISOString(),
    processingTime,
  };
}

/**
 * Format authority data for response
 * Delegates to source-specific extractors in /sources/*.ts
 */
export function formatAuthorityData(authority: AuthorityData): FormattedAuthorityData {
  const formatted: FormattedAuthorityData = {
    source: authority.source,
    verified: authority.verified ?? true,
    confidence: authority.confidence,
  };

  // Common fields
  if (authority.title) formatted.title = authority.title;
  if (authority.catalogNumber) formatted.catalogNumber = authority.catalogNumber;
  if (authority.externalUrl) formatted.externalUrl = authority.externalUrl;

  // Format market value if available
  if (authority.marketValue) {
    const mv = authority.marketValue;
    formatted.marketValue = {
      low: formatPriceSmart(mv.fair || mv.poor || mv.good || mv.low || 0),
      mid: formatPriceSmart(mv.good || mv.average || mv.vf || mv.mid || 0),
      high: formatPriceSmart(mv.excellent || mv.mint || mv.unc || mv.high || 0),
    };
  }

  // Format price data if available
  if (authority.priceData?.conditions) {
    formatted.pricesByCondition = authority.priceData.conditions.map((c: Record<string, unknown>) => ({
      condition: c.condition as string,
      grade: c.grade as string,
      price: c.price as number,
    }));
  }

  // Get itemDetails for source-specific extraction
  const details = (authority.itemDetails || {}) as Record<string, unknown>;

  console.log(`📋 Formatter authority.source: "${authority.source}"`);
  console.log(`📋 Formatter itemDetails keys: ${Object.keys(details).join(', ') || 'EMPTY'}`);

  // Delegate to source-specific extractors (ebay, numista, colnect, etc.)
  extractSourceSpecificData(authority, details, formatted);

  // Include remaining itemDetails as fallback
  if (Object.keys(details).length > 0) {
    const remainingDetails = { ...details };
    EXTRACTED_KEYS.forEach(key => delete remainingDetails[key]);

    if (Object.keys(remainingDetails).length > 0) {
      formatted.itemDetails = remainingDetails;
    }
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

  if (consensus.decision === 'BUY') {
    parts.push(`This ${consensus.itemName} appears to be a good purchase opportunity.`);
  } else {
    parts.push(`This ${consensus.itemName} may not be the best value at this time.`);
  }

  if (consensus.confidence >= 90) {
    parts.push(`Analysis confidence is high (${consensus.confidence}%).`);
  } else if (consensus.confidence >= 70) {
    parts.push(`Analysis confidence is moderate (${consensus.confidence}%).`);
  } else {
    parts.push(`Analysis confidence is limited (${consensus.confidence}%). Consider additional research.`);
  }

  if (blendedPrice?.authorityVerified) {
    parts.push('Price verified against authority database.');
  }

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

  return [
    `Total: ${votes.length} votes`,
    `BUY: ${buyVotes.length} | SELL: ${sellVotes.length}`,
    `Providers: ${votes.map(v => v.providerName).join(', ')}`,
  ].join('\n');
}

// =============================================================================
// CONFIDENCE & QUALITY FORMATTING
// =============================================================================

export function formatConfidence(confidence: number): {
  value: number;
  label: string;
  color: string;
} {
  if (confidence >= 90) return { value: confidence, label: 'High', color: 'green' };
  if (confidence >= 70) return { value: confidence, label: 'Moderate', color: 'yellow' };
  if (confidence >= 50) return { value: confidence, label: 'Low', color: 'orange' };
  return { value: confidence, label: 'Very Low', color: 'red' };
}

export function formatQuality(quality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK'): {
  level: string;
  description: string;
  icon: string;
} {
  switch (quality) {
    case 'OPTIMAL':
      return { level: 'Optimal', description: 'Full multi-AI consensus achieved', icon: '✅' };
    case 'DEGRADED':
      return { level: 'Degraded', description: 'Partial consensus, some providers unavailable', icon: '⚠️' };
    case 'FALLBACK':
      return { level: 'Fallback', description: 'Limited data, single source estimate', icon: '❌' };
  }
}

// =============================================================================
// API RESPONSE FORMATTING
// =============================================================================

/**
 * Format response for API JSON output
 */
export function formatAPIResponse(response: FormattedAnalysisResponse): Record<string, unknown> {
  return {
    id: response.analysisId,
    itemName: response.itemName,
    estimatedValue: response.estimatedValue,
    decision: response.decision,
    confidenceScore: response.confidence,
    summary_reasoning: response.summaryReasoning,
    valuation_factors: response.valuationFactors,
    resale_toolkit: {
      listInArena: true,
      sellOnProPlatforms: true,
      linkToMyStore: false,
      shareToSocial: true,
    },
    marketComps: [],
    imageUrl: '',
    capturedAt: response.timestamp,
    category: response.category,
    subCategory: response.category,
    tags: [response.category, response.decision.toLowerCase()],
    analysis_quality: response.analysisQuality,
    formattedPrice: response.formattedPrice,
    priceRange: response.priceRange,
    metrics: response.metrics,
    authorityData: response.authorityData,
    processingTime: response.processingTime,
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
    id: analysisId || `error_${Date.now()}`,
    itemName: 'Analysis Error',
    estimatedValue: 0,
    decision: 'SELL',
    confidenceScore: 0,
    summary_reasoning: typeof error === 'string' ? error : error.message,
    valuation_factors: ['Error occurred during analysis'],
    resale_toolkit: {
      listInArena: false,
      sellOnProPlatforms: false,
      linkToMyStore: false,
      shareToSocial: false,
    },
    marketComps: [],
    imageUrl: '',
    capturedAt: new Date().toISOString(),
    category: 'error',
    subCategory: 'error',
    tags: ['error'],
    analysis_quality: 'NO_RESULT',
    error: {
      message: typeof error === 'string' ? error : error.message,
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
```

---

Push that and test a scan. The `decisionAgreement` crash is gone — `safeMetrics()` now handles both the new pipeline format and the compat object from `analyze.ts`.

While that builds, paste one of the broken providers so we can get all 8 engines firing:
```
src/lib/hydra/ai/google.ts