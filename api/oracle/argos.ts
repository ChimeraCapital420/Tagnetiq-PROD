// FILE: api/oracle/argos.ts
// Argos Alerts API — fetch, manage, and trigger proactive alerts
//
// v2.0 — February 2026 — Full activation
//
// Endpoints (single handler, action-based):
//
//   ALERTS:
//     POST { action: 'scan' }                → Trigger vault scan, generate new alerts
//     POST { action: 'get' }                 → Fetch unread alerts
//     POST { action: 'get_all' }             → Fetch all alerts (including read)
//     POST { action: 'count' }               → Get unread count (for badge)
//     POST { action: 'read', ids: [...] }    → Mark alerts as read
//     POST { action: 'dismiss', ids: [...] } → Dismiss alerts
//
//   WATCHLIST:
//     POST { action: 'watch', itemName, category, estimatedValue } → Add to watchlist
//     POST { action: 'watchlist' }           → Get user's watchlist
//     POST { action: 'remove_watch', watchId } → Remove from watchlist
//
//   INVENTORY:
//     POST { action: 'inventory_summary' }   → Dashboard summary
//     POST { action: 'reorder_suggestions' } → Get reorder suggestions
//
//   SCHEDULES:
//     POST { action: 'schedules' }           → Get user's scan schedules
//     POST { action: 'update_schedule', scanType, frequency } → Update schedule
//
// All actions require authentication.
// Vault scan is gated to Elite tier (bypassed in beta mode).
// All other actions work for all tiers (read your own alerts).
//
// Mobile-First: Compact JSON responses. Badge count is a single integer.
// Device polls /count on app open, fetches full alerts only when viewed.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';
import { getUserTier } from '../../src/lib/oracle/tier.js';
import {
  scanVaultForAlerts,
  getAlerts,
  markAlertsRead,
  dismissAlerts,
  getUnreadCount,
} from '../../src/lib/oracle/argos/index.js';
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
} from '../../src/lib/oracle/argos/watchlist.js';
import {
  getReorderSuggestions,
  getInventorySummary,
  getScanSchedules,
  upsertScanSchedule,
} from '../../src/lib/oracle/argos/cron.js';
import type { ScanType, ScanFrequency } from '../../src/lib/oracle/argos/cron.js';

