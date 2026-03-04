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
    brand_confusion: 'brand_confusion',
    size_error: 'size_error',
    category_misclass: 'category_misclass',
    model_confusion: 'model_confusion',
    condition_error: 'condition_error',
    grade_error: 'grade_error',
    identity: 'identity_error',
    identity_error: 'identity_error',
  };
  return map[correctionType] ?? 'identity_error';
}

// ─── Provider Error Rate Calculation ─────────────────────────────────────────

/**
 * Given an array of provider_votes records (each is { openai: "X", anthropic: "Y" ... })
 * and the correct value, compute per-provider error rates.
 *
 * Returns { openai: 0.73, anthropic: 0.12, google: 0.65 }
 */
function computeProviderErrorRates(
  voteRecords: (Record<string, string> | null)[],
  correctValue: string
): Record<string, number> | null {
  const providerCounts: Record<string, { total: number; errors: number }> = {};

  for (const votes of voteRecords) {
    if (!votes) continue;
    for (const [provider, vote] of Object.entries(votes)) {
      if (!providerCounts[provider]) {
        providerCounts[provider] = { total: 0, errors: 0 };
      }
      providerCounts[provider].total++;
      // Error = provider said something different from the correct value
      if (vote.toLowerCase() !== correctValue.toLowerCase()) {
        providerCounts[provider].errors++;
      }
    }
  }

  if (Object.keys(providerCounts).length === 0) return null;

  const rates: Record<string, number> = {};
  for (const [provider, counts] of Object.entries(providerCounts)) {
    rates[provider] = parseFloat((counts.errors / counts.total).toFixed(2));
  }
  return rates;
}

// ─── Agreement Calculation ────────────────────────────────────────────────────

/**
 * Given a group of corrections that share (wrong_value → correct_value),
 * compute what fraction actually agree on the same corrected_name.
 */
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

// ─── Status Promotion Logic ───────────────────────────────────────────────────

function determineStatus(
  occurrenceCount: number,
  agreementRate: number,
  currentStatus: PatternStatus
): PatternStatus {
  // Never un-retire via aggregation (requires manual admin action)
  if (currentStatus === 'retired') return 'retired';

  if (
    occurrenceCount >= PATTERN_THRESHOLDS.CONFIRMED_MIN_COUNT &&
    agreementRate >= PATTERN_THRESHOLDS.CONFIRMED_MIN_AGREEMENT
  ) {
    return 'confirmed';
  }

  if (
    occurrenceCount >= PATTERN_THRESHOLDS.EMERGING_MIN_COUNT &&
    agreementRate >= PATTERN_THRESHOLDS.EMERGING_MIN_AGREEMENT
  ) {
    return 'emerging';
  }

  return 'candidate';
}

// ─── Group Key ───────────────────────────────────────────────────────────────

/**
 * Creates a canonical grouping key from a correction row.
 * Patterns are grouped by: (correction_type, item_category, original_name_normalized, corrected_name_normalized)
 */
