// FILE: api/oracle/argos.ts
// Argos Alerts API — fetch, manage, and trigger proactive alerts
//
// Sprint G: Proactive Argos Alerts
//
// Endpoints (single handler, action-based):
//   POST { action: 'scan' }                → Trigger vault scan, generate new alerts
//   POST { action: 'get' }                 → Fetch unread alerts
//   POST { action: 'get_all' }             → Fetch all alerts (including read)
//   POST { action: 'count' }               → Get unread count (for badge)
//   POST { action: 'read', ids: [...] }    → Mark alerts as read
//   POST { action: 'dismiss', ids: [...] } → Dismiss alerts
//
// All actions require authentication.
// Vault scan is gated to Elite tier (bypassed in beta mode).
// All other actions work for all tiers (read your own alerts).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import { getUserTier } from '../../src/lib/oracle/tier.js';
import {
  scanVaultForAlerts,
  getAlerts,
  markAlertsRead,
  dismissAlerts,
  getUnreadCount,
} from '../../src/lib/oracle/argos/index.js';

export const config = {
  maxDuration: 30,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { action } = req.body;

    if (!action || typeof action !== 'string') {
      return res.status(400).json({ error: 'An "action" string is required.' });
    }

    switch (action) {
      // ── Trigger vault scan ──────────────────────────────
      case 'scan': {
        const tierInfo = await getUserTier(supabaseAdmin, user.id);
        const result = await scanVaultForAlerts(supabaseAdmin, user.id, tierInfo.current);

        return res.status(200).json({
          success: true,
          ...result,
        });
      }

      // ── Fetch unread alerts ─────────────────────────────
      case 'get': {
        const { limit, alertType } = req.body;
        const alerts = await getAlerts(supabaseAdmin, user.id, {
          includeRead: false,
          limit: limit || 20,
          alertType,
        });

        return res.status(200).json({
          alerts,
          count: alerts.length,
        });
      }

      // ── Fetch all alerts (including read) ───────────────
      case 'get_all': {
        const { limit: allLimit } = req.body;
        const allAlerts = await getAlerts(supabaseAdmin, user.id, {
          includeRead: true,
          limit: allLimit || 50,
        });

        return res.status(200).json({
          alerts: allAlerts,
          count: allAlerts.length,
        });
      }

      // ── Unread count (for badge) ────────────────────────
      case 'count': {
        const count = await getUnreadCount(supabaseAdmin, user.id);
        return res.status(200).json({ unreadCount: count });
      }

      // ── Mark as read ────────────────────────────────────
      case 'read': {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ error: '"ids" array is required.' });
        }
        await markAlertsRead(supabaseAdmin, user.id, ids);
        return res.status(200).json({ success: true, marked: ids.length });
      }

      // ── Dismiss ─────────────────────────────────────────
      case 'dismiss': {
        const { ids: dismissIds } = req.body;
        if (!Array.isArray(dismissIds) || dismissIds.length === 0) {
          return res.status(400).json({ error: '"ids" array is required.' });
        }
        await dismissAlerts(supabaseAdmin, user.id, dismissIds);
        return res.status(200).json({ success: true, dismissed: dismissIds.length });
      }

      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid: scan, get, get_all, count, read, dismiss`,
        });
    }

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Argos API error:', errMsg);
    return res.status(500).json({ error: 'Argos is recalibrating. Try again.' });
  }
}