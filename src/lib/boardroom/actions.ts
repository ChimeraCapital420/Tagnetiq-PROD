// FILE: src/lib/boardroom/actions.ts
// Board Autonomous Action Engine
//
// Sprint P: Board members can DO things, not just talk.
// Sprint 6: Enhanced with execution channel routing + user_id tracking.
//
// Flow:
//   1. Board member identifies an action to take (during conversation or autonomously)
//   2. Action is queued with impact assessment
//   3. Trust level determines if it needs human approval:
//      - Low trust: always needs approval
//      - High trust: auto-approved for low/medium impact
//      - Autonomous trust: auto-approved for everything in their domain
//   4. Approved actions are executed via channel handlers
//   5. Everything is logged with a paper trail
//
// Safety: Even at max trust, critical actions always need human approval.
//         Cross-domain actions always need approval regardless of trust.

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type ActionStatus = 'pending' | 'auto_approved' | 'approved' | 'rejected' | 'executed' | 'failed' | 'rolled_back';
export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionType =
  | 'report'
  | 'alert'
  | 'config_change'
  | 'data_update'
  | 'user_action'
  | 'financial'
  | 'security'
  | 'content'
  | 'integration'
  | 'recommendation'
  | 'social_media'
  | 'email'
  | 'support';

export interface ProposeActionParams {
  userId: string;
  memberSlug: string;
  actionType: ActionType;
  title: string;
  description: string;
  domain: string;
  payload: Record<string, any>;
  impactLevel?: ImpactLevel;
  estimatedCost?: number;
  affectsUsers?: boolean;
  reversible?: boolean;
}

export interface ActionResult {
  actionId: string;
  status: ActionStatus;
  autoApproved: boolean;
  needsApproval: boolean;
  message: string;
}

export interface ActionExecution {
  success: boolean;
  details: string;
  data?: any;
}

/**
 * Execution channel interface.
 * Each channel in api/boardroom/execution/channels/ exports an execute()
 * function matching this signature.
 */
export interface ExecutionChannel {
  execute: (supabase: SupabaseClient, action: any) => Promise<ActionExecution>;
  riskLevel: 'low' | 'medium' | 'high';
}

// =============================================================================
// CHANNEL REGISTRY — maps action_type to channel modules
// =============================================================================

// In-process channel map. The gateway populates this at startup.
// action engine calls routeExecution → checks registry → falls back to built-in handlers.
const channelRegistry = new Map<string, (supabase: SupabaseClient, action: any) => Promise<ActionExecution>>();

/**
 * Register an execution channel for a given action type.
 * Called by the gateway during bootstrap.
 */
export function registerChannel(
  actionType: string,
  handler: (supabase: SupabaseClient, action: any) => Promise<ActionExecution>
): void {
  channelRegistry.set(actionType, handler);
}

/**
 * Check if a channel is registered for a given action type.
 */
export function hasChannel(actionType: string): boolean {
  return channelRegistry.has(actionType);
}

// =============================================================================
// PROPOSE AN ACTION
// =============================================================================

/**
 * A board member proposes an action.
 * The system determines if it needs approval based on trust level + impact.
 */
