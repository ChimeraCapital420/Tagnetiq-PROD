/**
 * COLLECTIVE INTELLIGENCE ENGINE — Layer 2: Pattern Aggregator
 * Codename: The Hive Mind
 *
 * aggregatePatterns() — reads hydra_corrections, groups them into patterns,
 * upserts hydra_correction_patterns, then promotes/retires based on thresholds.
 *
 * Called by: api/cron/aggregate-corrections.ts (daily Vercel cron)
 * Risk: ZERO — reads corrections table, writes patterns table, touches nothing else.
 *
 * Mobile-first note: this is a pure server-side job. No device involvement.
 * Runs once daily; all pattern reads after this are fast indexed queries.
 *
 * CHANGELOG:
 * v1.0: Initial — correction-only aggregation
 * v2.0: BIDIRECTIONAL — reads confirmed_accurate rows alongside corrections.
 *
 *   confirmed_accurate rows (written by recorder.recordConfirmation()) have:
 *     original_name === corrected_name  (same item — positive trust signal)
 *     correction_type === 'confirmed_accurate'
 *     confidence = 0.85–0.95 depending on source
 *
 *   How confirmations affect each pattern:
 *
 *   1. CONFIDENCE BLEND — correction agreement rate is blended with the avg
 *      confirmation confidence. High confirmation volume raises the pattern's
 *      confidence score toward the confirmed items' trust level.
 *      Each confirmation contributes 3% weight, capped at 30%.
 *
 *   2. EFFECTIVE OCCURRENCE — 3 confirmations count as 1 effective correction
 *      for promotion threshold purposes. A pattern with 4 corrections and 9
 *      confirmations has an effective count of 7 — enough to reach 'confirmed'.
 *      Confirmations alone cannot anchor a pattern (no wrong_value).
 *
 *   3. PROVIDER ERROR RATES — confirmation provider_votes show which providers
 *      voted on a scan that was confirmed accurate. These count as correct (0 errors)
 *      in the per-provider calculation, reducing error rates for providers that
 *      frequently get things right — not just penalizing them when wrong.
 *
 *   Confirmations with no matching correction pattern are counted and logged
 *   but not written to hydra_correction_patterns — they need a wrong_value
 *   anchor to form a pattern row.
 */

import { createClient } from '@supabase/supabase-js';
import type {
  CorrectionRow,
  PatternRow,
  PatternType,
  PatternStatus,
  AggregationResult,
} from './types.js';
import { PATTERN_THRESHOLDS } from './types.js';

// ─── Supabase Client ──────────────────────────────────────────────────────────

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Correction Type → Pattern Type Mapping ───────────────────────────────────

function toPatternType(correctionType: string): PatternType {
  const map: Record<string, PatternType> = {
    brand_confusion:   'brand_confusion',
    size_error:        'size_error',
    category_misclass: 'category_misclass',
    model_confusion:   'model_confusion',
    condition_error:   'condition_error',
    grade_error:       'grade_error',
    identity:          'identity_error',
    identity_error:    'identity_error',
  };
  return map[correctionType] ?? 'identity_error';
}

// ─── Provider Error Rate Calculation (Bidirectional) ─────────────────────────

/**
 * Computes per-provider error rates using both correction votes and
 * confirmation votes.
 *
 * Correction votes: error if provider didn't say correctValue.
 * Confirmation votes: all count as correct (0 errors) — the item was confirmed
 * accurate, so whatever the providers voted was right.
 *
 * Net effect: a provider that appears in many confirmation votes earns a lower
 * error rate, reflecting that it gets many identifications right as well as wrong.
 */
function computeProviderErrorRates(
  correctionVoteRecords: (Record<string, string> | null)[],
  confirmationVoteRecords: (Record<string, string> | null)[],
  correctValue: string
): Record<string, number> | null {
  const counts: Record<string, { total: number; errors: number }> = {};

  // Correction votes — error when provider didn't match correctValue
  for (const votes of correctionVoteRecords) {
    if (!votes) continue;
    for (const [provider, vote] of Object.entries(votes)) {
      if (!counts[provider]) counts[provider] = { total: 0, errors: 0 };
      counts[provider].total++;
      if (vote.toLowerCase() !== correctValue.toLowerCase()) {
        counts[provider].errors++;
      }
    }
  }

  // Confirmation votes — provider got it right, zero errors for these
  for (const votes of confirmationVoteRecords) {
    if (!votes) continue;
    for (const [provider] of Object.entries(votes)) {
      if (!counts[provider]) counts[provider] = { total: 0, errors: 0 };
      counts[provider].total++;
      // No errors increment — confirmed accurate scan
    }
  }

  if (Object.keys(counts).length === 0) return null;

  const rates: Record<string, number> = {};
  for (const [provider, c] of Object.entries(counts)) {
    rates[provider] = parseFloat((c.errors / c.total).toFixed(2));
  }
  return rates;
}

