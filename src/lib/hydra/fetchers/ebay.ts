// FILE: src/lib/hydra/fetchers/ebay.ts
// HYDRA v7.1 - eBay Market Data Fetcher
// FIXED v7.0: Full OAuth2 client credentials flow
// ADDED v7.1: fetchEbayDataByImage() — visual search via Browse API search_by_image
// FIXED v7.2: Price field fallback — Browse API returns price in multiple fields
//   depending on listing type (FIXED_PRICE vs AUCTION vs BEST_OFFER).
//   Now checks: price.value → currentBidPrice.value → marketPrice.value
//   This fixes the $3.99 flat line bug where auction items had no price.value
//   but did have currentBidPrice.value. sampleListings price uses same fallback.
// ADDED v7.3: Sell-through rate + rich market intelligence
//   - Second API call for sold/completed listings (last 30 days)
//   - Sell-through rate = sold ÷ active × 100
//   - Velocity label: Hot / Steady / Slow / Sitting
//   - Condition breakdown, buying options split, authenticity guarantee flag
//   - Avg seller feedback, listing age signal, best platform suggestion

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

// ==================== SELL-THROUGH FETCH (v7.3 NEW) ====================

/**
 * Fetches sold/completed listings for the same query.
 * Returns { soldCount, soldPrices, medianDaysToSell }
 * Runs in parallel with the active listings fetch — adds ~0ms wall time.
 */
