// FILE: src/lib/oracle/safety/guardrails.ts
// Autonomy Safety Guardrails
//
// Sprint Q: The rules that cannot be broken.
//
// HARD LIMITS (hardcoded, not configurable, not overridable):
//   1. AI NEVER sells without explicit user confirmation
//   2. AI NEVER spends above caps without confirmation
//   3. AI NEVER deletes user data
//   4. AI NEVER contacts external parties without consent
//   5. AI NEVER modifies payment/billing
//   6. Silence = CANCEL (not confirm)
//   7. Kill switch is instant
//
// SOFT LIMITS (user-configurable):
//   - Spend caps per action/day/month
//   - Which actions are allowed
//   - Reversal window duration
//   - Pre-authorized suppliers and items
//   - Sandbox vs live mode
//
// PHILOSOPHY:
//   AI proposes, human disposes.
//   Trust is earned through a paper trail of good recommendations.
//   Real execution is opt-in, bounded, and reversible.

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// HARD LIMITS — these exist in code, not just the database
// No function in this system can bypass these.
// =============================================================================

export const HARD_LIMITS = {
  /** AI can NEVER list or sell a user's item without explicit confirmation */
  NO_SELL_WITHOUT_CONFIRMATION: true,

  /** AI can NEVER delete user vault items, conversations, or account data */
  NO_DELETE_USER_DATA: true,

  /** AI can NEVER contact external parties without user consent */
  NO_EXTERNAL_CONTACT: true,

  /** AI can NEVER modify payment methods, subscriptions, or billing */
  NO_PAYMENT_MODIFICATION: true,

  /** AI can NEVER delete or deactivate a user account */
  NO_ACCOUNT_DELETION: true,

  /** Maximum single autonomous transaction (USD) */
  MAX_SINGLE_TRANSACTION: 500.00,

  /** Maximum autonomous spend per user per day (USD) */
  MAX_DAILY_SPEND: 200.00,

  /** Maximum autonomous spend per user per month (USD) */
  MAX_MONTHLY_SPEND: 2000.00,

  /** Minimum reversal window (minutes) — user can set higher, never lower */
  MIN_REVERSAL_WINDOW: 5,

  /** Silence = CANCEL. If user doesn't confirm, action is cancelled. */
  SILENCE_EQUALS_CANCEL: true,

  /** All new autonomous features start in sandbox mode */
  SANDBOX_FIRST: true,

  /** Kill switch deactivates ALL autonomy immediately */
  KILL_SWITCH_INSTANT: true,
} as const;

// =============================================================================
// TYPES
// =============================================================================

export type AutonomyAction =
  | 'inventory_reorder'
  | 'price_adjustment'
  | 'listing_draft'
  | 'watchlist_modify'
  | 'notification_send'
  | 'report_generate'
  | 'alert_create';

export type LedgerStatus =
  | 'proposed'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'auto_approved'
  | 'executing'
  | 'executed'
  | 'cancelled_by_user'
  | 'cancelled_timeout'
  | 'rejected'
  | 'failed'
  | 'rolled_back'
  | 'blocked_by_guardrail';

export interface GuardrailCheck {
  allowed: boolean;
  reason: string;
  blockedBy?: string;
  requiresConfirmation: boolean;
  isSandbox: boolean;
  spendCapRemaining?: number;
}

export interface AutonomySettings {
  autonomy_enabled: boolean;
  sandbox_mode: boolean;
  max_spend_per_action: number;
  max_spend_per_day: number;
  max_spend_per_month: number;
  spent_today: number;
  spent_this_month: number;
  can_reorder_inventory: boolean;
  can_draft_listings: boolean;
  can_adjust_prices: boolean;
  can_send_notifications: boolean;
  can_modify_watchlist: boolean;
  reversal_window_minutes: number;
  confirmation_method: string;
  authorized_suppliers: any[];
  authorized_items: any[];
  kill_switch_activated: boolean;
}

