// FILE: api/seo/listing/[id].ts
// Server-rendered HTML for crawlers with full structured data
// Kill switch: SEO_ENABLED environment variable

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { SEO_CONFIG, isFeatureEnabled, getDisabledResponse, isCrawler } from '../config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const { domain } = SEO_CONFIG;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing listing ID' });
  }

  const userAgent = req.headers['user-agent'] || '';
  const isBot = isCrawler(userAgent);

  // If SEO disabled OR not a crawler, redirect to SPA
  if (!isFeatureEnabled('richSnippets') || !isBot) {
    return res.redirect(302, `/marketplace/${id}`);
  }

  try {
    const { data: listing, error } = await supabase
      .from('arena_listings')
      .select(`
        *,
        profiles!arena_listings_seller_id_fkey (
          screen_name,
          location_text,
          avatar_url
        )
      `)
      .eq('id', id)
      .eq('status', 'active')
      .single();

    if (error || !listing) {
      return res.status(404).send(generate404Page());
    }

    const html = generateListingPage(listing);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).send(html);
  } catch (error: any) {
    console.error('SEO listing error:', error);
    return res.status(500).send(generate404Page());
  }
}

function generateListingPage(listing: any): string {
  const { domain, siteName, social } = SEO_CONFIG;
  const profile = listing.profiles;
  
  const title = `${listing.item_name} | ${siteName}`;
  const description = (listing.description || listing.item_name || '').slice(0, 160);
  const price = listing.asking_price?.toFixed(2) || '0.00';
  const listingUrl = `${domain}/marketplace/${listing.id}`;
  const sellerName = profile?.screen_name || 'Seller';
  const location = profile?.location_text || 'United States';

  // Dynamic OG image if enabled, else product photo
  const ogImageUrl = isFeatureEnabled('ogImages')
    ? `${domain}/api/seo/og-image/${listing.id}`
    : (listing.primary_photo_url || `${domain}${SEO_CONFIG.images.defaultOG}`);
  
  const productImageUrl = listing.primary_photo_url || `${domain}/placeholder.svg`;

  // Schema.org condition mapping
  const conditionMap: Record<string, string> = {
    'new': 'NewCondition', 'mint': 'NewCondition', 'like_new': 'NewCondition',
    'excellent': 'RefurbishedCondition',
    'good': 'UsedCondition', 'fair': 'UsedCondition', 'poor': 'DamagedCondition',
  };
  const schemaCondition = conditionMap[listing.condition?.toLowerCase()] || 'UsedCondition';

  // Structured Data - Product
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.item_name,
    description: description,
    image: [productImageUrl, ...(listing.additional_photos || []).slice(0, 5)],
    sku: listing.id,
    mpn: listing.id,
    brand: {
      '@type': 'Brand',
      name: listing.category || 'Collectibles',
    },
    offers: {
      '@type': 'Offer',
      url: listingUrl,
      priceCurrency: 'USD',
      price: price,
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      itemCondition: `https://schema.org/${schemaCondition}`,
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Person',
        name: sellerName,
        address: {
          '@type': 'PostalAddress',
          addressLocality: location,
          addressCountry: 'US',
        },
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'US',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 7, unitCode: 'DAY' },
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'US',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 14,
        returnMethod: 'https://schema.org/ReturnByMail',
      },
    },
    ...(listing.is_verified && {
      review: {
        '@type': 'Review',
        reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
        author: { '@type': 'Organization', name: siteName },
        reviewBody: 'Verified authentic by TagnetIQ',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '5',
        reviewCount: '1',
      },
    }),
  };

  // Breadcrumb Schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: domain },
      { '@type': 'ListItem', position: 2, name: 'Marketplace', item: `${domain}/marketplace` },
      { '@type': 'ListItem', position: 3, name: listing.category || 'Items', item: `${domain}/marketplace?category=${encodeURIComponent(listing.category || 'all')}` },
      { '@type': 'ListItem', position: 4, name: listing.item_name, item: listingUrl },
    ],
  };

  // Organization Schema (for site-wide SEO)
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: domain,
    logo: `${domain}${SEO_CONFIG.images.logo}`,
    sameAs: [
      `https://twitter.com/${social.twitter.replace('@', '')}`,
      `https://facebook.com/${social.facebook}`,
    ],
  };

  return `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns# product: https://ogp.me/ns/product#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(title)}</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(listing.item_name)}, ${listing.category || 'collectibles'}, buy, sell, marketplace, verified, ${location}">
  <meta name="author" content="${siteName}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="${listingUrl}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="product">
  <meta property="og:url" content="${listingUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:secure_url" content="${ogImageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(listing.item_name)}">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:locale" content="en_US">
  
  <!-- Product-specific Open Graph -->
  <meta property="product:price:amount" content="${price}">
  <meta property="product:price:currency" content="USD">
  <meta property="product:availability" content="in stock">
  <meta property="product:condition" content="${listing.condition || 'used'}">
  <meta property="product:retailer_item_id" content="${listing.id}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="${social.twitter}">
  <meta name="twitter:creator" content="${social.twitter}">
  <meta name="twitter:url" content="${listingUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${ogImageUrl}">
  <meta name="twitter:image:alt" content="${escapeHtml(listing.item_name)}">
  <meta name="twitter:label1" content="Price">
  <meta name="twitter:data1" content="$${price}">
  <meta name="twitter:label2" content="Condition">
  <meta name="twitter:data2" content="${listing.condition || 'Used'}">
  
  <!-- Pinterest -->
  <meta property="og:price:amount" content="${price}">
  <meta property="og:price:currency" content="USD">
  
  <!-- WhatsApp / Telegram -->
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <!-- Structured Data -->
  <script type="application/ld+json">${JSON.stringify(productSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(orgSchema)}</script>
  
  <!-- Favicon -->
  <link rel="icon" type="image/png" href="${domain}${SEO_CONFIG.images.favicon}">
  <link rel="apple-touch-icon" href="${domain}${SEO_CONFIG.images.logo}">
  
  <!-- Preconnect -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="${domain}">
  
  <style>
    :root {
      --bg: #0a0a0a;
      --surface: #1a1a1a;
      --text: #e5e5e5;
      --text-muted: #888;
      --primary: #3b82f6;
      --success: #22c55e;
      --warning: #f59e0b;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg); 
      color: var(--text);
      min-height: 100vh;
      line-height: 1.5;
    }
    .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
    .breadcrumb { font-size: 14px; color: var(--text-muted); margin-bottom: 24px; }
    .breadcrumb a { color: var(--primary); text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .product { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    @media (max-width: 768px) { .product { grid-template-columns: 1fr; gap: 24px; } }
    .gallery { display: flex; flex-direction: column; gap: 12px; }
    .main-image { 
      aspect-ratio: 1; 
      background: var(--surface); 
      border-radius: 16px; 
      overflow: hidden;
      position: relative;
    }
    .main-image img { width: 100%; height: 100%; object-fit: cover; }
    .verified-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      background: var(--success);
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .thumbnails { display: flex; gap: 8px; overflow-x: auto; }
    .thumb { 
      width: 60px; height: 60px; 
      border-radius: 8px; 
      overflow: hidden; 
      flex-shrink: 0;
      border: 2px solid transparent;
      cursor: pointer;
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .details { display: flex; flex-direction: column; gap: 20px; }
    h1 { font-size: 28px; font-weight: 700; line-height: 1.2; }
    .price-section { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
    .price { font-size: 36px; font-weight: 800; color: var(--success); }
    .original-price { font-size: 20px; color: var(--text-muted); text-decoration: line-through; }
    .savings { 
      background: var(--warning); 
      color: black; 
      padding: 4px 10px; 
      border-radius: 12px; 
      font-size: 14px; 
      font-weight: 600;
    }
    .badges { display: flex; gap: 8px; flex-wrap: wrap; }
    .badge { 
      display: inline-flex; 
      align-items: center; 
      gap: 6px;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
    }
    .badge-verified { background: rgba(34, 197, 94, 0.15); color: var(--success); }
    .badge-condition { background: rgba(59, 130, 246, 0.15); color: var(--primary); }
    .badge-category { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
    .seller { 
      display: flex; 
      align-items: center; 
      gap: 16px;
      padding: 20px;
      background: var(--surface);
      border-radius: 16px;
    }
    .seller-avatar { 
      width: 56px; height: 56px; 
      border-radius: 50%; 
      background: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .seller-info { flex: 1; }
    .seller-name { font-weight: 600; font-size: 16px; }
    .seller-location { font-size: 14px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
    .description { 
      padding: 20px; 
      background: var(--surface); 
      border-radius: 16px;
      white-space: pre-wrap;
    }
    .description h3 { margin-bottom: 12px; font-size: 16px; color: var(--text-muted); }
    .cta { 
      display: block;
      text-align: center;
      background: var(--primary);
      color: white;
      padding: 18px 32px;
      border-radius: 14px;
      font-size: 18px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s;
    }
    .cta:hover { background: #2563eb; transform: translateY(-2px); }
    .trust { 
      display: flex; 
      justify-content: center; 
      gap: 24px; 
      padding: 16px;
      background: var(--surface);
      border-radius: 12px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .trust span { display: flex; align-items: center; gap: 6px; }
    .footer { 
      margin-top: 60px; 
      padding-top: 24px;
      border-top: 1px solid #222;
      text-align: center; 
      color: var(--text-muted);
      font-size: 14px;
    }
    .footer a { color: var(--primary); text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="${domain}">Home</a> › 
      <a href="${domain}/marketplace">Marketplace</a> › 
      <a href="${domain}/marketplace?category=${encodeURIComponent(listing.category || 'all')}">${escapeHtml(listing.category || 'Items')}</a> › 
      <span>${escapeHtml((listing.item_name || '').slice(0, 50))}${listing.item_name?.length > 50 ? '...' : ''}</span>
    </nav>
    
    <article class="product" itemscope itemtype="https://schema.org/Product">
      <div class="gallery">
        <div class="main-image">
          ${listing.is_verified ? '<div class="verified-badge">✓ Verified Authentic</div>' : ''}
          <img 
            src="${productImageUrl}" 
            alt="${escapeHtml(listing.item_name)}" 
            itemprop="image"
            loading="eager"
          >
        </div>
        ${listing.additional_photos?.length > 0 ? `
        <div class="thumbnails">
          <div class="thumb"><img src="${productImageUrl}" alt="Main"></div>
          ${listing.additional_photos.slice(0, 5).map((url: string, i: number) => `
          <div class="thumb"><img src="${url}" alt="Photo ${i + 2}"></div>
          `).join('')}
        </div>
        ` : ''}
      </div>
      
      <div class="details">
        <h1 itemprop="name">${escapeHtml(listing.item_name)}</h1>
        
        <div class="price-section" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <span class="price" itemprop="price" content="${price}">$${price}</span>
          <meta itemprop="priceCurrency" content="USD">
          <link itemprop="availability" href="https://schema.org/InStock">
          ${listing.estimated_value && listing.estimated_value > listing.asking_price ? `
            <span class="original-price">$${listing.estimated_value.toFixed(2)}</span>
            <span class="savings">${Math.round(((listing.estimated_value - listing.asking_price) / listing.estimated_value) * 100)}% OFF</span>
          ` : ''}
        </div>
        
        <div class="badges">
          ${listing.is_verified ? '<span class="badge badge-verified">✓ Verified Authentic</span>' : ''}
          ${listing.condition ? `<span class="badge badge-condition">${escapeHtml(listing.condition)}</span>` : ''}
          ${listing.category ? `<span class="badge badge-category">${escapeHtml(listing.category)}</span>` : ''}
        </div>
        
        <div class="seller" itemprop="seller" itemscope itemtype="https://schema.org/Person">
          <div class="seller-avatar">👤</div>
          <div class="seller-info">
            <div class="seller-name" itemprop="name">${escapeHtml(sellerName)}</div>
            <div class="seller-location">
              <span>📍</span>
              <span itemprop="address" itemscope itemtype="https://schema.org/PostalAddress">
                <span itemprop="addressLocality">${escapeHtml(location)}</span>
              </span>
            </div>
          </div>
        </div>
        
        ${listing.description ? `
        <div class="description">
          <h3>Description</h3>
          <div itemprop="description">${escapeHtml(listing.description)}</div>
        </div>
        ` : ''}
        
        <a href="${domain}/marketplace/${listing.id}" class="cta">
          View Full Listing & Buy Now →
        </a>
        
        <div class="trust">
          <span>🔒 Secure Transaction</span>
          <span>✓ Buyer Protection</span>
          <span>📦 Shipping Available</span>
        </div>
      </div>
    </article>
    
    <footer class="footer">
      <p>Listed on <a href="${domain}">${siteName}</a> — The Premier Verified Marketplace</p>
      <p style="margin-top: 8px;">© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
    </footer>
  </div>
  
  <script>
    // Real browsers get redirected to the full SPA experience
    if (!navigator.userAgent.match(/bot|crawl|spider|slurp|lighthouse/i)) {
      window.location.replace('${domain}/marketplace/${listing.id}');
    }
  </script>
</body>
</html>`;
}

function generate404Page(): string {
  const { domain, siteName } = SEO_CONFIG;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Listing Not Found | ${siteName}</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    body { font-family: sans-serif; background: #0a0a0a; color: #e5e5e5; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; }
    a { color: #3b82f6; }
  </style>
</head>
<body>
  <div>
    <h1>Listing Not Found</h1>
    <p>This item may have been sold or removed.</p>
    <p><a href="${domain}/marketplace">Browse Marketplace →</a></p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}