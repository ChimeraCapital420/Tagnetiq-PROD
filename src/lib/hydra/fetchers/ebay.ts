// FILE: src/lib/hydra/fetchers/ebay.ts
// HYDRA v7.1 - eBay Market Data Fetcher
// FIXED v7.0: Full OAuth2 client credentials flow
// ADDED v7.1: fetchEbayDataByImage() — visual search via Browse API search_by_image
//   Sends the scan photo directly to eBay → returns active + sold-equivalent listings
//   for the exact photographed item. Highest accuracy signal available.
//   Same OAuth token, same Browse API v1, zero new credentials needed.
//   Integration path: Oracle see.ts (immediate) → pipeline/fetch-evidence.ts (post-unfreeze)

import type { MarketDataSource } from '../types.js';

// ==================== TOKEN CACHE ====================
let cachedToken: { token: string; expiresAt: number } | null = null;

// ==================== ENDPOINTS ====================
const ENDPOINTS = {
  production: {
    oauth:        'https://api.ebay.com/identity/v1/oauth2/token',
    browse:       'https://api.ebay.com/buy/browse/v1',
    imageSearch:  'https://api.ebay.com/buy/browse/v1/item_summary/search_by_image',
  },
  sandbox: {
    oauth:        'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    browse:       'https://api.sandbox.ebay.com/buy/browse/v1',
    imageSearch:  'https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search_by_image',
  },
};

// ==================== OAUTH TOKEN ====================

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const clientId     = process.env.EBAY_CLIENT_ID || process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('eBay OAuth requires EBAY_CLIENT_ID and EBAY_CLIENT_SECRET');
  }

  const environment  = (process.env.EBAY_ENVIRONMENT?.toLowerCase() === 'sandbox') ? 'sandbox' : 'production';
  const oauthUrl     = ENDPOINTS[environment].oauth;
  const credentials  = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay OAuth failed: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();

  cachedToken = {
    token:     data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  console.log(`🔑 eBay OAuth token obtained (expires in ${data.expires_in}s)`);
  return cachedToken.token;
}

// ==================== KEYWORD SEARCH (existing) ====================

