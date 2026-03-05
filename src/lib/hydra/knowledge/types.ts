/**
 * COLLECTIVE INTELLIGENCE ENGINE — Types
 * Codename: The Hive Mind
 *
 * Layer 1: Correction Ledger  → hydra_corrections table
 * Layer 2: Pattern Catalog    → hydra_correction_patterns table
 * Layer 3: Pre-Scan Knowledge → injected into HYDRA prompts
 *
 * Privacy: NO user_id anywhere in this module. Anonymous by design.
 *
 * CHANGELOG:
 * v1.0: Initial types
 * v1.1: AggregationResult — added processedConfirmations field to reflect
 *       bidirectional aggregator reading both corrections and confirmed_accurate rows.
 *       CorrectionRow.correction_type — added inline comment documenting
 *       'confirmed_accurate' as a valid value written by recordConfirmation().
 */

// ─── Layer 1: Raw Correction ────────────────────────────────────────────────

/** One field that changed during a correction (brand, size, model, etc.) */
export interface CorrectionField {
  field: 'brand' | 'model' | 'size' | 'category' | 'grade' | 'condition' | 'identity' | string;
  from: string;
  to: string;
}

/**
 * The "before" state — what HYDRA originally said.
 * Mirrors the analysis result shape coming out of analyze.ts.
 */
export interface OriginalAnalysis {
  /** The item name/identification HYDRA produced */
  itemName?: string;
  /** HYDRA's identification string (e.g. "6 Foot Green Line Ladder") */
  identification?: string;
  /** HYDRA's category classification */
  category?: string;
  /** HYDRA's subcategory */
  subcategory?: string;
  /** HYDRA's estimated dollar value */
  estimatedValue?: number;
  /** HYDRA's confidence score 0-1 */
  confidence?: number;
  /** Raw consensus votes from each AI provider: { openai: "Green Line", anthropic: "Bull" } */
  votes?: Record<string, string>;
  /** pHash fingerprint of the scanned image */
  imageHash?: string;
  /** Full hydraConsensus object if available */
  hydraConsensus?: {
    votes?: Record<string, string>;
    [key: string]: unknown;
  };
}

/**
 * The "after" state — what the truth turned out to be.
 * Comes from the refined analysis after user correction.
 */
export interface CorrectedAnalysis {
  itemName?: string;
  identification?: string;
  category?: string;
  subcategory?: string;
  estimatedValue?: number;
  confidence?: number;
}

/**
 * Full input to recordCorrection().
 * Caller (api/refine-analysis.ts) passes this after a successful refinement.
 */
export interface CorrectionInput {
  /** The original HYDRA analysis */
  original: OriginalAnalysis;
  /** The corrected (refined) analysis */
  corrected: CorrectedAnalysis;
  /**
   * Explicit list of fields that changed, if already computed.
   * If omitted, recorder will derive them from original vs corrected.
   */
  corrections?: CorrectionField[];
  /**
   * Provider votes map from the original consensus run.
   * { openai: "Green Line", anthropic: "Bull", google: "Green Line" }
   */
  providerVotes?: Record<string, string>;
  /** pHash of the image (cannot be reversed into the original image) */
  imageHash?: string;
  /**
   * Optional: authoritative source that confirmed the correction
   * (e.g. "user_explicit", "barcode_scan", "serial_lookup")
   */
  authoritySource?: string;
}

/** Row shape written to the hydra_corrections table */
export interface CorrectionRow {
  original_name: string;
  original_category: string;
  original_value: number | null;
  original_confidence: number | null;
  corrected_name: string;
  corrected_category: string | null;
  corrected_value: number | null;
  /**
   * The type of signal this row represents.
   *
   * Standard correction types (original_name !== corrected_name):
   *   'brand_confusion' | 'size_error' | 'category_misclass' | 'model_confusion'
   *   'condition_error' | 'grade_error' | 'identity' | 'identity_error' | 'value_correction'
   *
   * Positive trust signal (original_name === corrected_name):
   *   'confirmed_accurate' — written by recordConfirmation().
   *   Sources: 'high_consensus' (analyze.ts OPTIMAL + confidence>=0.85)
   *            'user_rating' (feedback.ts 4+ star ratings)
   *   The aggregator reads these to boost pattern confidence and improve
   *   provider trust weights. They do NOT anchor new pattern rows.
   */
  correction_type: string;
  correction_fields: CorrectionField[];
  item_category: string;
  item_subcategory: string | null;
  image_hash: string | null;
  provider_votes: Record<string, string> | null;
  authority_source: string | null;
  confidence: number;
  // NO user_id — anonymous by design
}

// ─── Layer 2: Aggregated Pattern ────────────────────────────────────────────

export type PatternType =
  | 'brand_confusion'
  | 'size_error'
  | 'category_misclass'
  | 'model_confusion'
  | 'condition_error'
  | 'grade_error'
  | 'identity_error';

export type PatternStatus = 'candidate' | 'emerging' | 'confirmed' | 'retired';

/** Row shape in the hydra_correction_patterns table */
export interface PatternRow {
  id?: string;
  pattern_type: PatternType;
  category: string;
  subcategory: string | null;
  wrong_value: string;
  correct_value: string;
  affected_field: string;
  occurrence_count: number;
  correction_rate: number | null;
  confidence: number | null;
  provider_error_rates: Record<string, number> | null;
  visual_cluster: string | null;
  distinguishing_features: string | null;
  status: PatternStatus;
  first_seen?: string;
  last_seen?: string;
  promoted_at?: string | null;
}

/** Thresholds that govern pattern promotion */
export const PATTERN_THRESHOLDS = {
  /** Min corrections to become 'emerging' */
  EMERGING_MIN_COUNT: 3,
  /** Min agreement ratio to become 'emerging' */
  EMERGING_MIN_AGREEMENT: 0.7,
  /** Min corrections to become 'confirmed' */
  CONFIRMED_MIN_COUNT: 5,
  /** Min agreement ratio to become 'confirmed' */
  CONFIRMED_MIN_AGREEMENT: 0.8,
  /** Days with no new corrections before retiring */
  RETIRE_AFTER_DAYS: 90,
} as const;

// ─── Layer 3: Knowledge Block ────────────────────────────────────────────────

/** One formatted knowledge item injected into a HYDRA prompt */
export interface KnowledgeItem {
  patternType: PatternType;
  category: string;
  wrongValue: string;
  correctValue: string;
  affectedField: string;
  confidence: number;
  occurrenceCount: number;
  distinguishingFeatures: string | null;
  providerErrorRates: Record<string, number> | null;
}

/** The fully formatted block passed to buildAnalysisPrompt() */
export interface CollectiveKnowledgeBlock {
  /** Human-readable prompt text to append to the system prompt */
  promptText: string;
  /** Structured items (useful for logging / future UI) */
  items: KnowledgeItem[];
  /** ISO timestamp when this block was assembled */
  assembledAt: string;
}

// ─── Aggregation Job ────────────────────────────────────────────────────────

export interface AggregationResult {
  /** Correction rows processed (correction_type !== 'confirmed_accurate') */
  processedCorrections: number;
  /**
   * Confirmation rows processed (correction_type === 'confirmed_accurate').
   * Positive trust signals from high-consensus scans and 4+★ user ratings.
   * They blend into pattern confidence and provider error rates but cannot
   * anchor new pattern rows on their own (no wrong_value to key on).
   */
  processedConfirmations: number;
  upsertedPatterns: number;
  promoted: number;
  retired: number;
  durationMs: number;
}