// FILE: src/lib/hydra/pricing/index.ts
// HYDRA Pricing Module Exports
// Phase 4: Pricing

// =============================================================================
// BLENDER
// =============================================================================

export {
  blendPrices,
  blendAIWithAuthority,
  blendFromVotes,
  adjustPriceForCondition,
  getConditionMultiplier,
  type PriceSource,
  type BlendedPrice,
  type BlendOptions,
} from './blender.js';

// =============================================================================
// FORMATTER
// =============================================================================

export {
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
  type FormattedAnalysisResponse,
  type FormattedAuthorityData,
  type PriceDisplay,
} from './formatter.js';

// =============================================================================
// MODULE INFO
// =============================================================================

export const PRICING_MODULE_VERSION = '6.0.0';