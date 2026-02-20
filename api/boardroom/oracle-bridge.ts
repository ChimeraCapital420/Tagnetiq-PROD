// FILE: api/boardroom/oracle-bridge.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD ORACLE BRIDGE — User Data Pipeline API
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 8 Gap #3: Oracle User Data Pipeline
//
// This endpoint bridges the Oracle analytics pipeline to the Board.
// It serves pre-computed insights (from nightly cron) and live queries.
//
// CRON (nightly — add to vercel.json):
//   GET ?cron_secret=xxx
//   Computes yesterday's + today's board insights snapshot.
//   Runs after api/admin/kpis.ts cron (which computes analytics_daily).
//
// AUTHENTICATED (board members only):
//   POST { action: 'today' }        → Today's insights (live or cached)
//   POST { action: 'history', days } → Last N days of insights
//   POST { action: 'prompt' }        → Board-ready context block for prompts
//   POST { action: 'alerts' }        → Current alerts only
//   POST { action: 'summary' }       → Executive summary text only
//
// ARCHITECTURE:
//   analytics_events → analytics_daily → board_oracle_insights
//                       ↓                      ↓
//                  (raw events)         (board-digestible)
//                       ↓                      ↓
//                  tracker.ts          oracle-insights.ts
//                       ↓                      ↓
//                  admin/kpis.ts       THIS ENDPOINT
//
// The board never touches analytics_events directly. It consumes
// pre-aggregated, anonymized insights from board_oracle_insights.
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import {
  computeBoardInsights,
  persistBoardInsights,
  getRecentInsights,
  getTodayInsights,
  formatInsightsForPrompt,
} from '../../src/lib/boardroom/oracle-insights.js';

export const config = {
  maxDuration: 30,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ══════════════════════════════════════════════════════
  // CRON: Nightly insight computation
  // ══════════════════════════════════════════════════════
  if (req.method === 'GET') {
    const { cron_secret } = req.query;

    if (cron_secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Invalid cron secret.' });
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      // Also compute yesterday in case the daily analytics cron ran late
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // Compute both (upsert handles duplicates)
      const [yesterdayInsights, todayInsights] = await Promise.all([
        computeBoardInsights(supabaseAdmin, yesterday),
        computeBoardInsights(supabaseAdmin, today),
      ]);

      await Promise.all([
        persistBoardInsights(supabaseAdmin, yesterday, yesterdayInsights),
        persistBoardInsights(supabaseAdmin, today, todayInsights),
      ]);

      const alertCount = todayInsights.alerts.length;
      const criticalCount = todayInsights.alerts.filter(a => a.severity === 'critical').length;

      console.log(
        `[OracleBridge] Insights computed: ${today} (${alertCount} alerts, ${criticalCount} critical)`,
      );

      return res.status(200).json({
        success: true,
        computed: [yesterday, today],
        alertCount,
        criticalCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[OracleBridge] Cron error:', error.message);
      return res.status(500).json({ error: 'Insight computation failed.', details: error.message });
    }
  }

  // ══════════════════════════════════════════════════════
  // AUTHENTICATED: Board member queries
  // ══════════════════════════════════════════════════════
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);

    // Verify boardroom access
    const { data: accessRow } = await supabaseAdmin
      .from('boardroom_access')
      .select('access_level')
      .eq('user_id', user.id)
      .single();

    if (!accessRow) {
      return res.status(403).json({ error: 'Boardroom access required.' });
    }

    const { action } = req.body;

    switch (action) {
      // ── Today's full insights (live or cached) ────────
      case 'today': {
        const insights = await getTodayInsights(supabaseAdmin);
        return res.status(200).json({
          date: new Date().toISOString().split('T')[0],
          ...insights,
        });
      }

      // ── Historical insights for trend analysis ────────
      case 'history': {
        const { days = 7 } = req.body;
        const clampedDays = Math.min(Math.max(1, days), 90);
        const history = await getRecentInsights(supabaseAdmin, clampedDays);
        return res.status(200).json({
          data: history,
          days: clampedDays,
          count: history.length,
        });
      }

      // ── Board-ready prompt context block ──────────────
      // Returns formatted text that prompt-builder.ts can inject
      // directly into a board member's system prompt.
      case 'prompt': {
        const insights = await getTodayInsights(supabaseAdmin);
        const promptBlock = formatInsightsForPrompt(insights);
        return res.status(200).json({
          promptBlock,
          hasAlerts: insights.alerts.length > 0,
          alertCount: insights.alerts.length,
        });
      }

      // ── Alerts only ───────────────────────────────────
      case 'alerts': {
        const insights = await getTodayInsights(supabaseAdmin);
        return res.status(200).json({
          alerts: insights.alerts,
          critical: insights.alerts.filter(a => a.severity === 'critical'),
          warnings: insights.alerts.filter(a => a.severity === 'warning'),
          info: insights.alerts.filter(a => a.severity === 'info'),
        });
      }

      // ── Executive summary text only ───────────────────
      case 'summary': {
        const insights = await getTodayInsights(supabaseAdmin);
        return res.status(200).json({
          summary: insights.executiveSummary,
          alertCount: insights.alerts.length,
          date: new Date().toISOString().split('T')[0],
        });
      }

      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid: today, history, prompt, alerts, summary`,
        });
    }
  } catch (error: any) {
    const errMsg = error.message || 'Unexpected error.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('[OracleBridge] Error:', errMsg);
    return res.status(500).json({ error: 'Oracle bridge unavailable.' });
  }
}