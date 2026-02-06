// FILE: src/lib/hydra/pricing/index.ts
// Main exports for HYDRA pricing module
// Refactored v7.4

// Main formatter functions
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
  default as formatter,
} from './formatter.js';

// Types
export type {
  FormattedAnalysisResponse,
  FormattedAuthorityData,
  PriceDisplay,
} from './types.js';

// Source extractors (for direct use if needed)
export * from './sources/index.js';

// Blender (existing)
export * from './blender.js';