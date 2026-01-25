// FILE: src/lib/hydra/index.ts
// Main export file for HYDRA modular architecture
// Re-exports all modules for clean imports throughout the application

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
// CONSENSUS ENGINE (Phase 3)
// =============================================================================
export * from './consensus/index.js';

// =============================================================================
// PRICING (Phase 4)
// =============================================================================
export * from './pricing/index.js';

// =============================================================================
// STORAGE (Phase 4)
// =============================================================================
export * from './storage/index.js';

// =============================================================================
// CATEGORY DETECTION
// =============================================================================
export {
  detectItemCategory,
  type CategoryResult,
  type CategorySource,
} from './category-detection.js';

// =============================================================================
// FETCHERS (Authority APIs)
// =============================================================================
export {
  // Main orchestrator
  fetchMarketData,
  
  // Individual fetchers for direct access
  fetchEbayData,
  fetchNumistaData,
  fetchPokemonTCGData,
  fetchBricksetData,
  fetchGoogleBooksData,
  fetchDiscogsData,
  fetchRetailedData,
  fetchPSAData,
  fetchComicVineData,
  
  // Types
  type MarketDataResult,
  type AuthorityData,
  type PriceByCondition,
  type EbayListing,
  type NumistaData,
  type PokemonTCGData,
  type BricksetData,
  type GoogleBooksData,
  type DiscogsData,
  type RetailedData,
  type PSAData,
  type ComicVineData,
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
export const HYDRA_VERSION = '6.0.0';
export const HYDRA_MODULES = {
  config: true,
  prompts: true,
  categoryDetection: true,
  fetchers: true,
  ai: true,        // Phase 2 - COMPLETE
  consensus: true, // Phase 3 - COMPLETE
  pricing: true,   // Phase 4 - COMPLETE
  storage: true,   // Phase 4 - COMPLETE
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