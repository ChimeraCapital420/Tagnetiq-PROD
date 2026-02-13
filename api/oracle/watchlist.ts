// FILE: api/oracle/watchlist.ts
// Watchlist Management API
//
// Sprint J: Users configure what Argos monitors
//
// Endpoints (action-based):
//   POST { action: 'add', itemName, watchType, ... }   → Add to watchlist
//   POST { action: 'remove', watchId }                 → Deactivate watch
//   POST { action: 'delete', watchId }                 → Permanently delete
//   POST { action: 'list' }                            → Get active watchlist
//   POST { action: 'list_all' }                        → Get all (including inactive)
//   POST { action: 'update', watchId, ... }            → Update watch conditions
//   POST { action: 'auto_populate' }                   → Auto-add top vault items
//   POST { action: 'summary' }                         → Compact summary for UI badges

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import {
  addToWatchlist,
  removeFromWatchlist,
  deleteFromWatchlist,
  getWatchlist,
  updateWatch,
  autoPopulateWatchlist,
  getWatchlistSummary,
} from '../../src/lib/oracle/argos/watchlist.js';

export const config = {
  maxDuration: 15,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      // ── Add to watchlist ────────────────────────────────
      case 'add': {
        const { itemName, vaultItemId, category, searchQuery, watchType, thresholdPct, thresholdPrice } = req.body;

        if (!itemName || typeof itemName !== 'string') {
          return res.status(400).json({ error: '"itemName" is required.' });
        }

        const validTypes = ['price_drop', 'price_spike', 'price_any', 'new_listing', 'category_trend'];
        const type = validTypes.includes(watchType) ? watchType : 'price_any';

        const result = await addToWatchlist(supabaseAdmin, user.id, {
          itemName,
          vaultItemId,
          category,
          searchQuery,
          watchType: type,
          thresholdPct: thresholdPct || 10,
          thresholdPrice,
        });

        if (!result) {
          return res.status(500).json({ error: 'Failed to add to watchlist.' });
        }

        return res.status(200).json({
          success: true,
          watchId: result.id,
          isNew: result.isNew,
          message: result.isNew
            ? `Now watching "${itemName}" for ${type.replace('_', ' ')} alerts.`
            : `Already watching "${itemName}" — kept existing watch.`,
        });
      }

      // ── Remove (deactivate) ─────────────────────────────
      case 'remove': {
        const { watchId } = req.body;
        if (!watchId) return res.status(400).json({ error: '"watchId" is required.' });

        const success = await removeFromWatchlist(supabaseAdmin, user.id, watchId);
        return res.status(200).json({ success });
      }

      // ── Permanently delete ──────────────────────────────
      case 'delete': {
        const { watchId: deleteId } = req.body;
        if (!deleteId) return res.status(400).json({ error: '"watchId" is required.' });

        const success = await deleteFromWatchlist(supabaseAdmin, user.id, deleteId);
        return res.status(200).json({ success });
      }

      // ── List active watchlist ───────────────────────────
      case 'list': {
        const { limit } = req.body;
        const items = await getWatchlist(supabaseAdmin, user.id, { limit });
        return res.status(200).json({ watchlist: items, count: items.length });
      }

      // ── List all (including inactive) ───────────────────
      case 'list_all': {
        const { limit: allLimit } = req.body;
        const allItems = await getWatchlist(supabaseAdmin, user.id, {
          includeInactive: true,
          limit: allLimit,
        });
        return res.status(200).json({ watchlist: allItems, count: allItems.length });
      }

      // ── Update watch conditions ─────────────────────────
      case 'update': {
        const { watchId: updateId, watchType: newType, thresholdPct: newPct, thresholdPrice: newPrice, searchQuery: newQuery, isActive } = req.body;

        if (!updateId) return res.status(400).json({ error: '"watchId" is required.' });

        const updates: Record<string, any> = {};
        if (newType) updates.watch_type = newType;
        if (newPct !== undefined) updates.threshold_pct = newPct;
        if (newPrice !== undefined) updates.threshold_price = newPrice;
        if (newQuery !== undefined) updates.search_query = newQuery;
        if (isActive !== undefined) updates.is_active = isActive;

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No update fields provided.' });
        }

        const success = await updateWatch(supabaseAdmin, user.id, updateId, updates);
        return res.status(200).json({ success });
      }

      // ── Auto-populate from vault ────────────────────────
      case 'auto_populate': {
        const { maxItems } = req.body;
        const added = await autoPopulateWatchlist(supabaseAdmin, user.id, maxItems || 10);
        return res.status(200).json({
          success: true,
          itemsAdded: added,
          message: added > 0
            ? `Argos is now watching your top ${added} vault items.`
            : 'All your top vault items are already being watched.',
        });
      }

      // ── Compact summary (for UI badges) ─────────────────
      case 'summary': {
        const summary = await getWatchlistSummary(supabaseAdmin, user.id);
        return res.status(200).json(summary);
      }

      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid: add, remove, delete, list, list_all, update, auto_populate, summary`,
        });
    }

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Watchlist API error:', errMsg);
    return res.status(500).json({ error: 'Watchlist hiccup. Try again.' });
  }
}