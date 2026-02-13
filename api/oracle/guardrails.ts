// FILE: api/oracle/guardrails.ts
// Autonomy Guardrails API
//
// Sprint Q: User-controlled AI safety
//
// AUTHENTICATED:
//   POST { action: 'settings' }                    → Get autonomy settings
//   POST { action: 'update_settings', ... }        → Update settings
//   POST { action: 'kill_switch', reason }          → EMERGENCY: stop everything
//   POST { action: 'deactivate_kill_switch' }       → Re-enable (doesn't auto-enable autonomy)
//   POST { action: 'confirm', ledgerId }            → Confirm a pending action
//   POST { action: 'cancel', ledgerId }             → Cancel a pending action
//   POST { action: 'pending' }                      → List pending actions
//   POST { action: 'ledger', limit? }               → View action history
//   POST { action: 'hard_limits' }                  → View system hard limits
//   POST { action: 'authorize_supplier', name, maxPerOrder, maxSpend }
//   POST { action: 'remove_supplier', name }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import {
  HARD_LIMITS,
  getAutonomySettings,
  updateAutonomySettings,
  activateKillSwitch,
  deactivateKillSwitch,
  confirmAction,
  cancelAction,
  getPendingActions,
  getLedger,
} from '../../src/lib/oracle/safety/guardrails.js';

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

    if (!action) {
      return res.status(400).json({ error: 'An "action" is required.' });
    }

    switch (action) {
      // ── Get autonomy settings ─────────────────────────
      case 'settings': {
        const settings = await getAutonomySettings(supabaseAdmin, user.id);
        return res.status(200).json({ settings, hardLimits: HARD_LIMITS });
      }

      // ── Update settings ───────────────────────────────
      case 'update_settings': {
        const allowed = [
          'autonomy_enabled', 'sandbox_mode',
          'max_spend_per_action', 'max_spend_per_day', 'max_spend_per_month',
          'can_reorder_inventory', 'can_draft_listings', 'can_adjust_prices',
          'can_send_notifications', 'can_modify_watchlist',
          'reversal_window_minutes', 'confirmation_method',
        ];

        const updates: Record<string, any> = {};
        for (const key of allowed) {
          if (key in req.body) updates[key] = req.body[key];
        }

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No valid settings provided.' });
        }

        const result = await updateAutonomySettings(supabaseAdmin, user.id, updates);
        return res.status(200).json(result);
      }

      // ── KILL SWITCH ───────────────────────────────────
      case 'kill_switch': {
        const { reason = 'User activated kill switch' } = req.body;
        await activateKillSwitch(supabaseAdmin, user.id, reason);
        return res.status(200).json({
          success: true,
          message: 'Kill switch activated. ALL autonomous actions stopped immediately.',
        });
      }

      // ── Deactivate kill switch ────────────────────────
      case 'deactivate_kill_switch': {
        await deactivateKillSwitch(supabaseAdmin, user.id);
        return res.status(200).json({
          success: true,
          message: 'Kill switch deactivated. Autonomy remains disabled until you re-enable it.',
        });
      }

      // ── Confirm pending action ────────────────────────
      case 'confirm': {
        const { ledgerId } = req.body;
        if (!ledgerId) return res.status(400).json({ error: '"ledgerId" required.' });

        const result = await confirmAction(supabaseAdmin, user.id, ledgerId);
        return res.status(result.success ? 200 : 400).json(result);
      }

      // ── Cancel pending action ─────────────────────────
      case 'cancel': {
        const { ledgerId: cancelId } = req.body;
        if (!cancelId) return res.status(400).json({ error: '"ledgerId" required.' });

        const result = await cancelAction(supabaseAdmin, user.id, cancelId);
        return res.status(200).json(result);
      }

      // ── List pending actions ──────────────────────────
      case 'pending': {
        const pending = await getPendingActions(supabaseAdmin, user.id);
        return res.status(200).json({ actions: pending, count: pending.length });
      }

      // ── View ledger ───────────────────────────────────
      case 'ledger': {
        const { limit = 50 } = req.body;
        const ledger = await getLedger(supabaseAdmin, user.id, limit);
        return res.status(200).json({ ledger, count: ledger.length });
      }

      // ── View hard limits ──────────────────────────────
      case 'hard_limits': {
        return res.status(200).json({
          hardLimits: HARD_LIMITS,
          message: 'These limits are enforced in code and cannot be overridden.',
        });
      }

      // ── Authorize a supplier ──────────────────────────
      case 'authorize_supplier': {
        const { name, maxPerOrder, maxSpend } = req.body;
        if (!name) return res.status(400).json({ error: '"name" is required.' });

        const settings = await getAutonomySettings(supabaseAdmin, user.id);
        const suppliers = [...(settings.authorized_suppliers || [])];

        // Remove if exists (update)
        const filtered = suppliers.filter((s: any) => s.name?.toLowerCase() !== name.toLowerCase());
        filtered.push({ name, maxPerOrder: maxPerOrder || null, maxSpend: maxSpend || null });

        await updateAutonomySettings(supabaseAdmin, user.id, { authorized_suppliers: filtered } as any);
        return res.status(200).json({ success: true, suppliers: filtered });
      }

      // ── Remove a supplier ─────────────────────────────
      case 'remove_supplier': {
        const { name: removeName } = req.body;
        if (!removeName) return res.status(400).json({ error: '"name" is required.' });

        const currentSettings = await getAutonomySettings(supabaseAdmin, user.id);
        const remaining = (currentSettings.authorized_suppliers || [])
          .filter((s: any) => s.name?.toLowerCase() !== removeName.toLowerCase());

        await updateAutonomySettings(supabaseAdmin, user.id, { authorized_suppliers: remaining } as any);
        return res.status(200).json({ success: true, suppliers: remaining });
      }

      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid: settings, update_settings, kill_switch, deactivate_kill_switch, confirm, cancel, pending, ledger, hard_limits, authorize_supplier, remove_supplier`,
        });
    }

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Guardrails API error:', errMsg);
    return res.status(500).json({ error: errMsg });
  }
}