// FILE: src/lib/oracle/argos/watchlist.ts
// Argos Watchlist Management
//
// Sprint J: Users can configure what Argos watches for them
//
// Watch types:
//   - price_drop:     Alert when price drops below threshold %
//   - price_spike:    Alert when price rises above threshold %
//   - price_any:      Alert on any significant price change
//   - new_listing:    Alert when new listings appear for this item
//   - category_trend: Alert on category-wide movements
//
// Oracle integration:
//   During conversation, Oracle can suggest adding items to the watchlist.
//   "Want me to keep an eye on that for you?" → addToWatchlist()
//   This is called from chat when Oracle detects interest patterns.

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type WatchType = 'price_drop' | 'price_spike' | 'price_any' | 'new_listing' | 'category_trend';

export interface WatchlistItem {
  id: string;
  user_id: string;
  vault_item_id: string | null;
  item_name: string;
  item_category: string | null;
  search_query: string | null;
  watch_type: WatchType;
  threshold_pct: number | null;
  threshold_price: number | null;
  is_active: boolean;
  last_checked_at: string | null;
  last_alert_at: string | null;
  alert_count: number;
  created_at: string;
}

export interface AddWatchParams {
  /** Vault item ID (optional — can watch items not in vault) */
  vaultItemId?: string;
  /** Item name (required) */
  itemName: string;
  /** Category for context */
  category?: string;
  /** Search query for broad watches (e.g., "vintage Rolex Submariner") */
  searchQuery?: string;
  /** What to watch for */
  watchType: WatchType;
  /** Percentage threshold to trigger (default 10%) */
  thresholdPct?: number;
  /** Absolute price threshold (optional) */
  thresholdPrice?: number;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Add an item to the user's watchlist.
 * Prevents duplicates: same user + same item name + same watch type = skip.
 */
export async function addToWatchlist(
  supabase: SupabaseClient,
  userId: string,
  params: AddWatchParams
): Promise<{ id: string; isNew: boolean } | null> {
  // Check for existing watch on same item + type
  const { data: existing } = await supabase
    .from('argos_watchlist')
    .select('id, is_active')
    .eq('user_id', userId)
    .eq('item_name', params.itemName)
    .eq('watch_type', params.watchType)
    .single();

  // Already watching — reactivate if inactive
  if (existing) {
    if (!existing.is_active) {
      await supabase
        .from('argos_watchlist')
        .update({
          is_active: true,
          threshold_pct: params.thresholdPct ?? 10,
          threshold_price: params.thresholdPrice ?? null,
        })
        .eq('id', existing.id);
    }
    return { id: existing.id, isNew: false };
  }

  // Create new watch
  const { data, error } = await supabase
    .from('argos_watchlist')
    .insert({
      user_id: userId,
      vault_item_id: params.vaultItemId || null,
      item_name: params.itemName,
      item_category: params.category || null,
      search_query: params.searchQuery || null,
      watch_type: params.watchType,
      threshold_pct: params.thresholdPct ?? 10,
      threshold_price: params.thresholdPrice ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('Watchlist add failed:', error.message);
    return null;
  }

  return { id: data.id, isNew: true };
}

/**
 * Remove an item from the watchlist (deactivate, don't delete).
 */
export async function removeFromWatchlist(
  supabase: SupabaseClient,
  userId: string,
  watchId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('argos_watchlist')
    .update({ is_active: false })
    .eq('id', watchId)
    .eq('user_id', userId);

  return !error;
}

/**
 * Permanently delete a watchlist item.
 */
export async function deleteFromWatchlist(
  supabase: SupabaseClient,
  userId: string,
  watchId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('argos_watchlist')
    .delete()
    .eq('id', watchId)
    .eq('user_id', userId);

  return !error;
}

/**
 * Get the user's active watchlist.
 */
export async function getWatchlist(
  supabase: SupabaseClient,
  userId: string,
  options?: { includeInactive?: boolean; limit?: number }
): Promise<WatchlistItem[]> {
  let query = supabase
    .from('argos_watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(options?.limit || 50);

  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Watchlist fetch failed:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Update watch conditions on an existing watchlist item.
 */
export async function updateWatch(
  supabase: SupabaseClient,
  userId: string,
  watchId: string,
  updates: Partial<{
    watch_type: WatchType;
    threshold_pct: number;
    threshold_price: number | null;
    search_query: string | null;
    is_active: boolean;
  }>
): Promise<boolean> {
  const { error } = await supabase
    .from('argos_watchlist')
    .update(updates)
    .eq('id', watchId)
    .eq('user_id', userId);

  return !error;
}

/**
 * Auto-generate watchlist items from a user's vault.
 * Called when a user first enables Argos — pre-populates their
 * watchlist with their highest-value vault items.
 */
export async function autoPopulateWatchlist(
  supabase: SupabaseClient,
  userId: string,
  maxItems: number = 10
): Promise<number> {
  // Get top vault items by value
  const { data: vaultItems } = await supabase
    .from('vault_items')
    .select('id, item_name, estimated_value, category')
    .eq('user_id', userId)
    .order('estimated_value', { ascending: false })
    .limit(maxItems);

  if (!vaultItems || vaultItems.length === 0) return 0;

  // Check what's already being watched
  const { data: existing } = await supabase
    .from('argos_watchlist')
    .select('item_name')
    .eq('user_id', userId)
    .eq('is_active', true);

  const alreadyWatched = new Set((existing || []).map(e => e.item_name?.toLowerCase()));

  // Add unwatched vault items
  const toAdd = vaultItems
    .filter(item => item.item_name && !alreadyWatched.has(item.item_name.toLowerCase()))
    .map(item => ({
      user_id: userId,
      vault_item_id: item.id,
      item_name: item.item_name,
      item_category: item.category || null,
      watch_type: 'price_any' as WatchType,
      threshold_pct: 10,
    }));

  if (toAdd.length === 0) return 0;

  const { error } = await supabase
    .from('argos_watchlist')
    .insert(toAdd);

  if (error) {
    console.warn('Auto-populate watchlist failed:', error.message);
    return 0;
  }

  return toAdd.length;
}

/**
 * Get watchlist summary for Oracle's prompt context.
 * Returns a compact summary suitable for the Argos prompt block.
 */
export async function getWatchlistSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<{ itemCount: number; categories: string[]; topItems: string[] }> {
  const { data } = await supabase
    .from('argos_watchlist')
    .select('item_name, item_category')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(20);

  if (!data || data.length === 0) {
    return { itemCount: 0, categories: [], topItems: [] };
  }

  const categories = [...new Set(data.map(d => d.item_category).filter(Boolean))] as string[];
  const topItems = data.slice(0, 5).map(d => d.item_name);

  return {
    itemCount: data.length,
    categories,
    topItems,
  };
}