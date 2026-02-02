// FILE: api/seo/product-feed.ts
// Google Merchant Center Product Feed (XML format)
// Submit this URL to Google Merchant Center when SEO is enabled
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
  if (!isFeatureEnabled('productFeed')) {
    return getDisabledResponse(res, 'xml');
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
        additional_photos,
        is_verified,
        created_at,
        updated_at,
        seller_id,
        profiles!arena_listings_seller_id_fkey (
          screen_name,
          location_text
        )
      `)
      .eq('status', 'active')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(SEO_CONFIG.crawl.maxListingsInFeed);

    if (error) throw error;

    const xml = generateGoogleShoppingFeed(listings || []);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).send(xml);
  } catch (error: any) {
    console.error('Product feed error:', error);
    return res.status(500).send(`<?xml version="1.0"?><error>${error.message}</error>`);
  }
}

function generateGoogleShoppingFeed(listings: any[]): string {
  const { domain, siteName } = SEO_CONFIG;

  const items = listings.map(listing => {
    const profile = listing.profiles;
    const location = profile?.location_text || 'United States';
    const price = listing.asking_price?.toFixed(2) || '0.00';
    
    const description = escapeXml(
      (listing.description || listing.item_name || '').slice(0, 5000)
    );
    const title = escapeXml(
      (listing.item_name || 'Item').slice(0, 150)
    );

    const conditionMap: Record<string, string> = {
      'new': 'new', 'mint': 'new', 'like_new': 'new',
      'excellent': 'refurbished',
      'good': 'used', 'fair': 'used', 'poor': 'used',
    };
    const googleCondition = conditionMap[listing.condition?.toLowerCase()] || 'used';

    const categoryMap: Record<string, string> = {
      'coins': 'Collectibles > Coins',
      'trading-cards': 'Toys & Games > Trading Cards',
      'sports': 'Sporting Goods > Sports Memorabilia',
      'electronics': 'Electronics',
      'lego': 'Toys & Games > Building Toys > Building Sets',
      'art': 'Arts & Entertainment > Collectibles > Art',
      'books': 'Media > Books',
      'luxury': 'Apparel & Accessories > Jewelry',
      'collectibles': 'Collectibles',
    };
    const googleCategory = categoryMap[listing.category?.toLowerCase()] || 'Collectibles';

    // Use dynamic OG image if enabled
    const imageUrl = isFeatureEnabled('ogImages')
      ? `${domain}/api/seo/og-image/${listing.id}`
      : (listing.primary_photo_url || `${domain}/placeholder.svg`);
    
    const productImageUrl = listing.primary_photo_url || `${domain}/placeholder.svg`;
    const listingUrl = `${domain}/marketplace/${listing.id}`;

    return `
    <item>
      <g:id>${listing.id}</g:id>
      <g:title><![CDATA[${title}]]></g:title>
      <g:description><![CDATA[${description}]]></g:description>
      <g:link>${listingUrl}</g:link>
      <g:image_link>${productImageUrl}</g:image_link>
      ${listing.additional_photos?.length ? listing.additional_photos.slice(0, 9).map((url: string) => 
        `<g:additional_image_link>${url}</g:additional_image_link>`
      ).join('\n      ') : ''}
      <g:condition>${googleCondition}</g:condition>
      <g:availability>in_stock</g:availability>
      <g:price>${price} USD</g:price>
      ${listing.estimated_value && listing.estimated_value > listing.asking_price ? 
        `<g:sale_price>${price} USD</g:sale_price>` : ''}
      <g:brand>${siteName}</g:brand>
      <g:google_product_category>${googleCategory}</g:google_product_category>
      <g:product_type><![CDATA[${listing.category || 'Collectibles'}]]></g:product_type>
      <g:identifier_exists>false</g:identifier_exists>
      <g:shipping>
        <g:country>US</g:country>
        <g:service>Standard</g:service>
        <g:price>0 USD</g:price>
      </g:shipping>
      ${listing.is_verified ? '<g:custom_label_0>Verified</g:custom_label_0>' : ''}
      <g:custom_label_1>${escapeXml(profile?.screen_name || 'Seller')}</g:custom_label_1>
      <g:custom_label_2>${escapeXml(location)}</g:custom_label_2>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${siteName}</title>
    <link>${domain}</link>
    <description>Verified collectibles and unique items from trusted sellers</description>
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