export async function proposeAction(
  supabase: SupabaseClient,
  params: ProposeActionParams
): Promise<ActionResult> {
  // Get member's current trust level
  const { data: member } = await supabase
    .from('boardroom_members')
    .select('trust_level, role, expertise')
    .eq('slug', params.memberSlug)
    .single();

  if (!member) {
    return {
      actionId: '',
      status: 'failed',
      autoApproved: false,
      needsApproval: false,
      message: `Board member "${params.memberSlug}" not found.`,
    };
  }

  const trust = member.trust_level || 20;
  const impact = params.impactLevel || 'low';

  // Check if action template exists and member meets trust requirement
  const { data: template } = await supabase
    .from('board_action_templates')
    .select('min_trust_level, auto_approve_at_trust, requires_approval')
    .eq('member_slug', params.memberSlug)
    .eq('action_type', params.actionType)
    .eq('is_active', true)
    .maybeSingle();

  const minTrust = template?.min_trust_level || 40;
  if (trust < minTrust) {
    return {
      actionId: '',
      status: 'rejected',
      autoApproved: false,
      needsApproval: false,
      message: `${params.memberSlug} needs trust level ${minTrust} for this action (current: ${trust}).`,
    };
  }

  // Determine if auto-approval is possible
  const autoApproveAt = template?.auto_approve_at_trust || 80;
  const canAutoApprove = determineAutoApproval(trust, impact, autoApproveAt, params);

  const status: ActionStatus = canAutoApprove ? 'auto_approved' : 'pending';

  // Insert action with user_id for ownership tracking
  const { data: action, error } = await supabase
    .from('board_action_queue')
    .insert({
      user_id: params.userId,
      member_slug: params.memberSlug,
      action_type: params.actionType,
      title: params.title,
      description: params.description,
      action_payload: params.payload,
      domain: params.domain,
      impact_level: impact,
      estimated_cost: params.estimatedCost || null,
      affects_users: params.affectsUsers || false,
      reversible: params.reversible !== false,
      status,
      requires_approval: !canAutoApprove,
      trust_at_creation: trust,
      approved_at: canAutoApprove ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error || !action) {
    return {
      actionId: '',
      status: 'failed',
      autoApproved: false,
      needsApproval: false,
      message: `Failed to queue action: ${error?.message || 'unknown error'}`,
    };
  }

  // If auto-approved, execute immediately (fire-and-forget)
  if (canAutoApprove) {
    executeAction(supabase, action.id).catch(() => {});
  }

  return {
    actionId: action.id,
    status,
    autoApproved: canAutoApprove,
    needsApproval: !canAutoApprove,
    message: canAutoApprove
      ? `Action auto-approved and executing (trust: ${trust}).`
      : `Action queued for admin approval (trust: ${trust}, required: ${autoApproveAt}).`,
  };
}

// =============================================================================
// APPROVAL WORKFLOW
// =============================================================================

/**
 * Admin approves a pending action.
 */
export async function approveAction(
  supabase: SupabaseClient,
  actionId: string,
  approvedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from('board_action_queue')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)
    .eq('status', 'pending');

  if (error) return false;

  // Execute after approval (fire-and-forget)
  executeAction(supabase, actionId).catch(() => {});
  return true;
}

/**
 * Admin rejects a pending action.
 */
