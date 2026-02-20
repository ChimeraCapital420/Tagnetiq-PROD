// FILE: api/boardroom/execution/gateway.ts
// Execution Gateway — Trust-gated action router with guardrails
//
// Sprint 6: The board earns the right to act through demonstrated competence.
//
// This is the SINGLE ENTRY POINT for all board member execution requests.
// Every action flows: Member → Gateway → Guardrails → Channel or Approval Queue.
//
// Endpoints:
//   POST /api/boardroom/execution/gateway
//     body.action = 'execute'  — member requests an action (runs checkGuardrails)
//     body.action = 'queue'    — founder views pending approvals (mobile-optimized)
//     body.action = 'approve'  — founder approves a pending action
//     body.action = 'reject'   — founder rejects with feedback
//     body.action = 'settings' — get/update autonomy settings
//     body.action = 'kill'     — activate kill switch (instant)
//     body.action = 'unkill'   — deactivate kill switch
//
// Mobile-first: approval queue is compact, swipeable, push-notification ready.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../../_lib/security.js';
import { getSupaAdmin } from '../lib/provider-caller.js';
import { getTrustTier } from '../../../src/lib/boardroom/evolution.js';
import {
  proposeAction,
  approveAction,
  rejectAction,
  getPendingActions,
  getActionStats,
  registerChannel,
  type ActionType,
  type ImpactLevel,
  type ActionExecution,
} from '../../../src/lib/boardroom/actions.js';
import {
  checkGuardrails,
  proposeAutonomousAction,
  confirmAction,
  cancelAction,
  activateKillSwitch,
  deactivateKillSwitch,
  getAutonomySettings,
  updateAutonomySettings,
  processExpiredConfirmations,
  type ProposedAction,
  type AutonomyAction,
} from '../../../src/lib/oracle/safety/guardrails.js';

// ── Channel imports ─────────────────────────────────────
import { execute as executeSocialMedia } from './channels/social-media.js';
import { execute as executeEmail } from './channels/email.js';
import { execute as executeSupport } from './channels/support.js';
import { execute as executeReporting } from './channels/reporting.js';
import { execute as executeAlerts } from './channels/alerts.js';

export const config = {
  maxDuration: 25,
};

// =============================================================================
// BOOTSTRAP — Register execution channels on cold start
// =============================================================================

let channelsRegistered = false;

function bootstrapChannels(): void {
  if (channelsRegistered) return;

  registerChannel('social_media', executeSocialMedia);
  registerChannel('email', executeEmail);
  registerChannel('support', executeSupport);
  registerChannel('reporting', executeReporting);
  registerChannel('alerts', executeAlerts);

  channelsRegistered = true;
}

// =============================================================================
// TRUST → RISK MAPPING
// =============================================================================

/** Minimum trust level required for each risk tier */
const RISK_TRUST_MAP: Record<string, number> = {
  low: 30,      // reporting, alerts — always safe
  medium: 50,   // support responses, email drafts
  high: 75,     // social media publishing, email sends
};

