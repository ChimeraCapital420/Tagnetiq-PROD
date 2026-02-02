// FILE: api/seo/og-image/[id].ts
// Dynamic Open Graph image generator for social sharing
// Creates beautiful preview cards for Twitter, Facebook, iMessage, etc.
// Kill switch: SEO_ENABLED environment variable

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { SEO_CONFIG, isFeatureEnabled, getDisabledResponse } from '../config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Kill switch check
  if (!isFeatureEnabled('ogImages')) {
    // Return a default image redirect
    return res.redirect(302, `${SEO_CONFIG.domain}${SEO_CONFIG.images.defaultOG}`);
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.redirect(302, `${SEO_CONFIG.domain}${SEO_CONFIG.images.defaultOG}`);
  }

  try {
    const { data: listing, error } = await supabase
      .from('arena_listings')
      .select(`
        id,
        item_name,
        asking_price,
        estimated_value,
        primary_photo_url,
        category,
        condition,
        is_verified,
        profiles!arena_listings_seller_id_fkey (
          screen_name,
          location_text
        )
      `)
      .eq('id', id)
      .single();

    if (error || !listing) {
      return res.redirect(302, `${SEO_CONFIG.domain}${SEO_CONFIG.images.defaultOG}`);
    }

    // Generate SVG-based OG image (converts to PNG via Vercel OG)
    const svg = generateOGImageSVG(listing);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(svg);
  } catch (error: any) {
    console.error('OG image error:', error);
    return res.redirect(302, `${SEO_CONFIG.domain}${SEO_CONFIG.images.defaultOG}`);
  }
}

function generateOGImageSVG(listing: any): string {
  const { siteName } = SEO_CONFIG;
  const profile = listing.profiles;
  
  const title = (listing.item_name || 'Item').slice(0, 60);
  const price = listing.asking_price?.toFixed(2) || '0.00';
  const originalPrice = listing.estimated_value?.toFixed(2);
  const sellerName = profile?.screen_name || 'Seller';
  const location = profile?.location_text || 'United States';
  const category = listing.category || 'Collectibles';
  const condition = listing.condition || 'Used';
  const isVerified = listing.is_verified;
  
  const hasDiscount = originalPrice && parseFloat(originalPrice) > parseFloat(price);
  const discount = hasDiscount 
    ? Math.round(((parseFloat(originalPrice) - parseFloat(price)) / parseFloat(originalPrice)) * 100)
    : 0;

  // Escape for SVG
  const esc = (str: string) => (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f0f0f"/>
      <stop offset="100%" style="stop-color:#1a1a2e"/>
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#262626"/>
      <stop offset="100%" style="stop-color:#1a1a1a"/>
    </linearGradient>
    <clipPath id="imageClip">
      <rect x="60" y="100" width="400" height="400" rx="20"/>
    </clipPath>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="20" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Decorative elements -->
  <circle cx="1100" cy="100" r="200" fill="#3b82f6" opacity="0.1"/>
  <circle cx="100" cy="530" r="150" fill="#22c55e" opacity="0.1"/>
  
  <!-- Main card -->
  <rect x="40" y="80" width="1120" height="470" rx="24" fill="url(#card)" filter="url(#shadow)"/>
  
  <!-- Product image placeholder -->
  <rect x="60" y="100" width="400" height="400" rx="20" fill="#333"/>
  ${listing.primary_photo_url ? `
  <image 
    x="60" y="100" 
    width="400" height="400" 
    href="${esc(listing.primary_photo_url)}" 
    clip-path="url(#imageClip)"
    preserveAspectRatio="xMidYMid slice"
  />` : `
  <text x="260" y="310" text-anchor="middle" fill="#666" font-family="system-ui" font-size="48">📦</text>
  `}
  
  <!-- Verified badge on image -->
  ${isVerified ? `
  <rect x="80" y="120" width="130" height="36" rx="18" fill="#22c55e"/>
  <text x="100" y="145" fill="white" font-family="system-ui" font-size="14" font-weight="600">✓ Verified</text>
  ` : ''}
  
  <!-- Discount badge -->
  ${hasDiscount ? `
  <rect x="330" y="120" width="110" height="36" rx="18" fill="#f59e0b"/>
  <text x="345" y="145" fill="#000" font-family="system-ui" font-size="14" font-weight="700">${discount}% OFF</text>
  ` : ''}
  
  <!-- Content area -->
  <!-- Category & Condition -->
  <text x="500" y="140" fill="#888" font-family="system-ui" font-size="16">${esc(category)} • ${esc(condition)}</text>
  
  <!-- Title -->
  <text x="500" y="200" fill="#fff" font-family="system-ui" font-size="36" font-weight="700">
    ${esc(title.length > 35 ? title.slice(0, 35) + '...' : title)}
  </text>
  ${title.length > 35 ? `
  <text x="500" y="250" fill="#fff" font-family="system-ui" font-size="36" font-weight="700">
    ${esc(title.slice(35, 60))}${title.length > 60 ? '...' : ''}
  </text>
  ` : ''}
  
  <!-- Price -->
  <text x="500" y="${title.length > 35 ? '330' : '280'}" fill="#22c55e" font-family="system-ui" font-size="56" font-weight="800">$${price}</text>
  ${hasDiscount ? `
  <text x="${500 + (price.length * 30) + 20}" y="${title.length > 35 ? '325' : '275'}" fill="#666" font-family="system-ui" font-size="28" text-decoration="line-through">$${originalPrice}</text>
  ` : ''}
  
  <!-- Seller info -->
  <circle cx="520" cy="${title.length > 35 ? '410' : '360'}" r="24" fill="#444"/>
  <text x="520" y="${title.length > 35 ? '418' : '368'}" text-anchor="middle" fill="#888" font-family="system-ui" font-size="20">👤</text>
  <text x="560" y="${title.length > 35 ? '405' : '355'}" fill="#fff" font-family="system-ui" font-size="18" font-weight="600">${esc(sellerName)}</text>
  <text x="560" y="${title.length > 35 ? '430' : '380'}" fill="#888" font-family="system-ui" font-size="14">📍 ${esc(location)}</text>
  
  <!-- Trust badges -->
  <rect x="500" y="${title.length > 35 ? '460' : '410'}" width="120" height="32" rx="16" fill="#333"/>
  <text x="520" y="${title.length > 35 ? '482' : '432'}" fill="#888" font-family="system-ui" font-size="12">🔒 Secure</text>
  
  <rect x="640" y="${title.length > 35 ? '460' : '410'}" width="140" height="32" rx="16" fill="#333"/>
  <text x="660" y="${title.length > 35 ? '482' : '432'}" fill="#888" font-family="system-ui" font-size="12">✓ Protection</text>
  
  <!-- Footer / Branding -->
  <rect x="40" y="560" width="1120" height="60" rx="0 0 24 24" fill="#111"/>
  <text x="80" y="598" fill="#3b82f6" font-family="system-ui" font-size="24" font-weight="700">✦ ${esc(siteName)}</text>
  <text x="350" y="596" fill="#666" font-family="system-ui" font-size="16">The Premier Verified Marketplace</text>
  
  <!-- CTA -->
  <rect x="900" y="570" width="240" height="44" rx="22" fill="#3b82f6"/>
  <text x="1020" y="600" text-anchor="middle" fill="#fff" font-family="system-ui" font-size="16" font-weight="600">View Listing →</text>
</svg>`;
}