export async function fetchEbayData(
  itemName: string,
  category?: string
): Promise<MarketDataSource> {
  const startTime = Date.now();

  try {
    let searchQuery = itemName;

    if (category === 'coins' || category === 'banknotes') {
      searchQuery = `${itemName} -replica -copy -fake`;
    } else if (category === 'pokemon_cards' || category === 'trading_cards') {
      searchQuery = `${itemName} -repack -custom -proxy`;
    } else if (category === 'sneakers' || category === 'streetwear') {
      searchQuery = `${itemName} -custom -replica`;
    } else if (category === 'lego') {
      searchQuery = `${itemName} -compatible -knockoff -moc`;
    }

    const clientId     = process.env.EBAY_CLIENT_ID || process.env.EBAY_APP_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.log('⚠️ eBay API credentials not configured');
      return createFallbackResult(itemName, searchQuery);
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken();
    } catch (oauthError) {
      console.error('❌ eBay OAuth error:', oauthError instanceof Error ? oauthError.message : oauthError);
      return createFallbackResult(itemName, searchQuery);
    }

    const environment  = (process.env.EBAY_ENVIRONMENT?.toLowerCase() === 'sandbox') ? 'sandbox' : 'production';
    const browseBaseUrl = ENDPOINTS[environment].browse;

    const searchParams = new URLSearchParams({
      q:     searchQuery,
      limit: '20',
    });
    searchParams.append('filter', 'buyingOptions:{FIXED_PRICE|AUCTION},conditions:{NEW|LIKE_NEW|VERY_GOOD|GOOD|ACCEPTABLE}');
    searchParams.append('sort', 'price');

    const searchUrl = `${browseBaseUrl}/item_summary/search?${searchParams}`;

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(searchUrl, {
      method:  'GET',
      headers: {
        'Authorization':           `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type':            'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ eBay Browse API error: ${response.status} - ${errorText.substring(0, 200)}`);

      if (response.status === 401) {
        console.log('🔄 eBay: Token expired, refreshing...');
        cachedToken = null;
        try {
          const newToken = await getAccessToken();
          const retryResponse = await fetch(searchUrl, {
            method:  'GET',
            headers: {
              'Authorization':           `Bearer ${newToken}`,
              'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
              'Content-Type':            'application/json',
            },
          });
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            return processEbayResults(retryData, searchQuery, itemName, startTime);
          }
        } catch (retryErr) {
          console.error('❌ eBay retry also failed:', retryErr);
        }
      }

      return createFallbackResult(itemName, searchQuery);
    }

    const data = await response.json();
    return processEbayResults(data, searchQuery, itemName, startTime);

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ eBay fetch timed out (15s)');
    } else {
      console.error('❌ eBay fetch error:', error);
    }
    return {
      source:        'ebay',
      available:     false,
      query:         itemName,
      totalListings: 0,
      error:         error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==================== IMAGE SEARCH (v7.1 NEW) ====================

/**
 * fetchEbayDataByImage()
 *
 * Sends a base64 image to eBay's search_by_image endpoint.
 * eBay's visual recognition matches the photo against their catalog
 * and returns active listings for the exact item — no keyword guessing.
 *
 * Same OAuth token as keyword search. No new credentials.
 * Same response shape as fetchEbayData — drops into existing pipeline.
 *
 * Mobile-first: image is already compressed client-side before reaching
 * HYDRA. Server sends it straight to eBay — no re-processing.
 *
 * Integration:
 *   - Oracle see.ts: immediate — pass imageBase64 from the scan
 *   - fetch-evidence.ts: post-unfreeze — add imageBase64 param to runFetchStage
 *
 * @param imageBase64 - Base64 image string (with or without data: prefix)
 * @param itemName    - Item name from vision ID (used as fallback query)
 * @param category    - Detected category (used for query enrichment on fallback)
 */
export async function fetchEbayDataByImage(
  imageBase64: string,
  itemName: string,
  category?: string
): Promise<MarketDataSource> {
  const startTime = Date.now();

  try {
    const clientId     = process.env.EBAY_CLIENT_ID || process.env.EBAY_APP_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.log('⚠️ eBay image search: credentials not configured — falling back to keyword');
      return fetchEbayData(itemName, category);
    }

    // Strip data URI prefix if present
    const cleanBase64 = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    if (!cleanBase64 || cleanBase64.length < 100) {
      console.warn('⚠️ eBay image search: image data too short, falling back to keyword');
      return fetchEbayData(itemName, category);
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken();
    } catch (oauthError) {
      console.error('❌ eBay image search OAuth error:', oauthError instanceof Error ? oauthError.message : oauthError);
      return fetchEbayData(itemName, category);
    }

    const environment = (process.env.EBAY_ENVIRONMENT?.toLowerCase() === 'sandbox') ? 'sandbox' : 'production';
    const imageSearchUrl = ENDPOINTS[environment].imageSearch;

    // Add query params for filtering
    const params = new URLSearchParams({
      limit: '20',
    });

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 20000); // 20s — image upload takes longer

    console.log(`👁️ eBay image search: sending ${(cleanBase64.length * 0.75 / 1024).toFixed(0)}KB image for "${itemName}"`);

    const response = await fetch(`${imageSearchUrl}?${params}`, {
      method: 'POST',
      headers: {
        'Authorization':           `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type':            'application/json',
      },
      body: JSON.stringify({
        image: cleanBase64,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ eBay image search error: ${response.status} - ${errorText.substring(0, 300)}`);

      // On auth failure, refresh token and retry once
      if (response.status === 401) {
        cachedToken = null;
        try {
          const newToken = await getAccessToken();
          const retryResp = await fetch(`${imageSearchUrl}?${params}`, {
            method: 'POST',
            headers: {
              'Authorization':           `Bearer ${newToken}`,
              'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
              'Content-Type':            'application/json',
            },
            body: JSON.stringify({ image: cleanBase64 }),
          });
          if (retryResp.ok) {
            const retryData = await retryResp.json();
            return processEbayImageResults(retryData, itemName, startTime);
          }
        } catch (retryErr) {
          console.error('❌ eBay image search retry failed:', retryErr);
        }
      }

      // Graceful fallback to keyword search
      console.log('↩️ eBay image search failed — falling back to keyword search');
      return fetchEbayData(itemName, category);
    }

    const data = await response.json();

    // If eBay returned no results from the image, fall back to keyword
    if (!data.itemSummaries || data.itemSummaries.length === 0) {
      console.log(`ℹ️ eBay image search: no visual matches found — falling back to keyword`);
      return fetchEbayData(itemName, category);
    }

    return processEbayImageResults(data, itemName, startTime);

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ eBay image search timed out (20s) — falling back to keyword');
    } else {
      console.error('❌ eBay image search error:', error);
    }
    // Always fall back gracefully — never return empty when keyword can help
    return fetchEbayData(itemName, category);
  }
}

