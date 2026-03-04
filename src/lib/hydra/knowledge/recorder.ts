/**
 * COLLECTIVE INTELLIGENCE ENGINE — Layer 1: Correction Recorder
 * Codename: The Hive Mind
 *
 * recordCorrection() — writes one anonymous row to hydra_corrections.
 *
 * Design principles:
 * - Fire-and-forget: caller uses .catch() so failures are silent
 * - Non-blocking: never awaited in the hot path
 * - Zero PII: no user_id, no device_id, no IP address
 * - Graceful: if the DB is down, user's refinement still succeeds
 *
 * Mobile-first: this runs server-side only. Device sends the refined
 * analysis; the server records the delta. No extra round-trips.
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
 * - Both fields present = 0.9
 * - Only corrected name = 0.75
 * - Category correction only = 0.7
 * - Fallback = 0.8
 */
function computeConfidence(
  fields: CorrectionField[],
  original: CorrectionInput['original'],
  corrected: CorrectionInput['corrected'],
  authoritySource?: string
): number {
  // Authoritative source (barcode, serial, explicit user confirmation)
  if (authoritySource && authoritySource !== 'user_explicit') return 0.95;

  const hasBoth =
    (original.identification || original.itemName) &&
    (corrected.identification || corrected.itemName);
  if (!hasBoth) return 0.7;

  // More specific correction fields = higher confidence
  if (fields.length >= 2) return 0.9;
  if (fields.length === 1) return 0.8;

  return 0.75;
}

// ─── Provider Error Rate Capture ─────────────────────────────────────────────

/**
 * Given provider votes (what each AI said originally) and the corrected name,
 * build a provider_votes record that preserves what each provider said.
 * The aggregator later computes error rates from these.
 */
function captureProviderVotes(
  providerVotes: Record<string, string> | undefined,
  _correctedName: string
): Record<string, string> | null {
  if (!providerVotes || Object.keys(providerVotes).length === 0) return null;
  return providerVotes;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * recordCorrection(input)
 *
 * Writes one anonymous row to hydra_corrections.
 * Returns a Promise — caller should use .catch() to swallow errors.
 *
 * Example usage in api/refine-analysis.ts:
 *
 *   recordCorrection({
 *     original: analysisContext,
 *     corrected: refinedResult,
 *     providerVotes: analysisContext.hydraConsensus?.votes,
 *     imageHash: analysisContext.imageHash,
 *   }).catch(err => console.warn('Correction recording failed:', err));
 */
export async function recordCorrection(input: CorrectionInput): Promise<void> {
  const { original, corrected, corrections, providerVotes, imageHash, authoritySource } = input;

  const originalName = original.identification || original.itemName || '';
  const correctedName = corrected.identification || corrected.itemName || '';

  // If nothing meaningful changed, skip
  if (!originalName || !correctedName) {
    console.warn('[CI-Engine] recordCorrection: missing name data, skipping');
    return;
  }

  // Derive changed fields
  const fields: CorrectionField[] =
    corrections && corrections.length > 0
      ? corrections
      : extractCorrectionFields(original, corrected);

  // If literally nothing changed, skip (refinement that didn't change identity)
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