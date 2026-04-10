/**
 * COLLECTIVE INTELLIGENCE ENGINE — Layer 1: Correction Recorder
 * Codename: The Hive Mind
 *
 * recordCorrection()    — writes one anonymous correction row
 * recordConfirmation()  — writes one positive signal
 * recordDisagreement()  — writes one low-consensus signal (NEW)
 *
 * Design principles:
 * - Fire-and-forget: caller uses .catch() so failures are silent
 * - Non-blocking: never awaited in the hot path
 * - Zero PII: no user_id, no device_id, no IP address
 * - Graceful: if the DB is down, user's scan still succeeds
 *
 * DISAGREEMENT SIGNALS (added alongside corrections and confirmations):
 * When HYDRA providers reach LOW consensus on a scan, that uncertainty
 * is valuable data. The aggregator uses disagreement rows to:
 *   - Flag item categories where HYDRA consistently struggles
 *   - Identify provider disagreement patterns by category
 *   - Weight corrections more heavily in low-consensus zones
 *   - Surface items that need more training data
 * A category with 50 disagreements and 5 corrections needs attention.
 * A provider that always disagrees with consensus needs investigation.
 */

import { createClient } from '@supabase/supabase-js';
import type {
  CorrectionInput,
  CorrectionRow,
  CorrectionField,
  PatternType,
} from './types.js';

// ─── Supabase client (service role — RLS bypassed) ──────────────────────────

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ─── Field Extraction ────────────────────────────────────────────────────────

function extractCorrectionFields(
  original: CorrectionInput['original'],
  corrected: CorrectionInput['corrected']
): CorrectionField[] {
  const fields: CorrectionField[] = [];

  const origName = original.identification || original.itemName || '';
  const corrName = corrected.identification || corrected.itemName || '';
  if (origName && corrName && origName.toLowerCase() !== corrName.toLowerCase()) {
    fields.push({ field: 'identity', from: origName, to: corrName });
  }

  if (
    original.category &&
    corrected.category &&
    original.category !== corrected.category
  ) {
    fields.push({ field: 'category', from: original.category, to: corrected.category });
  }

  if (original.estimatedValue != null && corrected.estimatedValue != null) {
    const diff = Math.abs(original.estimatedValue - corrected.estimatedValue);
    const pct = diff / (original.estimatedValue || 1);
    if (pct > 0.05) {
      fields.push({
        field: 'value',
        from: String(original.estimatedValue),
        to: String(corrected.estimatedValue),
      });
    }
  }

  return fields;
}

function classifyCorrectionType(
  fields: CorrectionField[],
  originalName: string,
  correctedName: string
): string {
  if (fields.length === 0) return 'identity';

  const fieldNames = fields.map((f) => f.field);

  if (fieldNames.includes('category')) return 'category_misclass';

  if (fieldNames.includes('identity')) {
    const origLower = originalName.toLowerCase();
    const corrLower = correctedName.toLowerCase();
    const origTokens = origLower.split(/\s+/);
    const corrTokens = corrLower.split(/\s+/);

    if (origTokens[0] !== corrTokens[0]) return 'brand_confusion';

    const sizePattern = /\b(\d+\s*(?:ft|in|inch|cm|mm|oz|lb|kg|g|gallon|gal|qt|l)\b)/i;
    const origSize = origLower.match(sizePattern)?.[0];
    const corrSize = corrLower.match(sizePattern)?.[0];
    if (origSize && corrSize && origSize !== corrSize) return 'size_error';

    return 'model_confusion';
  }

  return 'identity';
}

function toCorrectionPatternType(correctionType: string): PatternType {
  const map: Record<string, PatternType> = {
    brand_confusion: 'brand_confusion',
    size_error: 'size_error',
    category_misclass: 'category_misclass',
    model_confusion: 'model_confusion',
    condition_error: 'condition_error',
    grade_error: 'grade_error',
    identity: 'identity_error',
  };
  return map[correctionType] ?? 'identity_error';
}

function computeConfidence(
  fields: CorrectionField[],
  original: CorrectionInput['original'],
  corrected: CorrectionInput['corrected'],
  authoritySource?: string
): number {
  if (authoritySource && authoritySource !== 'user_explicit') return 0.95;

  const hasBoth =
    (original.identification || original.itemName) &&
    (corrected.identification || corrected.itemName);
  if (!hasBoth) return 0.7;

  if (fields.length >= 2) return 0.9;
  if (fields.length === 1) return 0.8;

  return 0.75;
}

function captureProviderVotes(
  providerVotes: Record<string, string> | undefined,
  _correctedName: string
): Record<string, string> | null {
  if (!providerVotes || Object.keys(providerVotes).length === 0) return null;
  return providerVotes;
}

