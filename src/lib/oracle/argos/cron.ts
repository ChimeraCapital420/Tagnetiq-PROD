// FILE: src/lib/oracle/argos/cron.ts
// Argos Cron Engine — automated vault scanning & market intelligence
//
// v2.0 — February 2026 — HYDRA Integration
//
// Sprint O: Alerts generate even when the user isn't in the app.
//
// Three scan types:
//   vault_monitor   — Price changes on resale vault items (HYDRA-powered)
//   watchlist_check — Market conditions against watchlist criteria (HYDRA-powered)
//   inventory_check — Stock levels, reorder points, sell-through rates
//   full_sweep      — All of the above
//
// Vault type awareness:
//   personal  → SKIP. Never compare to market. Owner's business.
//   resale    → Full scan. HYDRA fetchers for live market prices.
//   inventory → Stock check. Reorder alerts, sell-through analysis.
//
// Mobile-First: All scanning happens server-side on schedule.
// The user's device never runs HYDRA — it just polls for cached results.
// This keeps battery and data usage near zero on mobile.
//
// Precision Design:
//   - Uses HYDRA's blendedPrice (weighted multi-source) for accuracy
//   - Confidence threshold: only alert on 0.5+ confidence data
//   - Dedup: 24h window per item+type combination
//   - Smart batching: high-value items first, max N per run
//   - Stale check: only refresh items not checked in 24h+

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchMarketData } from '../../hydra/fetchers/index.js';
import type { ItemCategory } from '../../hydra/types.js';

// =============================================================================
// TYPES
// =============================================================================

export type ScanType = 'vault_monitor' | 'watchlist_check' | 'inventory_check' | 'full_sweep';
export type ScanFrequency = 'hourly' | 'every_6h' | 'daily' | 'weekly' | 'manual';

export interface CronOptions {
  /** Filter to specific scan type (optional — runs all due scans if omitted) */
  scanTypeFilter?: string;
  /** Max users to process per cron run (default 20) */
  maxUsersPerRun?: number;
  /** Max HYDRA price checks per user (default 8) */
  maxItemsPerUser?: number;
}

export interface CronResult {
  scansRun: number;
  totalAlerts: number;
  totalPriceChecks: number;
  errors: number;
}

export interface ScanResult {
  scanType: ScanType;
  itemsScanned: number;
  alertsGenerated: number;
  reordersTriggered: number;
  priceChecksRun: number;
  errors: number;
  durationMs: number;
}

