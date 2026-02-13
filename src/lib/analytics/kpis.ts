// FILE: api/admin/kpis.ts
// KPI Dashboard API — live anonymous metrics
//
// Sprint E+: Every data point, zero PII
//
// CRON (daily snapshot):
//   GET ?cron_secret=xxx              → Compute daily snapshot + funnel
//
// AUTHENTICATED (admin only):
//   POST { action: 'live' }           → Real-time KPIs (DAU, scans, chats, errors)
//   POST { action: 'daily', days? }   → Historical daily snapshots (charts)
//   POST { action: 'funnel' }         → Current conversion funnel
//   POST { action: 'features', days? } → Feature usage breakdown
//   POST { action: 'health' }          → System health overview
//   POST { action: 'track', events[] } → Server-side event tracking (batch)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import {
  getLiveKPIs,
  getDailyKPIs,
  getFunnel,
  getFeatureUsage,
  computeDailySnapshot,
  computeFunnelSnapshot,
  trackBatch,
  type TrackEvent,
} from '../../src/lib/analytics/tracker.js';

export const config = {
  maxDuration: 30,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CRON: Daily snapshot computation ──────────────────
  if (req.method === 'GET') {
    const { cron_secret } = req.query;

    if (cron_secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Invalid cron secret.' });
    }

    const today = new Date().toISOString().split('T')[0];

    await computeDailySnapshot(supabaseAdmin, today);
    await computeFunnelSnapshot(supabaseAdmin, today);

    return res.status(200).json({
      success: true,
      snapshotDate: today,
      timestamp: new Date().toISOString(),
    });
  }

  // ── AUTHENTICATED: Admin endpoints ────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { action } = req.body;

    // Track endpoint doesn't require admin (any authenticated user can track)
    if (action === 'track') {
      const { events } = req.body;
      if (!events || !Array.isArray(events)) {
        return res.status(400).json({ error: '"events" array required.' });
      }

      const trackEvents: TrackEvent[] = events.map((e: any) => ({
        userId: user.id,
        event: e.event,
        category: e.category || 'feature',
        properties: e.properties || {},
        platform: e.platform,
      }));

      await trackBatch(supabaseAdmin, trackEvents);
      return res.status(200).json({ success: true, tracked: trackEvents.length });
    }

    // All other endpoints require admin
    const { data: access } = await supabaseAdmin
      .from('boardroom_access')
      .select('access_level')
      .eq('user_id', user.id)
      .single();

    if (!access || access.access_level !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    switch (action) {
      // ── Live KPIs (real-time) ─────────────────────────
      case 'live': {
        const kpis = await getLiveKPIs(supabaseAdmin);
        return res.status(200).json(kpis);
      }

      // ── Historical daily data ─────────────────────────
      case 'daily': {
        const { days = 30 } = req.body;
        const daily = await getDailyKPIs(supabaseAdmin, days);
        return res.status(200).json({ data: daily, days });
      }

      // ── Conversion funnel ─────────────────────────────
      case 'funnel': {
        const funnel = await getFunnel(supabaseAdmin);
        return res.status(200).json({ funnel });
      }

      // ── Feature usage ─────────────────────────────────
      case 'features': {
        const { days: featureDays = 7 } = req.body;
        const features = await getFeatureUsage(supabaseAdmin, featureDays);
        return res.status(200).json({ features, days: featureDays });
      }

      // ── System health ─────────────────────────────────
      case 'health': {
        const live = await getLiveKPIs(supabaseAdmin);
        const daily = await getDailyKPIs(supabaseAdmin, 7);
        const funnel = await getFunnel(supabaseAdmin);

        // Compute trends
        const yesterday = daily.length > 1 ? daily[daily.length - 2] : null;
        const today = daily.length > 0 ? daily[daily.length - 1] : null;

        return res.status(200).json({
          live,
          trends: {
            dauChange: yesterday && today ? today.dau - yesterday.dau : 0,
            scanChange: yesterday && today ? today.total_scans - yesterday.total_scans : 0,
            errorChange: yesterday && today ? today.error_count - yesterday.error_count : 0,
          },
          funnel,
          weekSummary: daily.slice(-7),
        });
      }

      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid: live, daily, funnel, features, health, track`,
        });
    }

  } catch (error: any) {
    const errMsg = error.message || 'Unexpected error.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('KPI API error:', errMsg);
    return res.status(500).json({ error: errMsg });
  }
}