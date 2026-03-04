/**
 * COLLECTIVE INTELLIGENCE ENGINE — Layer 3: Pattern Lookup
 * Codename: The Hive Mind
 *
 * lookupPatterns(category) — queries confirmed patterns for a given category,
 * then formats them as a CollectiveKnowledgeBlock ready to inject into HYDRA prompts.
 *
 * Performance:
 *   - Query: <5ms (small table, indexed on category + status)
 *   - In-memory cache: warm serverless instances reuse the result
 *   - Graceful degradation: if DB is down, scan proceeds without knowledge
 *
 * Mobile-first note: this adds ~200-500 tokens to AI prompts (server-side only).
 * The device sends the scan request; the server enriches the prompt transparently.
 * Zero extra round-trips to the device.
 */

import { createClient } from '@supabase/supabase-js';
import type { PatternRow, CollectiveKnowledgeBlock, KnowledgeItem } from './types.js';

// ─── Supabase Client ──────────────────────────────────────────────────────────

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
// Warm serverless instances cache patterns for 5 minutes.
// Cold starts re-fetch from DB — still <5ms.

interface CacheEntry {
  block: CollectiveKnowledgeBlock | null;
  expiresAt: number;
}

const patternCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(category: string): CollectiveKnowledgeBlock | null | undefined {
  const entry = patternCache.get(category.toLowerCase());
  if (!entry) return undefined; // cache miss
  if (Date.now() > entry.expiresAt) {
    patternCache.delete(category.toLowerCase());
    return undefined; // expired
  }
  return entry.block; // null = "no patterns for this category" (still valid cache)
}

function setCache(category: string, block: CollectiveKnowledgeBlock | null): void {
  patternCache.set(category.toLowerCase(), {
    block,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ─── Pattern → KnowledgeItem ──────────────────────────────────────────────────

function toKnowledgeItem(pattern: PatternRow): KnowledgeItem {
  return {
    patternType: pattern.pattern_type,
    category: pattern.category,
    wrongValue: pattern.wrong_value,
    correctValue: pattern.correct_value,
    affectedField: pattern.affected_field,
    confidence: pattern.confidence ?? 0.8,
    occurrenceCount: pattern.occurrence_count,
    distinguishingFeatures: pattern.distinguishing_features ?? null,
    providerErrorRates: pattern.provider_error_rates as Record<string, number> | null,
  };
}

// ─── Knowledge Block Formatter ────────────────────────────────────────────────

/**
 * Formats confirmed patterns as the === COLLECTIVE KNOWLEDGE === block
 * that gets appended to every AI provider's system prompt.
 *
 * Format mirrors the spec in the build handoff document exactly.
 */
function buildKnowledgeBlock(items: KnowledgeItem[], category: string): CollectiveKnowledgeBlock {
  const lines: string[] = [
    '=== COLLECTIVE KNOWLEDGE (verified corrections) ===',
    'The following patterns have been confirmed by multiple independent verifications:',
    '',
  ];

  items.forEach((item, i) => {
    const num = i + 1;
    const confidencePct = Math.round(item.confidence * 100);
    const typeLabel = item.patternType.replace(/_/g, ' ').toUpperCase();

    lines.push(
      `${num}. ${typeLabel}: In '${item.category}' category, items identified as '${item.wrongValue}' are frequently the correct item '${item.correctValue}'. Affected field: ${item.affectedField}.`
    );

    if (item.distinguishingFeatures) {
      lines.push(`   Distinguishing feature: ${item.distinguishingFeatures}`);
    }

    // Highlight the worst-offending providers so the best one leads
    if (item.providerErrorRates) {
      const sorted = Object.entries(item.providerErrorRates)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2);
      if (sorted.length > 0 && sorted[0][1] > 0.5) {
        const providerNote = sorted
          .map(([p, r]) => `${p} ${Math.round(r * 100)}% error rate`)
          .join(', ');
        lines.push(`   Note: ${providerNote} on this pattern.`);
      }
    }

    lines.push(
      `   Confidence: ${confidencePct}% (${item.occurrenceCount} verified corrections)`
    );
    lines.push('');
  });

  lines.push(
    'Use alongside your own analysis. If your identification conflicts with a high-confidence pattern, explain your reasoning.'
  );
  lines.push('=== END COLLECTIVE KNOWLEDGE ===');

  return {
    promptText: lines.join('\n'),
    items,
    assembledAt: new Date().toISOString(),
  };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * lookupPatterns(category)
 *
 * Queries hydra_correction_patterns WHERE category = category AND status = 'confirmed'.
 * Formats results as a CollectiveKnowledgeBlock for prompt injection.
 *
 * Returns null if:
 * - No confirmed patterns exist for this category (scan proceeds normally)
 * - DB query fails (graceful degradation — scan proceeds normally)
 *
 * Example usage in api/analyze.ts:
 *
 *   const collectiveKnowledge = await lookupPatterns(categoryResult.category)
 *     .catch(err => { console.warn('[CI-Engine] Pattern lookup failed:', err); return null; });
 *
 *   const consensus = await runConsensus(itemName, imageBase64, {
 *     category: categoryResult.category,
 *     collectiveKnowledge,   // ← pass through to prompt builder
 *   });
 */
export async function lookupPatterns(
  category: string
): Promise<CollectiveKnowledgeBlock | null> {
  const categoryNorm = (category ?? '').toLowerCase().trim();
  if (!categoryNorm) return null;

  // ── Cache check ─────────────────────────────────────────────────────────────
  const cached = getCached(categoryNorm);
  if (cached !== undefined) {
    if (cached) {
      console.log(
        `[CI-Engine] 📚 Cache hit: ${cached.items.length} patterns for '${categoryNorm}'`
      );
    }
    return cached;
  }

  // ── DB query ─────────────────────────────────────────────────────────────────
  const supabase = getSupabaseClient();
  const queryStart = Date.now();

  const { data, error } = await supabase
    .from('hydra_correction_patterns')
    .select(
      'pattern_type, category, wrong_value, correct_value, affected_field, occurrence_count, confidence, distinguishing_features, provider_error_rates'
    )
    .eq('category', categoryNorm)
    .eq('status', 'confirmed')
    .order('confidence', { ascending: false })
    .limit(10); // Cap at 10 patterns to keep prompts lean

  const queryMs = Date.now() - queryStart;

  if (error) {
    console.warn(`[CI-Engine] Pattern lookup DB error for '${categoryNorm}': ${error.message}`);
    // Don't cache errors — let next call retry
    return null;
  }

  console.log(
    `[CI-Engine] 🔍 Pattern lookup for '${categoryNorm}': ${data?.length ?? 0} confirmed patterns (${queryMs}ms)`
  );

  if (!data || data.length === 0) {
    setCache(categoryNorm, null);
    return null;
  }

  const items = (data as PatternRow[]).map(toKnowledgeItem);
  const block = buildKnowledgeBlock(items, categoryNorm);

  setCache(categoryNorm, block);

  return block;
}

/**
 * lookupPatternsForMultipleCategories(categories)
 *
 * Convenience: fetches patterns for an array of categories in parallel.
 * Useful when category detection returns multiple candidates.
 * Returns the block with the most patterns, or null.
 */
export async function lookupPatternsForMultipleCategories(
  categories: string[]
): Promise<CollectiveKnowledgeBlock | null> {
  if (!categories || categories.length === 0) return null;

  const results = await Promise.allSettled(categories.map(lookupPatterns));

  // Pick the richest block (most items)
  let best: CollectiveKnowledgeBlock | null = null;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      if (!best || result.value.items.length > best.items.length) {
        best = result.value;
      }
    }
  }

  return best;
}