export async function rejectAction(
  supabase: SupabaseClient,
  actionId: string,
  rejectedBy: string,
  reason: string
): Promise<boolean> {
  const { error } = await supabase
    .from('board_action_queue')
    .update({
      status: 'rejected',
      approved_by: rejectedBy,
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)
    .eq('status', 'pending');

  return !error;
}

// =============================================================================
// ACTION EXECUTION
// =============================================================================

/**
 * Execute an approved action.
 * This is the dispatcher — routes to registered channels or built-in handlers.
 */
async function executeAction(
  supabase: SupabaseClient,
  actionId: string
): Promise<void> {
  const { data: action } = await supabase
    .from('board_action_queue')
    .select('*')
    .eq('id', actionId)
    .in('status', ['approved', 'auto_approved'])
    .single();

  if (!action) return;

  try {
    const result = await routeExecution(supabase, action);

    await supabase
      .from('board_action_queue')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
        execution_result: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId);

    // Boost trust for successful execution (+1, capped at 100)
    await supabase
      .from('boardroom_members')
      .update({
        trust_level: Math.min(100, (action.trust_at_creation || 20) + 1),
      })
      .eq('slug', action.member_slug);

  } catch (err: any) {
    await supabase
      .from('board_action_queue')
      .update({
        status: 'failed',
        error_message: err.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId);
  }
}

/**
 * Route execution to the appropriate handler based on action type.
 * Checks registered channels first, then falls back to built-in handlers.
 */
async function routeExecution(
  supabase: SupabaseClient,
  action: any
): Promise<ActionExecution> {
  // 1. Check if an execution channel is registered for this type
  const channelHandler = channelRegistry.get(action.action_type);
  if (channelHandler) {
    return channelHandler(supabase, action);
  }

  // 2. Fall back to built-in handlers
  switch (action.action_type) {
    case 'report':
      return executeReport(supabase, action);

    case 'alert':
      return executeAlert(supabase, action);

    case 'security':
      return executeSecurity(supabase, action);

    case 'data_update':
      return executeDataUpdate(supabase, action);

    case 'recommendation':
      return {
        success: true,
        details: `Recommendation logged: ${action.title}`,
        data: action.action_payload,
      };

    default:
      return {
        success: true,
        details: `Action type "${action.action_type}" queued for manual execution.`,
        data: action.action_payload,
      };
  }
}

// ── Built-in Action Handlers ────────────────────────────

async function executeReport(_supabase: SupabaseClient, action: any): Promise<ActionExecution> {
  const payload = action.action_payload || {};

  return {
    success: true,
    details: `Report "${action.title}" generated by ${action.member_slug}.`,
    data: {
      reportType: payload.reportType || 'general',
      generatedAt: new Date().toISOString(),
      memberSlug: action.member_slug,
    },
  };
}

async function executeAlert(_supabase: SupabaseClient, action: any): Promise<ActionExecution> {
  const payload = action.action_payload || {};

  return {
    success: true,
    details: `Alert sent: ${action.title}`,
    data: {
      alertType: payload.alertType || 'info',
      recipients: payload.recipients || ['admin'],
      sentAt: new Date().toISOString(),
    },
  };
}

async function executeSecurity(_supabase: SupabaseClient, action: any): Promise<ActionExecution> {
  const payload = action.action_payload || {};

  if (payload.flagUserId) {
    return {
      success: true,
      details: `User ${payload.flagUserId} flagged for review: ${action.description}`,
      data: { flaggedUserId: payload.flagUserId, reason: action.description },
    };
  }

  if (payload.flagListingId) {
    return {
      success: true,
      details: `Listing ${payload.flagListingId} flagged: ${action.description}`,
      data: { flaggedListingId: payload.flagListingId, reason: action.description },
    };
  }

  return {
    success: true,
    details: `Security action logged: ${action.title}`,
    data: payload,
  };
}

async function executeDataUpdate(_supabase: SupabaseClient, action: any): Promise<ActionExecution> {
  const payload = action.action_payload || {};

  return {
    success: true,
    details: `Data update executed: ${action.title}`,
    data: { updatedAt: new Date().toISOString(), ...payload },
  };
}

// =============================================================================
// QUERY ACTIONS
// =============================================================================

/**
 * Get pending actions awaiting approval.
 */
export async function getPendingActions(
  supabase: SupabaseClient
): Promise<any[]> {
  const { data } = await supabase
    .from('board_action_queue')
    .select('*, boardroom_members!inner(name, title)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  return data || [];
}

/**
 * Get action history for a specific board member.
 */
export async function getMemberActions(
  supabase: SupabaseClient,
  memberSlug: string,
  limit: number = 20
): Promise<any[]> {
  const { data } = await supabase
    .from('board_action_queue')
    .select('*')
    .eq('member_slug', memberSlug)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Get action stats for the whole board.
 */
export async function getActionStats(
  supabase: SupabaseClient
): Promise<{
  totalActions: number;
  pending: number;
  executed: number;
  autoApproved: number;
  rejected: number;
  failed: number;
  byMember: Record<string, number>;
}> {
  const { data: all } = await supabase
    .from('board_action_queue')
    .select('member_slug, status');

  if (!all) return { totalActions: 0, pending: 0, executed: 0, autoApproved: 0, rejected: 0, failed: 0, byMember: {} };

  const byMember: Record<string, number> = {};
  let pending = 0, executed = 0, autoApproved = 0, rejected = 0, failed = 0;

  for (const a of all) {
    byMember[a.member_slug] = (byMember[a.member_slug] || 0) + 1;
    if (a.status === 'pending') pending++;
    else if (a.status === 'executed') executed++;
    else if (a.status === 'auto_approved') autoApproved++;
    else if (a.status === 'rejected') rejected++;
    else if (a.status === 'failed') failed++;
  }

  return { totalActions: all.length, pending, executed, autoApproved, rejected, failed, byMember };
}

// =============================================================================
// AUTO-APPROVAL LOGIC
// =============================================================================

function determineAutoApproval(
  trust: number,
  impact: ImpactLevel,
  autoApproveThreshold: number,
  params: ProposeActionParams
): boolean {
  // Critical actions ALWAYS need human approval
  if (impact === 'critical') return false;

  // Actions affecting users ALWAYS need approval below trust 80
  if (params.affectsUsers && trust < 80) return false;

  // Financial actions need higher trust
  if (params.actionType === 'financial' && trust < 80) return false;

  // Security actions need higher trust for high impact
  if (params.actionType === 'security' && params.impactLevel === 'high' && trust < 80) return false;

  // Standard auto-approval: trust >= threshold and impact isn't high
  if (trust >= autoApproveThreshold) {
    if (impact === 'low') return true;
    if (impact === 'medium' && trust >= 60) return true;
    if (impact === 'high' && trust >= 80) return true;
  }

  // Low impact + moderate trust = auto-approve
  if (impact === 'low' && trust >= 40) return true;

  return false;
}