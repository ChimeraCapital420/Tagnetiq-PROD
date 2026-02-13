// FILE: src/lib/oracle/argos/engine.ts
// Argos Engine — Oracle's proactive intelligence system
//
// Sprint G: Proactive Argos Alerts
//
// Two operating modes:
//
//   PASSIVE: Monitors vault items against market data.
//     Runs on-demand (user opens app) or via cron.
//     Generates alerts: price drops, spikes, opportunities.
//     Works on phone, tablet, glasses — any device that fetches alerts.
//
//   ACTIVE (Hunt Mode): User snaps a photo, gets instant triage.
//     Optimized for speed (Groq ~300ms).
//     Returns BUY/SKIP/HOLD with one-line reasoning.
//     Works from phone camera, tablet camera, or smart glasses.
//
// Hardware-agnostic: Argos doesn't know or care what device called it.
// It receives data, processes server-side, returns structured results.
// The client decides how to render: push notification, toast, HUD overlay, voice.

import type { SupabaseClient } from '@supabase/supabase-js';
import { hasFeature, type UserTier } from '../tier.js';

// =============================================================================
// TYPES
// =============================================================================

export type AlertType =
  | 'price_drop'
  | 'price_spike'
  | 'new_listing'
  | 'market_trend'
  | 'flip_opportunity'
  | 'vault_milestone'
  | 'hunt_result'
  | 'oracle_nudge';

export type AlertPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ArgosAlert {
  user_id: string;
  alert_type: AlertType;
  priority: AlertPriority;
  title: string;
  body: string;
  action_url?: string;
  action_label?: string;
  vault_item_id?: string;
  item_name?: string;
  item_category?: string;
  alert_data?: Record<string, any>;
  expires_at?: string;
}

export interface VaultScanResult {
  /** Total vault items checked */
  itemsChecked: number;
  /** Alerts generated this run */
  alertsGenerated: number;
  /** Items with price changes detected */
  priceChanges: PriceChange[];
  /** Vault total value (current estimate) */
  vaultTotalValue: number;
  /** Timestamp of this scan */
  scannedAt: string;
}

export interface PriceChange {
  vaultItemId: string;
  itemName: string;
  category: string;
  oldValue: number;
  newValue: number;
  changePct: number;
  direction: 'up' | 'down';
}

// =============================================================================
// ARGOS PASSIVE — VAULT MONITORING
// =============================================================================

/**
 * Scan a user's vault for price changes and generate alerts.
 *
 * This is the core Argos loop:
 *   1. Fetch user's vault items
 *   2. Compare stored values against recent scan data
 *   3. Generate alerts for significant changes
 *   4. Check for vault milestones
 *
 * Call this when the user opens the app, or on a timer/cron.
 * Designed to be fast and non-blocking.
 *
 * @param supabase - Admin client
 * @param userId   - User to scan
 * @param tier     - User's current tier (for feature gating)
 */
