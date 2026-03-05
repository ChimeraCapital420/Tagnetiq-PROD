/**
 * COLLECTIVE INTELLIGENCE ENGINE — Layer 1: Correction Recorder
 * Codename: The Hive Mind
 *
 * recordCorrection() — writes one anonymous row to hydra_corrections.
 * recordConfirmation() — writes one anonymous positive signal to hydra_corrections.
 *
 * Design principles:
 * - Fire-and-forget: caller uses .catch() so failures are silent
 * - Non-blocking: never awaited in the hot path
 * - Zero PII: no user_id, no device_id, no IP address
 * - Graceful: if the DB is down, user's refinement still succeeds
 *
 * Mobile-first: this runs server-side only. Device sends the refined
 * analysis; the server records the delta. No extra round-trips.
 *
 * CONFIRMATION SIGNALS (added alongside corrections):
 * Two sources write confirmation rows:
 *   1. User rates analysis 4+ stars → recordConfirmation(source='user_rating')
 *   2. HYDRA providers reach high consensus → recordConfirmation(source='high_consensus')
 * The aggregator weighs both: corrections flag patterns, confirmations reinforce them.
 * A pattern confirmed 50 times with 0 corrections is far stronger than
 * one corrected 5 times with 0 confirmations.
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

/**
 * Derives which fields changed between original and corrected analyses.
 * Returns an array of { field, from, to } deltas.
 */
function extractCorrectionFields(
  original: CorrectionInput['original'],
  corrected: CorrectionInput['corrected']
): CorrectionField[] {
  const fields: CorrectionField[] = [];

  // Identification / name
  const origName = original.identification || original.itemName || '';
  const corrName = corrected.identification || corrected.itemName || '';
  if (origName && corrName && origName.toLowerCase() !== corrName.toLowerCase()) {
    fields.push({ field: 'identity', from: origName, to: corrName });
  }

  // Category
  if (
    original.category &&
    corrected.category &&
    original.category !== corrected.category
  ) {
    fields.push({ field: 'category', from: original.category, to: corrected.category });
  }

  // Value (significant change = >5%)
  if (
    original.estimatedValue != null &&
    corrected.estimatedValue != null
  ) {
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

/**
 * Classifies the primary type of a correction from the changed fields.
 * Uses simple heuristics — good enough for pattern aggregation.
 */
function classifyCorrectionType(
  fields: CorrectionField[],
  originalName: string,
  correctedName: string
): string {
  if (fields.length === 0) return 'identity';

  const fieldNames = fields.map((f) => f.field);

  if (fieldNames.includes('category')) return 'category_misclass';

  // Brand / model detection via name comparison
  if (fieldNames.includes('identity')) {
    const origLower = originalName.toLowerCase();
    const corrLower = correctedName.toLowerCase();

    // Heuristic: if the first token differs, it's probably a brand confusion
    const origTokens = origLower.split(/\s+/);
    const corrTokens = corrLower.split(/\s+/);

    if (origTokens[0] !== corrTokens[0]) return 'brand_confusion';

    // Size tokens (numbers / units)
    const sizePattern = /\b(\d+\s*(?:ft|in|inch|cm|mm|oz|lb|kg|g|gallon|gal|qt|l)\b)/i;
    const origSize = origLower.match(sizePattern)?.[0];
    const corrSize = corrLower.match(sizePattern)?.[0];
    if (origSize && corrSize && origSize !== corrSize) return 'size_error';

    return 'model_confusion';
  }

  return 'identity';
}

/**
 * Maps a correction_type string to a PatternType for the patterns table.
 */
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

/**
 * Heuristic confidence: higher if the user was specific, lower if vague.
 */
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

// ─── Provider Error Rate Capture ─────────────────────────────────────────────

function captureProviderVotes(
  providerVotes: Record<string, string> | undefined,
  _correctedName: string
): Record<string, string> | null {
  if (!providerVotes || Object.keys(providerVotes).length === 0) return null;
  return providerVotes;
}

// ─── Main Export: recordCorrection ───────────────────────────────────────────

/**
 * recordCorrection(input)
 *
 * Writes one anonymous correction row to hydra_corrections.
 * Fire-and-forget — caller uses .catch() to swallow errors.
 */
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
    // NO user_id — anonymous by design
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

/**
 * ConfirmationInput — what we need to record a positive signal.
 *
 * Two sources call this:
 *   1. api/nexus/feedback.ts  — user rates 4+ stars
 *   2. api/analyze.ts         — HYDRA providers reach high consensus (≥0.85)
 */
export interface ConfirmationInput {
  itemName: string;
  category: string;
  estimatedValue?: number | null;
  confidence?: number | null;
  // Which AI providers participated — from hydraConsensus.votes
  providerVotes?: Record<string, string> | null;
  // Agreement score 0–1 from HYDRA consensus
  consensusAgreement?: number | null;
  imageHash?: string | null;
  confirmationSource: 'user_rating' | 'high_consensus' | 'authority_match';
  // Star rating 1–5 — present when source = 'user_rating'
  rating?: number;
}

/**
 * recordConfirmation(input)
 *
 * Records a POSITIVE signal — "HYDRA got this right."
 *
 * Written to the same hydra_corrections table:
 *   correction_type  = 'confirmed_accurate'
 *   original_name    = corrected_name   ← same name, no change
 *   correction_fields = []              ← nothing changed
 *
 * The aggregator uses correction_type = 'confirmed_accurate' to distinguish
 * these from error corrections. Confirmations:
 *   - Increase pattern confidence when the same ID is repeatedly confirmed
 *   - Down-weight provider error rates for providers that got it right
 *   - Accelerate pattern promotion when confirmations > corrections
 *
 * Zero schema changes — uses existing hydra_corrections table.
 * Fire-and-forget — caller uses .catch() to swallow errors silently.
 *
 * Confidence scale:
 *   user_rating 5★      = 0.95  (explicit human verification)
 *   user_rating 4★      = 0.85  (human satisfied, implicit)
 *   high_consensus 0.9+ = 0.90  (3 AIs agreed strongly)
 *   authority_match     = 0.95  (authority DB confirmed)
 *
 * Usage in api/nexus/feedback.ts:
 *
 *   if (rating >= 4 && item_context) {
 *     recordConfirmation({
 *       itemName: item_context.itemName,
 *       category: item_context.category,
 *       estimatedValue: item_context.estimatedValue,
 *       confirmationSource: 'user_rating',
 *       rating,
 *     }).catch(err => console.warn('[CI-Engine] Confirmation failed (non-fatal):', err));
 *   }
 *
 * Usage in api/analyze.ts (high-consensus path):
 *
 *   if (consensus.agreementScore >= 0.85 && quality === 'OPTIMAL') {
 *     recordConfirmation({
 *       itemName: result.itemName,
 *       category: result.category,
 *       estimatedValue: result.estimatedValue,
 *       consensusAgreement: consensus.agreementScore,
 *       providerVotes: consensus.votes,
 *       confirmationSource: 'high_consensus',
 *     }).catch(err => console.warn('[CI-Engine] Confirmation failed (non-fatal):', err));
 *   }
 */
export async function recordConfirmation(input: ConfirmationInput): Promise<void> {
  const {
    itemName, category, estimatedValue, confidence, providerVotes,
    consensusAgreement, imageHash, confirmationSource, rating,
  } = input;

  if (!itemName || !category) {
    console.warn('[CI-Engine] recordConfirmation: missing itemName or category, skipping');
    return;
  }

  // Confidence per source
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

  // original_name === corrected_name is the signal — "nothing needed to change"
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
    // NO user_id — anonymous by design
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