async function fetchSoldListings(
  searchQuery: string,
  accessToken: string,
  environment: 'production' | 'sandbox',
): Promise<{ soldCount: number; soldMedianPrice: number; medianDaysListed: number }> {
  try {
    const browseBaseUrl = ENDPOINTS[environment].browse;

    const soldParams = new URLSearchParams({
      q:     searchQuery,
      limit: '50',
    });
    // Filter for completed sold listings in the last 30 days
    soldParams.append('filter', 'buyingOptions:{FIXED_PRICE|AUCTION},conditions:{NEW|LIKE_NEW|VERY_GOOD|GOOD|ACCEPTABLE},soldListings:true');

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${browseBaseUrl}/item_summary/search?${soldParams}`, {
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
      console.warn(`⚠️ eBay sold listings fetch failed: ${response.status}`);
      return { soldCount: 0, soldMedianPrice: 0, medianDaysListed: 0 };
    }

    const data = await response.json();
    const soldTotal = data.total || 0;
    const items = data.itemSummaries || [];

    // Extract sold prices
    const soldPrices = items
      .map((item: any) => parseFloat(
        item.lastSoldPrice?.value ||
        item.price?.value ||
        item.currentBidPrice?.value ||
        '0'
      ))
      .filter((p: number) => p > 0)
      .sort((a: number, b: number) => a - b);

    const soldMedianPrice = soldPrices.length > 0
      ? soldPrices[Math.floor(soldPrices.length / 2)]
      : 0;

    // Calculate median days listed before sale (from itemCreationDate to now)
    const now = Date.now();
    const daysListed = items
      .filter((item: any) => item.itemCreationDate)
      .map((item: any) => {
        const created = new Date(item.itemCreationDate).getTime();
        return Math.round((now - created) / (1000 * 60 * 60 * 24));
      })
      .filter((d: number) => d > 0 && d < 365)
      .sort((a: number, b: number) => a - b);

    const medianDaysListed = daysListed.length > 0
      ? daysListed[Math.floor(daysListed.length / 2)]
      : 0;

    return { soldCount: soldTotal, soldMedianPrice, medianDaysListed };
  } catch (err) {
    console.warn('⚠️ eBay sold listings fetch error:', err);
    return { soldCount: 0, soldMedianPrice: 0, medianDaysListed: 0 };
  }
}

// ==================== SELL-THROUGH CALCULATION (v7.3) ====================

function calculateSellThrough(
  activeCount: number,
  soldCount: number,
  medianDaysListed: number,
): SellThroughData {
  if (activeCount === 0) {
    return { rate: 0, label: 'Unknown', velocity: 'unknown', medianDaysToSell: 0, activeListings: 0, soldLast30Days: 0 };
  }

  const rate = Math.round((soldCount / activeCount) * 100);

  let label: string;
  let velocity: 'hot' | 'steady' | 'slow' | 'sitting' | 'unknown';

  if (rate >= 200) {
    label    = 'Hot — sells very fast';
    velocity = 'hot';
  } else if (rate >= 50) {
    label    = 'Steady market';
    velocity = 'steady';
  } else if (rate >= 10) {
    label    = 'Slow mover';
    velocity = 'slow';
  } else {
    label    = 'Sitting — hard to sell';
    velocity = 'sitting';
  }

  return {
    rate,
    label,
    velocity,
    medianDaysToSell: medianDaysListed,
    activeListings:   activeCount,
    soldLast30Days:   soldCount,
  };
}

// ==================== RICH MARKET INTELLIGENCE (v7.3) ====================

function extractRichIntel(items: any[]): RichMarketIntel {
  // Condition breakdown
  const conditionCounts: Record<string, number> = {};
  items.forEach((item: any) => {
    const cond = item.condition || 'Unknown';
    conditionCounts[cond] = (conditionCounts[cond] || 0) + 1;
  });

  // Buying options split
  let fixedPrice = 0, auction = 0, bestOffer = 0;
  items.forEach((item: any) => {
    const opts: string[] = item.buyingOptions || [];
    if (opts.includes('FIXED_PRICE')) fixedPrice++;
    if (opts.includes('AUCTION'))     auction++;
    if (opts.includes('BEST_OFFER'))  bestOffer++;
  });

  // Authenticity Guarantee (luxury signal)
  const hasAuthenticityGuarantee = items.some((item: any) =>
    (item.qualifiedPrograms || []).includes('AUTHENTICITY_GUARANTEE')
  );

  // Avg seller feedback
  const feedbackScores = items
    .map((item: any) => parseFloat(item.seller?.feedbackPercentage || '0'))
    .filter((f: number) => f > 0);
  const avgSellerFeedback = feedbackScores.length > 0
    ? Math.round(feedbackScores.reduce((a: number, b: number) => a + b, 0) / feedbackScores.length)
    : 0;

  // Free shipping percentage
  const freeShippingCount = items.filter((item: any) =>
    item.shippingOptions?.some((s: any) =>
      parseFloat(s.shippingCost?.value || '1') === 0
    )
  ).length;
  const freeShippingPct = items.length > 0
    ? Math.round((freeShippingCount / items.length) * 100)
    : 0;

  // Best platform suggestion — simple heuristic
  let bestPlatform = 'eBay';
  if (auction > fixedPrice && auction > bestOffer) {
    bestPlatform = 'eBay Auction';
  } else if (bestOffer > fixedPrice) {
    bestPlatform = 'eBay Best Offer';
  }

  return {
    conditionBreakdown:        conditionCounts,
    buyingOptions:             { fixedPrice, auction, bestOffer },
    hasAuthenticityGuarantee,
    avgSellerFeedback,
    freeShippingPct,
    bestPlatform,
  };
}

// ==================== TYPE DEFINITIONS (v7.3) ====================

export interface SellThroughData {
  rate:             number;   // percentage e.g. 340
  label:            string;   // "Hot — sells very fast"
  velocity:         'hot' | 'steady' | 'slow' | 'sitting' | 'unknown';
  medianDaysToSell: number;
  activeListings:   number;
  soldLast30Days:   number;
}

export interface RichMarketIntel {
  conditionBreakdown:        Record<string, number>;
  buyingOptions:             { fixedPrice: number; auction: number; bestOffer: number };
  hasAuthenticityGuarantee:  boolean;
  avgSellerFeedback:         number;
  freeShippingPct:           number;
  bestPlatform:              string;
}

// ==================== KEYWORD SEARCH ====================

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

    // v7.3: Run active + sold fetches in parallel — zero added wall time
    const [response, soldData] = await Promise.all([
      fetch(searchUrl, {
        method:  'GET',
        headers: {
          'Authorization':           `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Content-Type':            'application/json',
        },
        signal: controller.signal,
      }),
      fetchSoldListings(searchQuery, accessToken, environment),
    ]);

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
            return processEbayResults(retryData, searchQuery, itemName, startTime, soldData);
          }
        } catch (retryErr) {
          console.error('❌ eBay retry also failed:', retryErr);
        }
      }
      return createFallbackResult(itemName, searchQuery);
    }

    const data = await response.json();
    return processEbayResults(data, searchQuery, itemName, startTime, soldData);

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

