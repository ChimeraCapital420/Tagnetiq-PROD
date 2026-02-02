// FILE: api/seo/config.ts
// Central SEO configuration and kill switch
// Toggle: Set SEO_ENABLED=true in environment when ready

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SEO CONFIGURATION
// ============================================================================

export const SEO_CONFIG = {
  // Master kill switch - set to 'true' when ready for Google
  enabled: process.env.SEO_ENABLED === 'true',
  
  // Domain configuration
  domain: process.env.NEXT_PUBLIC_APP_URL || 'https://tagnetiq.com',
  siteName: 'TagnetIQ Marketplace',
  siteDescription: 'The premier verified marketplace for collectibles, memorabilia, and unique items.',
  
  // Feature flags (can enable individually)
  features: {
    sitemap: process.env.SEO_SITEMAP !== 'false',
    productFeed: process.env.SEO_PRODUCT_FEED !== 'false',
    richSnippets: process.env.SEO_RICH_SNIPPETS !== 'false',
    ogImages: process.env.SEO_OG_IMAGES !== 'false',
    priceAlerts: process.env.SEO_PRICE_ALERTS !== 'false',
    socialCards: process.env.SEO_SOCIAL_CARDS !== 'false',
  },
  
  // Crawl settings
  crawl: {
    allowBots: process.env.SEO_ALLOW_BOTS === 'true',
    crawlDelay: 1,
    maxListingsInFeed: 10000,
    maxListingsInSitemap: 50000,
  },
  
  // Social media
  social: {
    twitter: '@tagnetiq',
    facebook: 'tagnetiq',
  },
  
  // Default images
  images: {
    defaultOG: '/og-default.png',
    logo: '/logo.png',
    favicon: '/favicon.png',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function isSEOEnabled(): boolean {
  return SEO_CONFIG.enabled;
}

export function isFeatureEnabled(feature: keyof typeof SEO_CONFIG.features): boolean {
  return SEO_CONFIG.enabled && SEO_CONFIG.features[feature];
}

export function isCrawler(userAgent: string): boolean {
  return /googlebot|bingbot|yandex|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora|pinterest|slackbot|vkshare|w3c_validator|lighthouse|whatsapp|telegram|discord/i.test(userAgent);
}

export function getDisabledResponse(res: VercelResponse, format: 'json' | 'xml' | 'html' = 'json') {
  if (format === 'xml') {
    res.setHeader('Content-Type', 'application/xml');
    return res.status(503).send(`<?xml version="1.0" encoding="UTF-8"?>
<error>
  <message>SEO features are currently disabled</message>
  <status>maintenance</status>
</error>`);
  }
  
  if (format === 'html') {
    res.setHeader('Content-Type', 'text/html');
    return res.status(503).send(`<!DOCTYPE html>
<html><head><title>Maintenance</title><meta name="robots" content="noindex"></head>
<body><h1>Coming Soon</h1><p>This page is under maintenance.</p></body></html>`);
  }
  
  return res.status(503).json({ 
    error: 'SEO features disabled',
    message: 'This feature is currently in maintenance mode.',
    enabled: false,
  });
}

// ============================================================================
// STATUS ENDPOINT
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // This endpoint shows SEO status (for admin use)
  
  const status = {
    enabled: SEO_CONFIG.enabled,
    domain: SEO_CONFIG.domain,
    features: SEO_CONFIG.features,
    crawl: {
      ...SEO_CONFIG.crawl,
      currentlyAllowed: SEO_CONFIG.enabled && SEO_CONFIG.crawl.allowBots,
    },
    endpoints: {
      sitemap: `${SEO_CONFIG.domain}/api/seo/sitemap`,
      productFeed: `${SEO_CONFIG.domain}/api/seo/product-feed`,
      priceAlerts: `${SEO_CONFIG.domain}/api/seo/price-alerts`,
      ogImage: `${SEO_CONFIG.domain}/api/seo/og-image/[listing-id]`,
      listing: `${SEO_CONFIG.domain}/api/seo/listing/[listing-id]`,
    },
    instructions: {
      enable: 'Set SEO_ENABLED=true in environment variables',
      googleSearchConsole: 'https://search.google.com/search-console',
      googleMerchantCenter: 'https://merchants.google.com',
      bingWebmaster: 'https://www.bing.com/webmasters',
    },
    timestamp: new Date().toISOString(),
  };

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(status);
}