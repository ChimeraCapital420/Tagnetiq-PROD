// FILE: api/notifications/push-subscribe.ts
// Web Push Notification subscription management
// Mobile-first: Works with service workers for background notifications

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // POST: Subscribe to push notifications
  if (req.method === 'POST') {
    const { subscription, categories, notify_types } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh,
        auth: subscription.keys?.auth,
        categories: categories || [],
        notify_watchlist: notify_types?.watchlist ?? true,
        notify_price_drops: notify_types?.price_drops ?? true,
        notify_messages: notify_types?.messages ?? true,
        notify_sales: notify_types?.sales ?? true,
        user_agent: req.headers['user-agent'] || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,endpoint',
      })
      .select()
      .single();

    if (error) {
      console.error('Push subscribe error:', error);
      return res.status(500).json({ error: 'Failed to save subscription' });
    }

    return res.status(200).json({ 
      success: true, 
      subscription_id: data.id,
      message: 'Push notifications enabled',
    });
  }

  // GET: Get user's push subscriptions
  if (req.method === 'GET') {
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, categories, notify_watchlist, notify_price_drops, notify_messages, notify_sales, created_at')
      .eq('user_id', user.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      subscriptions: subs || [],
      count: subs?.length || 0,
    });
  }

  // DELETE: Unsubscribe
  if (req.method === 'DELETE') {
    const { endpoint, all } = req.body;

    if (all) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);
    } else if (endpoint) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint);
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}