// ==================== IMAGE SEARCH (v7.1) ====================

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

    const environment    = (process.env.EBAY_ENVIRONMENT?.toLowerCase() === 'sandbox') ? 'sandbox' : 'production';
    const imageSearchUrl = ENDPOINTS[environment].imageSearch;

    const params = new URLSearchParams({ limit: '20' });

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 20000);

    console.log(`👁️ eBay image search: sending ${(cleanBase64.length * 0.75 / 1024).toFixed(0)}KB image for "${itemName}"`);

    // v7.3: Run image search + sold lookup in parallel
    const [response, soldData] = await Promise.all([
      fetch(`${imageSearchUrl}?${params}`, {
        method: 'POST',
        headers: {
          'Authorization':           `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Content-Type':            'application/json',
        },
        body: JSON.stringify({ image: cleanBase64 }),
        signal: controller.signal,
      }),
      fetchSoldListings(itemName, accessToken, environment),
    ]);

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ eBay image search error: ${response.status} - ${errorText.substring(0, 300)}`);

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
            return processEbayImageResults(retryData, itemName, startTime, soldData);
          }
        } catch (retryErr) {
          console.error('❌ eBay image search retry failed:', retryErr);
        }
      }

      console.log('↩️ eBay image search failed — falling back to keyword search');
      return fetchEbayData(itemName, category);
    }

    const data = await response.json();

    if (!data.itemSummaries || data.itemSummaries.length === 0) {
      console.log('ℹ️ eBay image search: no visual matches found — falling back to keyword');
      return fetchEbayData(itemName, category);
    }

    return processEbayImageResults(data, itemName, startTime, soldData);

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ eBay image search timed out (20s) — falling back to keyword');
    } else {
      console.error('❌ eBay image search error:', error);
    }
    return fetchEbayData(itemName, category);
  }
}

// ==================== IMAGE RESULT PROCESSING ====================

function processEbayImageResults(
  data: any,
  itemName: string,
  startTime: number,
  soldData: { soldCount: number; soldMedianPrice: number; medianDaysListed: number },
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

  const prices = items
    .map((item: any) => {
      const price = parseFloat(
        item.price?.value ||
        item.currentBidPrice?.value ||
        item.marketPrice?.value ||
        '0'
      );
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

  const activeCount  = data.total || items.length;
  const sellThrough  = calculateSellThrough(activeCount, soldData.soldCount, soldData.medianDaysListed);
  const richIntel    = extractRichIntel(items);

  const sampleListings = items.slice(0, 5).map((item: any) => ({
    title:     item.title || 'Unknown',
    price:     parseFloat(
      item.price?.value ||
      item.currentBidPrice?.value ||
      item.marketPrice?.value ||
      '0'
    ),
    condition: item.condition || 'Unknown',
    url:       item.itemWebUrl || `https://www.ebay.com/itm/${item.itemId}`,
    image:     item.image?.imageUrl,
  }));

  console.log(`✅ eBay image search: ${items.length} visual matches, median $${median.toFixed(2)}, sell-through ${sellThrough.rate}% in ${Date.now() - startTime}ms`);

  return {
    source:        'ebay',
    available:     true,
    query:         `[image] ${itemName}`,
    totalListings: activeCount,
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
    sellThrough,
    richIntel,
    metadata: {
      responseTime:  Date.now() - startTime,
      apiVersion:    'browse_v1_image_search',
      imageSearch:   true,
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
  startTime: number,
  soldData: { soldCount: number; soldMedianPrice: number; medianDaysListed: number },
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
      const price = parseFloat(
        item.price?.value ||
        item.currentBidPrice?.value ||
        item.marketPrice?.value ||
        '0'
      );
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

  const activeCount = data.total || items.length;
  const sellThrough = calculateSellThrough(activeCount, soldData.soldCount, soldData.medianDaysListed);
  const richIntel   = extractRichIntel(items);

  const sampleListings = items.slice(0, 5).map((item: any) => ({
    title:     item.title || 'Unknown',
    price:     parseFloat(
      item.price?.value ||
      item.currentBidPrice?.value ||
      item.marketPrice?.value ||
      '0'
    ),
    condition: item.condition || 'Unknown',
    url:       item.itemWebUrl || `https://www.ebay.com/itm/${item.itemId}`,
    image:     item.image?.imageUrl,
  }));

  console.log(`✅ eBay: ${items.length} listings, median $${median.toFixed(2)}, sell-through ${sellThrough.rate}% in ${Date.now() - startTime}ms`);

  return {
    source:        'ebay',
    available:     true,
    query:         searchQuery,
    totalListings: activeCount,
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
    sellThrough,
    richIntel,
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
    metadata: { fallback: true, searchUrl },
  };
}