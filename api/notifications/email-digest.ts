// FILE: api/notifications/email-digest.ts
// Email Digest System
// Sends personalized weekly digest of new listings matching user preferences
// Can be triggered by cron job or manual request

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://tagnetiq.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'digest@tagnetiq.com';

interface DigestPreferences {
  user_id: string;
  email: string;
  screen_name: string;
  categories: string[];
  location_radius_miles: number;
  location_lat?: number;
  location_lng?: number;
  location_text?: string;
  price_min?: number;
  price_max?: number;
  frequency: 'daily' | 'weekly' | 'instant';
  last_digest_sent?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret or admin
  const cronSecret = req.headers['x-cron-secret'];
  const isAuthorized = cronSecret === process.env.CRON_SECRET;

  if (req.method === 'GET') {
    // Return digest stats
    const { data: stats } = await supabase
      .from('email_preferences')
      .select('frequency, created_at')
      .eq('digest_enabled', true);

    return res.status(200).json({
      total_subscribers: stats?.length || 0,
      by_frequency: {
        daily: stats?.filter(s => s.frequency === 'daily').length || 0,
        weekly: stats?.filter(s => s.frequency === 'weekly').length || 0,
        instant: stats?.filter(s => s.frequency === 'instant').length || 0,
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { frequency = 'weekly', user_id } = req.body;

  try {
    // Get users who need digest
    let query = supabase
      .from('email_preferences')
      .select(`
        user_id,
        categories,
        location_radius_miles,
        price_min,
        price_max,
        frequency,
        last_digest_sent,
        profiles!email_preferences_user_id_fkey (
          email,
          screen_name,
          location_text,
          location_lat,
          location_lng
        )
      `)
      .eq('digest_enabled', true)
      .eq('frequency', frequency);

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data: subscribers, error } = await query;

    if (error) throw error;

    const results = {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const subscriber of subscribers || []) {
      results.processed++;

      try {
        // Check if digest already sent recently
        if (shouldSkipDigest(subscriber.last_digest_sent, frequency)) {
          results.skipped++;
          continue;
        }

        // Get matching listings
        const listings = await getMatchingListings(subscriber);

        if (listings.length === 0) {
          results.skipped++;
          continue;
        }

        // Generate and send email
        const profile = subscriber.profiles as any;
        await sendDigestEmail({
          to: profile.email,
          name: profile.screen_name,
          listings,
          preferences: {
            ...subscriber,
            location_text: profile.location_text,
          },
        });

        // Update last sent timestamp
        await supabase
          .from('email_preferences')
          .update({ last_digest_sent: new Date().toISOString() })
          .eq('user_id', subscriber.user_id);

        results.sent++;
      } catch (err: any) {
        results.errors.push(`${subscriber.user_id}: ${err.message}`);
      }
    }

    // Log digest run
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'email_digest_run',
      resource_type: 'system',
      resource_id: frequency,
      details: results,
    });

    return res.status(200).json(results);
  } catch (error: any) {
    console.error('Digest error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function shouldSkipDigest(lastSent: string | undefined, frequency: string): boolean {
  if (!lastSent) return false;

  const lastSentDate = new Date(lastSent);
  const now = new Date();
  const hoursSince = (now.getTime() - lastSentDate.getTime()) / (1000 * 60 * 60);

  switch (frequency) {
    case 'instant': return hoursSince < 1;
    case 'daily': return hoursSince < 20; // Allow some buffer
    case 'weekly': return hoursSince < 144; // ~6 days
    default: return false;
  }
}

async function getMatchingListings(subscriber: any): Promise<any[]> {
  const profile = subscriber.profiles as any;
  const since = getDigestSince(subscriber.frequency, subscriber.last_digest_sent);

  let query = supabase
    .from('arena_listings')
    .select(`
      id, item_name, asking_price, estimated_value, category,
      primary_photo_url, is_verified, created_at,
      profiles!arena_listings_seller_id_fkey ( screen_name, location_text )
    `)
    .eq('status', 'active')
    .eq('is_public', true)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);

  // Filter by categories
  if (subscriber.categories?.length > 0) {
    query = query.in('category', subscriber.categories);
  }

  // Filter by price
  if (subscriber.price_min) {
    query = query.gte('asking_price', subscriber.price_min);
  }
  if (subscriber.price_max) {
    query = query.lte('asking_price', subscriber.price_max);
  }

  const { data: listings } = await query;

  // Filter by location if user has location
  if (profile.location_lat && profile.location_lng && subscriber.location_radius_miles) {
    // In production, use PostGIS for proper distance calculation
    // For now, just return all listings (location filtering would be done in DB)
    return listings || [];
  }

  return listings || [];
}

function getDigestSince(frequency: string, lastSent?: string): string {
  if (lastSent) return lastSent;

  const now = new Date();
  switch (frequency) {
    case 'instant': return new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    case 'daily': return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case 'weekly': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}

async function sendDigestEmail(params: {
  to: string;
  name: string;
  listings: any[];
  preferences: any;
}): Promise<void> {
  const { to, name, listings, preferences } = params;

  const subject = `🏷️ ${listings.length} new items ${preferences.location_text ? `near ${preferences.location_text}` : 'for you'}`;

  const html = generateDigestHTML(name, listings, preferences);

  // Send via Resend (or your email provider)
  if (RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `TagnetIQ <${FROM_EMAIL}>`,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Email send failed: ${response.status}`);
    }
  } else {
    console.log(`[DEV] Would send email to ${to}: ${subject}`);
  }
}

function generateDigestHTML(name: string, listings: any[], preferences: any): string {
  const listingsHTML = listings.map(listing => {
    const price = listing.asking_price?.toFixed(2) || '0.00';
    const hasDiscount = listing.estimated_value > listing.asking_price;
    const discount = hasDiscount 
      ? Math.round((1 - listing.asking_price / listing.estimated_value) * 100) 
      : 0;

    return `
      <tr>
        <td style="padding: 16px; border-bottom: 1px solid #333;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="80" style="vertical-align: top;">
                <a href="${DOMAIN}/marketplace/${listing.id}">
                  <img src="${listing.primary_photo_url || `${DOMAIN}/placeholder.svg`}" 
                       alt="${listing.item_name}" 
                       width="80" height="80" 
                       style="border-radius: 8px; object-fit: cover;">
                </a>
              </td>
              <td style="padding-left: 16px; vertical-align: top;">
                <a href="${DOMAIN}/marketplace/${listing.id}" 
                   style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                  ${escapeHtml(listing.item_name)}
                </a>
                ${listing.is_verified ? '<span style="color: #22c55e; font-size: 12px;"> ✓ Verified</span>' : ''}
                <div style="margin-top: 4px;">
                  <span style="color: #22c55e; font-size: 20px; font-weight: 700;">$${price}</span>
                  ${hasDiscount ? `<span style="color: #f59e0b; font-size: 14px; margin-left: 8px;">${discount}% off</span>` : ''}
                </div>
                <div style="color: #888; font-size: 12px; margin-top: 4px;">
                  📍 ${listing.profiles?.location_text || 'USA'} • ${listing.category || 'Collectibles'}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Listings for You</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #171717; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 24px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <img src="${DOMAIN}/tagnetiq-logo-white.png" alt="TagnetIQ" height="32" style="height: 32px;">
                  </td>
                  <td align="right">
                    <span style="color: #ffffff; font-size: 14px;">Weekly Digest</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 24px 24px 16px 24px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Hey ${escapeHtml(name || 'Collector')}! 👋
              </h1>
              <p style="margin: 8px 0 0 0; color: #888; font-size: 14px;">
                ${listings.length} new item${listings.length !== 1 ? 's' : ''} matching your interests
                ${preferences.location_text ? ` near ${preferences.location_text}` : ''}
              </p>
            </td>
          </tr>
          
          <!-- Listings -->
          <tr>
            <td style="padding: 0 24px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
                ${listingsHTML}
              </table>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 24px;" align="center">
              <a href="${DOMAIN}/marketplace" 
                 style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 16px;">
                Browse All Listings →
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; border-top: 1px solid #333;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="color: #666; font-size: 12px;">
                    <p style="margin: 0;">You're receiving this because you enabled digest emails.</p>
                    <p style="margin: 8px 0 0 0;">
                      <a href="${DOMAIN}/settings/notifications" style="color: #3b82f6; text-decoration: none;">Manage preferences</a> •
                      <a href="${DOMAIN}/unsubscribe?type=digest" style="color: #3b82f6; text-decoration: none;">Unsubscribe</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function escapeHtml(str: string): string {
  return (str || '').replace(/[&<>"']/g, c => 
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
  );
}