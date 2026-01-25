// ============================================
// OUTBOUND CLICK TRACKER v1.0
// /api/outbound/click.ts
// 
// Purpose: Track all clicks to external authority sources
// - Logs clicks for analytics
// - Redirects user to destination
// - Supports future affiliate tags
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 10,
};

// ============================================
// PROVIDER CONFIGURATION
// ============================================

interface ProviderConfig {
  name: string;
  displayName: string;
  baseUrl: string;
  hasAffiliate: boolean;
  cpcRate?: number;  // Expected CPC if they have one
  notes?: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  // === Authority Sources (track for future negotiation) ===
  numista: {
    name: 'numista',
    displayName: 'Numista Catalogue',
    baseUrl: 'https://en.numista.com',
    hasAffiliate: false,
    notes: 'Community coin database - potential partnership'
  },
  brickset: {
    name: 'brickset',
    displayName: 'Brickset Database',
    baseUrl: 'https://brickset.com',
    hasAffiliate: false,
    notes: 'LEGO database - ad supported'
  },
  discogs: {
    name: 'discogs',
    displayName: 'Discogs Database',
    baseUrl: 'https://www.discogs.com',
    hasAffiliate: false,
    notes: 'Vinyl marketplace - 8% seller fee model'
  },
  pokemon_tcg: {
    name: 'pokemon_tcg',
    displayName: 'Pokemon TCG API',
    baseUrl: 'https://pokemontcg.io',
    hasAffiliate: false,
    notes: 'Card data API - free tier'
  },
  google_books: {
    name: 'google_books',
    displayName: 'Google Books',
    baseUrl: 'https://books.google.com',
    hasAffiliate: false,
    notes: 'Book metadata - no affiliate'
  },
  comicvine: {
    name: 'comicvine',
    displayName: 'Comic Vine',
    baseUrl: 'https://comicvine.gamespot.com',
    hasAffiliate: false,
    notes: 'Owned by Fandom - ad supported'
  },
  rawg: {
    name: 'rawg',
    displayName: 'RAWG Games',
    baseUrl: 'https://rawg.io',
    hasAffiliate: false,
    notes: 'Video game database - API focused'
  },
  
  // === Marketplaces with Affiliate Potential ===
  ebay: {
    name: 'ebay',
    displayName: 'eBay',
    baseUrl: 'https://www.ebay.com',
    hasAffiliate: true,
    cpcRate: 0.02,  // ~$0.02 CPC via EPN
    notes: 'eBay Partner Network - Quality Click Pricing'
  },
  tcgplayer: {
    name: 'tcgplayer',
    displayName: 'TCGPlayer',
    baseUrl: 'https://www.tcgplayer.com',
    hasAffiliate: true,
    cpcRate: 0,  // CPA only
    notes: '5% commission on sales'
  },
  stockx: {
    name: 'stockx',
    displayName: 'StockX',
    baseUrl: 'https://stockx.com',
    hasAffiliate: true,
    cpcRate: 0,
    notes: '2-3% commission via Impact'
  },
  goat: {
    name: 'goat',
    displayName: 'GOAT',
    baseUrl: 'https://www.goat.com',
    hasAffiliate: true,
    cpcRate: 0,
    notes: 'Commission-based affiliate'
  },
  amazon: {
    name: 'amazon',
    displayName: 'Amazon',
    baseUrl: 'https://www.amazon.com',
    hasAffiliate: true,
    cpcRate: 0,
    notes: 'Amazon Associates - 1-4.5% commission'
  }
};

// ============================================
// SUPABASE CLIENT
// ============================================

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.warn('⚠️ [Outbound] Supabase not configured - clicks will not be tracked');
    return null;
  }
  
  return createClient(url, key);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getCountryFromHeaders(req: VercelRequest): string | null {
  // Vercel provides geo data
  return (req.headers['x-vercel-ip-country'] as string) || null;
}

function normalizeProvider(provider: string): string {
  return provider.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function validateUrl(url: string, providerConfig?: ProviderConfig): boolean {
  try {
    const parsed = new URL(url);
    // Allow any https URL, but log if it doesn't match expected base
    if (providerConfig?.baseUrl && !url.startsWith(providerConfig.baseUrl)) {
      console.warn(`⚠️ [Outbound] URL mismatch: expected ${providerConfig.baseUrl}, got ${parsed.origin}`);
    }
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET (browser redirect) and POST (API call)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Merge query params and body
  const params = { ...req.query, ...(req.body || {}) };
  
  const {
    provider,
    url,
    // Optional attribution
    analysis_id,
    item_name,
    item_category,
    authority_source,
    confidence,
    value,
    user_id,
    referrer
  } = params as Record<string, string>;

  // Validate required params
  if (!provider || !url) {
    return res.status(400).json({
      error: 'Missing required parameters',
      required: ['provider', 'url'],
      example: '/api/outbound/click?provider=numista&url=https://en.numista.com/catalogue/pieces123.html'
    });
  }

  // Normalize provider name
  const normalizedProvider = normalizeProvider(provider);
  const providerConfig = PROVIDERS[normalizedProvider];
  
  // Validate URL
  if (!validateUrl(url, providerConfig)) {
    return res.status(400).json({ error: 'Invalid URL - must be HTTPS' });
  }

  // Build the final redirect URL
  // TODO: Add affiliate tags when we have them configured
  let finalUrl = url;
  
  // Example: eBay Partner Network integration (when configured)
  // if (normalizedProvider === 'ebay' && process.env.EPN_CAMPAIGN_ID) {
  //   finalUrl = `https://rover.ebay.com/rover/1/${process.env.EPN_CAMPAIGN_ID}/1?mpre=${encodeURIComponent(url)}`;
  // }

  // Log the click to Supabase
  const supabase = getSupabase();
  let clickId: string | null = null;
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('outbound_clicks')
        .insert({
          provider: normalizedProvider,
          destination_url: url,  // Store original URL
          analysis_id: analysis_id || null,
          item_name: item_name || null,
          item_category: item_category || null,
          user_id: user_id || null,
          authority_source: authority_source || providerConfig?.displayName || provider,
          authority_confidence: confidence ? parseFloat(confidence) : null,
          estimated_value: value ? parseFloat(value) : null,
          potential_cpc: providerConfig?.cpcRate || null,
          user_agent: req.headers['user-agent'] || null,
          ip_country: getCountryFromHeaders(req),
          referrer_page: referrer || req.headers.referer || null,
          metadata: {
            has_affiliate: providerConfig?.hasAffiliate || false,
            provider_notes: providerConfig?.notes || null
          }
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ [Outbound] Insert error:', error.message);
      } else {
        clickId = data?.id;
        console.log(`✅ [Outbound] Logged: ${normalizedProvider} → ${clickId}`);
      }
    } catch (err: any) {
      console.error('❌ [Outbound] Exception:', err.message);
    }
  }

  // Return based on request type
  const isApiCall = req.method === 'POST' || 
                   req.headers.accept?.includes('application/json');

  if (isApiCall) {
    // Return JSON for API consumers
    return res.status(200).json({
      success: true,
      click_id: clickId,
      provider: providerConfig?.displayName || provider,
      redirect_url: finalUrl,
      has_affiliate: providerConfig?.hasAffiliate || false
    });
  }

  // Browser request - redirect to destination
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-TagnetIQ-Click', clickId || 'untracked');
  res.setHeader('X-TagnetIQ-Provider', normalizedProvider);
  
  return res.redirect(302, finalUrl);
}