// ─── Main Export: recordCorrection ───────────────────────────────────────────

export async function recordCorrection(input: CorrectionInput): Promise<void> {
  const { original, corrected, corrections, providerVotes, imageHash, authoritySource } = input;

  const originalName = original.identification || original.itemName || '';
  const correctedName = corrected.identification || corrected.itemName || '';

  if (!originalName || !correctedName) {
    console.warn('[CI-Engine] recordCorrection: missing name data, skipping');
    return;
  }

  const fields: CorrectionField[] =
    corrections && corrections.length > 0
      ? corrections
      : extractCorrectionFields(original, corrected);

  if (
    fields.length === 0 &&
    originalName.toLowerCase() === correctedName.toLowerCase()
  ) {
    return;
  }

  const correctionType = classifyCorrectionType(fields, originalName, correctedName);
  const confidence = computeConfidence(fields, original, corrected, authoritySource);

  const row: CorrectionRow = {
    original_name: originalName,
    original_category: original.category || 'unknown',
    original_value: original.estimatedValue ?? null,
    original_confidence: original.confidence ?? null,
    corrected_name: correctedName,
    corrected_category: corrected.category ?? null,
    corrected_value: corrected.estimatedValue ?? null,
    correction_type: correctionType,
    correction_fields: fields,
    item_category: original.category || corrected.category || 'unknown',
    item_subcategory: original.subcategory ?? corrected.subcategory ?? null,
    image_hash: imageHash ?? null,
    provider_votes: captureProviderVotes(
      providerVotes ?? original.hydraConsensus?.votes,
      correctedName
    ),
    authority_source: authoritySource ?? null,
    confidence,
  };

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('hydra_corrections').insert(row);

  if (error) {
    throw new Error(`[CI-Engine] Failed to record correction: ${error.message}`);
  }

  console.log(
    `[CI-Engine] ✅ Correction recorded: "${originalName}" → "${correctedName}" (${correctionType}, confidence=${confidence})`
  );
}

// =============================================================================
// CONFIRMATION SIGNALS
// =============================================================================

export interface ConfirmationInput {
  itemName: string;
  category: string;
  estimatedValue?: number | null;
  confidence?: number | null;
  providerVotes?: Record<string, string> | null;
  consensusAgreement?: number | null;
  imageHash?: string | null;
  confirmationSource: 'user_rating' | 'high_consensus' | 'authority_match';
  rating?: number;
}

export async function recordConfirmation(input: ConfirmationInput): Promise<void> {
  const {
    itemName, category, estimatedValue, confidence, providerVotes,
    consensusAgreement, imageHash, confirmationSource, rating,
  } = input;

  if (!itemName || !category) {
    console.warn('[CI-Engine] recordConfirmation: missing itemName or category, skipping');
    return;
  }

  let confirmationConfidence: number;
  if (confirmationSource === 'user_rating') {
    confirmationConfidence = rating === 5 ? 0.95 : 0.85;
  } else if (confirmationSource === 'high_consensus' && consensusAgreement != null) {
    confirmationConfidence = Math.min(0.95, consensusAgreement);
  } else if (confirmationSource === 'authority_match') {
    confirmationConfidence = 0.95;
  } else {
    confirmationConfidence = 0.80;
  }

  const row: Partial<CorrectionRow> = {
    original_name: itemName,
    original_category: category,
    original_value: estimatedValue ?? null,
    original_confidence: confidence ?? null,
    corrected_name: itemName,
    corrected_category: category,
    corrected_value: estimatedValue ?? null,
    correction_type: 'confirmed_accurate',
    correction_fields: [],
    item_category: category,
    item_subcategory: null,
    image_hash: imageHash ?? null,
    provider_votes: providerVotes ?? null,
    authority_source: confirmationSource,
    confidence: confirmationConfidence,
  };

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('hydra_corrections').insert(row);

  if (error) {
    throw new Error(`[CI-Engine] Failed to record confirmation: ${error.message}`);
  }

  console.log(
    `[CI-Engine] ⭐ Confirmation recorded: "${itemName}" [${category}]` +
    ` source=${confirmationSource}` +
    (rating ? ` rating=${rating}★` : '') +
    (consensusAgreement != null ? ` agreement=${(consensusAgreement * 100).toFixed(0)}%` : '') +
    ` confidence=${confirmationConfidence}`
  );
}

// =============================================================================
// DISAGREEMENT SIGNALS — RH-027
// =============================================================================

