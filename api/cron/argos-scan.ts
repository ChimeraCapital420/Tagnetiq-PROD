// FILE: api/cron/argos-scan.ts
// Argos Cron Endpoint — scheduled vault scanning + market intelligence
//
// v1.0 — February 2026
//
// Called by Vercel cron (vercel.json) every 6 hours.
// Finds all users with due scan schedules and runs them.
// Auth: cron_secret query parameter (matches CRON_SECRET env var).
//
// This is the heartbeat that keeps Argos alive when users aren't in the app.
// Without this endpoint, the Oracle promises intelligence it can't deliver.
//
// Mobile-First: All heavy lifting happens server-side on schedule.
// The user's device only polls for results — zero compute on their end.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { runDueScans } from '../../src/lib/oracle/argos/cron.js';

export const config = {
  maxDuration: 120, // 2 min — enough for batch HYDRA lookups
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Auth: cron secret (same pattern as /api/admin/kpis) ──
  const cronSecret = (req.query.cron_secret as string) || '';
  const expectedSecret = process.env.CRON_SECRET || '';

  if (!expectedSecret || cronSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── Optional: scan_type override for manual triggers ──
  const scanType = (req.query.scan_type as string) || undefined;

  const startTime = Date.now();

  try {
    console.log('🦅 Argos cron starting...');

    const result = await runDueScans(supabaseAdmin, {
      scanTypeFilter: scanType,
      maxUsersPerRun: 20,       // Cap to stay within timeout
      maxItemsPerUser: 8,       // HYDRA calls per user
    });

    const duration = Date.now() - startTime;

    console.log(`🦅 Argos cron complete: ${result.scansRun} scans, ${result.totalAlerts} alerts, ${result.errors} errors (${duration}ms)`);

    return res.status(200).json({
      success: true,
      scansRun: result.scansRun,
      totalAlerts: result.totalAlerts,
      totalPriceChecks: result.totalPriceChecks || 0,
      errors: result.errors,
      durationMs: duration,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('🦅 Argos cron failed:', error.message);

    return res.status(500).json({
      success: false,
      error: 'Argos cron encountered an error',
      durationMs: duration,
    });
  }
}