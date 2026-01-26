// FILE: src/lib/hydra/pricing/formatter.ts
// Price and Response Formatting for HYDRA
// Formats final output for API responses

import type {
  ConsensusResult,
  AuthorityData,
  ModelVote,
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
  /** Valuation factors */
  valuationFactors: string[];
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
  verified: boolean;
  confidence?: number;
  
  // Common fields
  title?: string;
  catalogNumber?: string;
  externalUrl?: string;
  
  // Market values
  marketValue?: {
    low: string;
    mid: string;
    high: string;
  };
  
  // Price by condition (for coins, cards, etc.)
  pricesByCondition?: Array<{
    condition: string;
    grade?: string;
    price: number;
  }>;
  
  // Google Books specific
  isbn?: string;
  isbn13?: string;
  isbn10?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  categories?: string[];
  description?: string;
  language?: string;
  averageRating?: number;
  ratingsCount?: number;
  imageLinks?: {
    thumbnail?: string;
    smallThumbnail?: string;
  };
  retailPrice?: number;
  
  // Numista specific (coins)
  numistaId?: number;
  issuer?: string;
  minYear?: number;
  maxYear?: number;
  value?: string;
  composition?: string;
  weight?: number;
  size?: number;
  thickness?: number;
  shape?: string;
  orientation?: string;
  references?: string;
  obverseThumb?: string;
  reverseThumb?: string;
  
  // Pokemon TCG specific
  pokemonTcgId?: string;
  setName?: string;
  setCode?: string;
  rarity?: string;
  artist?: string;
  hp?: string;
  types?: string[];
  attacks?: any[];
  weaknesses?: any[];
  resistances?: any[];
  
  // Raw item details (fallback for any other data)
  itemDetails?: Record<string, any>;
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

  // Extract valuation factors from consensus
  const valuationFactors = consensus.valuationFactors || [
    `${consensus.totalVotes} AI models analyzed`,
    `${consensus.analysisQuality} analysis quality`,
    `${Math.round(consensus.consensusMetrics.decisionAgreement * 100)}% decision agreement`,
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
 * Format authority data for response - PRESERVES ALL RICH DATA
 */
export function formatAuthorityData(authority: AuthorityData): FormattedAuthorityData {
  const formatted: FormattedAuthorityData = {
    source: authority.source,
    verified: authority.verified ?? true,
    confidence: authority.confidence,
  };

  // Common fields
  if (authority.title) {
    formatted.title = authority.title;
  }
  if (authority.catalogNumber) {
    formatted.catalogNumber = authority.catalogNumber;
  }
  if (authority.externalUrl) {
    formatted.externalUrl = authority.externalUrl;
  }

  // Format market value if available
  if (authority.marketValue) {
    const mv = authority.marketValue;
    formatted.marketValue = {
      low: formatPriceSmart(mv.fair || mv.poor || mv.good || 0),
      mid: formatPriceSmart(mv.good || mv.average || mv.vf || 0),
      high: formatPriceSmart(mv.excellent || mv.mint || mv.unc || 0),
    };
  }

  // Format price data if available (conditions/grades)
  if (authority.priceData?.conditions) {
    formatted.pricesByCondition = authority.priceData.conditions.map((c: any) => ({
      condition: c.condition,
      grade: c.grade,
      price: c.price,
    }));
  }

  // Extract itemDetails based on source type
  const details = authority.itemDetails || {};

  // =========================================================================
  // GOOGLE BOOKS DATA
  // =========================================================================
  if (authority.source === 'google_books' || details.googleBooksId) {
    formatted.isbn = details.isbn13 || details.isbn10;
    formatted.isbn13 = details.isbn13;
    formatted.isbn10 = details.isbn10;
    formatted.authors = details.authors;
    formatted.publisher = details.publisher;
    formatted.publishedDate = details.publishedDate;
    formatted.pageCount = details.pageCount;
    formatted.categories = details.categories;
    formatted.description = details.description;
    formatted.language = details.language;
    formatted.averageRating = details.averageRating;
    formatted.ratingsCount = details.ratingsCount;
    formatted.imageLinks = details.imageLinks;
    formatted.title = details.title || formatted.title;
    formatted.externalUrl = details.infoLink || details.canonicalVolumeLink || formatted.externalUrl;
    
    // Retail price from priceData
    if (authority.priceData?.retail) {
      formatted.retailPrice = authority.priceData.retail;
    }
  }

  // =========================================================================
  // NUMISTA DATA (Coins & Banknotes)
  // =========================================================================
  if (authority.source === 'numista' || details.numistaId) {
    formatted.numistaId = details.numistaId;
    formatted.title = details.title || formatted.title;
    formatted.issuer = details.issuer;
    formatted.minYear = details.minYear;
    formatted.maxYear = details.maxYear;
    formatted.value = details.value;
    formatted.composition = details.composition;
    formatted.weight = details.weight;
    formatted.size = details.size;
    formatted.thickness = details.thickness;
    formatted.shape = details.shape;
    formatted.orientation = details.orientation;
    formatted.references = details.references;
    formatted.obverseThumb = details.obverseThumb;
    formatted.reverseThumb = details.reverseThumb;
    formatted.externalUrl = details.url || formatted.externalUrl;
  }

  // =========================================================================
  // POKEMON TCG DATA
  // =========================================================================
  if (authority.source === 'pokemon_tcg' || details.pokemonTcgId) {
    formatted.pokemonTcgId = details.pokemonTcgId || details.id;
    formatted.title = details.name || formatted.title;
    formatted.setName = details.setName || details.set?.name;
    formatted.setCode = details.setCode || details.set?.id;
    formatted.rarity = details.rarity;
    formatted.artist = details.artist;
    formatted.hp = details.hp;
    formatted.types = details.types;
    formatted.attacks = details.attacks;
    formatted.weaknesses = details.weaknesses;
    formatted.resistances = details.resistances;
    formatted.imageLinks = details.images;
  }

  // =========================================================================
  // FALLBACK: Include raw itemDetails for any unmapped data
  // =========================================================================
  if (Object.keys(details).length > 0) {
    // Only include itemDetails if there's data we haven't already extracted
    const remainingDetails = { ...details };
    
    // Remove already-extracted fields to avoid duplication
    const extractedKeys = [
      'googleBooksId', 'isbn13', 'isbn10', 'authors', 'publisher', 'publishedDate',
      'pageCount', 'categories', 'description', 'language', 'averageRating', 'ratingsCount',
      'imageLinks', 'infoLink', 'canonicalVolumeLink', 'previewLink',
      'numistaId', 'title', 'issuer', 'minYear', 'maxYear', 'value', 'composition',
      'weight', 'size', 'thickness', 'shape', 'orientation', 'references', 'url',
      'obverseThumb', 'reverseThumb', 'category',
      'pokemonTcgId', 'id', 'name', 'setName', 'set', 'setCode', 'rarity', 'artist',
      'hp', 'types', 'attacks', 'weaknesses', 'resistances', 'images',
    ];
    
    extractedKeys.forEach(key => delete remainingDetails[key]);
    
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
// API RESPONSE FORMATTING - MATCHES FRONTEND AnalysisResult INTERFACE
// =============================================================================

/**
 * Format response for API JSON output
 * CRITICAL: This MUST match the frontend AnalysisResult interface in src/types.ts
 */
export function formatAPIResponse(response: FormattedAnalysisResponse): Record<string, unknown> {
  return {
    // Required fields matching AnalysisResult interface
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
    
    // Additional data for enhanced frontend features
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
    // Return minimal valid AnalysisResult to prevent frontend crash
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
    
    // Error details
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