/**
 * DisagreementInput — what we need to record a low-consensus signal.
 *
 * Called from api/analyze.ts when HYDRA providers fail to reach consensus:
 *   - confidence < 0.65
 *   - analysisQuality !== 'OPTIMAL'
 *   - Multiple providers gave significantly different valuations
 *
 * These rows tell the CI Engine:
 *   - Which categories HYDRA consistently struggles with
 *   - Which provider combinations tend to disagree
 *   - Where training data gaps exist
 *   - Which scan types need more provider weighting attention
 */
export interface DisagreementInput {
  itemName: string;
  category: string;
  estimatedValue?: number | null;
  confidence: number;
  analysisQuality: string;
  // Provider votes that disagreed — key: providerId, value: their decision/value
  providerVotes?: Record<string, string> | null;
  // How spread apart the provider valuations were (max - min)
  valueSpread?: number | null;
  // How many providers participated
  providerCount?: number | null;
  imageHash?: string | null;
}

/**
 * recordDisagreement(input)
 *
 * Records a LOW-CONSENSUS signal — "HYDRA providers disagreed on this."
 *
 * Written to the same hydra_corrections table:
 *   correction_type  = 'low_consensus'
 *   original_name    = corrected_name  ← same name (no correction yet)
 *   correction_fields = []             ← nothing corrected yet
 *   confidence       = inverse of agreement (lower agreement = higher signal weight)
 *
 * The aggregator uses correction_type = 'low_consensus' to:
 *   - Build a map of categories where HYDRA is uncertain
 *   - Identify provider pairs that consistently disagree
 *   - Flag items for potential correction review
 *   - Reduce pattern confidence in high-disagreement zones
 *
 * Zero schema changes — uses existing hydra_corrections table.
 * Fire-and-forget — caller uses .catch() to swallow errors silently.
 *
 * Usage in api/analyze.ts (low-consensus path):
 *
 *   if (pipelineResult.confidence < 0.65) {
 *     recordDisagreement({
 *       itemName: pipelineResult.itemName,
 *       category: pipelineResult.category,
 *       estimatedValue: pipelineResult.finalPrice,
 *       confidence: pipelineResult.confidence,
 *       analysisQuality: pipelineResult.analysisQuality,
 *       providerVotes: pipelineResult.allVotes ?? null,
 *     }).catch(err =>
 *       console.warn('[CI-Engine] Disagreement record failed (non-fatal):', err)
 *     );
 *   }
 */
export async function recordDisagreement(input: DisagreementInput): Promise<void> {
  const {
    itemName, category, estimatedValue, confidence,
    analysisQuality, providerVotes, valueSpread,
    providerCount, imageHash,
  } = input;

  if (!itemName || !category) {
    console.warn('[CI-Engine] recordDisagreement: missing itemName or category, skipping');
    return;
  }

  // Signal weight: lower confidence = higher disagreement signal
  // A confidence of 0.4 gives disagreementWeight of 0.6 (strong signal)
  // A confidence of 0.64 gives disagreementWeight of 0.36 (weak signal)
  const disagreementWeight = Math.min(0.95, Math.max(0.1, 1 - confidence));

  // Build a description of the disagreement for the correction_fields
  const disagreementFields: CorrectionField[] = [];

  if (valueSpread != null && valueSpread > 0) {
    disagreementFields.push({
      field: 'value_spread',
      from: `$${estimatedValue?.toFixed(2) || '?'}`,
      to: `±$${valueSpread.toFixed(2)}`,
    });
  }

  if (providerCount != null) {
    disagreementFields.push({
      field: 'provider_count',
      from: String(providerCount),
      to: 'disagreed',
    });
  }

  const row: Partial<CorrectionRow> = {
    original_name: itemName,
    original_category: category,
    original_value: estimatedValue ?? null,
    original_confidence: confidence,
    corrected_name: itemName,          // same — no correction yet
    corrected_category: category,
    corrected_value: estimatedValue ?? null,
    correction_type: 'low_consensus',
    correction_fields: disagreementFields,
    item_category: category,
    item_subcategory: null,
    image_hash: imageHash ?? null,
    provider_votes: providerVotes ?? null,
    authority_source: `quality:${analysisQuality}`,
    confidence: disagreementWeight,    // weight of the disagreement signal
  };

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('hydra_corrections').insert(row);

  if (error) {
    throw new Error(`[CI-Engine] Failed to record disagreement: ${error.message}`);
  }

  console.log(
    `[CI-Engine] ⚡ Disagreement recorded: "${itemName}" [${category}]` +
    ` confidence=${(confidence * 100).toFixed(0)}%` +
    ` quality=${analysisQuality}` +
    ` signal_weight=${disagreementWeight.toFixed(2)}` +
    (valueSpread ? ` spread=$${valueSpread.toFixed(2)}` : '')
  );
}