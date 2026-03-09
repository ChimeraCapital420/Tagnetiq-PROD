// ============================================================
// FILE:  api/cron/aggregate-corrections.ts
//        (folder: api/cron/ — create if it does not exist)
// ============================================================
// COLLECTIVE INTELLIGENCE ENGINE — Daily Aggregation Cron
// Codename: The Hive Mind
//
// Vercel Cron endpoint: /api/cron/aggregate-corrections
// Schedule: daily at 3:00 AM UTC (registered in vercel.json)
//
// v1.0: Aggregation job — processedCorrections, upsertedPatterns,
//       promoted, retired
//
// v1.1 CHANGES — Hardening Sprint #9:
//   - CI Pattern Cache Warming added AFTER aggregation completes.
//     Queries the top 10 most active categories from correction_patterns
//     and calls lookupPatterns() for each one. This pre-populates the
//     5-minute server-side cache on warm instances so the next scans
//     in those categories hit cache instead of DB.
//   - Fire-and-forget: cache warming failure never affects the aggregation
//     success response. If DB is unreachable for the warming query,
//     aggregation still reports success.
//   - CAUTION: This is a frozen file. The ONLY addition is the cache
//     warming call AFTER aggregation logic. Aggregation logic is untouched.
//
// Mobile-first note: pure server-side job.
// Zero impact on device performance or API response times.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { aggregatePatterns, lookupPatterns } from '../../src/lib/hydra/knowledge/index.js';

export const config = {
  maxDuration: 60,
};

// =============================================================================
// v1.1 HARDENING #9 — Cache warming helper
//
// After aggregation completes, pre-populate lookupPatterns() cache for the
// top 10 most active categories. This ensures cold serverless restarts don't
// hit the DB on the first scan of each category — they hit warm cache instead.
//
// Fire-and-forget: the caller catches all errors and logs them.
// =============================================================================

async function warmPatternCache(): Promise<{ warmed: number; categories: string[] }> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Query top 10 most active categories by occurrence count
  const { data, error } = await supabase
    .from('correction_patterns')
    .select('category')
    .order('occurrence_count', { ascending: false })
    .limit(50); // Fetch more to deduplicate

  if (error || !data || data.length === 0) {
    throw new Error(error?.message ?? 'No correction_patterns rows found');
  }

  // Deduplicate categories and take top 10
  const categories = [...new Set(data.map((r: any) => r.category as string))].slice(0, 10);

  // Call lookupPatterns() for each — this populates the in-process cache.
  // allSettled: one failure doesn't abort the rest.
  await Promise.allSettled(
    categories.map(category =>
      lookupPatterns(category).catch(err =>
        console.warn(`[CI-Engine] Cache warm failed for "${category}":`, err?.message)
      )
    )
  );

  return { warmed: categories.length, categories };
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const querySecret = req.query.cron_secret as string | undefined;
    const authHeader = req.headers['authorization'];
    const bearerSecret = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    const isAuthorized = querySecret === cronSecret || bearerSecret === cronSecret;

    if (!isAuthorized) {
      console.warn('[CI-Engine] Unauthorized cron attempt blocked');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('\n🔄 === COLLECTIVE INTELLIGENCE AGGREGATION JOB START ===');
  console.log(`⏰ Triggered at: ${new Date().toISOString()}`);
  console.log(`📡 Method: ${req.method}`);

  try {
    // ── FROZEN AGGREGATION LOGIC — DO NOT MODIFY ───────────────────────────
    const result = await aggregatePatterns();
    // ── END FROZEN SECTION ─────────────────────────────────────────────────

    console.log('✅ === AGGREGATION JOB COMPLETE ===');
    console.log(`📊 Corrections processed: ${result.processedCorrections}`);
    console.log(`🗂️  Patterns upserted:    ${result.upsertedPatterns}`);
    console.log(`⭐ Patterns promoted:     ${result.promoted}`);
    console.log(`🗑️  Patterns retired:     ${result.retired}`);
    console.log(`⏱️  Duration:             ${result.durationMs}ms`);

    // =========================================================================
    // v1.1 HARDENING #9 — Cache warming (appended AFTER aggregation)
    //
    // Aggregation is already complete and the response is ready to send.
    // Fire-and-forget: warmPatternCache() errors are caught and logged.
    // The success response is NOT conditional on cache warming succeeding.
    // =========================================================================
    warmPatternCache()
      .then(({ warmed, categories }) => {
        console.log(
          `[CI-Engine] 🔥 Cache warmed: ${warmed} categories — ${categories.join(', ')}`
        );
      })
      .catch(err => {
        // Non-fatal: cold starts will just hit DB on next request as normal
        console.warn('[CI-Engine] Cache warming failed (non-fatal):', err?.message ?? err);
      });
    // =========================================================================

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });

  } catch (error: any) {
    console.error('❌ Aggregation job failed:', error);

    return res.status(500).json({
      success: false,
      error: 'Aggregation failed',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}