function groupKey(row: CorrectionRow): string {
  const origNorm = row.original_name.toLowerCase().trim();
  const corrNorm = row.corrected_name.toLowerCase().trim();
  const cat = (row.item_category ?? 'unknown').toLowerCase();
  const type = row.correction_type ?? 'identity';
  return `${type}||${cat}||${origNorm}||${corrNorm}`;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * aggregatePatterns()
 *
 * Reads all corrections from the last processing window, groups them into
 * candidate/emerging/confirmed patterns, then upserts into hydra_correction_patterns.
 *
 * Idempotent: safe to run multiple times — uses upsert, not insert.
 * Designed to run once daily via Vercel cron.
 *
 * Returns an AggregationResult summary for cron logging.
 */
export async function aggregatePatterns(): Promise<AggregationResult> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();

  console.log('[CI-Engine] 🔄 Starting pattern aggregation...');

  // ── Step 1: Fetch all corrections (no cutoff — aggregation is idempotent) ──
  const { data: corrections, error: fetchError } = await supabase
    .from('hydra_corrections')
    .select('*')
    .order('created_at', { ascending: false });

  if (fetchError) {
    throw new Error(`[CI-Engine] Failed to fetch corrections: ${fetchError.message}`);
  }

  const rows = (corrections ?? []) as CorrectionRow[];
  console.log(`[CI-Engine] 📊 Loaded ${rows.length} corrections`);

  if (rows.length === 0) {
    return {
      processedCorrections: 0,
      upsertedPatterns: 0,
      promoted: 0,
      retired: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // ── Step 2: Group corrections by canonical key ────────────────────────────
  const groups = new Map<string, CorrectionRow[]>();
  for (const row of rows) {
    const key = groupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  console.log(`[CI-Engine] 🗂️  Grouped into ${groups.size} distinct patterns`);

  // ── Step 3: Fetch existing patterns (for current status + promoted_at) ────
  const { data: existingPatterns, error: patternFetchError } = await supabase
    .from('hydra_correction_patterns')
    .select('*');

  if (patternFetchError) {
    throw new Error(`[CI-Engine] Failed to fetch existing patterns: ${patternFetchError.message}`);
  }

  // Index existing patterns by their canonical key for O(1) lookup
  const existingMap = new Map<string, PatternRow>();
  for (const p of existingPatterns ?? []) {
    const existingKey = `${p.pattern_type}||${p.category}||${p.wrong_value.toLowerCase()}||${p.correct_value.toLowerCase()}`;
    existingMap.set(existingKey, p as PatternRow);
  }

  // ── Step 4: Build upsert payloads ─────────────────────────────────────────
  let promoted = 0;
  const upsertPayloads: Omit<PatternRow, 'id'>[] = [];

  for (const [key, groupRows] of groups.entries()) {
    const sample = groupRows[0];
    const correctValue = sample.corrected_name;
    const wrongValue = sample.original_name;
    const occurrenceCount = groupRows.length;
    const agreementRate = computeAgreementRate(groupRows, correctValue);

    // Primary affected field from correction_fields[0]
    const affectedField =
      (sample.correction_fields as CorrectionField[])?.[0]?.field ?? 'identity';

    const providerVoteRecords = groupRows.map((r) => r.provider_votes as Record<string, string> | null);
    const providerErrorRates = computeProviderErrorRates(providerVoteRecords, correctValue);

    const existing = existingMap.get(key);
    const currentStatus: PatternStatus = existing?.status ?? 'candidate';
    const newStatus = determineStatus(occurrenceCount, agreementRate, currentStatus);

    if (
      currentStatus !== 'confirmed' &&
      newStatus === 'confirmed'
    ) {
      promoted++;
      console.log(
        `[CI-Engine] ⭐ PROMOTED to confirmed: "${wrongValue}" → "${correctValue}" (${occurrenceCount} corrections, ${(agreementRate * 100).toFixed(0)}% agreement)`
      );
    }

    const now = new Date().toISOString();

    upsertPayloads.push({
      pattern_type: toPatternType(sample.correction_type),
      category: sample.item_category,
      subcategory: sample.item_subcategory ?? null,
      wrong_value: wrongValue,
      correct_value: correctValue,
      affected_field: affectedField,
      occurrence_count: occurrenceCount,
      correction_rate: null, // Would need total scan count to compute — future enhancement
      confidence: parseFloat(agreementRate.toFixed(2)),
      provider_error_rates: providerErrorRates,
      visual_cluster: null,
      distinguishing_features: existing?.distinguishing_features ?? null,
      status: newStatus,
      first_seen: existing?.first_seen ?? now,
      last_seen: now,
      promoted_at:
        newStatus === 'confirmed' && !existing?.promoted_at
          ? now
          : (existing?.promoted_at ?? null),
    });
  }

  // ── Step 5: Upsert patterns ───────────────────────────────────────────────
  // Using onConflict on the natural key tuple. Supabase requires a unique constraint.
  // The constraint should be: (pattern_type, category, wrong_value, correct_value)
  const { error: upsertError } = await supabase
    .from('hydra_correction_patterns')
    .upsert(upsertPayloads, {
      onConflict: 'pattern_type,category,wrong_value,correct_value',
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(`[CI-Engine] Upsert failed: ${upsertError.message}`);
  }

  // ── Step 6: Retire stale patterns ────────────────────────────────────────
  const retireBeforeDate = new Date();
  retireBeforeDate.setDate(retireBeforeDate.getDate() - PATTERN_THRESHOLDS.RETIRE_AFTER_DAYS);

  const { data: retired, error: retireError } = await supabase
    .from('hydra_correction_patterns')
    .update({ status: 'retired' })
    .lt('last_seen', retireBeforeDate.toISOString())
    .neq('status', 'retired')
    .select('id');

  if (retireError) {
    console.warn(`[CI-Engine] Retire step failed (non-fatal): ${retireError.message}`);
  }

  const retiredCount = retired?.length ?? 0;
  if (retiredCount > 0) {
    console.log(`[CI-Engine] 🗑️  Retired ${retiredCount} stale patterns`);
  }

  const result: AggregationResult = {
    processedCorrections: rows.length,
    upsertedPatterns: upsertPayloads.length,
    promoted,
    retired: retiredCount,
    durationMs: Date.now() - startTime,
  };

  console.log('[CI-Engine] ✅ Aggregation complete:', result);
  return result;
}

// ─── Type used internally ────────────────────────────────────────────────────
interface CorrectionField {
  field: string;
  from: string;
  to: string;
}