export interface ProposedAction {
  userId: string;
  actionType: AutonomyAction;
  description: string;
  payload: Record<string, any>;
  initiatedBy: 'oracle' | 'board_member' | 'cron' | 'system';
  initiatorDetail?: string;
  financialAmount?: number;
  targetItemId?: string;
  supplierName?: string;
}

// =============================================================================
// GUARDRAIL CHECK — call this BEFORE any autonomous action
// =============================================================================

/**
 * Check if an autonomous action is allowed.
 * This is the single gate that ALL autonomous actions must pass through.
 * If this returns allowed: false, the action DOES NOT HAPPEN. Period.
 */
export async function checkGuardrails(
  supabase: SupabaseClient,
  action: ProposedAction
): Promise<GuardrailCheck> {

  // ── HARD LIMIT: Absolute prohibitions ─────────────────
  if (isAbsolutelyProhibited(action)) {
    return {
      allowed: false,
      reason: getProhibitionReason(action),
      blockedBy: 'hard_limit',
      requiresConfirmation: false,
      isSandbox: false,
    };
  }

  // ── Get user's autonomy settings ──────────────────────
  const settings = await getAutonomySettings(supabase, action.userId);

  // ── KILL SWITCH ───────────────────────────────────────
  if (settings.kill_switch_activated) {
    return {
      allowed: false,
      reason: 'Kill switch is activated. All autonomy is disabled.',
      blockedBy: 'kill_switch',
      requiresConfirmation: false,
      isSandbox: false,
    };
  }

  // ── AUTONOMY DISABLED ────────────────────────────────
  if (!settings.autonomy_enabled) {
    return {
      allowed: false,
      reason: 'Autonomy is not enabled. User must opt in.',
      blockedBy: 'autonomy_disabled',
      requiresConfirmation: false,
      isSandbox: false,
    };
  }

  // ── ACTION PERMISSION CHECK ──────────────────────────
  if (!isActionPermitted(action.actionType, settings)) {
    return {
      allowed: false,
      reason: `User has not enabled "${action.actionType}" for autonomous execution.`,
      blockedBy: 'action_not_permitted',
      requiresConfirmation: false,
      isSandbox: settings.sandbox_mode,
    };
  }

  // ── FINANCIAL CHECKS ─────────────────────────────────
  if (action.financialAmount && action.financialAmount > 0) {
    const spendCheck = checkSpendLimits(action.financialAmount, settings);
    if (!spendCheck.allowed) {
      return {
        ...spendCheck,
        isSandbox: settings.sandbox_mode,
      };
    }
  }

  // ── SUPPLIER AUTHORIZATION (for reorders) ────────────
  if (action.actionType === 'inventory_reorder' && action.supplierName) {
    const supplierCheck = checkSupplierAuthorization(action, settings);
    if (!supplierCheck.allowed) {
      return {
        ...supplierCheck,
        isSandbox: settings.sandbox_mode,
      };
    }
  }

  // ── ITEM AUTHORIZATION (for reorders) ────────────────
  if (action.actionType === 'inventory_reorder' && action.targetItemId) {
    const itemCheck = checkItemAuthorization(action, settings);
    if (!itemCheck.allowed) {
      return {
        ...itemCheck,
        isSandbox: settings.sandbox_mode,
      };
    }
  }

  // ── PASSED ALL CHECKS ────────────────────────────────
  const needsConfirmation = action.financialAmount
    ? action.financialAmount > 0  // Any spend requires confirmation
    : false;

  return {
    allowed: true,
    reason: settings.sandbox_mode
      ? 'Allowed (SANDBOX MODE — will simulate, not execute)'
      : 'Allowed within user-defined bounds',
    requiresConfirmation: needsConfirmation,
    isSandbox: settings.sandbox_mode,
    spendCapRemaining: settings.max_spend_per_day - settings.spent_today,
  };
}

// =============================================================================
// PROPOSE + LOG — create a ledger entry for any autonomous action
// =============================================================================

