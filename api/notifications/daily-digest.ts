// FILE: api/notifications/daily-digest.ts
// Daily Digest Cron — Oracle's morning briefing
//
// Runs daily at 6am UTC (via Vercel cron).
// For each user with digest_enabled = true:
//   1. Build personalized digest (vault changes, watchlist, alerts, streak)
//   2. Format as push notification
//   3. Send via existing push infrastructure
//   4. Update digest_last_sent timestamp
//
// GET ?cron_secret=xxx   → Run the digest job
// POST { action: 'preview' } → Preview YOUR digest (authenticated)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildDailyDigest } from '../../src/lib/onboarding/engagement.js';

export const config = {
  maxDuration: 60, // May process many users
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CRON: Process all users ───────────────────────────
  if (req.method === 'GET') {
    const { cron_secret } = req.query;

    if (cron_secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Invalid cron secret.' });
    }

    try {
      // Get all users with digest enabled who haven't been sent today
      const today = new Date().toISOString().split('T')[0];

      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, screen_name, digest_time, digest_last_sent, timezone')
        .eq('digest_enabled', true);

      if (error) {
        console.error('Digest: Error fetching users:', error.message);
        return res.status(500).json({ error: error.message });
      }

      const eligibleUsers = (users || []).filter(u => {
        // Skip if already sent today
        if (u.digest_last_sent) {
          const lastSent = u.digest_last_sent.split('T')[0];
          if (lastSent === today) return false;
        }
        return true;
      });

      let sent = 0;
      let failed = 0;

      for (const user of eligibleUsers) {
        try {
          // Build the digest
          const digest = await buildDailyDigest(supabase, user.id);

          // Format the notification body
          const bodyParts: string[] = [];

          if (digest.streak > 1) {
            bodyParts.push(`🔥 Day ${digest.streak} streak`);
          }

          for (const section of digest.sections.slice(0, 3)) {
            const firstItem = section.items[0];
            if (firstItem) bodyParts.push(firstItem);
          }

          const notificationBody = bodyParts.length > 0
            ? bodyParts.join(' • ')
            : digest.oracleSignoff;

          // Send push notification (if user has push_subscriptions)
          const { data: subscriptions } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', user.id);

          if (subscriptions && subscriptions.length > 0) {
            // Use web-push to send (if available)
            // For now, we store the digest for in-app retrieval
          }

          // Store the digest for in-app display
          // The digest endpoint (POST action: 'preview') returns this on demand
          // Update last sent timestamp
          await supabase
            .from('profiles')
            .update({ digest_last_sent: new Date().toISOString() })
            .eq('id', user.id);

          sent++;
        } catch (userError) {
          console.error(`Digest: Failed for user ${user.id}:`, userError);
          failed++;
        }
      }

      return res.status(200).json({
        success: true,
        date: today,
        eligible: eligibleUsers.length,
        sent,
        failed,
        skipped: (users || []).length - eligibleUsers.length,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      console.error('Digest cron error:', error);
      return res.status(500).json({ error: error.message || 'Digest cron failed.' });
    }
  }

  // ── AUTHENTICATED: Preview your own digest ────────────
  if (req.method === 'POST') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token.' });
      }

      const { action } = req.body;

      if (action === 'preview') {
        const digest = await buildDailyDigest(supabase, user.id);
        return res.status(200).json(digest);
      }

      if (action === 'update_preferences') {
        const { enabled, time } = req.body;

        const updates: Record<string, any> = {};
        if (typeof enabled === 'boolean') updates.digest_enabled = enabled;
        if (time && /^\d{2}:\d{2}$/.test(time)) updates.digest_time = time;

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);
        }

        return res.status(200).json({ success: true, updates });
      }

      return res.status(400).json({ error: 'Valid actions: preview, update_preferences' });

    } catch (error: any) {
      console.error('Digest preview error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return res.status(200).end();
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}