// FILE: src/lib/hydra/fetchers/ebay.ts
// HYDRA v7.0 - eBay Market Data Fetcher
// FIXED v7.0: Full OAuth2 client credentials flow (replaces dead EBAY_APP_ID/EBAY_ACCESS_TOKEN)
// Uses EBAY_CLIENT_ID + EBAY_CLIENT_SECRET → OAuth token → Browse API v1
// Matches the working pattern from api/ebay/search.ts and api/ebay/price-check.ts

import type { MarketDataSource } from '../types.js';

// ==================== TOKEN CACHE ====================
// Cached at module level so it persists across calls within the same Lambda invocation
let cachedToken: { token: string; expiresAt: number } | null = null;

// ==================== ENDPOINTS ====================
const ENDPOINTS = {
  production: {
    oauth: 'https://api.ebay.com/identity/v1/oauth2/token',
    browse: 'https://api.ebay.com/buy/browse/v1',
  },
  sandbox: {
    oauth: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    browse: 'https://api.sandbox.ebay.com/buy/browse/v1',
  },
};

// ==================== OAUTH TOKEN ====================

/**
 * Get OAuth2 access token using client credentials flow.
 * Caches the token and refreshes 60s before expiry.
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const clientId = process.env.EBAY_CLIENT_ID || process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('eBay OAuth requires EBAY_CLIENT_ID and EBAY_CLIENT_SECRET');
  }

  const environment = (process.env.EBAY_ENVIRONMENT?.toLowerCase() === 'sandbox') ? 'sandbox' : 'production';
  const oauthUrl = ENDPOINTS[environment].oauth;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
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
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  console.log(`🔑 eBay OAuth token obtained (expires in ${data.expires_in}s)`);
  return cachedToken.token;
}

// ==================== MAIN FETCHER ====================

export async function fetchEbayData(itemName: string, category?: string): Promise<MarketDataSource> {
  const startTime = Date.now();

  try {
    // Build search query with category-specific enhancements
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

    // Check if credentials exist before attempting OAuth
    const clientId = process.env.EBAY_CLIENT_ID || process.env.EBAY_APP_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.log('⚠️ eBay API credentials not configured (need EBAY_CLIENT_ID + EBAY_CLIENT_SECRET)');
      return createFallbackResult(itemName, searchQuery);
    }

    // Get OAuth token
    let accessToken: string;
    try {
      accessToken = await getAccessToken();
    } catch (oauthError) {
      console.error('❌ eBay OAuth error:', oauthError instanceof Error ? oauthError.message : oauthError);
      return createFallbackResult(itemName, searchQuery);
    }

    // Determine environment
    const environment = (process.env.EBAY_ENVIRONMENT?.toLowerCase() === 'sandbox') ? 'sandbox' : 'production';
    const browseBaseUrl = ENDPOINTS[environment].browse;

    // Build Browse API search URL
    const searchParams = new URLSearchParams({
      q: searchQuery,
      limit: '20',
    });

    // Add condition filter
    const filters: string[] = [
      'buyingOptions:{FIXED_PRICE|AUCTION}',
      'conditions:{NEW|LIKE_NEW|VERY_GOOD|GOOD|ACCEPTABLE}',
    ];
    searchParams.append('filter', filters.join(','));
    searchParams.append('sort', 'price');

    const searchUrl = `${browseBaseUrl}/item_summary/search?${searchParams}`;

    // Make the API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for eBay

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ eBay Browse API error: ${response.status} - ${errorText.substring(0, 200)}`);

      // If token expired, clear cache and try once more
      if (response.status === 401) {
        console.log('🔄 eBay: Token expired, refreshing...');
        cachedToken = null;
        try {
          const newToken = await getAccessToken();
          const retryResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${newToken}`,
              'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
              'Content-Type': 'application/json',
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
      source: 'ebay',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==================== RESULT PROCESSING ====================

function processEbayResults(
  data: any,
  searchQuery: string,
  itemName: string,
  startTime: number
): MarketDataSource {
  const items = data.itemSummaries || [];

  if (items.length === 0) {
    return {
      source: 'ebay',
      available: false,
      query: searchQuery,
      totalListings: 0,
      error: 'No listings found',
    };
  }

  // Extract prices
  const prices = items
    .map((item: any) => {
      const price = parseFloat(item.price?.value || '0');
      const shipping = item.shippingOptions?.[0]?.shippingCost?.value;
      const shippingCost = shipping ? parseFloat(shipping) : 0;
      return price + shippingCost; // Total cost to buyer
    })
    .filter((p: number) => p > 0)
    .sort((a: number, b: number) => a - b);

  if (prices.length === 0) {
    return {
      source: 'ebay',
      available: true,
      query: searchQuery,
      totalListings: data.total || items.length,
      error: 'No valid prices found',
      sampleListings: items.slice(0, 3).map((item: any) => ({
        title: item.title || 'Unknown',
        price: 0,
        condition: item.condition || 'Unknown',
        url: item.itemWebUrl || `https://www.ebay.com/itm/${item.itemId}`,
      })),
      metadata: {
        responseTime: Date.now() - startTime,
        apiVersion: 'browse_v1_oauth',
      },
    };
  }

  const lowest = prices[0];
  const highest = prices[prices.length - 1];
  const average = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
  const median = prices[Math.floor(prices.length / 2)] || average;

  // Build sample listings
  const sampleListings = items.slice(0, 5).map((item: any) => ({
    title: item.title || 'Unknown',
    price: parseFloat(item.price?.value || '0'),
    condition: item.condition || 'Unknown',
    url: item.itemWebUrl || `https://www.ebay.com/itm/${item.itemId}`,
  }));

  console.log(`✅ eBay: Found ${items.length} listings, median $${median.toFixed(2)} in ${Date.now() - startTime}ms`);

  return {
    source: 'ebay',
    available: true,
    query: searchQuery,
    totalListings: data.total || items.length,
    priceAnalysis: {
      lowest: parseFloat(lowest.toFixed(2)),
      highest: parseFloat(highest.toFixed(2)),
      average: parseFloat(average.toFixed(2)),
      median: parseFloat(median.toFixed(2)),
    },
    suggestedPrices: {
      goodDeal: parseFloat((median * 0.75).toFixed(2)),
      fairMarket: parseFloat(median.toFixed(2)),
      sellPrice: parseFloat((median * 1.1).toFixed(2)),
    },
    sampleListings,
    metadata: {
      responseTime: Date.now() - startTime,
      apiVersion: 'browse_v1_oauth',
      environment: process.env.EBAY_ENVIRONMENT || 'production',
      totalResults: data.total,
      pricesSampled: prices.length,
    },
  };
}

// ==================== FALLBACK ====================

function createFallbackResult(itemName: string, query: string): MarketDataSource {
  // Generate eBay search URL for manual lookup (sold/completed items)
  const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=15&LH_Complete=1&LH_Sold=1`;

  return {
    source: 'ebay',
    available: true,
    query,
    totalListings: 0,
    sampleListings: [{
      title: `Search eBay for "${itemName}"`,
      price: 0,
      condition: 'N/A',
      url: searchUrl,
    }],
    metadata: {
      fallback: true,
      searchUrl,
    },
  };
}