/**
 * Propose an autonomous action. Runs guardrail checks, logs to ledger,
 * and returns the action ID for tracking.
 *
 * This does NOT execute the action. It proposes it.
 */
export async function proposeAutonomousAction(
  supabase: SupabaseClient,
  action: ProposedAction
): Promise<{
  ledgerId: string | null;
  allowed: boolean;
  status: LedgerStatus;
  reason: string;
  isSandbox: boolean;
  reversalDeadline?: string;
}> {
  // Run guardrail check
  const check = await checkGuardrails(supabase, action);

  // Determine status
  let status: LedgerStatus;
  if (!check.allowed) {
    status = 'blocked_by_guardrail';
  } else if (check.isSandbox) {
    status = 'proposed'; // Sandbox = log but don't execute
  } else if (check.requiresConfirmation) {
    status = 'awaiting_confirmation';
  } else {
    status = 'auto_approved'; // Low-risk, within bounds
  }

  // Calculate reversal deadline
  const settings = await getAutonomySettings(supabase, action.userId);
  const reversalMinutes = Math.max(settings.reversal_window_minutes, HARD_LIMITS.MIN_REVERSAL_WINDOW);
  const confirmationDeadline = status === 'awaiting_confirmation'
    ? new Date(Date.now() + reversalMinutes * 60 * 1000).toISOString()
    : null;

  // Log to ledger (always, even if blocked)
  const { data: entry } = await supabase
    .from('autonomy_ledger')
    .insert({
      user_id: action.userId,
      action_type: action.actionType,
      action_description: action.description,
      action_payload: action.payload,
      initiated_by: action.initiatedBy,
      initiator_detail: action.initiatorDetail || null,
      financial_amount: action.financialAmount || null,
      is_sandbox: check.isSandbox,
      sandbox_result: check.isSandbox ? { simulated: true, wouldHave: action.description } : null,
      status,
      confirmation_sent_at: status === 'awaiting_confirmation' ? new Date().toISOString() : null,
      confirmation_deadline: confirmationDeadline,
      blocked_by: check.blockedBy || null,
      block_reason: !check.allowed ? check.reason : null,
    })
    .select('id')
    .single();

  return {
    ledgerId: entry?.id || null,
    allowed: check.allowed,
    status,
    reason: check.reason,
    isSandbox: check.isSandbox,
    reversalDeadline: confirmationDeadline || undefined,
  };
}

// =============================================================================
// USER CONFIRMATION / CANCELLATION
// =============================================================================

/**
 * User confirms a pending autonomous action.
 */
export async function confirmAction(
  supabase: SupabaseClient,
  userId: string,
  ledgerId: string
): Promise<{ success: boolean; message: string }> {
  const { data: entry } = await supabase
    .from('autonomy_ledger')
    .select('status, confirmation_deadline, financial_amount')
    .eq('id', ledgerId)
    .eq('user_id', userId)
    .single();

  if (!entry) return { success: false, message: 'Action not found.' };

  if (entry.status !== 'awaiting_confirmation') {
    return { success: false, message: `Action is "${entry.status}", not awaiting confirmation.` };
  }

  // Check if deadline has passed (silence = cancel)
  if (entry.confirmation_deadline && new Date(entry.confirmation_deadline) < new Date()) {
    await supabase
      .from('autonomy_ledger')
      .update({ status: 'cancelled_timeout', cancelled_at: new Date().toISOString() })
      .eq('id', ledgerId);
    return { success: false, message: 'Confirmation window expired. Action cancelled.' };
  }

  await supabase
    .from('autonomy_ledger')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', ledgerId);

  // Update spend tracking if financial
  if (entry.financial_amount && entry.financial_amount > 0) {
    await updateSpendTracking(supabase, userId, entry.financial_amount);
  }

  return { success: true, message: 'Action confirmed.' };
}

/**
 * User cancels a pending autonomous action.
 */
