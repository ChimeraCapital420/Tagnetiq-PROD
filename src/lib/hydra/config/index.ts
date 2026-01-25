/**
 * HYDRA v6.0 - Configuration Module
 * 
 * Re-exports all configuration modules for easy importing.
 * 
 * @module hydra/config
 * 
 * @example
 * ```typescript
 * import { AI_PROVIDERS, getApiKey, API_TIMEOUTS } from '../config/index.js';
 * ```
 */

// Provider configurations
export {
  AI_PROVIDERS,
  PROVIDER_GROUPS,
  getApiKey,
  isProviderAvailable,
  getAvailableProviders,
  getProviderConfig,
  getPrimaryModel,
  getTotalWeight,
  validateProviderConfig,
  type ProviderConfig,
} from './providers.js';

// Constants
export {
  // Timeouts
  DEFAULT_API_TIMEOUT,
  EXTENDED_API_TIMEOUT,
  SHORT_API_TIMEOUT,
  API_TIMEOUTS,
  
  // Weights
  AI_MODEL_WEIGHTS,
  MARKET_SOURCE_WEIGHTS,
  
  // Authority
  AUTHORITY_PRIORITY,
  AUTHORITY_CONFIDENCE_BOOST,
  
  // Confidence
  CONFIDENCE_THRESHOLDS,
  CONFIDENCE_WEIGHTS,
  
  // Tiebreaker
  TIEBREAKER_THRESHOLDS,
  
  // Price blending
  PRICE_BLEND_CONFIG,
  
  // Limits
  LISTING_LIMITS,
  
  // Category
  CATEGORY_CONFIDENCE,
  
  // Quality
  QUALITY_THRESHOLDS,
  type AnalysisQuality,
  
  // Rate limits
  RATE_LIMITS,
  
  // Cache
  CACHE_TTL,
  
  // Production
  PRODUCTION_BASE_URL,
  VERCEL_CONFIG,
  
  // Feature flags
  FEATURE_FLAGS,
} from './constants.js';