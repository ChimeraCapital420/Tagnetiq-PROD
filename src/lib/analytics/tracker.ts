// FILE: src/lib/analytics/tracker.ts
// Anonymous Analytics Tracker
//
// Sprint E+: Every valuable data point, zero PII.
//
// v9.4 FIX: .catch(() => {}) → .then(() => {}, () => {})
//   Supabase PostgrestBuilder has .then() but NOT .catch() as a native method.
//   Using .catch() throws "supabase.from(...).insert(...).catch is not a function"
//
// ANONYMIZATION:
//   User IDs are SHA-256 hashed with a monthly-rotating salt.
//   This means: same user = same anon_id within a month,
//   but you can't reverse the hash to find the user.
//   Cross-month analysis uses cohort-level data, not individual tracking.
//
// WHAT GETS TRACKED (every event that tells us if the product works):
//
//   ONBOARDING:     signup, onboard_start, onboard_step, onboard_complete, onboard_skip
//   SCAN:           scan_start, scan_complete, scan_error, scan_category
//   VAULT:          vault_add, vault_remove, vault_view, vault_type_set
//   ORACLE:         oracle_chat, oracle_voice_used, oracle_name_set, oracle_energy
//   SHARE:          share_prompt_shown, share_completed, share_dismissed
//   MARKETPLACE:    listing_created, listing_viewed, listing_sold
//   ENGAGEMENT:     session_start, feature_used, tour_completed, digest_opened
//   SUBSCRIPTION:   trial_start, subscription_created, subscription_cancelled
//   ERROR:          api_error, scan_failure, provider_fallback
//   PERFORMANCE:    api_response_time, scan_duration, oracle_response_time

import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// =============================================================================
// ANONYMIZATION
// =============================================================================

// Salt rotates monthly — prevents cross-month user identification
function getMonthSalt(): string {
  const now = new Date();
  const base = process.env.ANALYTICS_SALT || 'tagnetiq-analytics-default-salt';
  return `${base}-${now.getFullYear()}-${now.getMonth()}`;
}

/**
 * Hash a user ID into an anonymous identifier.
 * Same user = same anon_id within a month.
 * Cannot be reversed to find the user.
 */