export async function cancelAction(
  supabase: SupabaseClient,
  userId: string,
  ledgerId: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from('autonomy_ledger')
    .update({ status: 'cancelled_by_user', cancelled_at: new Date().toISOString() })
    .eq('id', ledgerId)
    .eq('user_id', userId)
    .in('status', ['proposed', 'awaiting_confirmation', 'auto_approved']);

  return {
    success: !error,
    message: error ? 'Failed to cancel.' : 'Action cancelled.',
  };
}

/**
 * Process expired confirmations. Run periodically.
 * Silence = CANCEL. This is a hard limit.
 */
export async function processExpiredConfirmations(
  supabase: SupabaseClient
): Promise<number> {
  const { data: expired } = await supabase
    .from('autonomy_ledger')
    .update({
      status: 'cancelled_timeout',
      cancelled_at: new Date().toISOString(),
    })
    .eq('status', 'awaiting_confirmation')
    .lt('confirmation_deadline', new Date().toISOString())
    .select('id');

  return expired?.length || 0;
}

// =============================================================================
// KILL SWITCH
// =============================================================================

/**
 * Activate the kill switch. Immediately stops ALL autonomous actions.
 * This is instant. No delay. No confirmation. No reversal window.
 */
export async function activateKillSwitch(
  supabase: SupabaseClient,
  userId: string,
  reason: string
): Promise<boolean> {
  // 1. Activate kill switch
  await supabase
    .from('user_autonomy_settings')
    .upsert({
      user_id: userId,
      autonomy_enabled: false,
      kill_switch_activated: true,
      kill_switch_at: new Date().toISOString(),
      kill_switch_reason: reason,
    }, { onConflict: 'user_id' });

  // 2. Cancel ALL pending/awaiting actions
  await supabase
    .from('autonomy_ledger')
    .update({
      status: 'cancelled_by_user',
      cancelled_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .in('status', ['proposed', 'awaiting_confirmation', 'auto_approved', 'executing']);

  return true;
}

/**
 * Deactivate the kill switch. Re-enables autonomy settings.
 * Does NOT automatically re-enable autonomy — user must do that separately.
 */
export async function deactivateKillSwitch(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_autonomy_settings')
    .update({
      kill_switch_activated: false,
      // Note: autonomy_enabled stays false. User must re-enable manually.
    })
    .eq('user_id', userId);

  return !error;
}

// =============================================================================
// SETTINGS MANAGEMENT
// =============================================================================

/**
 * Get or create autonomy settings for a user.
 */
export async function getAutonomySettings(
  supabase: SupabaseClient,
  userId: string
): Promise<AutonomySettings> {
  const { data: existing } = await supabase
    .from('user_autonomy_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    // Reset daily/monthly spend if date has changed
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    if (existing.spend_reset_daily !== today) {
      existing.spent_today = 0;
      existing.spend_reset_daily = today;
    }
    if (existing.spend_reset_monthly?.substring(0, 7) !== thisMonth) {
      existing.spent_this_month = 0;
      existing.spend_reset_monthly = today;
    }

    return existing as AutonomySettings;
  }

  // Create default settings (everything off)
  const { data: created } = await supabase
    .from('user_autonomy_settings')
    .insert({ user_id: userId })
    .select('*')
    .single();

  return (created as AutonomySettings) || {
    autonomy_enabled: false,
    sandbox_mode: true,
    max_spend_per_action: 0,
    max_spend_per_day: 0,
    max_spend_per_month: 0,
    spent_today: 0,
    spent_this_month: 0,
    can_reorder_inventory: false,
    can_draft_listings: false,
    can_adjust_prices: false,
    can_send_notifications: true,
    can_modify_watchlist: true,
    reversal_window_minutes: 15,
    confirmation_method: 'push',
    authorized_suppliers: [],
    authorized_items: [],
    kill_switch_activated: false,
  };
}

/**
 * Update autonomy settings. Validates against hard limits.
 */
export async function updateAutonomySettings(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<AutonomySettings>
): Promise<{ success: boolean; message: string }> {
  // Enforce hard limits on spend caps
  if (updates.max_spend_per_action !== undefined) {
    updates.max_spend_per_action = Math.min(updates.max_spend_per_action, HARD_LIMITS.MAX_SINGLE_TRANSACTION);
  }
  if (updates.max_spend_per_day !== undefined) {
    updates.max_spend_per_day = Math.min(updates.max_spend_per_day, HARD_LIMITS.MAX_DAILY_SPEND);
  }
  if (updates.max_spend_per_month !== undefined) {
    updates.max_spend_per_month = Math.min(updates.max_spend_per_month, HARD_LIMITS.MAX_MONTHLY_SPEND);
  }

  // Enforce minimum reversal window
  if (updates.reversal_window_minutes !== undefined) {
    updates.reversal_window_minutes = Math.max(updates.reversal_window_minutes, HARD_LIMITS.MIN_REVERSAL_WINDOW);
  }

  await getAutonomySettings(supabase, userId); // Ensure exists

  const { error } = await supabase
    .from('user_autonomy_settings')
    .update(updates)
    .eq('user_id', userId);

  return {
    success: !error,
    message: error ? `Failed: ${error.message}` : 'Settings updated.',
  };
}

// =============================================================================
// LEDGER QUERIES
// =============================================================================

/**
 * Get the autonomy ledger for a user.
 */
export async function getLedger(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50
): Promise<any[]> {
  const { data } = await supabase
    .from('autonomy_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Get pending actions awaiting user confirmation.
 */
export async function getPendingActions(
  supabase: SupabaseClient,
  userId: string
): Promise<any[]> {
  const { data } = await supabase
    .from('autonomy_ledger')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'awaiting_confirmation')
    .order('created_at', { ascending: false });

  return data || [];
}

// =============================================================================
// INTERNAL — hard limit enforcement
// =============================================================================

function isAbsolutelyProhibited(action: ProposedAction): boolean {
  // These actions are NEVER allowed autonomously, regardless of settings
  const prohibitedPatterns = [
    /sell|list.*item|publish.*listing/i,
    /delete.*vault|remove.*vault|clear.*vault/i,
    /delete.*account|deactivate.*account/i,
    /contact.*supplier|email.*buyer|message.*seller/i,
    /change.*payment|modify.*billing|update.*card/i,
    /cancel.*subscription|upgrade.*plan/i,
  ];

  const desc = `${action.actionType} ${action.description}`;
  return prohibitedPatterns.some(p => p.test(desc));
}

function getProhibitionReason(action: ProposedAction): string {
  if (/sell|list|publish/i.test(action.description)) {
    return 'HARD LIMIT: AI cannot sell or list items without explicit user confirmation. This is not configurable.';
  }
  if (/delete/i.test(action.description)) {
    return 'HARD LIMIT: AI cannot delete user data. This is not configurable.';
  }
  if (/contact|email|message/i.test(action.description)) {
    return 'HARD LIMIT: AI cannot contact external parties without user consent.';
  }
  if (/payment|billing|card|subscription/i.test(action.description)) {
    return 'HARD LIMIT: AI cannot modify payment or billing. This is not configurable.';
  }
  return 'HARD LIMIT: This action is prohibited by platform safety rules.';
}

function isActionPermitted(actionType: AutonomyAction, settings: AutonomySettings): boolean {
  switch (actionType) {
    case 'inventory_reorder': return settings.can_reorder_inventory;
    case 'listing_draft': return settings.can_draft_listings;
    case 'price_adjustment': return settings.can_adjust_prices;
    case 'notification_send': return settings.can_send_notifications;
    case 'watchlist_modify': return settings.can_modify_watchlist;
    case 'report_generate': return true;  // Reports are always safe
    case 'alert_create': return true;      // Alerts are always safe
    default: return false;
  }
}

function checkSpendLimits(
  amount: number,
  settings: AutonomySettings
): GuardrailCheck {
  // Hard limit: single transaction cap
  if (amount > HARD_LIMITS.MAX_SINGLE_TRANSACTION) {
    return {
      allowed: false,
      reason: `Amount $${amount} exceeds hard limit of $${HARD_LIMITS.MAX_SINGLE_TRANSACTION} per transaction.`,
      blockedBy: 'hard_limit_max_transaction',
      requiresConfirmation: false,
      isSandbox: false,
    };
  }

  // User limit: per action
  if (settings.max_spend_per_action > 0 && amount > settings.max_spend_per_action) {
    return {
      allowed: false,
      reason: `Amount $${amount} exceeds your per-action limit of $${settings.max_spend_per_action}.`,
      blockedBy: 'spend_cap_per_action',
      requiresConfirmation: false,
      isSandbox: false,
    };
  }

  // User limit: daily
  if (settings.max_spend_per_day > 0 && (settings.spent_today + amount) > settings.max_spend_per_day) {
    return {
      allowed: false,
      reason: `This would exceed your daily spend limit of $${settings.max_spend_per_day} (spent today: $${settings.spent_today}).`,
      blockedBy: 'spend_cap_daily',
      requiresConfirmation: false,
      isSandbox: false,
    };
  }

  // User limit: monthly
  if (settings.max_spend_per_month > 0 && (settings.spent_this_month + amount) > settings.max_spend_per_month) {
    return {
      allowed: false,
      reason: `This would exceed your monthly spend limit of $${settings.max_spend_per_month} (spent this month: $${settings.spent_this_month}).`,
      blockedBy: 'spend_cap_monthly',
      requiresConfirmation: false,
      isSandbox: false,
    };
  }

  return { allowed: true, reason: 'Within spend limits', requiresConfirmation: true, isSandbox: false };
}

function checkSupplierAuthorization(
  action: ProposedAction,
  settings: AutonomySettings
): GuardrailCheck {
  const authorized = (settings.authorized_suppliers || []) as any[];
  const supplier = authorized.find((s: any) =>
    s.name?.toLowerCase() === action.supplierName?.toLowerCase()
  );

  if (!supplier) {
    return {
      allowed: false,
      reason: `Supplier "${action.supplierName}" is not pre-authorized. Add them in autonomy settings first.`,
      blockedBy: 'supplier_not_authorized',
      requiresConfirmation: false,
      isSandbox: false,
    };
  }

  if (action.financialAmount && supplier.maxSpend && action.financialAmount > supplier.maxSpend) {
    return {
      allowed: false,
      reason: `Order $${action.financialAmount} exceeds authorized limit of $${supplier.maxSpend} for ${action.supplierName}.`,
      blockedBy: 'supplier_spend_limit',
      requiresConfirmation: false,
      isSandbox: false,
    };
  }

  return { allowed: true, reason: 'Supplier authorized', requiresConfirmation: true, isSandbox: false };
}

function checkItemAuthorization(
  action: ProposedAction,
  settings: AutonomySettings
): GuardrailCheck {
  const authorized = (settings.authorized_items || []) as any[];

  if (authorized.length === 0) {
    // No specific items authorized — allow if general reorder permission is granted
    return { allowed: true, reason: 'General reorder permission', requiresConfirmation: true, isSandbox: false };
  }

  const item = authorized.find((i: any) => i.vaultItemId === action.targetItemId);
  if (!item) {
    return {
      allowed: false,
      reason: `This item is not in your pre-authorized reorder list.`,
      blockedBy: 'item_not_authorized',
      requiresConfirmation: false,
      isSandbox: false,
    };
  }

  return { allowed: true, reason: 'Item authorized', requiresConfirmation: true, isSandbox: false };
}

async function updateSpendTracking(
  supabase: SupabaseClient,
  userId: string,
  amount: number
): Promise<void> {
  const settings = await getAutonomySettings(supabase, userId);

  await supabase
    .from('user_autonomy_settings')
    .update({
      spent_today: (settings.spent_today || 0) + amount,
      spent_this_month: (settings.spent_this_month || 0) + amount,
    })
    .eq('user_id', userId);
}