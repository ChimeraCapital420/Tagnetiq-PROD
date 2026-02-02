// FILE: api/seo/sitemap.ts
// Dynamic XML Sitemap for Google Search Console
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
  if (!isFeatureEnabled('sitemap')) {
    return getDisabledResponse(res, 'xml');
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: listings, error } = await supabase
      .from('arena_listings')
      .select('id, updated_at, category, is_verified, item_name')
      .eq('status', 'active')
      .eq('is_public', true)
      .order('updated_at', { ascending: false })
      .limit(SEO_CONFIG.crawl.maxListingsInSitemap);

    if (error) throw error;

    const xml = generateSitemap(listings || []);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).send(xml);
  } catch (error: any) {
    console.error('Sitemap error:', error);
    return res.status(500).send(`<?xml version="1.0"?><error>${error.message}</error>`);
  }
}

function generateSitemap(listings: any[]): string {
  const { domain } = SEO_CONFIG;
  const now = new Date().toISOString();

  // Static pages
  const staticPages = [
    { url: '', priority: '1.0', changefreq: 'daily' },
    { url: '/marketplace', priority: '0.9', changefreq: 'hourly' },
    { url: '/arena', priority: '0.9', changefreq: 'hourly' },
    { url: '/about', priority: '0.5', changefreq: 'monthly' },
    { url: '/how-it-works', priority: '0.6', changefreq: 'monthly' },
    { url: '/pricing', priority: '0.6', changefreq: 'monthly' },
    { url: '/contact', priority: '0.4', changefreq: 'monthly' },
    { url: '/terms', priority: '0.3', changefreq: 'yearly' },
    { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
  ];

  const staticUrls = staticPages.map(page => `
  <url>
    <loc>${domain}${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('');

  // Listing pages with images
  const listingUrls = listings.map(listing => {
    const lastmod = listing.updated_at || now;
    const priority = listing.is_verified ? '0.8' : '0.7';
    
    return `
  <url>
    <loc>${domain}/marketplace/${listing.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${priority}</priority>
    ${isFeatureEnabled('ogImages') ? `
    <image:image>
      <image:loc>${domain}/api/seo/og-image/${listing.id}</image:loc>
      <image:title>${escapeXml(listing.item_name || 'Item')}</image:title>
    </image:image>` : ''}
  </url>`;
  }).join('');

  // Category pages
  const categories = [...new Set(listings.map(l => l.category).filter(Boolean))];
  const categoryUrls = categories.map(cat => `
  <url>
    <loc>${domain}/marketplace?category=${encodeURIComponent(cat)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  ${staticUrls}
  ${categoryUrls}
  ${listingUrls}
</urlset>`;
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}