export const config = {
  maxDuration: 30,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Valid scan types and frequencies for schedule updates
const VALID_SCAN_TYPES: ScanType[] = ['vault_monitor', 'watchlist_check', 'inventory_check', 'full_sweep'];
const VALID_FREQUENCIES: ScanFrequency[] = ['hourly', 'every_6h', 'daily', 'weekly', 'manual'];

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ── Rate limit ──
  if (applyRateLimit(req, res, LIMITS.STANDARD)) return;

  try {
    const user = await verifyUser(req);
    const { action } = req.body;

    if (!action || typeof action !== 'string') {
      return res.status(400).json({ error: 'An "action" string is required.' });
    }

    switch (action) {

      // ═══════════════════════════════════════════════════════════
      // ALERTS
      // ═══════════════════════════════════════════════════════════

      // ── Trigger vault scan ──
      case 'scan': {
        // Scan is expensive — tighter rate limit
        if (applyRateLimit(req, res, LIMITS.EXPENSIVE)) return;

        const tierInfo = await getUserTier(supabaseAdmin, user.id);
        const result = await scanVaultForAlerts(supabaseAdmin, user.id, tierInfo.current);

        return res.status(200).json({
          success: true,
          ...result,
        });
      }

      // ── Fetch unread alerts ──
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

      // ── Fetch all alerts (including read) ──
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

      // ── Unread count (for badge) ──
      // Mobile-First: Single integer response, minimal payload
      case 'count': {
        const count = await getUnreadCount(supabaseAdmin, user.id);
        return res.status(200).json({ unreadCount: count });
      }

      // ── Mark as read ──
      case 'read': {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ error: '"ids" array is required.' });
        }
        await markAlertsRead(supabaseAdmin, user.id, ids);
        return res.status(200).json({ success: true, marked: ids.length });
      }

      // ── Dismiss ──
      case 'dismiss': {
        const { ids: dismissIds } = req.body;
        if (!Array.isArray(dismissIds) || dismissIds.length === 0) {
          return res.status(400).json({ error: '"ids" array is required.' });
        }
        await dismissAlerts(supabaseAdmin, user.id, dismissIds);
        return res.status(200).json({ success: true, dismissed: dismissIds.length });
      }

      // ═══════════════════════════════════════════════════════════
      // WATCHLIST
      // ═══════════════════════════════════════════════════════════

      // ── Add to watchlist ──
      // Called from AnalysisResult.tsx "Watch" button
      case 'watch': {
        const { itemName, category, estimatedValue, watchType, thresholdPct } = req.body;

        if (!itemName || typeof itemName !== 'string') {
          return res.status(400).json({ error: '"itemName" is required.' });
        }

        const result = await addToWatchlist(supabaseAdmin, user.id, {
          itemName: itemName.trim().slice(0, 300),
          category: category || undefined,
          watchType: watchType || 'price_any',
          thresholdPct: thresholdPct || 10,
          thresholdPrice: estimatedValue ? parseFloat(estimatedValue) : undefined,
        });

        if (!result) {
          return res.status(500).json({ error: 'Could not add to watchlist.' });
        }

        return res.status(200).json({
          success: true,
          watchId: result.id,
          isNew: result.isNew,
          message: result.isNew ? 'Added to watchlist' : 'Already watching this item',
        });
      }

      // ── Get watchlist ──
      case 'watchlist': {
        const { includeInactive, limit: wlLimit } = req.body;
        const watchlist = await getWatchlist(supabaseAdmin, user.id, {
          includeInactive: includeInactive || false,
          limit: wlLimit || 50,
        });

        return res.status(200).json({
          watchlist,
          count: watchlist.length,
        });
      }

      // ── Remove from watchlist ──
      case 'remove_watch': {
        const { watchId } = req.body;
        if (!watchId || typeof watchId !== 'string') {
          return res.status(400).json({ error: '"watchId" is required.' });
        }
        const removed = await removeFromWatchlist(supabaseAdmin, user.id, watchId);
        return res.status(200).json({ success: removed });
      }

      // ═══════════════════════════════════════════════════════════
      // INVENTORY
      // ═══════════════════════════════════════════════════════════

      // ── Inventory dashboard summary ──
      case 'inventory_summary': {
        const summary = await getInventorySummary(supabaseAdmin, user.id);
        return res.status(200).json(summary);
      }

      // ── Reorder suggestions ──
      case 'reorder_suggestions': {
        const suggestions = await getReorderSuggestions(supabaseAdmin, user.id);
        return res.status(200).json({
          suggestions,
          count: suggestions.length,
        });
      }

      // ═══════════════════════════════════════════════════════════
      // SCHEDULES
      // ═══════════════════════════════════════════════════════════

      // ── Get scan schedules ──
      case 'schedules': {
        const schedules = await getScanSchedules(supabaseAdmin, user.id);
        return res.status(200).json({
          schedules,
          count: schedules.length,
        });
      }

      // ── Update scan schedule ──
      case 'update_schedule': {
        const { scanType, frequency, vaultTypes } = req.body;

        if (!scanType || !VALID_SCAN_TYPES.includes(scanType)) {
          return res.status(400).json({
            error: `Invalid scanType. Valid: ${VALID_SCAN_TYPES.join(', ')}`,
          });
        }
        if (!frequency || !VALID_FREQUENCIES.includes(frequency)) {
          return res.status(400).json({
            error: `Invalid frequency. Valid: ${VALID_FREQUENCIES.join(', ')}`,
          });
        }

        const scheduleId = await upsertScanSchedule(
          supabaseAdmin,
          user.id,
          scanType,
          frequency,
          vaultTypes || ['resale']
        );

        return res.status(200).json({
          success: true,
          scheduleId,
        });
      }

      // ═══════════════════════════════════════════════════════════

      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid: scan, get, get_all, count, read, dismiss, watch, watchlist, remove_watch, inventory_summary, reorder_suggestions, schedules, update_schedule`,
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