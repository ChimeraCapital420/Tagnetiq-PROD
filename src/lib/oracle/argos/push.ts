// FILE: src/lib/oracle/argos/push.ts
// Argos Push Notification Service
//
// Sprint I: Push notifications — Argos alerts reach users when app is closed
//
// Device-agnostic push system:
//   - Web Push API (PWA / browser)
//   - FCM (Android / React Native)
//   - APNs (iOS) — ready for integration
//   - Custom transport (smart glasses SDK — future)
//
// When Argos generates an alert, this service delivers it to ALL of the
// user's registered devices that match the alert type preferences.
//
// Mobile-first: Users configure notification preferences per-device.
// Quiet hours respected. Dead subscriptions auto-cleaned.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ArgosAlert } from './engine.js';

// =============================================================================
// TYPES
// =============================================================================

export type DeviceType = 'web' | 'android' | 'ios' | 'glasses' | 'other';
export type PushTransport = 'web_push' | 'fcm' | 'apns' | 'custom';

export interface PushSubscription {
  id: string;
  user_id: string;
  device_type: DeviceType;
  device_name: string | null;
  device_id: string | null;
  transport: PushTransport;
  subscription: WebPushPayload | FcmPayload | ApnsPayload | Record<string, any>;
  is_active: boolean;
  notify_price_drops: boolean;
  notify_price_spikes: boolean;
  notify_hunt_results: boolean;
  notify_market_trends: boolean;
  notify_vault_milestones: boolean;
  notify_oracle_nudges: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export interface WebPushPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface FcmPayload {
  token: string;
}

export interface ApnsPayload {
  deviceToken: string;
}

export interface PushResult {
  targeted: number;
  delivered: number;
  failed: number;
  skipped: number;
}

// Alert type → preference field mapping
const ALERT_PREFERENCE_MAP: Record<string, keyof PushSubscription> = {
  'price_drop': 'notify_price_drops',
  'price_spike': 'notify_price_spikes',
  'new_listing': 'notify_price_drops',
  'market_trend': 'notify_market_trends',
  'flip_opportunity': 'notify_price_spikes',
  'vault_milestone': 'notify_vault_milestones',
  'hunt_result': 'notify_hunt_results',
  'oracle_nudge': 'notify_oracle_nudges',
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Send a push notification for an Argos alert to all of a user's devices.
 * Respects per-device notification preferences and quiet hours.
 */
export async function pushAlert(
  supabase: SupabaseClient,
  alert: ArgosAlert
): Promise<PushResult> {
  const result: PushResult = { targeted: 0, delivered: 0, failed: 0, skipped: 0 };

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', alert.user_id)
    .eq('is_active', true);

  if (!subs || subs.length === 0) return result;

  result.targeted = subs.length;

  for (const sub of subs) {
    const prefKey = ALERT_PREFERENCE_MAP[alert.alert_type];
    if (prefKey && sub[prefKey] === false) {
      result.skipped++;
      continue;
    }

    if (isQuietHours(sub.quiet_hours_start, sub.quiet_hours_end)) {
      result.skipped++;
      continue;
    }

    try {
      await sendPush(sub, alert);
      result.delivered++;

      supabase
        .from('push_subscriptions')
        .update({
          last_pushed_at: new Date().toISOString(),
          push_count: sub.push_count + 1,
        })
        .eq('id', sub.id)
        .then(() => {})
        .catch(() => {});

    } catch (err: any) {
      result.failed++;
      console.warn(`Push failed for ${sub.device_type}/${sub.id}: ${err.message}`);

      const newErrorCount = (sub.error_count || 0) + 1;
      supabase
        .from('push_subscriptions')
        .update({
          error_count: newErrorCount,
          last_error: err.message,
          is_active: newErrorCount < 5,
        })
        .eq('id', sub.id)
        .then(() => {})
        .catch(() => {});
    }
  }

  return result;
}

/**
 * Send push notifications for multiple alerts (batch).
 */
export async function pushAlertBatch(
  supabase: SupabaseClient,
  alerts: ArgosAlert[]
): Promise<PushResult> {
  const totals: PushResult = { targeted: 0, delivered: 0, failed: 0, skipped: 0 };

  const byUser = new Map<string, ArgosAlert[]>();
  for (const alert of alerts) {
    const existing = byUser.get(alert.user_id) || [];
    existing.push(alert);
    byUser.set(alert.user_id, existing);
  }

  for (const [userId, userAlerts] of byUser) {
    const toSend = prioritizeAlerts(userAlerts).slice(0, 3);

    for (const alert of toSend) {
      const result = await pushAlert(supabase, alert);
      totals.targeted += result.targeted;
      totals.delivered += result.delivered;
      totals.failed += result.failed;
      totals.skipped += result.skipped;
    }
  }

  return totals;
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

/**
 * Register a device for push notifications.
 * Uses manual check-then-insert pattern (not upsert) because
 * the unique index on (user_id, device_id) is partial (WHERE device_id IS NOT NULL)
 * and Supabase PostgREST can't use partial indexes for upsert conflict targets.
 */
export async function registerDevice(
  supabase: SupabaseClient,
  userId: string,
  params: {
    deviceType: DeviceType;
    deviceName?: string;
    deviceId?: string;
    transport: PushTransport;
    subscription: Record<string, any>;
  }
): Promise<{ id: string } | null> {
  // If device_id provided, check for existing registration first
  if (params.deviceId) {
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('device_id', params.deviceId)
      .maybeSingle();

    if (existing) {
      // Update existing registration (reactivate + refresh token)
      const { data, error } = await supabase
        .from('push_subscriptions')
        .update({
          device_type: params.deviceType,
          device_name: params.deviceName || null,
          transport: params.transport,
          subscription: params.subscription,
          is_active: true,
          error_count: 0,
          last_error: null,
        })
        .eq('id', existing.id)
        .select('id')
        .single();

      if (error) {
        console.warn('Push registration update failed:', error.message);
        return null;
      }
      return data;
    }
  }

  // Insert new registration
  const { data, error } = await supabase
    .from('push_subscriptions')
    .insert({
      user_id: userId,
      device_type: params.deviceType,
      device_name: params.deviceName || null,
      device_id: params.deviceId || null,
      transport: params.transport,
      subscription: params.subscription,
      is_active: true,
      error_count: 0,
      last_error: null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('Push registration insert failed:', error.message);
    return null;
  }
  return data;
}

/**
 * Unregister a device (deactivate, don't delete).
 */
export async function unregisterDevice(
  supabase: SupabaseClient,
  userId: string,
  subscriptionId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('id', subscriptionId)
    .eq('user_id', userId);

  return !error;
}

/**
 * Get all registered devices for a user.
 */
export async function getDevices(
  supabase: SupabaseClient,
  userId: string
): Promise<any[]> {
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id, device_type, device_name, transport, is_active, push_count, last_pushed_at, notify_price_drops, notify_price_spikes, notify_hunt_results, notify_market_trends, notify_vault_milestones, notify_oracle_nudges, quiet_hours_start, quiet_hours_end, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return data || [];
}

/**
 * Update notification preferences for a device.
 */
export async function updatePreferences(
  supabase: SupabaseClient,
  userId: string,
  subscriptionId: string,
  prefs: Partial<{
    notify_price_drops: boolean;
    notify_price_spikes: boolean;
    notify_hunt_results: boolean;
    notify_market_trends: boolean;
    notify_vault_milestones: boolean;
    notify_oracle_nudges: boolean;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
  }>
): Promise<boolean> {
  const { error } = await supabase
    .from('push_subscriptions')
    .update(prefs)
    .eq('id', subscriptionId)
    .eq('user_id', userId);

  return !error;
}

/**
 * Clean up dead subscriptions (5+ consecutive errors).
 */
export async function cleanupDeadSubscriptions(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .delete()
    .gte('error_count', 5)
    .select('id');

  if (error) return 0;
  return data?.length || 0;
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

async function sendPush(
  sub: PushSubscription,
  alert: ArgosAlert
): Promise<void> {
  const payload = buildPushPayload(alert);

  switch (sub.transport) {
    case 'web_push':
      await sendWebPush(sub.subscription as WebPushPayload, payload);
      break;
    case 'fcm':
      await sendFcm(sub.subscription as FcmPayload, payload);
      break;
    case 'apns':
      await sendApns(sub.subscription as ApnsPayload, payload);
      break;
    case 'custom':
      console.log(`Custom push for ${sub.device_type}: ${payload.title}`);
      break;
    default:
      throw new Error(`Unknown transport: ${sub.transport}`);
  }
}

function buildPushPayload(alert: ArgosAlert): {
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  data: Record<string, any>;
} {
  const iconMap: Record<string, string> = {
    price_drop: '📉',
    price_spike: '📈',
    new_listing: '🆕',
    market_trend: '📊',
    flip_opportunity: '💰',
    vault_milestone: '🏆',
    hunt_result: '🎯',
    oracle_nudge: '💡',
  };

  return {
    title: alert.title,
    body: alert.body,
    icon: iconMap[alert.alert_type] || '🔮',
    badge: '/icons/badge-72.png',
    tag: `argos-${alert.alert_type}-${alert.vault_item_id || 'general'}`,
    data: {
      alert_type: alert.alert_type,
      action_url: alert.action_url,
      action_label: alert.action_label,
      vault_item_id: alert.vault_item_id,
      item_name: alert.item_name,
    },
  };
}

async function sendWebPush(
  subscription: WebPushPayload,
  payload: ReturnType<typeof buildPushPayload>
): Promise<void> {
  try {
    const webpush = await import('web-push');

    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@tagnetiq.com';

    if (!vapidPublic || !vapidPrivate) {
      throw new Error('VAPID keys not configured');
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
      { TTL: 86400 }
    );
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.warn('web-push package not installed — skipping Web Push delivery');
      return;
    }
    throw err;
  }
}

async function sendFcm(
  subscription: FcmPayload,
  payload: ReturnType<typeof buildPushPayload>
): Promise<void> {
  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey) {
    throw new Error('FIREBASE_SERVER_KEY not configured');
  }

  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `key=${serverKey}`,
    },
    body: JSON.stringify({
      to: subscription.token,
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
      },
      data: payload.data,
    }),
  });

  if (!response.ok) {
    throw new Error(`FCM error: ${response.status}`);
  }
}

async function sendApns(
  subscription: ApnsPayload,
  payload: ReturnType<typeof buildPushPayload>
): Promise<void> {
  console.log(`APNs push queued for device ${subscription.deviceToken.slice(0, 8)}...: ${payload.title}`);
}

function isQuietHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

function prioritizeAlerts(alerts: ArgosAlert[]): ArgosAlert[] {
  const priorityOrder: Record<string, number> = {
    urgent: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  return [...alerts].sort(
    (a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3)
  );
}