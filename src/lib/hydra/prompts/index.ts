/**
 * HYDRA v6.0 - Prompts Module
 * 
 * Re-exports all prompt modules for easy importing.
 * 
 * @module hydra/prompts
 * 
 * @example
 * ```typescript
 * import { 
 *   ANALYSIS_SYSTEM_PROMPT, 
 *   buildTiebreakerPrompt,
 *   buildRefinementPrompt 
 * } from '../prompts/index.js';
 * ```
 */

// Analysis prompts
export {
  ANALYSIS_SYSTEM_PROMPT,
  SUPPORTED_CATEGORIES,
  buildAnalysisPrompt,
  buildUserMessage,
  validateAnalysisResponse,
  FORBIDDEN_PHRASES,
  findForbiddenPhrases,
  type SupportedCategory,
  type AnalysisResponse,
} from './analysis.js';

// Tiebreaker prompts
export {
  TIEBREAKER_SYSTEM_PROMPT,
  buildTiebreakerPrompt,
  createVoteSummaries,
  needsTiebreaker,
  valuesAreDivergent,
  validateTiebreakerResponse,
  type VoteSummary,
  type TiebreakerResponse,
} from './tiebreaker.js';

// Refinement prompts
export {
  REFINEMENT_SYSTEM_PROMPT,
  buildRefinementPrompt,
  calculateValueAdjustment,
  calculateConfidenceChange,
  validateRefinementResponse,
  getRefinementType,
  type RefinementContext,
  type RefinementResponse,
} from './refinement.js';