// FILE: api/seo/price-alerts.ts
// Price drop alerts feed for Google Shopping
// Shows items with recent price reductions
// Kill switch: SEO_ENABLED environment variable

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { SEO_CONFIG, isFeatureEnabled, getDisabledResponse } from './config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Kill switch check
  if (!isFeatureEnabled('priceAlerts')) {
    return getDisabledResponse(res, 'xml');
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch items where asking_price < estimated_value (deals)
    const { data: listings, error } = await supabase
      .from('arena_listings')
      .select(`
        id,
        item_name,
        description,
        asking_price,
        estimated_value,
        category,
        condition,
        primary_photo_url,
        is_verified,
        created_at,
        updated_at,
        profiles!arena_listings_seller_id_fkey (
          screen_name,
          location_text
        )
      `)
      .eq('status', 'active')
      .eq('is_public', true)
      .not('estimated_value', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    // Filter to items with actual discounts (at least 10% off)
    const deals = (listings || []).filter(l => {
      if (!l.estimated_value || !l.asking_price) return false;
      const discount = (l.estimated_value - l.asking_price) / l.estimated_value;
      return discount >= 0.1; // At least 10% off
    });

    const xml = generatePriceAlertsFeed(deals);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).send(xml);
  } catch (error: any) {
    console.error('Price alerts feed error:', error);
    return res.status(500).send(`<?xml version="1.0"?><error>${error.message}</error>`);
  }
}

function generatePriceAlertsFeed(listings: any[]): string {
  const { domain, siteName } = SEO_CONFIG;

  const items = listings.map(listing => {
    const profile = listing.profiles;
    const currentPrice = listing.asking_price?.toFixed(2) || '0.00';
    const originalPrice = listing.estimated_value?.toFixed(2) || currentPrice;
    const discount = Math.round(((listing.estimated_value - listing.asking_price) / listing.estimated_value) * 100);
    
    const title = escapeXml((listing.item_name || 'Item').slice(0, 150));
    const description = escapeXml(
      `🔥 ${discount}% OFF! Was $${originalPrice}, now $${currentPrice}. ${(listing.description || '').slice(0, 300)}`
    );
    
    const listingUrl = `${domain}/marketplace/${listing.id}`;
    const imageUrl = listing.primary_photo_url || `${domain}/placeholder.svg`;

    return `
    <item>
      <g:id>deal-${listing.id}</g:id>
      <g:title><![CDATA[🔥 ${discount}% OFF: ${title}]]></g:title>
      <g:description><![CDATA[${description}]]></g:description>
      <g:link>${listingUrl}?utm_source=google&amp;utm_medium=shopping&amp;utm_campaign=price_drop</g:link>
      <g:image_link>${imageUrl}</g:image_link>
      <g:condition>used</g:condition>
      <g:availability>in_stock</g:availability>
      <g:price>${originalPrice} USD</g:price>
      <g:sale_price>${currentPrice} USD</g:sale_price>
      <g:sale_price_effective_date>${new Date().toISOString()}/${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}</g:sale_price_effective_date>
      <g:brand>${siteName}</g:brand>
      <g:google_product_category>Collectibles</g:google_product_category>
      <g:custom_label_0>Price Drop</g:custom_label_0>
      <g:custom_label_1>${discount}% Off</g:custom_label_1>
      ${listing.is_verified ? '<g:custom_label_2>Verified</g:custom_label_2>' : ''}
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${siteName} - Price Drops &amp; Deals</title>
    <link>${domain}/marketplace?sort=deals</link>
    <description>Latest price drops and deals on verified collectibles</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}