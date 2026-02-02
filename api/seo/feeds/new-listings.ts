// FILE: api/seo/feeds/new-listings.ts
// RSS feed for new listings - can be used by:
// - RSS readers
// - IFTTT automation
// - Zapier integrations
// - Discord/Slack webhooks

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { SEO_CONFIG, isFeatureEnabled, getDisabledResponse } from '../config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isFeatureEnabled('productFeed')) {
    return getDisabledResponse(res, 'xml');
  }

  const category = req.query.category as string | undefined;
  const hours = parseInt(req.query.hours as string) || 24;

  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('arena_listings')
      .select(`
        id, item_name, description, asking_price, category,
        primary_photo_url, is_verified, created_at,
        profiles!arena_listings_seller_id_fkey ( screen_name, location_text )
      `)
      .eq('status', 'active')
      .eq('is_public', true)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);

    if (category) {
      query = query.eq('category', category);
    }

    const { data: listings, error } = await query;

    if (error) throw error;

    const { domain, siteName } = SEO_CONFIG;
    const feedTitle = category 
      ? `New ${category} Listings on ${siteName}`
      : `New Listings on ${siteName}`;

    const items = (listings || []).map(listing => `
    <item>
      <title><![CDATA[${listing.item_name}]]></title>
      <link>${domain}/marketplace/${listing.id}</link>
      <guid isPermaLink="true">${domain}/marketplace/${listing.id}</guid>
      <pubDate>${new Date(listing.created_at).toUTCString()}</pubDate>
      <description><![CDATA[
        $${listing.asking_price?.toFixed(2)} - ${listing.description || listing.item_name}
        ${listing.is_verified ? '✓ Verified' : ''}
        📍 ${listing.profiles?.location_text || 'USA'}
      ]]></description>
      <category>${listing.category || 'Collectibles'}</category>
      ${listing.primary_photo_url ? `<enclosure url="${listing.primary_photo_url}" type="image/jpeg"/>` : ''}
    </item>`).join('\n');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${feedTitle}</title>
    <link>${domain}/marketplace${category ? `?category=${category}` : ''}</link>
    <description>Latest listings from ${siteName}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${domain}/api/seo/feeds/new-listings${category ? `?category=${category}` : ''}" rel="self" type="application/rss+xml"/>
    <ttl>30</ttl>
    ${items}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml');
    res.setHeader('Cache-Control', 'public, s-maxage=1800');
    return res.status(200).send(rss);
  } catch (error: any) {
    console.error('RSS feed error:', error);
    return res.status(500).send(`<?xml version="1.0"?><error>${error.message}</error>`);
  }
}