export async function scanVaultForAlerts(
  supabase: SupabaseClient,
  userId: string,
  tier: UserTier
): Promise<VaultScanResult> {
  // Feature gate: Argos is Elite-only (but beta mode bypasses this)
  if (!hasFeature(tier, 'proactive_alerts') && !hasFeature(tier, 'argos_engine')) {
    return {
      itemsChecked: 0,
      alertsGenerated: 0,
      priceChanges: [],
      vaultTotalValue: 0,
      scannedAt: new Date().toISOString(),
    };
  }

  // ── 1. Fetch vault items ──────────────────────────────
  const { data: vaultItems } = await supabase
    .from('vault_items')
    .select('id, item_name, estimated_value, category, condition, created_at, updated_at')
    .eq('user_id', userId)
    .order('estimated_value', { ascending: false })
    .limit(100);

  if (!vaultItems || vaultItems.length === 0) {
    return {
      itemsChecked: 0,
      alertsGenerated: 0,
      priceChanges: [],
      vaultTotalValue: 0,
      scannedAt: new Date().toISOString(),
    };
  }

  // ── 2. Fetch recent scans for the same items ──────────
  // Compare vault stored values against most recent scan values
  const itemNames = vaultItems.map(v => v.item_name).filter(Boolean);
  const { data: recentScans } = await supabase
    .from('analysis_history')
    .select('item_name, estimated_value, category, created_at, consensus_data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);

  // Build a lookup of latest scan value per item name
  const scanValues = buildScanValueLookup(recentScans || []);

  // ── 3. Detect price changes ───────────────────────────
  const priceChanges: PriceChange[] = [];
  const alerts: ArgosAlert[] = [];
  let vaultTotalValue = 0;

  for (const item of vaultItems) {
    const currentValue = item.estimated_value || 0;
    vaultTotalValue += currentValue;

    // Find matching scan data
    const scanValue = findBestMatch(item.item_name, scanValues);
    if (!scanValue) continue;

    // Calculate change
    if (currentValue > 0 && scanValue.value > 0) {
      const changePct = ((scanValue.value - currentValue) / currentValue) * 100;
      const absChange = Math.abs(changePct);

      // Only alert on meaningful changes (>10%)
      if (absChange >= 10) {
        const direction = changePct > 0 ? 'up' : 'down';

        priceChanges.push({
          vaultItemId: item.id,
          itemName: item.item_name,
          category: item.category || 'general',
          oldValue: currentValue,
          newValue: scanValue.value,
          changePct: parseFloat(changePct.toFixed(1)),
          direction,
        });

        // Generate alert
        if (direction === 'down' && absChange >= 15) {
          alerts.push({
            user_id: userId,
            alert_type: 'price_drop',
            priority: absChange >= 25 ? 'high' : 'normal',
            title: `Price drop on your ${item.item_name}`,
            body: `Market value dropped ${Math.abs(changePct).toFixed(0)}% — was $${currentValue.toFixed(0)}, now around $${scanValue.value.toFixed(0)}. ${absChange >= 25 ? 'Significant move — worth checking.' : 'Keeping an eye on it.'}`,
            action_url: `/vault`,
            action_label: 'View in Vault',
            vault_item_id: item.id,
            item_name: item.item_name,
            item_category: item.category,
            alert_data: {
              old_price: currentValue,
              new_price: scanValue.value,
              change_pct: changePct,
              source: scanValue.source,
            },
          });
        }

        if (direction === 'up' && absChange >= 15) {
          alerts.push({
            user_id: userId,
            alert_type: 'price_spike',
            priority: absChange >= 30 ? 'urgent' : 'high',
            title: `${item.item_name} is trending up`,
            body: `Up ${changePct.toFixed(0)}% — was $${currentValue.toFixed(0)}, now around $${scanValue.value.toFixed(0)}. ${absChange >= 30 ? 'Could be a great time to sell.' : 'Market is moving in your favor.'}`,
            action_url: `/vault`,
            action_label: 'View in Vault',
            vault_item_id: item.id,
            item_name: item.item_name,
            item_category: item.category,
            alert_data: {
              old_price: currentValue,
              new_price: scanValue.value,
              change_pct: changePct,
              source: scanValue.source,
            },
          });
        }
      }
    }
  }

  // ── 4. Check vault milestones ─────────────────────────
  const milestoneAlert = checkVaultMilestone(userId, vaultTotalValue);
  if (milestoneAlert) alerts.push(milestoneAlert);

  // ── 5. Write alerts (deduplicated) ────────────────────
  let alertsGenerated = 0;
  if (alerts.length > 0) {
    alertsGenerated = await writeAlerts(supabase, userId, alerts);
  }

  return {
    itemsChecked: vaultItems.length,
    alertsGenerated,
    priceChanges,
    vaultTotalValue,
    scannedAt: new Date().toISOString(),
  };
}

// =============================================================================
// ALERT CRUD
// =============================================================================

/**
 * Fetch unread alerts for a user.
 * Ordered by priority (urgent first) then recency.
 */
export async function getAlerts(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    includeRead?: boolean;
    limit?: number;
    alertType?: AlertType;
  }
): Promise<any[]> {
  let query = supabase
    .from('argos_alerts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(options?.limit || 20);

  if (!options?.includeRead) {
    query = query.eq('is_read', false);
  }

  if (options?.alertType) {
    query = query.eq('alert_type', options.alertType);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Failed to fetch alerts:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Mark alert(s) as read.
 */
export async function markAlertsRead(
  supabase: SupabaseClient,
  userId: string,
  alertIds: string[]
): Promise<void> {
  await supabase
    .from('argos_alerts')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('id', alertIds);
}

/**
 * Dismiss alert(s) — removes from feed.
 */
export async function dismissAlerts(
  supabase: SupabaseClient,
  userId: string,
  alertIds: string[]
): Promise<void> {
  await supabase
    .from('argos_alerts')
    .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('id', alertIds);
}

/**
 * Get unread alert count (for badge display on any device).
 */
export async function getUnreadCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('argos_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .eq('is_dismissed', false);

  if (error) return 0;
  return count || 0;
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

interface ScanValueEntry {
  value: number;
  source: string;
  scannedAt: string;
}

/**
 * Build a lookup of latest scan values by normalized item name.
 */
function buildScanValueLookup(scans: any[]): Map<string, ScanValueEntry> {
  const lookup = new Map<string, ScanValueEntry>();

  for (const scan of scans) {
    const name = normalizeItemName(scan.item_name || '');
    if (!name || lookup.has(name)) continue; // Only keep most recent (scans are desc ordered)

    const value = parseFloat(scan.estimated_value?.toString() || '0');
    if (value <= 0) continue;

    lookup.set(name, {
      value,
      source: scan.consensus_data ? 'hydra_consensus' : 'ai_estimate',
      scannedAt: scan.created_at,
    });
  }

  return lookup;
}

/**
 * Find best matching scan value for a vault item.
 * Uses normalized name matching (case-insensitive, trimmed).
 */
function findBestMatch(
  itemName: string,
  scanValues: Map<string, ScanValueEntry>
): ScanValueEntry | null {
  const normalized = normalizeItemName(itemName);
  if (!normalized) return null;

  // Exact match
  if (scanValues.has(normalized)) return scanValues.get(normalized)!;

  // Partial match — item name contains or is contained by scan name
  for (const [scanName, entry] of scanValues) {
    if (normalized.includes(scanName) || scanName.includes(normalized)) {
      return entry;
    }
  }

  return null;
}

/**
 * Normalize item name for matching.
 */
function normalizeItemName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if the vault has hit a new milestone.
 */
function checkVaultMilestone(
  userId: string,
  totalValue: number
): ArgosAlert | null {
  // Milestone thresholds
  const milestones = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

  for (const milestone of milestones.reverse()) {
    if (totalValue >= milestone) {
      // Only generate if they just crossed this threshold
      // (In production, you'd check if this milestone was already alerted)
      return {
        user_id: userId,
        alert_type: 'vault_milestone',
        priority: milestone >= 10000 ? 'high' : 'normal',
        title: `Your vault hit $${milestone.toLocaleString()}!`,
        body: `Total estimated value: $${totalValue.toLocaleString()}. You're building something real.`,
        action_url: '/vault',
        action_label: 'View Vault',
        alert_data: { milestone, total_value: totalValue },
      };
    }
  }

  return null;
}

/**
 * Write alerts to DB with deduplication.
 * Prevents duplicate alerts for the same item + type within 24 hours.
 */
async function writeAlerts(
  supabase: SupabaseClient,
  userId: string,
  alerts: ArgosAlert[]
): Promise<number> {
  // Check for recent alerts to avoid duplicates
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentAlerts } = await supabase
    .from('argos_alerts')
    .select('alert_type, vault_item_id')
    .eq('user_id', userId)
    .gte('created_at', oneDayAgo);

  const recentKeys = new Set(
    (recentAlerts || []).map(a => `${a.alert_type}:${a.vault_item_id || 'general'}`)
  );

  // Filter out duplicates
  const newAlerts = alerts.filter(alert => {
    const key = `${alert.alert_type}:${alert.vault_item_id || 'general'}`;
    return !recentKeys.has(key);
  });

  if (newAlerts.length === 0) return 0;

  const { error } = await supabase
    .from('argos_alerts')
    .insert(newAlerts);

  if (error) {
    console.warn('Failed to write Argos alerts:', error.message);
    return 0;
  }

  return newAlerts.length;
}