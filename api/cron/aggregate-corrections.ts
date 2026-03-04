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
// Auth: matches all other TagnetIQ crons — query param pattern:
//   /api/cron/aggregate-corrections?cron_secret=YOUR_CRON_SECRET_HERE
//
// Manual admin trigger (same URL, POST or GET):
//   curl -X POST "https://tagnetiq.com/api/cron/aggregate-corrections?cron_secret=<secret>"
//
// Mobile-first note: pure server-side job.
// Zero impact on device performance or API response times.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { aggregatePatterns } from '../../src/lib/hydra/knowledge/index.js';

export const config = {
  maxDuration: 60, // Aggregation may take time with large correction volumes
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Auth check ──────────────────────────────────────────────────────────────
  // Matches the pattern used by every other cron in this project:
  //   ?cron_secret=YOUR_CRON_SECRET_HERE
  // Also accepts Authorization: Bearer <secret> for direct admin curl calls.
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

  // ── Method check ────────────────────────────────────────────────────────────
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('\n🔄 === COLLECTIVE INTELLIGENCE AGGREGATION JOB START ===');
  console.log(`⏰ Triggered at: ${new Date().toISOString()}`);
  console.log(`📡 Method: ${req.method}`);

  try {
    const result = await aggregatePatterns();

    console.log('✅ === AGGREGATION JOB COMPLETE ===');
    console.log(`📊 Corrections processed: ${result.processedCorrections}`);
    console.log(`🗂️  Patterns upserted:    ${result.upsertedPatterns}`);
    console.log(`⭐ Patterns promoted:     ${result.promoted}`);
    console.log(`🗑️  Patterns retired:     ${result.retired}`);
    console.log(`⏱️  Duration:             ${result.durationMs}ms`);

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