/** Action type → risk level */
const ACTION_RISK: Record<string, string> = {
  report: 'low',
  alert: 'low',
  reporting: 'low',
  alerts: 'low',
  recommendation: 'low',
  support: 'medium',
  email: 'medium',
  content: 'medium',
  data_update: 'medium',
  social_media: 'high',
  security: 'high',
  config_change: 'high',
  financial: 'high',
  integration: 'medium',
};

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  bootstrapChannels();

  const supabase = getSupaAdmin();

  try {
    const user = await verifyUser(req);

    // Verify boardroom access
    const { data: access } = await supabase
      .from('boardroom_access')
      .select('access_level')
      .eq('user_id', user.id)
      .single();

    if (!access) {
      return res.status(403).json({ error: 'Boardroom access required.' });
    }

    const { action } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'An "action" is required.' });
    }

    switch (action) {
      // ── Execute: member requests an action ────────────
      case 'execute': {
        return handleExecute(req, res, supabase, user);
      }

      // ── Queue: founder views pending approvals ────────
      case 'queue': {
        return handleQueue(res, supabase, user);
      }

      // ── Approve: founder approves pending action ──────
      case 'approve': {
        return handleApprove(req, res, supabase, user);
      }

      // ── Reject: founder rejects with feedback ─────────
      case 'reject': {
        return handleReject(req, res, supabase, user);
      }

      // ── Confirm: user confirms autonomy ledger entry ──
      case 'confirm': {
        const { ledgerId } = req.body;
        if (!ledgerId) return res.status(400).json({ error: '"ledgerId" required.' });
        const result = await confirmAction(supabase, user.id, ledgerId);
        return res.status(result.success ? 200 : 400).json(result);
      }

      // ── Cancel: user cancels pending autonomy action ──
      case 'cancel': {
        const { ledgerId: cancelId } = req.body;
        if (!cancelId) return res.status(400).json({ error: '"ledgerId" required.' });
        const result = await cancelAction(supabase, user.id, cancelId);
        return res.status(result.success ? 200 : 400).json(result);
      }

      // ── Settings: get/update autonomy settings ────────
      case 'settings': {
        return handleSettings(req, res, supabase, user);
      }

      // ── Kill switch: instant stop ─────────────────────
      case 'kill': {
        const { reason } = req.body;
        const killed = await activateKillSwitch(supabase, user.id, reason || 'Manual kill switch');
        return res.status(200).json({
          success: killed,
          message: killed ? 'Kill switch activated. All autonomy stopped.' : 'Failed to activate kill switch.',
        });
      }

      // ── Unkill: deactivate kill switch ────────────────
      case 'unkill': {
        const unkilled = await deactivateKillSwitch(supabase, user.id);
        return res.status(200).json({
          success: unkilled,
          message: unkilled
            ? 'Kill switch deactivated. Re-enable autonomy in settings.'
            : 'Failed to deactivate kill switch.',
        });
      }

      // ── Expire: process timed-out confirmations ───────
      case 'expire': {
        if (access.access_level !== 'admin') {
          return res.status(403).json({ error: 'Admin only.' });
        }
        const expired = await processExpiredConfirmations(supabase);
        return res.status(200).json({ expired, message: `${expired} expired actions cancelled.` });
      }

      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid: execute, queue, approve, reject, confirm, cancel, settings, kill, unkill, expire`,
        });
    }

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Execution gateway error:', errMsg);
    return res.status(500).json({ error: errMsg });
  }
}

// =============================================================================
// EXECUTE — The main flow
// =============================================================================

async function handleExecute(
  req: VercelRequest,
  res: VercelResponse,
  supabase: any,
  user: any
): Promise<void> {
  const {
    memberSlug, actionType, title, description, domain,
    payload, impactLevel, estimatedCost, affectsUsers, reversible,
  } = req.body;

  if (!memberSlug || !actionType || !title || !description) {
    res.status(400).json({
      error: '"memberSlug", "actionType", "title", and "description" are required.',
    });
    return;
  }

  // 1. Get member's trust level
  const { data: member } = await supabase
    .from('boardroom_members')
    .select('trust_level, slug, name, role')
    .eq('slug', memberSlug)
    .single();

  if (!member) {
    res.status(404).json({ error: `Board member "${memberSlug}" not found.` });
    return;
  }

  const trustLevel = member.trust_level || 20;
  const trustTier = getTrustTier(trustLevel);
  const riskLevel = ACTION_RISK[actionType] || 'medium';
  const minTrust = RISK_TRUST_MAP[riskLevel] || 50;

  // 2. Trust gate: member must have sufficient trust for this risk level
  if (trustLevel < minTrust) {
    res.status(403).json({
      error: `${member.name} needs trust level ${minTrust} for ${riskLevel}-risk actions (current: ${trustLevel}).`,
      trustLevel,
      trustTier,
      required: minTrust,
      riskLevel,
    });
    return;
  }

  // 3. Run autonomy guardrails (financial + safety checks)
  const guardrailAction: ProposedAction = {
    userId: user.id,
    actionType: mapToAutonomyAction(actionType),
    description: `${title}: ${description}`,
    payload: payload || {},
    initiatedBy: 'board_member',
    initiatorDetail: memberSlug,
    financialAmount: estimatedCost || undefined,
  };

  const guardrailCheck = await checkGuardrails(supabase, guardrailAction);

  if (!guardrailCheck.allowed) {
    // Log the blocked attempt to autonomy ledger
    await proposeAutonomousAction(supabase, guardrailAction);

    res.status(403).json({
      blocked: true,
      reason: guardrailCheck.reason,
      blockedBy: guardrailCheck.blockedBy,
      member: memberSlug,
      trustLevel,
    });
    return;
  }

  // 4. Propose the action (trust-gated auto-approval logic)
  const result = await proposeAction(supabase, {
    userId: user.id,
    memberSlug,
    actionType: actionType as ActionType,
    title,
    description,
    domain: domain || member.role || 'general',
    payload: payload || {},
    impactLevel: impactLevel as ImpactLevel,
    estimatedCost,
    affectsUsers,
    reversible,
  });

  // 5. If guardrails require confirmation, log to autonomy ledger too
  if (guardrailCheck.requiresConfirmation && estimatedCost && estimatedCost > 0) {
    await proposeAutonomousAction(supabase, guardrailAction);
  }

  // 6. Mobile-optimized response
  res.status(result.status === 'failed' ? 500 : 200).json({
    ...result,
    member: memberSlug,
    memberName: member.name,
    trustLevel,
    trustTier,
    riskLevel,
    guardrailCheck: {
      allowed: guardrailCheck.allowed,
      isSandbox: guardrailCheck.isSandbox,
      requiresConfirmation: guardrailCheck.requiresConfirmation,
      spendCapRemaining: guardrailCheck.spendCapRemaining,
    },
  });
}

// =============================================================================
// QUEUE — Founder approval queue (mobile-optimized)
// =============================================================================

async function handleQueue(
  res: VercelResponse,
  supabase: any,
  _user: any
): Promise<void> {
  const pending = await getPendingActions(supabase);
  const stats = await getActionStats(supabase);

  // Mobile-first: compact cards with swipe actions
  const queue = pending.map((a: any) => ({
    id: a.id,
    member: a.member_slug,
    memberName: a.boardroom_members?.name || a.member_slug,
    memberTitle: a.boardroom_members?.title || '',
    type: a.action_type,
    title: a.title,
    description: a.description,
    impact: a.impact_level,
    cost: a.estimated_cost,
    affectsUsers: a.affects_users,
    reversible: a.reversible,
    trust: a.trust_at_creation,
    createdAt: a.created_at,
  }));

  res.status(200).json({
    queue,
    count: queue.length,
    stats: {
      total: stats.totalActions,
      pending: stats.pending,
      executed: stats.executed,
      rejected: stats.rejected,
    },
  });
}

// =============================================================================
// APPROVE / REJECT
// =============================================================================

async function handleApprove(
  req: VercelRequest,
  res: VercelResponse,
  supabase: any,
  user: any
): Promise<void> {
  const { actionId } = req.body;
  if (!actionId) {
    res.status(400).json({ error: '"actionId" required.' });
    return;
  }

  const success = await approveAction(supabase, actionId, user.id);
  res.status(200).json({
    success,
    message: success ? 'Action approved and executing.' : 'Failed to approve (may not be pending).',
  });
}

async function handleReject(
  req: VercelRequest,
  res: VercelResponse,
  supabase: any,
  user: any
): Promise<void> {
  const { actionId, reason } = req.body;
  if (!actionId) {
    res.status(400).json({ error: '"actionId" required.' });
    return;
  }

  const success = await rejectAction(supabase, actionId, user.id, reason || 'No reason provided.');
  res.status(200).json({
    success,
    message: success ? 'Action rejected.' : 'Failed to reject (may not be pending).',
  });
}

// =============================================================================
// SETTINGS — Get or update autonomy settings
// =============================================================================

async function handleSettings(
  req: VercelRequest,
  res: VercelResponse,
  supabase: any,
  user: any
): Promise<void> {
  const { updates } = req.body;

  if (updates && typeof updates === 'object') {
    const result = await updateAutonomySettings(supabase, user.id, updates);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
  }

  const settings = await getAutonomySettings(supabase, user.id);
  res.status(200).json({ settings });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map board action types to autonomy action types for guardrail checks.
 * The guardrails system has a narrower set of action types.
 */
function mapToAutonomyAction(actionType: string): AutonomyAction {
  const map: Record<string, AutonomyAction> = {
    report: 'report_generate',
    reporting: 'report_generate',
    alert: 'alert_create',
    alerts: 'alert_create',
    content: 'listing_draft',
    social_media: 'notification_send',
    email: 'notification_send',
    support: 'notification_send',
    data_update: 'price_adjustment',
    config_change: 'price_adjustment',
    recommendation: 'report_generate',
    integration: 'report_generate',
    security: 'report_generate',
    financial: 'inventory_reorder',
  };

  return map[actionType] || 'report_generate';
}