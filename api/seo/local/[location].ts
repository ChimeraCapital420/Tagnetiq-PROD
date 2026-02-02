// FILE: api/seo/local/[location].ts  
// Creates location-specific landing pages
// "Collectibles for sale in Hoboken, NJ"

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { SEO_CONFIG, isFeatureEnabled, isCrawler } from '../config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { location } = req.query;
  const { domain, siteName } = SEO_CONFIG;

  if (!location || typeof location !== 'string') {
    return res.status(400).json({ error: 'Missing location' });
  }

  const userAgent = req.headers['user-agent'] || '';
  
  // Redirect real users to filtered marketplace
  if (!isCrawler(userAgent) || !isFeatureEnabled('richSnippets')) {
    return res.redirect(302, `/marketplace?location=${encodeURIComponent(location)}`);
  }

  try {
    // Normalize location for search
    const locationSearch = `%${location.replace(/-/g, ' ')}%`;

    const { data: listings, error } = await supabase
      .from('arena_listings')
      .select(`
        id, item_name, asking_price, primary_photo_url, category, is_verified,
        profiles!arena_listings_seller_id_fkey ( screen_name, location_text )
      `)
      .eq('status', 'active')
      .eq('is_public', true)
      .ilike('profiles.location_text', locationSearch)
      .limit(50);

    if (error) throw error;

    const locationName = location.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const itemCount = listings?.length || 0;

    const html = generateLocationPage(locationName, listings || [], itemCount);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).send(html);
  } catch (error: any) {
    console.error('Local SEO error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function generateLocationPage(location: string, listings: any[], count: number): string {
  const { domain, siteName } = SEO_CONFIG;
  const title = `Collectibles for Sale in ${location} | ${siteName}`;
  const description = `Find ${count}+ verified collectibles, memorabilia, and unique items for sale in ${location}. Buy local from trusted sellers on ${siteName}.`;

  // Local Business Schema
  const localSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    description,
    numberOfItems: count,
    itemListElement: listings.slice(0, 10).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: item.item_name,
        url: `${domain}/marketplace/${item.id}`,
        image: item.primary_photo_url,
        offers: {
          '@type': 'Offer',
          price: item.asking_price?.toFixed(2),
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
      },
    })),
  };

  const listingsHtml = listings.map(item => `
    <div style="border:1px solid #333;border-radius:12px;padding:16px;background:#1a1a1a;">
      <a href="${domain}/marketplace/${item.id}" style="text-decoration:none;color:inherit;">
        <img src="${item.primary_photo_url || `${domain}/placeholder.svg`}" 
             style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;margin-bottom:12px;">
        <div style="color:#fff;font-weight:600;margin-bottom:4px;">${escapeHtml(item.item_name)}</div>
        <div style="color:#22c55e;font-size:20px;font-weight:700;">$${item.asking_price?.toFixed(2)}</div>
        ${item.is_verified ? '<div style="color:#22c55e;font-size:12px;margin-top:4px;">✓ Verified</div>' : ''}
      </a>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${domain}/local/${location.toLowerCase().replace(/\s+/g, '-')}">
  
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  
  <script type="application/ld+json">${JSON.stringify(localSchema)}</script>
  
  <style>
    body { font-family: sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 32px; margin-bottom: 8px; }
    .subtitle { color: #888; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
    .cta { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Collectibles for Sale in ${escapeHtml(location)}</h1>
    <p class="subtitle">${count} items available from local sellers</p>
    
    <div class="grid">
      ${listingsHtml}
    </div>
    
    <a href="${domain}/marketplace?location=${encodeURIComponent(location)}" class="cta">
      View All ${count} Items in ${escapeHtml(location)} →
    </a>
  </div>
  
  <script>
    if (!navigator.userAgent.match(/bot|crawl|spider/i)) {
      window.location.replace('${domain}/marketplace?location=${encodeURIComponent(location)}');
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return (str || '').replace(/[&<>"']/g, c => 
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
  );
}