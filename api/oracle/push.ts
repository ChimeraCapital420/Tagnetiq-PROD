// FILE: api/oracle/push.ts
// Push Notification Management API
//
// Sprint I: Device registration + preference management
//
// Endpoints (action-based):
//   POST { action: 'register', deviceType, transport, subscription, ... }
//   POST { action: 'unregister', subscriptionId }
//   POST { action: 'devices' }                        → List registered devices
//   POST { action: 'preferences', subscriptionId, ... } → Update notification prefs
//   POST { action: 'test', subscriptionId }            → Send test notification

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import {
  registerDevice,
  unregisterDevice,
  getDevices,
  updatePreferences,
  pushAlert,
} from '../../src/lib/oracle/argos/push.js';

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

    if (!action || typeof action !== 'string') {
      return res.status(400).json({ error: 'An "action" string is required.' });
    }

    switch (action) {
      // ── Register a device ───────────────────────────────
      case 'register': {
        const { deviceType, deviceName, deviceId, transport, subscription } = req.body;

        if (!deviceType || !transport || !subscription) {
          return res.status(400).json({
            error: 'Required: deviceType, transport, subscription',
          });
        }

        const result = await registerDevice(supabaseAdmin, user.id, {
          deviceType,
          deviceName,
          deviceId,
          transport,
          subscription,
        });

        if (!result) {
          return res.status(500).json({ error: 'Failed to register device.' });
        }

        return res.status(200).json({
          success: true,
          subscriptionId: result.id,
          message: `${deviceName || deviceType} registered for push notifications.`,
        });
      }

      // ── Unregister a device ─────────────────────────────
      case 'unregister': {
        const { subscriptionId } = req.body;
        if (!subscriptionId) {
          return res.status(400).json({ error: 'subscriptionId is required.' });
        }

        const success = await unregisterDevice(supabaseAdmin, user.id, subscriptionId);
        return res.status(200).json({ success });
      }

      // ── List registered devices ─────────────────────────
      case 'devices': {
        const devices = await getDevices(supabaseAdmin, user.id);
        return res.status(200).json({ devices, count: devices.length });
      }

      // ── Update notification preferences ─────────────────
      case 'preferences': {
        const { subscriptionId: prefSubId, ...prefs } = req.body;
        // Remove non-preference fields
        delete prefs.action;

        if (!prefSubId) {
          return res.status(400).json({ error: 'subscriptionId is required.' });
        }

        // Whitelist allowed preference fields
        const allowed = [
          'notify_price_drops', 'notify_price_spikes', 'notify_hunt_results',
          'notify_market_trends', 'notify_vault_milestones', 'notify_oracle_nudges',
          'quiet_hours_start', 'quiet_hours_end',
        ];

        const cleanPrefs: Record<string, any> = {};
        for (const key of allowed) {
          if (key in prefs) cleanPrefs[key] = prefs[key];
        }

        if (Object.keys(cleanPrefs).length === 0) {
          return res.status(400).json({ error: 'No valid preference fields provided.' });
        }

        const success = await updatePreferences(supabaseAdmin, user.id, prefSubId, cleanPrefs);
        return res.status(200).json({ success });
      }

      // ── Send test notification ──────────────────────────
      case 'test': {
        const { subscriptionId: testSubId } = req.body;

        const testAlert = {
          user_id: user.id,
          alert_type: 'oracle_nudge' as const,
          priority: 'normal' as const,
          title: '🔮 Push notifications are working!',
          body: 'Argos is connected and watching your vault. You\'ll be the first to know about price changes.',
        };

        const result = await pushAlert(supabaseAdmin, testAlert);
        return res.status(200).json({
          success: result.delivered > 0,
          ...result,
        });
      }

      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid: register, unregister, devices, preferences, test`,
        });
    }

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Push API error:', errMsg);
    return res.status(500).json({ error: 'Notification service hiccup. Try again.' });
  }
}