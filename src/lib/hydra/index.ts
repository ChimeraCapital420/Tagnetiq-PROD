// FILE: src/lib/hydra/index.ts
// Main export file for HYDRA modular architecture
// Re-exports all modules for clean imports throughout the application
// v8.0: category-detection refactored from monolith to folder module
// v8.0: Added Colnect fetcher for 40+ collectible categories

// =============================================================================
// TYPES
// =============================================================================
export * from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================
export * from './config/index.js';

// =============================================================================
// PROMPTS
// =============================================================================
export * from './prompts/index.js';

// =============================================================================
// AI PROVIDERS
// =============================================================================
export * from './ai/index.js';

// =============================================================================
// CONSENSUS ENGINE
// =============================================================================
export * from './consensus/index.js';

// =============================================================================
// PRICING
// =============================================================================
export * from './pricing/index.js';

// =============================================================================
// STORAGE
// =============================================================================
export * from './storage/index.js';

// =============================================================================
// CATEGORY DETECTION (v8.0: refactored from single file to folder module)
// =============================================================================
// CHANGED v8.0: './category-detection.js' → './category-detection/index.js'
export {
  // Main detection function
  detectItemCategory,
  
  // Detection sub-functions
  detectCategoryFromName,
  detectCategoryByKeywords,
  checkNamePatternOverrides,
  
  // Utilities
  getApisForCategory,
  normalizeCategory,
  
  // Data maps (for direct access / testing)
  CATEGORY_API_MAP,
  CATEGORY_KEYWORDS,
  NAME_PATTERN_OVERRIDES,
} from './category-detection/index.js';

// =============================================================================
// FETCHERS (Authority APIs)
// =============================================================================
export {
  // Main orchestrator
  fetchMarketData,
  fetchMarketDataBatch,
  
  // Individual fetchers for direct access
  fetchEbayData,
  fetchNumistaData,
  fetchPokemonTcgData,
  fetchBricksetData,
  fetchGoogleBooksData,
  fetchDiscogsData,
  fetchRetailedData,
  fetchPsaData,
  verifyPsaCerts,
  
  // v8.0: Colnect fetcher (stamps, coins, banknotes, 40+ collectible categories)
  fetchColnectData,
  hasColnectSupport,
  getColnectCategories,
  getColnectCategorySlug,
} from './fetchers/index.js';

// =============================================================================
// CONVENIENCE RE-EXPORTS
// =============================================================================

// Config shortcuts
export {
  AI_PROVIDERS,
  getApiKey,
  isProviderAvailable,
  getAvailableProviders,
} from './config/providers.js';

export {
  API_TIMEOUTS,
  AI_MODEL_WEIGHTS,
  MARKET_SOURCE_WEIGHTS,
  AUTHORITY_PRIORITY,
  CONFIDENCE_WEIGHTS,
  TIEBREAKER_THRESHOLDS,
  FEATURE_FLAGS,
} from './config/constants.js';

// Prompt shortcuts
export {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisPrompt,
  buildUserMessage,
} from './prompts/analysis.js';

export {
  TIEBREAKER_SYSTEM_PROMPT,
  buildTiebreakerPrompt,
  needsTiebreaker,
} from './prompts/tiebreaker.js';

export {
  REFINEMENT_SYSTEM_PROMPT,
  buildRefinementPrompt,
} from './prompts/refinement.js';

// Consensus shortcuts
export {
  calculateConsensus,
  calculateConsensusWithDetails,
  quickConsensusCheck,
  calculateConfidence,
  tallyVotes,
  shouldTriggerTiebreaker,
} from './consensus/index.js';

// Pricing shortcuts
export {
  blendPrices,
  blendAIWithAuthority,
  blendFromVotes,
  adjustPriceForCondition,
  formatPrice,
  formatPriceSmart,
  formatAnalysisResponse,
} from './pricing/index.js';

// Storage shortcuts
export {
  saveAnalysis,
  saveAnalysisAsync,
  getAnalysis,
  isSupabaseAvailable,
} from './storage/index.js';

// =============================================================================
// VERSION INFO
// =============================================================================
export const HYDRA_VERSION = '8.0.0';
export const HYDRA_MODULES = {
  config: true,
  prompts: true,
  categoryDetection: true,
  fetchers: true,
  ai: true,
  consensus: true,
  pricing: true,
  storage: true,
} as const;

/**
 * Get status of HYDRA modular migration
 */
export function getHydraStatus(): {
  version: string;
  modules: typeof HYDRA_MODULES;
  completedModules: string[];
  pendingModules: string[];
} {
  const completed = Object.entries(HYDRA_MODULES)
    .filter(([_, ready]) => ready)
    .map(([name]) => name);
  
  const pending = Object.entries(HYDRA_MODULES)
    .filter(([_, ready]) => !ready)
    .map(([name]) => name);
  
  return {
    version: HYDRA_VERSION,
    modules: HYDRA_MODULES,
    completedModules: completed,
    pendingModules: pending,
  };
}