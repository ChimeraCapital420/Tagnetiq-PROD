/**
 * COLLECTIVE INTELLIGENCE ENGINE — Barrel Export
 * Codename: The Hive Mind
 *
 * Follows the same pattern as src/lib/hydra/benchmarks/index.ts
 *
 * Import from here throughout the codebase:
 *   import { recordCorrection, lookupPatterns, aggregatePatterns } from '../src/lib/hydra/knowledge/index.js';
 */

// Layer 1 — Correction Recorder
export { recordCorrection } from './recorder.js';

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