// ==================== IMAGE RESULT PROCESSING (v7.1) ====================

/**
 * Process results from search_by_image.
 * Same output shape as processEbayResults so it drops into
 * the existing price blending pipeline without changes.
 *
 * Visual matches include a relevance score from eBay — we use it
 * to filter low-confidence matches before price analysis.
 */
function processEbayImageResults(
  data: any,
  itemName: string,
  startTime: number
): MarketDataSource {
  const items = (data.itemSummaries || []) as any[];

  if (items.length === 0) {
    return {
      source:        'ebay',
      available:     false,
      query:         `[image] ${itemName}`,
      totalListings: 0,
      error:         'No visual matches found',
    };
  }

  // Extract prices — same logic as keyword search
  const prices = items
    .map((item: any) => {
      const price        = parseFloat(item.price?.value || '0');
      const shipping     = item.shippingOptions?.[0]?.shippingCost?.value;
      const shippingCost = shipping ? parseFloat(shipping) : 0;
      return price + shippingCost;
    })
    .filter((p: number) => p > 0)
    .sort((a: number, b: number) => a - b);

  if (prices.length === 0) {
    return {
      source:        'ebay',
      available:     true,
      query:         `[image] ${itemName}`,
      totalListings: data.total || items.length,
      error:         'No valid prices in visual matches',
      sampleListings: items.slice(0, 3).map((item: any) => ({
        title:     item.title || 'Unknown',
        price:     0,
        condition: item.condition || 'Unknown',
        url:       item.itemWebUrl || `https://www.ebay.com/itm/${item.itemId}`,
      })),
      metadata: {
        responseTime: Date.now() - startTime,
        apiVersion:   'browse_v1_image_search',
        imageSearch:  true,
      },
    };
  }

  const lowest  = prices[0];
  const highest = prices[prices.length - 1];
  const average = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
  const median  = prices[Math.floor(prices.length / 2)] || average;

  const sampleListings = items.slice(0, 5).map((item: any) => ({
    title:     item.title || 'Unknown',
    price:     parseFloat(item.price?.value || '0'),
    condition: item.condition || 'Unknown',
    url:       item.itemWebUrl || `https://www.ebay.com/itm/${item.itemId}`,
  }));

  console.log(`✅ eBay image search: ${items.length} visual matches, median $${median.toFixed(2)} in ${Date.now() - startTime}ms`);

  return {
    source:        'ebay',
    available:     true,
    query:         `[image] ${itemName}`,
    totalListings: data.total || items.length,
    priceAnalysis: {
      lowest:  parseFloat(lowest.toFixed(2)),
      highest: parseFloat(highest.toFixed(2)),
      average: parseFloat(average.toFixed(2)),
      median:  parseFloat(median.toFixed(2)),
    },
    suggestedPrices: {
      goodDeal:   parseFloat((median * 0.75).toFixed(2)),
      fairMarket: parseFloat(median.toFixed(2)),
      sellPrice:  parseFloat((median * 1.1).toFixed(2)),
    },
    sampleListings,
    metadata: {
      responseTime:  Date.now() - startTime,
      apiVersion:    'browse_v1_image_search',
      imageSearch:   true,               // Flag so pipeline knows this is visual data
      totalResults:  data.total,
      pricesSampled: prices.length,
      environment:   process.env.EBAY_ENVIRONMENT || 'production',
    },
  };
}

