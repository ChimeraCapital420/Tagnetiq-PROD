/**
 * HYDRA v6.0 - Configuration Constants
 * 
 * Centralized constants for timeouts, weights, limits, and configuration values.
 * Extracted from analyze.ts as part of modular refactoring.
 * 
 * @module hydra/config/constants
 */

// ==================== API TIMEOUTS ====================

/**
 * Default timeout for API calls (milliseconds)
 */
export const DEFAULT_API_TIMEOUT = 30000; // 30s

/**
 * Extended timeout for slower APIs
 */
export const EXTENDED_API_TIMEOUT = 45000; // 45s

/**
 * Short timeout for fast APIs (Pokemon TCG fix)
 */
export const SHORT_API_TIMEOUT = 6000; // 6s - prevents 504 errors

/**
 * API-specific timeouts
 */
export const API_TIMEOUTS: Record<string, number> = {
  // AI Providers - Primary Vision
  openai: 30000,
  anthropic: 30000,
  google: 30000,
  
  // AI Providers - Secondary Text
  mistral: 25000,
  groq: 15000,      // Groq is very fast
  xai: 30000,
  perplexity: 20000,
  
  // AI Providers - Tiebreaker
  deepseek: 45000,  // Longer for reasoning
  
  // Default fallback
  default: 30000,
  
  // Market APIs
  ebay: 10000,
  numista: 8000,
  brickset: 8000,
  google_books: 8000,
  pokemon_tcg: 6000, // v5.2: Reduced to prevent 504s
  rawg: 8000,
  discogs: 8000,
  comicvine: 8000,
  retailed: 10000,
  psa: 8000,
} as const;

// ==================== CONSENSUS WEIGHTS ====================

/**
 * AI model weights for consensus voting
 * Higher weight = more influence on final decision
 */
export const AI_MODEL_WEIGHTS: Record<string, number> = {
  // Primary Vision Models (highest weight)
  openai: 1.0,
  anthropic: 1.0,
  google: 1.0,
  
  // Secondary Text Models (medium weight)
  mistral: 0.75,
  groq: 0.75,
  xai: 0.80,
  perplexity: 0.85, // Higher due to real-time market data
  
  // Tiebreaker (lower weight)
  deepseek: 0.6,
} as const;

/**
 * Market data source weights for price blending
 */
export const MARKET_SOURCE_WEIGHTS: Record<string, number> = {
  // Authority sources (verified catalogues)
  numista: 1.5,
  brickset: 1.5,
  pokemon_tcg: 1.5,
  google_books: 1.4,
  discogs: 1.4,
  retailed: 1.5,
  psa: 1.6, // Graded item authority
  
  // Market sources
  ebay: 1.2, // Real market data
  
  // Metadata-only sources
  rawg: 0.5, // No pricing
  comicvine: 0.5, // No pricing
  
  // Fallback
  ai_estimate: 1.0,
} as const;

// ==================== AUTHORITY PRIORITY ====================

/**
 * Authority source priority for selecting primary authority
 * Lower number = higher priority
 */
export const AUTHORITY_PRIORITY: Record<string, number> = {
  'Pokemon TCG API': 1,
  'PSA Grading Service': 2,
  'Numista Catalogue': 3,
  'Brickset Database': 4,
  'Google Books': 5,
  'Discogs Database': 6,
  'Retailed Sneaker Database': 7,
  'Comic Vine Database': 8,
  'RAWG Games Database': 9,
  'eBay Marketplace': 10,
} as const;

/**
 * Confidence boost multipliers from authority sources
 * Max boost is capped at 15%
 */
export const AUTHORITY_CONFIDENCE_BOOST: Record<string, number> = {
  'Pokemon TCG API': 0.15,
  'PSA Grading Service': 0.15,
  'Numista Catalogue': 0.14,
  'Brickset Database': 0.13,
  'Google Books': 0.12,
  'Discogs Database': 0.12,
  'Retailed Sneaker Database': 0.14,
  'Comic Vine Database': 0.08,
  'RAWG Games Database': 0.05,
  'eBay Marketplace': 0.10,
} as const;

// ==================== CONFIDENCE THRESHOLDS ====================

/**
 * Minimum confidence required for different quality levels
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Optimal quality threshold */
  optimal: 75,
  /** Degraded quality threshold */
  degraded: 50,
  /** Minimum acceptable confidence */
  minimum: 30,
  /** Maximum possible confidence */
  maximum: 98,
} as const;

/**
 * Confidence calculation weights
 * Must sum to 1.0
 */
export const CONFIDENCE_WEIGHTS = {
  /** Weight of AI model scores */
  aiScores: 0.35,
  /** Weight of decision agreement */
  decisionAgreement: 0.25,
  /** Weight of value estimate agreement */
  valueAgreement: 0.25,
  /** Weight of model participation */
  participation: 0.10,
  /** Weight of authority data boost */
  authority: 0.05,
} as const;

// ==================== TIEBREAKER THRESHOLDS ====================

/**
 * Thresholds for triggering tiebreaker
 */
