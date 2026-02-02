// FILE: api/notifications/push-send.ts
// Send push notifications to subscribed users
// Triggered by events: new listing, price drop, message, sale

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://tagnetiq.com';

// Configure web-push with VAPID keys
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:push@tagnetiq.com`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export type PushEventType = 
  | 'new_listing'
  | 'price_drop' 
  | 'watchlist_match'
  | 'new_message'
  | 'sale_completed'
  | 'listing_sold';

interface PushPayload {
  event_type: PushEventType;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  data?: Record<string, any>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify internal call (from other API routes or webhooks)
  const internalSecret = req.headers['x-internal-secret'];
  if (internalSecret !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { 
    event_type,
    user_ids,
    category,
    listing_id,
    title,
    body,
    image,
  } = req.body as {
    event_type: PushEventType;
    user_ids?: string[];
    category?: string;
    listing_id?: string;
    title: string;
    body: string;
    image?: string;
  };

  if (!title || !body) {
    return res.status(400).json({ error: 'Missing title or body' });
  }

  try {
    // Build query for subscriptions
    let query = supabase
      .from('push_subscriptions')
      .select('*');

    // Filter by event type preferences
    switch (event_type) {
      case 'new_listing':
      case 'watchlist_match':
        query = query.eq('notify_watchlist', true);
        break;
      case 'price_drop':
        query = query.eq('notify_price_drops', true);
        break;
      case 'new_message':
        query = query.eq('notify_messages', true);
        break;
      case 'sale_completed':
      case 'listing_sold':
        query = query.eq('notify_sales', true);
        break;
    }

    // Filter by specific users if provided
    if (user_ids?.length) {
      query = query.in('user_id', user_ids);
    }

    // Filter by category if provided
    if (category) {
      query = query.contains('categories', [category]);
    }

    const { data: subscriptions, error } = await query;

    if (error) throw error;

    const results = {
      total: subscriptions?.length || 0,
      sent: 0,
      failed: 0,
      expired: [] as string[],
    };

    // Build notification payload
    const payload: PushPayload = {
      event_type,
      title,
      body,
      icon: `${DOMAIN}/icon-192.png`,
      badge: `${DOMAIN}/badge-72.png`,
      image,
      url: listing_id ? `${DOMAIN}/marketplace/${listing_id}` : `${DOMAIN}/marketplace`,
      data: { listing_id, category, event_type },
    };

    // Send to all matching subscriptions
    const sendPromises = (subscriptions || []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload),
          {
            TTL: 86400, // 24 hours
            urgency: event_type === 'new_message' ? 'high' : 'normal',
          }
        );
        results.sent++;
      } catch (err: any) {
        results.failed++;
        
        // Remove expired subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          results.expired.push(sub.id);
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    // Log notification send
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'push_notification_sent',
      resource_type: 'notification',
      resource_id: event_type,
      details: results,
    });

    return res.status(200).json(results);
  } catch (error: any) {
    console.error('Push send error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Helper function to send push notification from other API routes
export async function sendPushNotification(params: {
  event_type: PushEventType;
  user_ids?: string[];
  category?: string;
  listing_id?: string;
  title: string;
  body: string;
  image?: string;
}): Promise<void> {
  const response = await fetch(`${DOMAIN}/api/notifications/push-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    console.error('Failed to send push notification:', await response.text());
  }
}