// ─── Agreement Calculation ────────────────────────────────────────────────────

function computeAgreementRate(
  corrections: CorrectionRow[],
  correctValue: string
): number {
  if (corrections.length === 0) return 0;
  const agreeing = corrections.filter(
    (c) => c.corrected_name.toLowerCase() === correctValue.toLowerCase()
  ).length;
  return agreeing / corrections.length;
}

// ─── Confidence Blending ──────────────────────────────────────────────────────

/**
 * Blends correction agreement rate with confirmation signals.
 *
 * Each confirmation contributes 3% weight, capped at 30% total.
 * At 10+ confirmations, the confidence score is pulled ~30% toward
 * the average confirmation confidence (0.85–0.95).
 *
 * Example:
 *   correctionAgreement = 0.75 (3/4 corrections agree)
 *   10 confirmations with avg confidence 0.90
 *   weight = 0.30
 *   blended = 0.75 * 0.70 + 0.90 * 0.30 = 0.525 + 0.27 = 0.795
 *   → rounds to 0.80, qualifies for 'confirmed' threshold
 */
function blendConfidence(
  correctionAgreementRate: number,
  confirmationRows: CorrectionRow[]
): number {
  if (confirmationRows.length === 0) return correctionAgreementRate;

  const confirmationWeight = Math.min(confirmationRows.length * 0.03, 0.30);
  const avgConfirmationConfidence =
    confirmationRows.reduce((sum, r) => sum + (r.confidence ?? 0.85), 0) /
    confirmationRows.length;

  return parseFloat(
    (
      correctionAgreementRate * (1 - confirmationWeight) +
      avgConfirmationConfidence * confirmationWeight
    ).toFixed(2)
  );
}

// ─── Status Promotion Logic ───────────────────────────────────────────────────

/**
 * Determines pattern status using effective occurrence count.
 *
 * effectiveOccurrence = correctionCount + floor(confirmationCount / 3)
 *
 * Three confirmations of "Green Bull is correct" count as one additional
 * correction of "Green Line → Green Bull" for promotion purposes.
 * Confirmations alone cannot promote — there must be at least one real
 * correction establishing the wrong_value → correct_value anchor.
 */
function determineStatus(
  correctionCount: number,
  confirmationCount: number,
  blendedConfidence: number,
  currentStatus: PatternStatus
): PatternStatus {
  if (currentStatus === 'retired') return 'retired';

  const effectiveOccurrence = correctionCount + Math.floor(confirmationCount / 3);

  if (
    effectiveOccurrence >= PATTERN_THRESHOLDS.CONFIRMED_MIN_COUNT &&
    blendedConfidence >= PATTERN_THRESHOLDS.CONFIRMED_MIN_AGREEMENT
  ) {
    return 'confirmed';
  }

  if (
    effectiveOccurrence >= PATTERN_THRESHOLDS.EMERGING_MIN_COUNT &&
    blendedConfidence >= PATTERN_THRESHOLDS.EMERGING_MIN_AGREEMENT
  ) {
    return 'emerging';
  }

  return 'candidate';
}

// ─── Group Keys ───────────────────────────────────────────────────────────────

/**
 * Canonical key for correction grouping.
 * (correction_type, item_category, original_name, corrected_name)
 */
function correctionGroupKey(row: CorrectionRow): string {
  return [
    row.correction_type ?? 'identity',
    (row.item_category ?? 'unknown').toLowerCase(),
    row.original_name.toLowerCase().trim(),
    row.corrected_name.toLowerCase().trim(),
  ].join('||');
}

/**
 * Lookup key for confirmation matching.
 * A confirmation for "Green Bull" in "tools" matches a pattern whose
 * correct_value is "Green Bull" in the "tools" category.
 */