export function anonymize(userId: string): string {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${getMonthSalt()}`)
    .digest('hex')
    .substring(0, 16); // 16 chars is plenty for analytics dedup
}

// =============================================================================
// EVENT TRACKING
// =============================================================================

export type EventCategory =
  | 'onboarding' | 'scan' | 'vault' | 'oracle' | 'share'
  | 'marketplace' | 'engagement' | 'subscription' | 'error'
  | 'performance' | 'feature' | 'retention';

export interface TrackEvent {
  userId: string;           // Will be anonymized before storage
  event: string;
  category: EventCategory;
  properties?: Record<string, any>;
  platform?: string;
  appVersion?: string;
}

/**
 * Track an anonymous event. Core tracking function.
 * Checks opt-out status before recording.
 */
export async function track(
  supabase: SupabaseClient,
  event: TrackEvent
): Promise<void> {
  // Check opt-out
  const { data: profile } = await supabase
    .from('profiles')
    .select('analytics_opt_out')
    .eq('id', event.userId)
    .single();

  if (profile?.analytics_opt_out) return;

  // Scrub properties of any PII
  const cleanProps = scrubPII(event.properties || {});

  // v9.4 FIX: .then(ok, err) instead of .then().catch()
  // PostgrestBuilder only has .then(), not .catch()
  await supabase
    .from('analytics_events')
    .insert({
      anon_id: anonymize(event.userId),
      event_name: event.event,
      event_category: event.category,
      properties: cleanProps,
      platform: event.platform || detectPlatform(),
      app_version: event.appVersion || process.env.APP_VERSION || '1.0.0',
    })
    .then(() => {}, () => {}); // Non-blocking, never fail parent
}

/**
 * Track multiple events at once (batch).
 */
export async function trackBatch(
  supabase: SupabaseClient,
  events: TrackEvent[]
): Promise<void> {
  // Get all unique user IDs to check opt-out in one query
  const userIds = [...new Set(events.map(e => e.userId))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, analytics_opt_out')
    .in('id', userIds);

  const optedOut = new Set((profiles || []).filter(p => p.analytics_opt_out).map(p => p.id));

  const rows = events
    .filter(e => !optedOut.has(e.userId))
    .map(e => ({
      anon_id: anonymize(e.userId),
      event_name: e.event,
      event_category: e.category,
      properties: scrubPII(e.properties || {}),
      platform: e.platform || detectPlatform(),
      app_version: e.appVersion || process.env.APP_VERSION || '1.0.0',
    }));

  if (rows.length > 0) {
    // v9.4 FIX: .then(ok, err) instead of .catch()
    await supabase.from('analytics_events').insert(rows).then(() => {}, () => {});
  }
}

// =============================================================================
// CONVENIENCE TRACKERS — one-line calls for common events
// =============================================================================

export const trackOnboarding = (s: SupabaseClient, userId: string, step: string, tourId: string = 'first_visit') =>
  track(s, { userId, event: `onboard_${step}`, category: 'onboarding', properties: { step, tourId } });

export const trackScan = (s: SupabaseClient, userId: string, props: {
  category?: string; durationMs?: number; success: boolean; providersUsed?: number; confidence?: number;
}) =>
  track(s, { userId, event: props.success ? 'scan_complete' : 'scan_error', category: 'scan', properties: props });

export const trackVault = (s: SupabaseClient, userId: string, action: string, props: {
  vaultType?: string; category?: string; hasValue?: boolean;
}) =>
  track(s, { userId, event: `vault_${action}`, category: 'vault', properties: props });

export const trackOracle = (s: SupabaseClient, userId: string, props: {
  messageCount?: number; hasVoice?: boolean; responseTimeMs?: number; provider?: string; energy?: string;
}) =>
  track(s, { userId, event: 'oracle_chat', category: 'oracle', properties: props });

export const trackShare = (s: SupabaseClient, userId: string, action: 'prompt_shown' | 'completed' | 'dismissed', props?: {
  trigger?: string; platform?: string;
}) =>
  track(s, { userId, event: `share_${action}`, category: 'share', properties: props || {} });

export const trackFeature = (s: SupabaseClient, userId: string, feature: string) =>
  track(s, { userId, event: 'feature_used', category: 'feature', properties: { feature } });

export const trackPerformance = (s: SupabaseClient, userId: string, metric: string, valueMs: number) =>
  track(s, { userId, event: metric, category: 'performance', properties: { durationMs: valueMs } });

export const trackError = (s: SupabaseClient, userId: string, errorType: string, props?: Record<string, any>) =>
  track(s, { userId, event: errorType, category: 'error', properties: props || {} });

// =============================================================================
// KPI COMPUTATION — build daily snapshots
// =============================================================================

/**
 * Compute daily KPI snapshot. Called by cron job.
 */
export async function computeDailySnapshot(
  supabase: SupabaseClient,
  date?: string
): Promise<void> {
  const snapshotDate = date || new Date().toISOString().split('T')[0];
  const dayStart = `${snapshotDate}T00:00:00Z`;
  const dayEnd = `${snapshotDate}T23:59:59Z`;

  // ── Active users ──────────────────────────────────────
  const { data: dayEvents } = await supabase
    .from('analytics_events')
    .select('anon_id, event_name, event_category, properties')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  const uniqueUsers = new Set((dayEvents || []).map(e => e.anon_id));
  const dau = uniqueUsers.size;

  // WAU: unique users in last 7 days
  const weekAgo = new Date(new Date(snapshotDate).getTime() - 7 * 86400000).toISOString();
  const { data: weekEvents } = await supabase
    .from('analytics_events')
    .select('anon_id')
    .gte('created_at', weekAgo)
    .lte('created_at', dayEnd);
  const wau = new Set((weekEvents || []).map(e => e.anon_id)).size;

  // MAU: unique users in last 30 days
  const monthAgo = new Date(new Date(snapshotDate).getTime() - 30 * 86400000).toISOString();
  const { data: monthEvents } = await supabase
    .from('analytics_events')
    .select('anon_id')
    .gte('created_at', monthAgo)
    .lte('created_at', dayEnd);
  const mau = new Set((monthEvents || []).map(e => e.anon_id)).size;

  // ── Event counts ──────────────────────────────────────
  const events = dayEvents || [];
  const countEvent = (name: string) => events.filter(e => e.event_name === name).length;
  const countCategory = (cat: string) => events.filter(e => e.event_category === cat).length;

  const totalScans = countEvent('scan_complete');
  const totalOracleChats = countEvent('oracle_chat');
  const totalVaultAdds = countEvent('vault_add');
  const totalShares = countEvent('share_completed');
  const totalListings = countEvent('listing_created');
  const newSignups = countEvent('onboard_start');
  const onboardingComplete = countEvent('onboard_complete');
  const errorCount = countCategory('error');

  // ── Unique feature users ──────────────────────────────
  const usersWithVault = new Set(events.filter(e => e.event_category === 'vault').map(e => e.anon_id)).size;
  const usersWithOracle = new Set(events.filter(e => e.event_category === 'oracle').map(e => e.anon_id)).size;
  const uniqueOracleUsers = usersWithOracle;

  // ── Performance ───────────────────────────────────────
  const perfEvents = events.filter(e => e.event_category === 'performance');
  const responseTimes = perfEvents
    .map(e => e.properties?.durationMs)
    .filter((v): v is number => typeof v === 'number');

  const avgApiResponseMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null;

  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  const p95ResponseMs = sortedTimes.length > 0
    ? sortedTimes[Math.floor(sortedTimes.length * 0.95)]
    : null;

  // ── Scan categories ───────────────────────────────────
  const scanCats: Record<string, number> = {};
  for (const e of events.filter(e => e.event_name === 'scan_complete')) {
    const cat = e.properties?.category || 'general';
    scanCats[cat] = (scanCats[cat] || 0) + 1;
  }
  const topScanCategories = Object.entries(scanCats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([category, count]) => ({ category, count }));

  // ── Scan performance ──────────────────────────────────
  const scanDurations = events
    .filter(e => e.event_name === 'scan_complete')
    .map(e => e.properties?.durationMs)
    .filter((v): v is number => typeof v === 'number');

  const avgScanTimeMs = scanDurations.length > 0
    ? Math.round(scanDurations.reduce((a, b) => a + b, 0) / scanDurations.length)
    : null;

  const scanSuccessRate = totalScans > 0
    ? totalScans / (totalScans + countEvent('scan_error'))
    : null;

  // ── Streaks ───────────────────────────────────────────
  const { data: streakData } = await supabase
    .from('profiles')
    .select('use_streak')
    .not('use_streak', 'is', null)
    .gt('use_streak', 0);

  const avgStreak = (streakData || []).length > 0
    ? (streakData || []).reduce((sum, p) => sum + (p.use_streak || 0), 0) / streakData!.length
    : 0;

  // ── Upsert daily snapshot ─────────────────────────────
  await supabase
    .from('analytics_daily')
    .upsert({
      snapshot_date: snapshotDate,
      dau, wau, mau,
      new_signups: newSignups,
      onboarding_complete: onboardingComplete,
      total_scans: totalScans,
      total_oracle_chats: totalOracleChats,
      total_vault_adds: totalVaultAdds,
      total_shares: totalShares,
      total_listings: totalListings,
      users_with_vault: usersWithVault,
      users_with_oracle: usersWithOracle,
      unique_oracle_users: uniqueOracleUsers,
      avg_scan_time_ms: avgScanTimeMs,
      scan_success_rate: scanSuccessRate,
      top_scan_categories: topScanCategories,
      oracle_messages_count: totalOracleChats,
      avg_streak: avgStreak,
      avg_api_response_ms: avgApiResponseMs,
      error_count: errorCount,
      p95_response_ms: p95ResponseMs,
    }, { onConflict: 'snapshot_date' });
}

/**
 * Compute funnel snapshot for a date.
 */
export async function computeFunnelSnapshot(
  supabase: SupabaseClient,
  date?: string
): Promise<void> {
  const snapshotDate = date || new Date().toISOString().split('T')[0];

  // Count total users who have reached each funnel stage (all time up to date)
  const dateEnd = `${snapshotDate}T23:59:59Z`;

  const countUsersWithEvent = async (eventName: string): Promise<number> => {
    const { data } = await supabase
      .from('analytics_events')
      .select('anon_id')
      .eq('event_name', eventName)
      .lte('created_at', dateEnd);
    return new Set((data || []).map(e => e.anon_id)).size;
  };

  const stageSignup = await countUsersWithEvent('onboard_start');
  const stageOnboard = await countUsersWithEvent('onboard_complete');
  const stageFirstScan = await countUsersWithEvent('scan_complete');
  const stageVaultItem = await countUsersWithEvent('vault_add');
  const stageOracleChat = await countUsersWithEvent('oracle_chat');
  const stageShare = await countUsersWithEvent('share_completed');
  const stageMarketplace = await countUsersWithEvent('listing_created');
  const stageSubscription = await countUsersWithEvent('subscription_created');

  const rate = (num: number, den: number) => den > 0 ? parseFloat((num / den).toFixed(4)) : null;

  await supabase
    .from('analytics_funnel')
    .upsert({
      snapshot_date: snapshotDate,
      stage_signup: stageSignup,
      stage_onboard: stageOnboard,
      stage_first_scan: stageFirstScan,
      stage_vault_item: stageVaultItem,
      stage_oracle_chat: stageOracleChat,
      stage_share: stageShare,
      stage_marketplace: stageMarketplace,
      stage_subscription: stageSubscription,
      signup_to_onboard: rate(stageOnboard, stageSignup),
      onboard_to_scan: rate(stageFirstScan, stageOnboard),
      scan_to_vault: rate(stageVaultItem, stageFirstScan),
      vault_to_oracle: rate(stageOracleChat, stageVaultItem),
      oracle_to_share: rate(stageShare, stageOracleChat),
      share_to_subscribe: rate(stageSubscription, stageShare),
    }, { onConflict: 'snapshot_date' });
}

// =============================================================================
// LIVE KPI QUERIES — for the dashboard
// =============================================================================

/**
 * Get live KPIs (real-time counts from today).
 */
export async function getLiveKPIs(
  supabase: SupabaseClient
): Promise<{
  todayDAU: number;
  todayScans: number;
  todayOracleChats: number;
  todayShares: number;
  todayErrors: number;
  todayNewUsers: number;
  activeNow: number;
}> {
  const today = new Date().toISOString().split('T')[0];
  const todayStart = `${today}T00:00:00Z`;
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: todayEvents } = await supabase
    .from('analytics_events')
    .select('anon_id, event_name, event_category, created_at')
    .gte('created_at', todayStart);

  const events = todayEvents || [];

  return {
    todayDAU: new Set(events.map(e => e.anon_id)).size,
    todayScans: events.filter(e => e.event_name === 'scan_complete').length,
    todayOracleChats: events.filter(e => e.event_name === 'oracle_chat').length,
    todayShares: events.filter(e => e.event_name === 'share_completed').length,
    todayErrors: events.filter(e => e.event_category === 'error').length,
    todayNewUsers: events.filter(e => e.event_name === 'onboard_start').length,
    activeNow: new Set(events.filter(e => e.created_at >= fiveMinAgo).map(e => e.anon_id)).size,
  };
}

/**
 * Get historical daily KPIs for charting.
 */
export async function getDailyKPIs(
  supabase: SupabaseClient,
  days: number = 30
): Promise<any[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const { data } = await supabase
    .from('analytics_daily')
    .select('*')
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });

  return data || [];
}

/**
 * Get funnel data.
 */
export async function getFunnel(
  supabase: SupabaseClient
): Promise<any> {
  const { data } = await supabase
    .from('analytics_funnel')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  return data;
}

/**
 * Get feature usage breakdown.
 */
export async function getFeatureUsage(
  supabase: SupabaseClient,
  days: number = 7
): Promise<Record<string, number>> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data } = await supabase
    .from('analytics_events')
    .select('properties')
    .eq('event_name', 'feature_used')
    .gte('created_at', since);

  const usage: Record<string, number> = {};
  for (const e of (data || [])) {
    const feature = e.properties?.feature || 'unknown';
    usage[feature] = (usage[feature] || 0) + 1;
  }

  return usage;
}

// =============================================================================
// HELPERS
// =============================================================================

function scrubPII(props: Record<string, any>): Record<string, any> {
  const piiKeys = ['email', 'name', 'phone', 'address', 'ip', 'user_agent', 'screen_name',
    'display_name', 'full_name', 'user_id', 'userId', 'item_name', 'description',
    'content', 'message', 'query', 'search'];

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    if (piiKeys.includes(key.toLowerCase())) continue;
    if (typeof value === 'string' && value.includes('@')) continue; // Email pattern
    if (typeof value === 'string' && value.length > 200) continue; // Long text = content
    clean[key] = value;
  }
  return clean;
}

function detectPlatform(): string {
  // Server-side — platform is passed from client
  return 'server';
}