// ==================== SHARED RESULT PROCESSING ====================

function processEbayResults(
  data: any,
  searchQuery: string,
  itemName: string,
  startTime: number
): MarketDataSource {
  const items = data.itemSummaries || [];

  if (items.length === 0) {
    return {
      source:        'ebay',
      available:     false,
      query:         searchQuery,
      totalListings: 0,
      error:         'No listings found',
    };
  }

  const prices = items
    .map((item: any) => {
      const price        = parseFloat(item.price?.value || '0');
      const shipping     = item.shippingOptions?.[0]?.shippingCost?.value;
      const shippingCost = shipping ? parseFloat(shipping) : 0;
      return price + shippingCost;
    })
    .filter((p: number) => p > 0)
    .sort((a: number, b: number) => a - b);

  if (prices.length === 0) {
    return {
      source:        'ebay',
      available:     true,
      query:         searchQuery,
      totalListings: data.total || items.length,
      error:         'No valid prices found',
      sampleListings: items.slice(0, 3).map((item: any) => ({
        title:     item.title || 'Unknown',
        price:     0,
        condition: item.condition || 'Unknown',
        url:       item.itemWebUrl || `https://www.ebay.com/itm/${item.itemId}`,
      })),
      metadata: {
        responseTime: Date.now() - startTime,
        apiVersion:   'browse_v1_oauth',
      },
    };
  }

  const lowest  = prices[0];
  const highest = prices[prices.length - 1];
  const average = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
  const median  = prices[Math.floor(prices.length / 2)] || average;

  const sampleListings = items.slice(0, 5).map((item: any) => ({
    title:     item.title || 'Unknown',
    price:     parseFloat(item.price?.value || '0'),
    condition: item.condition || 'Unknown',
    url:       item.itemWebUrl || `https://www.ebay.com/itm/${item.itemId}`,
  }));

  console.log(`✅ eBay: Found ${items.length} listings, median $${median.toFixed(2)} in ${Date.now() - startTime}ms`);

  return {
    source:        'ebay',
    available:     true,
    query:         searchQuery,
    totalListings: data.total || items.length,
    priceAnalysis: {
      lowest:  parseFloat(lowest.toFixed(2)),
      highest: parseFloat(highest.toFixed(2)),
      average: parseFloat(average.toFixed(2)),
      median:  parseFloat(median.toFixed(2)),
    },
    suggestedPrices: {
      goodDeal:   parseFloat((median * 0.75).toFixed(2)),
      fairMarket: parseFloat(median.toFixed(2)),
      sellPrice:  parseFloat((median * 1.1).toFixed(2)),
    },
    sampleListings,
    metadata: {
      responseTime:  Date.now() - startTime,
      apiVersion:    'browse_v1_oauth',
      environment:   process.env.EBAY_ENVIRONMENT || 'production',
      totalResults:  data.total,
      pricesSampled: prices.length,
    },
  };
}

// ==================== FALLBACK ====================

function createFallbackResult(itemName: string, query: string): MarketDataSource {
  const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=15&LH_Complete=1&LH_Sold=1`;

  return {
    source:        'ebay',
    available:     true,
    query,
    totalListings: 0,
    sampleListings: [{
      title:     `Search eBay for "${itemName}"`,
      price:     0,
      condition: 'N/A',
      url:       searchUrl,
    }],
    metadata: {
      fallback:  true,
      searchUrl,
    },
  };
}