function confirmationLookupKey(category: string, itemName: string): string {
  return `${(category ?? 'unknown').toLowerCase()}||${itemName.toLowerCase().trim()}`;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * aggregatePatterns()
 *
 * Reads ALL rows from hydra_corrections, splits into corrections and
 * confirmations, then:
 *   1. Groups corrections by canonical key into candidate patterns
 *   2. For each pattern, finds matching confirmations (category + corrected_name)
 *   3. Blends confirmation signals into confidence and provider error rates
 *   4. Upserts into hydra_correction_patterns with blended scores
 *   5. Retires stale patterns
 *
 * Idempotent: safe to run multiple times — uses upsert, not insert.
 * Designed to run once daily via Vercel cron.
 */
export async function aggregatePatterns(): Promise<AggregationResult> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();

  console.log('[CI-Engine] 🔄 Starting bidirectional pattern aggregation...');

  // ── Step 1: Fetch all rows from the corrections ledger ───────────────────
  const { data: allRows, error: fetchError } = await supabase
    .from('hydra_corrections')
    .select('*')
    .order('created_at', { ascending: false });

  if (fetchError) {
    throw new Error(`[CI-Engine] Failed to fetch corrections: ${fetchError.message}`);
  }

  const rows = (allRows ?? []) as CorrectionRow[];
  console.log(`[CI-Engine] 📊 Loaded ${rows.length} total rows from ledger`);

  if (rows.length === 0) {
    return {
      processedCorrections:   0,
      processedConfirmations: 0,
      upsertedPatterns:       0,
      promoted:               0,
      retired:                0,
      durationMs:             Date.now() - startTime,
    };
  }

  // ── Step 2: Split corrections from confirmations ──────────────────────────
  //
  // Corrections: correction_type !== 'confirmed_accurate'
  //   original_name !== corrected_name — HYDRA got it wrong, user corrected it
  //
  // Confirmations: correction_type === 'confirmed_accurate'
  //   original_name === corrected_name — HYDRA got it right, user or system confirmed it
  //   Sources: 'high_consensus' (analyze.ts), 'user_rating' (feedback.ts)
  //
  const correctionRows = rows.filter(
    (r) => r.correction_type !== 'confirmed_accurate'
  );
  const confirmationRows = rows.filter(
    (r) => r.correction_type === 'confirmed_accurate'
  );

  console.log(
    `[CI-Engine] ✂️  Split: ${correctionRows.length} corrections | ${confirmationRows.length} confirmations`
  );

  if (correctionRows.length === 0) {
    console.log(
      '[CI-Engine] ℹ️  No corrections to aggregate. Patterns require at least one ' +
      'correction to anchor the wrong→correct mapping. Confirmations alone cannot form patterns.'
    );
    return {
      processedCorrections:   0,
      processedConfirmations: confirmationRows.length,
      upsertedPatterns:       0,
      promoted:               0,
      retired:                0,
      durationMs:             Date.now() - startTime,
    };
  }

  // ── Step 3: Index confirmations by (category, item_name) ─────────────────
  //
  // When we process pattern "Green Line → Green Bull [tools]", we look up
  // confirmations for "Green Bull" in "tools" to find positive trust signals
  // for the correct value.
  //
  const confirmationsByKey = new Map<string, CorrectionRow[]>();
  for (const row of confirmationRows) {
    const key = confirmationLookupKey(row.item_category, row.original_name);
    if (!confirmationsByKey.has(key)) confirmationsByKey.set(key, []);
    confirmationsByKey.get(key)!.push(row);
  }

  // ── Step 4: Group corrections by canonical key ────────────────────────────
  const groups = new Map<string, CorrectionRow[]>();
  for (const row of correctionRows) {
    const key = correctionGroupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  console.log(`[CI-Engine] 🗂️  Grouped into ${groups.size} distinct correction patterns`);

  // ── Step 5: Fetch existing patterns (for current status + promoted_at) ────
  const { data: existingPatterns, error: patternFetchError } = await supabase
    .from('hydra_correction_patterns')
    .select('*');

  if (patternFetchError) {
    throw new Error(`[CI-Engine] Failed to fetch existing patterns: ${patternFetchError.message}`);
  }

  const existingMap = new Map<string, PatternRow>();
  for (const p of existingPatterns ?? []) {
    const key = [
      p.pattern_type,
      p.category,
      p.wrong_value.toLowerCase(),
      p.correct_value.toLowerCase(),
    ].join('||');
    existingMap.set(key, p as PatternRow);
  }

  // ── Step 6: Build upsert payloads ─────────────────────────────────────────
  let promoted = 0;
  const upsertPayloads: Omit<PatternRow, 'id'>[] = [];

  for (const [key, groupCorrRows] of groups.entries()) {
    const sample = groupCorrRows[0];
    const correctValue = sample.corrected_name;
    const wrongValue   = sample.original_name;
    const correctionCount = groupCorrRows.length;

    // Matching confirmations: positive trust signals for the correct value
    const matchingConfirmations =
      confirmationsByKey.get(
        confirmationLookupKey(sample.item_category, correctValue)
      ) ?? [];

    // Base agreement: what fraction of corrections agree on correctValue
    const agreementRate = computeAgreementRate(groupCorrRows, correctValue);

    // Blend confirmation signals into confidence
    const blendedConfidence = blendConfidence(agreementRate, matchingConfirmations);

    // Primary affected field from correction_fields[0]
    const affectedField =
      (sample.correction_fields as CorrectionFieldLocal[])?.[0]?.field ?? 'identity';

    // Provider error rates — corrections penalize, confirmations redeem
    const correctionVotes    = groupCorrRows.map((r) => r.provider_votes as Record<string, string> | null);
    const confirmationVotes  = matchingConfirmations.map((r) => r.provider_votes as Record<string, string> | null);
    const providerErrorRates = computeProviderErrorRates(
      correctionVotes,
      confirmationVotes,
      correctValue
    );

    const existing = existingMap.get(key);
    const currentStatus: PatternStatus = existing?.status ?? 'candidate';
    const newStatus = determineStatus(
      correctionCount,
      matchingConfirmations.length,
      blendedConfidence,
      currentStatus
    );

    if (currentStatus !== 'confirmed' && newStatus === 'confirmed') {
      promoted++;
      console.log(
        `[CI-Engine] ⭐ PROMOTED to confirmed: "${wrongValue}" → "${correctValue}"` +
        ` | corrections=${correctionCount} confirmations=${matchingConfirmations.length}` +
        ` confidence=${(blendedConfidence * 100).toFixed(0)}%`
      );
    }

    const now = new Date().toISOString();

    upsertPayloads.push({
      pattern_type:             toPatternType(sample.correction_type),
      category:                 sample.item_category,
      subcategory:              sample.item_subcategory ?? null,
      wrong_value:              wrongValue,
      correct_value:            correctValue,
      affected_field:           affectedField,
      occurrence_count:         correctionCount,  // correction rows only — no schema change needed
      correction_rate:          null,             // needs total scan count — future enhancement
      confidence:               blendedConfidence,
      provider_error_rates:     providerErrorRates,
      visual_cluster:           null,
      distinguishing_features:  existing?.distinguishing_features ?? null,
      status:                   newStatus,
      first_seen:               existing?.first_seen ?? now,
      last_seen:                now,
      promoted_at:
        newStatus === 'confirmed' && !existing?.promoted_at
          ? now
          : (existing?.promoted_at ?? null),
    });
  }

  // ── Step 7: Upsert patterns ───────────────────────────────────────────────
  const { error: upsertError } = await supabase
    .from('hydra_correction_patterns')
    .upsert(upsertPayloads, {
      onConflict: 'pattern_type,category,wrong_value,correct_value',
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(`[CI-Engine] Upsert failed: ${upsertError.message}`);
  }

  // ── Step 8: Retire stale patterns ────────────────────────────────────────
  const retireBeforeDate = new Date();
  retireBeforeDate.setDate(
    retireBeforeDate.getDate() - PATTERN_THRESHOLDS.RETIRE_AFTER_DAYS
  );

  const { data: retiredData, error: retireError } = await supabase
    .from('hydra_correction_patterns')
    .update({ status: 'retired' })
    .lt('last_seen', retireBeforeDate.toISOString())
    .neq('status', 'retired')
    .select('id');

  if (retireError) {
    console.warn(`[CI-Engine] Retire step failed (non-fatal): ${retireError.message}`);
  }

  const retiredCount = retiredData?.length ?? 0;
  if (retiredCount > 0) {
    console.log(`[CI-Engine] 🗑️  Retired ${retiredCount} stale patterns`);
  }

  const result: AggregationResult = {
    processedCorrections:   correctionRows.length,
    processedConfirmations: confirmationRows.length,
    upsertedPatterns:       upsertPayloads.length,
    promoted,
    retired:                retiredCount,
    durationMs:             Date.now() - startTime,
  };

  console.log('[CI-Engine] ✅ Bidirectional aggregation complete:', result);
  return result;
}

// ─── Local type (mirrors types.ts CorrectionField) ────────────────────────────
interface CorrectionFieldLocal {
  field: string;
  from: string;
  to: string;
}