export interface InventoryAlert {
  vaultItemId: string;
  itemName: string;
  alertType: 'low_stock' | 'reorder_needed' | 'out_of_stock' | 'overstock' | 'slow_mover';
  currentStock: number;
  reorderPoint: number | null;
  daysUntilStockout: number | null;
  suggestedAction: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface ReorderSuggestion {
  vaultItemId: string;
  itemName: string;
  currentStock: number;
  reorderQuantity: number;
  supplierName: string | null;
  supplierLeadDays: number | null;
  estimatedStockoutDate: string | null;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

// =============================================================================
// CONSTANTS — Tuning knobs for precision
// =============================================================================

/** Minimum % change to generate any alert */
const CHANGE_THRESHOLD_NOTICE = 10;

/** Minimum % change to generate a push-worthy alert */
const CHANGE_THRESHOLD_ALERT = 15;

/** % change that triggers urgent priority */
const CHANGE_THRESHOLD_URGENT = 25;

/** Minimum HYDRA confidence to trust a price (0-1) */
const MIN_CONFIDENCE = 0.5;

/** Don't re-check items scanned within this window (ms) */
const STALE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Don't re-alert on same item+type within this window (ms) */
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Minimum item value to trigger HYDRA lookup (skip $5 items) */
const MIN_VALUE_FOR_HYDRA = 15;

/** Delay between HYDRA calls to avoid rate limits (ms) */
const HYDRA_CALL_DELAY_MS = 1500;

/** Max sources per HYDRA call (2 = eBay + category specialist) */
const HYDRA_MAX_SOURCES = 2;

// =============================================================================
// CRON RUNNER — called by Vercel cron or manual trigger
// =============================================================================

/**
 * Run all due scans. Called by cron endpoint.
 * Finds all schedules where next_run_at <= now and executes them.
 *
 * Mobile-First: This runs entirely server-side. The user's device
 * never executes HYDRA calls — it just polls for cached alerts.
 */
export async function runDueScans(
  supabase: SupabaseClient,
  options?: CronOptions
): Promise<CronResult> {
  const now = new Date().toISOString();
  const maxUsers = options?.maxUsersPerRun || 20;
  const maxItems = options?.maxItemsPerUser || 8;

  // Build query
  let query = supabase
    .from('argos_scan_schedule')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', now)
    .order('next_run_at', { ascending: true })
    .limit(maxUsers);

  // Optional scan type filter
  if (options?.scanTypeFilter) {
    query = query.eq('scan_type', options.scanTypeFilter);
  }

  const { data: dueScans } = await query;

  if (!dueScans || dueScans.length === 0) {
    return { scansRun: 0, totalAlerts: 0, totalPriceChecks: 0, errors: 0 };
  }

  let totalAlerts = 0;
  let totalPriceChecks = 0;
  let errors = 0;

  for (const schedule of dueScans) {
    try {
      const result = await executeScan(supabase, schedule, maxItems);
      totalAlerts += result.alertsGenerated;
      totalPriceChecks += result.priceChecksRun;

      // Update schedule — advance next_run_at
      await supabase
        .from('argos_scan_schedule')
        .update({
          last_run_at: now,
          next_run_at: calculateNextRun(schedule.frequency),
          last_result: result,
          run_count: (schedule.run_count || 0) + 1,
          updated_at: now,
        })
        .eq('id', schedule.id);

    } catch (err: any) {
      errors++;
      console.error(`🦅 Argos scan failed for schedule ${schedule.id}:`, err.message);

      await supabase
        .from('argos_scan_schedule')
        .update({
          last_run_at: now,
          next_run_at: calculateNextRun(schedule.frequency),
          error_count: (schedule.error_count || 0) + 1,
          last_error: err.message,
          updated_at: now,
        })
        .eq('id', schedule.id);
    }
  }

  return { scansRun: dueScans.length, totalAlerts, totalPriceChecks, errors };
}

/**
 * Execute a single scan for a user.
 */
async function executeScan(
  supabase: SupabaseClient,
  schedule: any,
  maxItems: number
): Promise<ScanResult> {
  const start = Date.now();
  const userId = schedule.user_id;
  const vaultTypes: string[] = schedule.vault_types || ['resale'];
  let itemsScanned = 0;
  let alertsGenerated = 0;
  let reordersTriggered = 0;
  let priceChecksRun = 0;
  let errors = 0;

  const scanType = schedule.scan_type as ScanType;

  // ── Vault Monitor (resale items — HYDRA-powered) ──
  if (scanType === 'vault_monitor' || scanType === 'full_sweep') {
    if (vaultTypes.includes('resale')) {
      try {
        const result = await scanResaleVault(supabase, userId, maxItems);
        itemsScanned += result.scanned;
        alertsGenerated += result.alerts;
        priceChecksRun += result.priceChecks;
      } catch (err: any) {
        errors++;
        console.error(`🦅 Resale scan error for ${userId}:`, err.message);
      }
    }
  }

  // ── Inventory Check ──
  if (scanType === 'inventory_check' || scanType === 'full_sweep') {
    if (vaultTypes.includes('inventory')) {
      try {
        const result = await scanInventoryVault(supabase, userId);
        itemsScanned += result.scanned;
        alertsGenerated += result.alerts;
        reordersTriggered += result.reorders;
      } catch (err: any) {
        errors++;
        console.error(`🦅 Inventory scan error for ${userId}:`, err.message);
      }
    }
  }

  // ── Watchlist Check (HYDRA-powered) ──
  if (scanType === 'watchlist_check' || scanType === 'full_sweep') {
    try {
      // Watchlist gets remaining item budget after resale scan
      const watchlistBudget = Math.max(3, maxItems - priceChecksRun);
      const result = await scanWatchlist(supabase, userId, watchlistBudget);
      itemsScanned += result.scanned;
      alertsGenerated += result.alerts;
      priceChecksRun += result.priceChecks;
    } catch (err: any) {
      errors++;
      console.error(`🦅 Watchlist scan error for ${userId}:`, err.message);
    }
  }

  return {
    scanType,
    itemsScanned,
    alertsGenerated,
    reordersTriggered,
    priceChecksRun,
    errors,
    durationMs: Date.now() - start,
  };
}

// =============================================================================
// RESALE VAULT SCANNER — HYDRA-powered price comparison
// =============================================================================

/**
 * Scan resale vault items against LIVE market data.
 *
 * Precision Design:
 *   1. Fetch resale vault items, highest value first
 *   2. Skip items already checked within STALE_WINDOW (24h)
 *   3. Skip items valued below MIN_VALUE_FOR_HYDRA ($15)
 *   4. Call HYDRA fetchMarketData() for each (eBay + category specialist)
 *   5. Compare blendedPrice against stored estimated_value
 *   6. Only trust results with confidence >= MIN_CONFIDENCE
 *   7. Generate alerts for CHANGE_THRESHOLD_ALERT+ (15%) changes
 *   8. Update vault estimated_value with new market price
 *   9. 24h dedup prevents alert spam
 */
async function scanResaleVault(
  supabase: SupabaseClient,
  userId: string,
  maxItems: number
): Promise<{ scanned: number; alerts: number; priceChecks: number }> {

  // ── 1. Fetch resale items, prioritized by value ──
  const { data: items } = await supabase
    .from('vault_items')
    .select('id, item_name, estimated_value, category, condition, updated_at')
    .eq('user_id', userId)
    .eq('vault_type', 'resale')
    .not('estimated_value', 'is', null)
    .gte('estimated_value', MIN_VALUE_FOR_HYDRA)
    .order('estimated_value', { ascending: false })
    .limit(maxItems * 2); // Fetch extra — some will be skipped

  if (!items || items.length === 0) return { scanned: 0, alerts: 0, priceChecks: 0 };

  // ── 2. Filter out recently checked items ──
  const staleThreshold = new Date(Date.now() - STALE_WINDOW_MS).toISOString();
  const { data: recentAlerts } = await supabase
    .from('argos_alerts')
    .select('vault_item_id, alert_type, created_at')
    .eq('user_id', userId)
    .gte('created_at', staleThreshold);

  const recentlyAlerted = new Set(
    (recentAlerts || []).map(a => `${a.alert_type}:${a.vault_item_id}`)
  );

  // Also check which items were recently price-checked via the alert_data
  const recentlyChecked = new Set(
    (recentAlerts || [])
      .filter(a => a.vault_item_id)
      .map(a => a.vault_item_id)
  );

  // Filter to items needing a check (not checked in 24h)
  const itemsToCheck = items
    .filter(item => !recentlyChecked.has(item.id))
    .slice(0, maxItems);

  if (itemsToCheck.length === 0) return { scanned: items.length, alerts: 0, priceChecks: 0 };

  // ── 3. Run HYDRA price checks with delay between calls ──
  let alerts = 0;
  let priceChecks = 0;
  const alertsToInsert: any[] = [];

  for (const item of itemsToCheck) {
    try {
      const category = (item.category || 'general') as ItemCategory;
      const currentValue = parseFloat(item.estimated_value?.toString() || '0');

      if (currentValue <= 0) continue;

      // Call HYDRA — 2 sources max (eBay + category specialist)
      const marketResult = await fetchMarketData(
        item.item_name,
        category,
        undefined,
        { maxSources: HYDRA_MAX_SOURCES, includeEbay: true }
      );

      priceChecks++;

      // ── 4. Extract blended price ──
      const blended = marketResult.blendedPrice;
      if (!blended || blended.value <= 0 || blended.confidence < MIN_CONFIDENCE) {
        // Low confidence or no data — skip, don't alert on garbage
        console.log(`🦅 ${item.item_name}: No reliable price (conf: ${blended?.confidence || 0})`);
        continue;
      }

      const newValue = blended.value;
      const changePct = ((newValue - currentValue) / currentValue) * 100;
      const absChange = Math.abs(changePct);

      console.log(`🦅 ${item.item_name}: $${currentValue.toFixed(0)} → $${newValue.toFixed(0)} (${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%, conf: ${blended.confidence.toFixed(2)})`);

      // ── 5. Generate alert if threshold met ──
      if (absChange >= CHANGE_THRESHOLD_ALERT) {
        const direction = changePct > 0 ? 'up' : 'down';
        const alertType = direction === 'down' ? 'price_drop' : 'price_spike';
        const dedupKey = `${alertType}:${item.id}`;

        // Dedup check
        if (!recentlyAlerted.has(dedupKey)) {
          const priority = absChange >= CHANGE_THRESHOLD_URGENT
            ? (direction === 'up' ? 'urgent' : 'high')
            : 'normal';

          const alert = direction === 'down'
            ? {
                user_id: userId,
                vault_item_id: item.id,
                alert_type: alertType,
                priority,
                title: `Price drop on your ${item.item_name}`,
                body: `Market value dropped ${absChange.toFixed(0)}% — was $${currentValue.toFixed(0)}, now ~$${newValue.toFixed(0)}. ${absChange >= CHANGE_THRESHOLD_URGENT ? 'Significant move — worth checking.' : 'Keeping an eye on it.'}`,
                action_url: '/vault',
                action_label: 'View in Vault',
                item_name: item.item_name,
                item_category: item.category,
                alert_data: {
                  old_price: currentValue,
                  new_price: newValue,
                  change_pct: parseFloat(changePct.toFixed(1)),
                  confidence: blended.confidence,
                  method: blended.method,
                  sources: marketResult.sources?.map(s => s.source).filter(Boolean) || [],
                },
              }
            : {
                user_id: userId,
                vault_item_id: item.id,
                alert_type: alertType,
                priority,
                title: `${item.item_name} is trending up`,
                body: `Up ${changePct.toFixed(0)}% — was $${currentValue.toFixed(0)}, now ~$${newValue.toFixed(0)}. ${absChange >= 30 ? 'Could be a great time to sell.' : 'Market moving in your favor.'}`,
                action_url: '/vault',
                action_label: 'View in Vault',
                item_name: item.item_name,
                item_category: item.category,
                alert_data: {
                  old_price: currentValue,
                  new_price: newValue,
                  change_pct: parseFloat(changePct.toFixed(1)),
                  confidence: blended.confidence,
                  method: blended.method,
                  sources: marketResult.sources?.map(s => s.source).filter(Boolean) || [],
                },
              };

          alertsToInsert.push(alert);
          alerts++;
        }
      }

      // ── 6. Update vault item with new market price ──
      // Only update if confidence is strong enough to trust
      if (blended.confidence >= 0.6 && absChange >= CHANGE_THRESHOLD_NOTICE) {
        await supabase
          .from('vault_items')
          .update({
            estimated_value: parseFloat(newValue.toFixed(2)),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)
          .eq('user_id', userId);
      }

      // ── Delay between HYDRA calls ──
      if (priceChecks < itemsToCheck.length) {
        await sleep(HYDRA_CALL_DELAY_MS);
      }

    } catch (err: any) {
      console.error(`🦅 HYDRA check failed for ${item.item_name}:`, err.message);
      // Don't stop the whole scan — just skip this item
    }
  }

  // ── 7. Batch insert alerts ──
  if (alertsToInsert.length > 0) {
    const { error } = await supabase
      .from('argos_alerts')
      .insert(alertsToInsert);

    if (error) {
      console.error('🦅 Failed to write resale alerts:', error.message);
      alerts = 0; // Don't count failed inserts
    }
  }

  return { scanned: items.length, alerts, priceChecks };
}

// =============================================================================
// WATCHLIST SCANNER — HYDRA-powered threshold checking
// =============================================================================

/**
 * Scan watchlist items against their trigger conditions using HYDRA.
 *
 * Each watchlist item has:
 *   - watch_type: what to watch for (price_drop, price_spike, price_any, etc.)
 *   - threshold_pct: percentage change to trigger (default 10%)
 *   - threshold_price: absolute price trigger (optional)
 *
 * We call HYDRA for current market price, then check against conditions.
 */
async function scanWatchlist(
  supabase: SupabaseClient,
  userId: string,
  maxItems: number
): Promise<{ scanned: number; alerts: number; priceChecks: number }> {

  // Fetch active watches not checked recently
  const checkThreshold = new Date(Date.now() - STALE_WINDOW_MS / 2).toISOString(); // 12h for watchlist

  const { data: watches } = await supabase
    .from('argos_watchlist')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`last_checked_at.is.null,last_checked_at.lte.${checkThreshold}`)
    .order('created_at', { ascending: true })
    .limit(maxItems);

  if (!watches || watches.length === 0) return { scanned: 0, alerts: 0, priceChecks: 0 };

  let alerts = 0;
  let priceChecks = 0;
  const alertsToInsert: any[] = [];
  const now = new Date().toISOString();

  // Dedup: recent alerts for this user's watchlist items
  const dedupWindow = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  const { data: recentAlerts } = await supabase
    .from('argos_alerts')
    .select('vault_item_id, alert_type')
    .eq('user_id', userId)
    .gte('created_at', dedupWindow);

  const recentKeys = new Set(
    (recentAlerts || []).map(a => `${a.alert_type}:${a.vault_item_id || 'general'}`)
  );

  for (const watch of watches) {
    try {
      const category = (watch.item_category || 'general') as ItemCategory;

      // Call HYDRA
      const marketResult = await fetchMarketData(
        watch.item_name,
        category,
        watch.search_query || undefined,
        { maxSources: HYDRA_MAX_SOURCES, includeEbay: true }
      );

      priceChecks++;

      const blended = marketResult.blendedPrice;
      if (!blended || blended.value <= 0 || blended.confidence < MIN_CONFIDENCE) {
        // Update last_checked even on no-data (prevents re-checking immediately)
        await supabase
          .from('argos_watchlist')
          .update({ last_checked_at: now })
          .eq('id', watch.id);
        continue;
      }

      const currentMarketPrice = blended.value;
      const thresholdPct = watch.threshold_pct || 10;
      const thresholdPrice = watch.threshold_price
        ? parseFloat(watch.threshold_price.toString())
        : null;

      // Determine if trigger conditions are met
      let triggered = false;
      let alertType = 'market_trend';
      let alertTitle = '';
      let alertBody = '';
      let priority: string = 'normal';

      if (thresholdPrice && thresholdPrice > 0) {
        // ── Absolute price threshold ──
        const changePct = ((currentMarketPrice - thresholdPrice) / thresholdPrice) * 100;
        const absChange = Math.abs(changePct);

        if (watch.watch_type === 'price_drop' && currentMarketPrice <= thresholdPrice * (1 - thresholdPct / 100)) {
          triggered = true;
          alertType = 'price_drop';
          alertTitle = `${watch.item_name} dropped below your target`;
          alertBody = `Now ~$${currentMarketPrice.toFixed(0)} (your target: $${thresholdPrice.toFixed(0)}). Down ${absChange.toFixed(0)}%.`;
          priority = absChange >= CHANGE_THRESHOLD_URGENT ? 'high' : 'normal';
        }
        else if (watch.watch_type === 'price_spike' && currentMarketPrice >= thresholdPrice * (1 + thresholdPct / 100)) {
          triggered = true;
          alertType = 'price_spike';
          alertTitle = `${watch.item_name} spiked above your target`;
          alertBody = `Now ~$${currentMarketPrice.toFixed(0)} (your target: $${thresholdPrice.toFixed(0)}). Up ${absChange.toFixed(0)}%.`;
          priority = absChange >= 30 ? 'urgent' : 'high';
        }
        else if (watch.watch_type === 'price_any' && absChange >= thresholdPct) {
          triggered = true;
          alertType = changePct > 0 ? 'price_spike' : 'price_drop';
          alertTitle = `${watch.item_name} moved ${absChange.toFixed(0)}%`;
          alertBody = `Now ~$${currentMarketPrice.toFixed(0)} (baseline: $${thresholdPrice.toFixed(0)}). ${changePct > 0 ? 'Up' : 'Down'} ${absChange.toFixed(0)}%.`;
          priority = absChange >= CHANGE_THRESHOLD_URGENT ? 'high' : 'normal';
        }
      } else {
        // ── No baseline price — report current market value as informational ──
        // First time checking: store current price as baseline, don't alert
        await supabase
          .from('argos_watchlist')
          .update({
            threshold_price: currentMarketPrice,
            last_checked_at: now,
          })
          .eq('id', watch.id);
        continue; // Next watch — we'll compare on the NEXT scan
      }

      // ── Insert alert if triggered ──
      if (triggered) {
        const dedupKey = `${alertType}:${watch.vault_item_id || watch.id}`;

        if (!recentKeys.has(dedupKey)) {
          alertsToInsert.push({
            user_id: userId,
            vault_item_id: watch.vault_item_id || null,
            alert_type: alertType,
            priority,
            title: alertTitle,
            body: alertBody,
            action_url: '/vault',
            action_label: 'View Details',
            item_name: watch.item_name,
            item_category: watch.item_category,
            alert_data: {
              watchlist_id: watch.id,
              watch_type: watch.watch_type,
              market_price: currentMarketPrice,
              threshold_price: thresholdPrice,
              threshold_pct: thresholdPct,
              confidence: blended.confidence,
              method: blended.method,
            },
          });

          alerts++;

          // Update watch with alert timestamp
          await supabase
            .from('argos_watchlist')
            .update({
              last_checked_at: now,
              last_alert_at: now,
              alert_count: (watch.alert_count || 0) + 1,
            })
            .eq('id', watch.id);
        }
      } else {
        // No trigger — just update last_checked
        await supabase
          .from('argos_watchlist')
          .update({ last_checked_at: now })
          .eq('id', watch.id);
      }

      // Delay between calls
      if (priceChecks < watches.length) {
        await sleep(HYDRA_CALL_DELAY_MS);
      }

    } catch (err: any) {
      console.error(`🦅 Watchlist check failed for ${watch.item_name}:`, err.message);
    }
  }

  // Batch insert alerts
  if (alertsToInsert.length > 0) {
    const { error } = await supabase
      .from('argos_alerts')
      .insert(alertsToInsert);

    if (error) {
      console.error('🦅 Failed to write watchlist alerts:', error.message);
      alerts = 0;
    }
  }

  return { scanned: watches.length, alerts, priceChecks };
}

// =============================================================================
// INVENTORY SCANNER — unchanged from v1 (already works)
// =============================================================================

/**
 * Scan inventory vault for stock issues.
 * No HYDRA needed — this is pure math on stored quantities.
 */
async function scanInventoryVault(
  supabase: SupabaseClient,
  userId: string
): Promise<{ scanned: number; alerts: number; reorders: number }> {
  const { data: items } = await supabase
    .from('vault_items')
    .select('id, item_name, stock_quantity, reorder_point, reorder_quantity, supplier_name, supplier_lead_days, sell_through_rate, cost_per_unit, sell_price_per_unit')
    .eq('user_id', userId)
    .eq('vault_type', 'inventory')
    .not('stock_quantity', 'is', null);

  if (!items || items.length === 0) return { scanned: 0, alerts: 0, reorders: 0 };

  let alerts = 0;
  let reorders = 0;

  // Dedup: recent inventory alerts
  const dedupWindow = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  const { data: recentAlerts } = await supabase
    .from('argos_alerts')
    .select('vault_item_id')
    .eq('user_id', userId)
    .gte('created_at', dedupWindow)
    .not('alert_data->inventoryAlert', 'is', null);

  const recentlyAlerted = new Set(
    (recentAlerts || []).map(a => a.vault_item_id)
  );

  const alertsToInsert: any[] = [];

  for (const item of items) {
    // Skip recently alerted items
    if (recentlyAlerted.has(item.id)) continue;

    const inventoryAlerts = analyzeInventoryItem(item);

    for (const alert of inventoryAlerts) {
      alertsToInsert.push({
        user_id: userId,
        vault_item_id: item.id,
        alert_type: alert.alertType === 'reorder_needed' ? 'price_drop' : 'market_trend',
        priority: alert.urgency === 'critical' ? 'urgent' : alert.urgency === 'high' ? 'high' : 'normal',
        title: `${alert.alertType.replace(/_/g, ' ').toUpperCase()}: ${item.item_name}`,
        body: alert.suggestedAction,
        item_name: item.item_name,
        alert_data: {
          inventoryAlert: true,
          currentStock: alert.currentStock,
          reorderPoint: alert.reorderPoint,
          daysUntilStockout: alert.daysUntilStockout,
          alertType: alert.alertType,
        },
      });

      alerts++;
      if (alert.alertType === 'reorder_needed') reorders++;
    }
  }

  // Batch insert
  if (alertsToInsert.length > 0) {
    const { error } = await supabase.from('argos_alerts').insert(alertsToInsert);
    if (error) {
      console.error('🦅 Failed to write inventory alerts:', error.message);
      alerts = 0;
      reorders = 0;
    }
  }

  return { scanned: items.length, alerts, reorders };
}

/**
 * Analyze a single inventory item for issues.
 */
function analyzeInventoryItem(item: any): InventoryAlert[] {
  const alerts: InventoryAlert[] = [];
  const stock = item.stock_quantity || 0;
  const reorderPoint = item.reorder_point;
  const sellRate = item.sell_through_rate || 0;
  const leadDays = item.supplier_lead_days || 0;

  // Out of stock
  if (stock <= 0) {
    alerts.push({
      vaultItemId: item.id,
      itemName: item.item_name,
      alertType: 'out_of_stock',
      currentStock: stock,
      reorderPoint,
      daysUntilStockout: 0,
      suggestedAction: `${item.item_name} is OUT OF STOCK. ${item.supplier_name ? `Order from ${item.supplier_name} immediately.` : 'Reorder now.'}`,
      urgency: 'critical',
    });
    return alerts;
  }

  // Calculate days until stockout
  const daysUntilStockout = sellRate > 0 ? Math.floor(stock / sellRate) : null;

  // Reorder needed: stock at or below reorder point
  if (reorderPoint && stock <= reorderPoint) {
    const urgency = stock <= Math.floor(reorderPoint * 0.5) ? 'critical' : 'high';
    alerts.push({
      vaultItemId: item.id,
      itemName: item.item_name,
      alertType: 'reorder_needed',
      currentStock: stock,
      reorderPoint,
      daysUntilStockout,
      suggestedAction: `${item.item_name}: ${stock} units left (reorder point: ${reorderPoint}). ${daysUntilStockout !== null ? `~${daysUntilStockout} days until stockout.` : ''} ${item.supplier_lead_days ? `Supplier takes ${item.supplier_lead_days} days.` : ''} Suggest ordering ${item.reorder_quantity || reorderPoint * 2} units.`,
      urgency,
    });
    return alerts;
  }

  // Low stock warning: within 2x supplier lead time
  if (daysUntilStockout !== null && leadDays > 0 && daysUntilStockout <= leadDays * 2) {
    alerts.push({
      vaultItemId: item.id,
      itemName: item.item_name,
      alertType: 'low_stock',
      currentStock: stock,
      reorderPoint,
      daysUntilStockout,
      suggestedAction: `${item.item_name}: ${daysUntilStockout} days of stock remaining, supplier needs ${leadDays} days to deliver. Consider reordering soon.`,
      urgency: 'medium',
    });
  }

  return alerts;
}

// =============================================================================
// INVENTORY MANAGEMENT (public — called from API endpoint)
// =============================================================================

/**
 * Get reorder suggestions for all inventory items.
 */
export async function getReorderSuggestions(
  supabase: SupabaseClient,
  userId: string
): Promise<ReorderSuggestion[]> {
  const { data: items } = await supabase
    .from('vault_items')
    .select('id, item_name, stock_quantity, reorder_point, reorder_quantity, supplier_name, supplier_lead_days, sell_through_rate')
    .eq('user_id', userId)
    .eq('vault_type', 'inventory')
    .not('stock_quantity', 'is', null)
    .not('reorder_point', 'is', null);

  if (!items) return [];

  return items
    .filter(item => (item.stock_quantity || 0) <= (item.reorder_point || 0))
    .map(item => {
      const stock = item.stock_quantity || 0;
      const sellRate = item.sell_through_rate || 0;
      const leadDays = item.supplier_lead_days || 0;
      const daysLeft = sellRate > 0 ? Math.floor(stock / sellRate) : null;

      let urgency: ReorderSuggestion['urgency'] = 'low';
      if (stock <= 0) urgency = 'critical';
      else if (daysLeft !== null && daysLeft <= leadDays) urgency = 'critical';
      else if (daysLeft !== null && daysLeft <= leadDays * 2) urgency = 'high';
      else if (stock <= (item.reorder_point || 0)) urgency = 'medium';

      return {
        vaultItemId: item.id,
        itemName: item.item_name,
        currentStock: stock,
        reorderQuantity: item.reorder_quantity || (item.reorder_point || 0) * 2,
        supplierName: item.supplier_name,
        supplierLeadDays: item.supplier_lead_days,
        estimatedStockoutDate: daysLeft !== null
          ? new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : null,
        urgency,
      };
    })
    .sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
}

/**
 * Log an inventory change (sale, restock, adjustment).
 */
export async function logInventoryChange(
  supabase: SupabaseClient,
  userId: string,
  vaultItemId: string,
  action: 'restock' | 'sold' | 'adjustment' | 'reorder_triggered' | 'damaged' | 'returned',
  quantityChange: number,
  triggeredBy: 'manual' | 'oracle' | 'cron' | 'api' = 'manual',
  note?: string
): Promise<boolean> {
  const { data: item } = await supabase
    .from('vault_items')
    .select('stock_quantity')
    .eq('id', vaultItemId)
    .eq('user_id', userId)
    .eq('vault_type', 'inventory')
    .single();

  if (!item) return false;

  const before = item.stock_quantity || 0;
  const after = Math.max(0, before + quantityChange);

  await supabase
    .from('vault_items')
    .update({ stock_quantity: after })
    .eq('id', vaultItemId);

  await supabase
    .from('inventory_log')
    .insert({
      user_id: userId,
      vault_item_id: vaultItemId,
      action,
      quantity_change: quantityChange,
      quantity_before: before,
      quantity_after: after,
      note,
      triggered_by: triggeredBy,
    });

  return true;
}

/**
 * Get inventory dashboard summary.
 */
export async function getInventorySummary(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  totalItems: number;
  totalUnits: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  reorderNeeded: number;
}> {
  const { data: items } = await supabase
    .from('vault_items')
    .select('stock_quantity, reorder_point, cost_per_unit, sell_price_per_unit')
    .eq('user_id', userId)
    .eq('vault_type', 'inventory');

  if (!items) return { totalItems: 0, totalUnits: 0, totalValue: 0, lowStockCount: 0, outOfStockCount: 0, reorderNeeded: 0 };

  let totalUnits = 0;
  let totalValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let reorderNeeded = 0;

  for (const item of items) {
    const stock = item.stock_quantity || 0;
    totalUnits += stock;
    totalValue += stock * (item.cost_per_unit || 0);

    if (stock <= 0) outOfStockCount++;
    else if (item.reorder_point && stock <= item.reorder_point) reorderNeeded++;
    else if (item.reorder_point && stock <= item.reorder_point * 1.5) lowStockCount++;
  }

  return {
    totalItems: items.length,
    totalUnits,
    totalValue: parseFloat(totalValue.toFixed(2)),
    lowStockCount,
    outOfStockCount,
    reorderNeeded,
  };
}

// =============================================================================
// SCHEDULE MANAGEMENT
// =============================================================================

/**
 * Create or update a scan schedule for a user.
 */
export async function upsertScanSchedule(
  supabase: SupabaseClient,
  userId: string,
  scanType: ScanType,
  frequency: ScanFrequency,
  vaultTypes: string[] = ['resale']
): Promise<string | null> {
  const nextRun = calculateNextRun(frequency);

  const { data: existing } = await supabase
    .from('argos_scan_schedule')
    .select('id')
    .eq('user_id', userId)
    .eq('scan_type', scanType)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('argos_scan_schedule')
      .update({ frequency, vault_types: vaultTypes, next_run_at: nextRun, is_active: true })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data: created } = await supabase
    .from('argos_scan_schedule')
    .insert({
      user_id: userId,
      scan_type: scanType,
      frequency,
      vault_types: vaultTypes,
      next_run_at: nextRun,
    })
    .select('id')
    .single();

  return created?.id || null;
}

/**
 * Get user's scan schedules.
 */
export async function getScanSchedules(
  supabase: SupabaseClient,
  userId: string
): Promise<any[]> {
  const { data } = await supabase
    .from('argos_scan_schedule')
    .select('*')
    .eq('user_id', userId)
    .order('scan_type');

  return data || [];
}

// =============================================================================
// HELPERS
// =============================================================================

function calculateNextRun(frequency: string): string {
  const now = Date.now();
  const intervals: Record<string, number> = {
    hourly: 60 * 60 * 1000,
    every_6h: 6 * 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    manual: 365 * 24 * 60 * 60 * 1000,
  };

  return new Date(now + (intervals[frequency] || intervals.daily)).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}