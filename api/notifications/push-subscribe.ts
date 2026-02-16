// FILE: api/notifications/push-subscribe.ts
// Stores/removes web push subscriptions
// Called by usePushNotifications hook on the client

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function verifyUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // ── POST: Register push subscription ──────────────────
    if (req.method === 'POST') {
      const { subscription, device } = req.body;

      if (!subscription?.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription' });
      }

      // Upsert — update if same endpoint exists, insert if new
      const { error } = await supabaseAdmin
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            keys: subscription.keys || {},
            device_type: device?.type || 'web',
            user_agent: (device?.userAgent || '').substring(0, 512),
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        );

      if (error) {
        // Table might not exist yet — create it
        if (error.code === '42P01') {
          await createPushTable();
          // Retry
          await supabaseAdmin
            .from('push_subscriptions')
            .upsert(
              {
                user_id: user.id,
                endpoint: subscription.endpoint,
                keys: subscription.keys || {},
                device_type: device?.type || 'web',
                user_agent: (device?.userAgent || '').substring(0, 512),
                is_active: true,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'endpoint' }
            );
        } else {
          console.error('[Push] Subscribe error:', error);
          return res.status(500).json({ error: 'Failed to save subscription' });
        }
      }

      return res.status(200).json({ success: true });
    }

    // ── DELETE: Remove push subscription ───────────────────
    if (req.method === 'DELETE') {
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint required' });
      }

      await supabaseAdmin
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('endpoint', endpoint)
        .eq('user_id', user.id);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[Push] Handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// =============================================================================
// AUTO-CREATE TABLE (if first push subscriber)
// =============================================================================

async function createPushTable() {
  await supabaseAdmin.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
        endpoint TEXT UNIQUE NOT NULL,
        keys JSONB DEFAULT '{}',
        device_type TEXT DEFAULT 'web',
        user_agent TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id, is_active);
      ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
      GRANT ALL ON push_subscriptions TO service_role;
    `,
  }).catch(() => {
    // rpc might not exist — table creation is non-critical
    console.warn('[Push] Could not auto-create table — run migration manually');
  });
}