export const TIEBREAKER_THRESHOLDS = {
  /** Minimum vote difference to trigger tiebreaker (percentage) */
  minVoteDifference: 15,
  /** Minimum confidence gap to trigger tiebreaker */
  minConfidenceGap: 20,
  /** Maximum number of tiebreaker attempts */
  maxAttempts: 1,
  /** Weight for tiebreaker vote */
  tiebreaker_weight: 0.6,
} as const;

// ==================== PRICE BLENDING ====================

/**
 * Price blending configuration
 */
export const PRICE_BLEND_CONFIG = {
  /** Use median (true) or average (false) as primary */
  preferMedian: true,
  /** Maximum weight for any single source */
  maxSourceWeight: 0.40,
  /** Minimum weight for AI estimate */
  minAiWeight: 0.15,
  /** Maximum weight for AI estimate */
  maxAiWeight: 0.40,
  /** Discount factor for good deal suggestion */
  goodDealDiscount: 0.85,
  /** Markup factor for sell price suggestion */
  sellPriceMarkup: 1.15,
} as const;

// ==================== LISTING LIMITS ====================

/**
 * Maximum items to return from various sources
 */
export const LISTING_LIMITS = {
  /** Max market comparables to return */
  marketComps: 10,
  /** Max sample listings per source */
  sampleListings: 5,
  /** Max tags to include */
  tags: 6,
  /** Max valuation factors to include */
  valuationFactors: 5,
} as const;

// ==================== CATEGORY DETECTION ====================

/**
 * Category detection confidence thresholds
 */
export const CATEGORY_CONFIDENCE = {
  /** High confidence from name parsing */
  nameParsing: 0.92,
  /** High confidence from AI vote */
  aiVote: 0.95,
  /** Medium confidence from category hint */
  categoryHint: 0.90,
  /** Variable confidence from keyword detection */
  keywordBase: 0.50,
  /** Confidence increment per keyword match */
  keywordIncrement: 0.10,
  /** Maximum keyword confidence */
  keywordMax: 0.95,
  /** Default confidence when no detection */
  default: 0.50,
} as const;

// ==================== ANALYSIS QUALITY ====================

/**
 * Analysis quality levels
 */
export type AnalysisQuality = 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';

/**
 * Thresholds for analysis quality determination
 */
export const QUALITY_THRESHOLDS = {
  /** Minimum AI responses for optimal quality */
  optimalAiResponses: 3,
  /** Minimum AI responses for degraded quality */
  degradedAiResponses: 2,
  /** Minimum market sources for optimal quality */
  optimalMarketSources: 2,
  /** Minimum confidence for optimal quality */
  optimalConfidence: 75,
} as const;

// ==================== RATE LIMITS ====================

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  /** Max concurrent AI requests */
  maxConcurrentAiRequests: 3,
  /** Max concurrent market API requests */
  maxConcurrentMarketRequests: 5,
  /** Delay between retries (ms) */
  retryDelay: 1000,
  /** Max retries per request */
  maxRetries: 2,
} as const;

// ==================== CACHE TTL ====================

/**
 * Cache time-to-live values (milliseconds)
 */
export const CACHE_TTL = {
  /** Category detection cache */
  categoryDetection: 3600000, // 1 hour
  /** Market data cache */
  marketData: 3600000, // 1 hour
  /** Authority data cache */
  authorityData: 7200000, // 2 hours
  /** Price analysis cache */
  priceAnalysis: 1800000, // 30 minutes
} as const;

// ==================== PRODUCTION CONFIG ====================

/**
 * Production URL for internal API calls
 */
export const PRODUCTION_BASE_URL = 'https://tagnetiq-prod.vercel.app';

/**
 * Vercel function configuration
 */
export const VERCEL_CONFIG = {
  /** Maximum function duration (seconds) */
  maxDuration: 60,
  /** Maximum request body size */
  maxBodySize: '10mb',
} as const;

// ==================== FEATURE FLAGS ====================

/**
 * Feature flags for gradual rollout
 * Set via environment variables
 */
export const FEATURE_FLAGS = {
  /** Enable new modular consensus engine */
  useModularConsensus: () => process.env.HYDRA_MODULAR_CONSENSUS === 'true',
  /** Enable authority data integration */
  enableAuthorityData: () => process.env.HYDRA_AUTHORITY_DATA !== 'false',
  /** Enable confidence boosting */
  enableConfidenceBoost: () => process.env.HYDRA_CONFIDENCE_BOOST !== 'false',
  /** Enable flip analysis button */
  enableFlipAnalysis: () => process.env.HYDRA_FLIP_ANALYSIS !== 'false',
  /** Enable debug logging */
  debugMode: () => process.env.HYDRA_DEBUG === 'true',
} as const;

export default {
  API_TIMEOUTS,
  AI_MODEL_WEIGHTS,
  MARKET_SOURCE_WEIGHTS,
  AUTHORITY_PRIORITY,
  AUTHORITY_CONFIDENCE_BOOST,
  CONFIDENCE_THRESHOLDS,
  CONFIDENCE_WEIGHTS,
  TIEBREAKER_THRESHOLDS,
  PRICE_BLEND_CONFIG,
  LISTING_LIMITS,
  CATEGORY_CONFIDENCE,
  QUALITY_THRESHOLDS,
  RATE_LIMITS,
  CACHE_TTL,
  PRODUCTION_BASE_URL,
  VERCEL_CONFIG,
  FEATURE_FLAGS,
};