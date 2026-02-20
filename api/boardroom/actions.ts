// FILE: api/boardroom/actions.ts
// Board Autonomous Actions API
//
// Sprint P: Board members can DO things, not just talk.
// Sprint 6: Uses getSupaAdmin(), adds user_id to action proposals.
//
// AUTHENTICATED (admin only):
//   POST { action: 'propose', memberSlug, actionType, title, description, domain, payload }
//   POST { action: 'approve', actionId }
//   POST { action: 'reject', actionId, reason }
//   POST { action: 'pending' }                 → List pending actions
//   POST { action: 'history', memberSlug? }     → Action history
//   POST { action: 'stats' }                    → Board action stats
//   POST { action: 'templates', memberSlug? }   → Available action templates

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';
import { getSupaAdmin } from './lib/provider-caller.js';
import {
  proposeAction,
  approveAction,
  rejectAction,
  getPendingActions,
  getMemberActions,
  getActionStats,
  type ActionType,
  type ImpactLevel,
} from '../../src/lib/boardroom/actions.js';

export const config = {
  maxDuration: 15,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabase = getSupaAdmin();

  try {
    const user = await verifyUser(req);

    // Verify admin access
    const { data: access } = await supabase
      .from('boardroom_access')
      .select('access_level')
      .eq('user_id', user.id)
      .single();

    if (!access || access.access_level !== 'admin') {
      return res.status(403).json({ error: 'Admin access required for board actions.' });
    }

    const { action } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'An "action" is required.' });
    }

    switch (action) {
      // ── Propose an action ─────────────────────────────
      case 'propose': {
        const {
          memberSlug, actionType, title, description, domain,
          payload, impactLevel, estimatedCost, affectsUsers, reversible,
        } = req.body;

        if (!memberSlug || !actionType || !title || !description || !domain) {
          return res.status(400).json({
            error: '"memberSlug", "actionType", "title", "description", and "domain" are required.',
          });
        }

        const result = await proposeAction(supabase, {
          userId: user.id,
          memberSlug,
          actionType: actionType as ActionType,
          title,
          description,
          domain,
          payload: payload || {},
          impactLevel: impactLevel as ImpactLevel,
          estimatedCost,
          affectsUsers,
          reversible,
        });

        const statusCode = result.status === 'failed' || result.status === 'rejected' ? 400 : 200;
        return res.status(statusCode).json(result);
      }

      // ── Approve a pending action ──────────────────────
      case 'approve': {
        const { actionId } = req.body;
        if (!actionId) {
          return res.status(400).json({ error: '"actionId" is required.' });
        }

        const success = await approveAction(supabase, actionId, user.id);
        return res.status(200).json({
          success,
          message: success ? 'Action approved and executing.' : 'Failed to approve (may not be pending).',
        });
      }

      // ── Reject a pending action ───────────────────────
      case 'reject': {
        const { actionId: rejectId, reason } = req.body;
        if (!rejectId) {
          return res.status(400).json({ error: '"actionId" is required.' });
        }

        const success = await rejectAction(supabase, rejectId, user.id, reason || 'No reason provided.');
        return res.status(200).json({
          success,
          message: success ? 'Action rejected.' : 'Failed to reject (may not be pending).',
        });
      }

      // ── List pending actions ──────────────────────────
      case 'pending': {
        const pending = await getPendingActions(supabase);
        return res.status(200).json({ actions: pending, count: pending.length });
      }

      // ── Action history ────────────────────────────────
      case 'history': {
        const { memberSlug: historySlug, limit = 20 } = req.body;

        if (historySlug) {
          const history = await getMemberActions(supabase, historySlug, limit);
          return res.status(200).json({ actions: history, member: historySlug });
        }

        // All members
        const { data: all } = await supabase
          .from('board_action_queue')
          .select('*, boardroom_members!inner(name, title)')
          .order('created_at', { ascending: false })
          .limit(limit);

        return res.status(200).json({ actions: all || [] });
      }

      // ── Action stats ──────────────────────────────────
      case 'stats': {
        const stats = await getActionStats(supabase);
        return res.status(200).json(stats);
      }

      // ── Available templates ───────────────────────────
      case 'templates': {
        const { memberSlug: templateSlug } = req.body;

        let query = supabase
          .from('board_action_templates')
          .select('*, boardroom_members!inner(name, title, trust_level)')
          .eq('is_active', true);

        if (templateSlug) {
          query = query.eq('member_slug', templateSlug);
        }

        const { data: templates } = await query.order('member_slug');

        return res.status(200).json({ templates: templates || [] });
      }

      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid: propose, approve, reject, pending, history, stats, templates`,
        });
    }

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Board actions error:', errMsg);
    return res.status(500).json({ error: errMsg });
  }
}