/**
 * COLLECTIVE INTELLIGENCE ENGINE — Barrel Export
 * Codename: The Hive Mind
 *
 * Follows the same pattern as src/lib/hydra/benchmarks/index.ts
 *
 * Import from here throughout the codebase:
 *   import { recordCorrection, recordConfirmation, lookupPatterns, aggregatePatterns }
 *     from '../src/lib/hydra/knowledge/index.js';
 *
 * CHANGELOG:
 * v1.0: Initial — recordCorrection, aggregatePatterns, lookupPatterns
 * v1.1: Added recordConfirmation export (required by analyze.ts v9.8 and feedback.ts v1.1)
 */

// Layer 1 — Correction Recorder
export { recordCorrection, recordConfirmation } from './recorder.js';

// Layer 2 — Pattern Aggregator
export { aggregatePatterns } from './aggregator.js';

// Layer 3 — Pattern Lookup + Knowledge Block Builder
export { lookupPatterns } from './pattern-lookup.js';

// Types (re-exported for consumers)
export type {
  // Inputs
  CorrectionInput,
  CorrectionField,
  OriginalAnalysis,
  CorrectedAnalysis,
  // DB rows
  CorrectionRow,
  PatternRow,
  // Knowledge block
  CollectiveKnowledgeBlock,
  KnowledgeItem,
  // Enums
  PatternType,
  PatternStatus,
  // Results
  AggregationResult,
} from './types.js';

export { PATTERN_THRESHOLDS } from './types.js';