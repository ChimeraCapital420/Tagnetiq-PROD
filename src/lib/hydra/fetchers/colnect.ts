// FILE: src/lib/hydra/fetchers/colnect.ts
// HYDRA v8.0 - Colnect Authority Data Fetcher
// Covers 40+ collectible categories via Colnect API (CAPI)
//
// Auth: HMAC-SHA256 signed requests (server-side only - no CORS)
// Docs: https://colnect.com/en/help/api
// Attribution: "Catalog information courtesy of Colnect, an online collectors community."
//
// MOBILE-FIRST: All requests go through Vercel serverless functions.
// The user's device never touches the Colnect API directly.

import { createHmac } from 'crypto';
import type { MarketDataSource, PriceAnalysis } from '../types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const COLNECT_BASE_URL = 'https://api.colnect.net';
const USER_AGENT = 'TagnetIQ-HYDRA/1.0.0'; // Must be >15 chars per CAPI spec
const DEFAULT_LANG = 'en';
const REQUEST_TIMEOUT = 12000; // 12s - keep it tight for mobile UX

// =============================================================================
// HYDRA CATEGORY → COLNECT CATEGORY MAPPING
// =============================================================================
// Colnect uses URL slugs for categories. Map HYDRA categories to Colnect slugs.
// Full list from CAPI spec - only map categories where Colnect adds value
// (i.e. categories not already covered better by a dedicated API)

export const HYDRA_TO_COLNECT_CATEGORY: Record<string, string> = {
  // PRIMARY - Colnect is THE authority for these
  'stamps': 'stamps',
  'banknotes': 'banknotes',
  'postcards': 'postcards',
  'phonecards': 'phonecards',
  'medals': 'medals',
  'tokens': 'tokens',
  'pins': 'pins',
  'patches': 'patches',
  'stickers': 'stickers',
  'tea_bags': 'tea_bags',
  'beer_coasters': 'beer_coasters',
  'bottlecaps': 'bottlecaps',
  'casino_cards': 'casino_cards',
  'drink_labels': 'drink_labels',
  'gift_cards': 'gift_cards',
  'hotel_key_cards': 'hotel_key_cards',
  'kids_meal_toys': 'kids_meal_toys',
  'sugar_packets': 'sugar_packets',
  'tickets': 'tickets',
  'magnets': 'magnets',
  'keychains': 'keychains',
  'miniature_sheets': 'miniature_sheets',

  // SECONDARY - Colnect has data, but we also have dedicated APIs
  // Colnect serves as backup/cross-reference authority
  'coins': 'coins',                       // Primary: Numista
  'lego': 'lego_sets',                    // Primary: Brickset
  'trading_cards': 'trading_card_games',   // Primary: Pokemon TCG / PSA
  'sports_cards': 'sports_cards',          // Primary: PSA
  'comics': 'comics',                      // Primary: ComicVine
  'video_games': 'video_games',            // Primary: eBay

  // COLLECTIBLES catch-all
  'collectibles': 'stamps', // Default to stamps for generic "collectible"
};

// Reverse mapping for display
export const COLNECT_CATEGORY_DISPLAY: Record<string, string> = {
  'stamps': 'Stamps',
  'coins': 'Coins',
  'banknotes': 'Banknotes',
  'postcards': 'Postcards',
  'phonecards': 'Phone Cards',
  'medals': 'Medals',
  'tokens': 'Tokens',
  'pins': 'Pins',
  'patches': 'Patches',
  'stickers': 'Stickers',
  'trading_card_games': 'Trading Card Games',
  'sports_cards': 'Sports Cards',
  'lego_sets': 'LEGO Sets',
  'comics': 'Comics',
  'video_games': 'Video Games',
  'beer_coasters': 'Beer Coasters',
  'bottlecaps': 'Bottle Caps',
  'casino_cards': 'Casino Cards',
  'drink_labels': 'Drink Labels',
  'gift_cards': 'Gift Cards',
  'hotel_key_cards': 'Hotel Key Cards',
  'kids_meal_toys': "Kids' Meal Toys",
  'sugar_packets': 'Sugar Packets',
  'tickets': 'Tickets',
  'magnets': 'Magnets',
  'keychains': 'Keychains',
  'tea_bags': 'Tea Bags',
  'miniature_sheets': 'Miniature Sheets',
};

// =============================================================================
// AUTHENTICATION - HMAC-SHA256
// =============================================================================
// Per CAPI spec: hash = HMAC-SHA256(urlPath + ">|<" + timestamp, appSecret)
// Headers: Capi-Timestamp + Capi-Hash
// app_secret is NEVER sent directly

function getCredentials(): { appId: string; appSecret: string } | null {
  const appId = process.env.COLNECT_API_KEY || process.env.COLNECT_APP_ID;
  const appSecret = process.env.COLNECT_API_SECRET || process.env.COLNECT_APP_SECRET;

  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

function buildAuthHeaders(urlPath: string, appSecret: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const hashInput = `${urlPath}>|<${timestamp}`;
  const hash = createHmac('sha256', appSecret).update(hashInput).digest('hex');

  return {
    'Capi-Timestamp': String(timestamp),
    'Capi-Hash': hash,
    'User-Agent': USER_AGENT,
    'Accept': 'application/json',
  };
}

// =============================================================================
// API REQUEST HELPER
// =============================================================================

async function colnectRequest<T = unknown>(urlPath: string): Promise<T> {
  const creds = getCredentials();
  if (!creds) throw new Error('COLNECT_API_KEY / COLNECT_API_SECRET not configured');

  const headers = buildAuthHeaders(urlPath, creds.appSecret);
  const fullUrl = `${COLNECT_BASE_URL}${urlPath}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      throw new Error(`Colnect API ${response.status}: ${errorText}`);
    }

    return (await response.json()) as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Colnect request timed out (${REQUEST_TIMEOUT / 1000}s)`);
    }
    throw error;
  }
}

// =============================================================================
// URLize - Convert item names to Colnect-compatible slugs
// =============================================================================
// From CAPI spec appendix - strips invalid chars, replaces spaces with underscores

function urlize(str: string): string {
  let result = str;
  // Strip HTML entities
  result = result.replace(/&[^;]+;/g, '_');
  // Remove invalid URL characters
  result = result.replace(/[."<>\\:/?#[\]@!$&'()*+,;=]/g, '');
  // Any space sequence becomes a single underscore
  result = result.replace(/[\s_]+/g, '_');
  // Trim underscores
  result = result.replace(/^_+|_+$/g, '');
  return result;
}

// =============================================================================
// MAIN FETCHER - Called by HYDRA orchestrator
// =============================================================================

export async function fetchColnectData(
  itemName: string,
  category?: string
): Promise<MarketDataSource> {
  const startTime = Date.now();
  console.log(`\n🏛️ === COLNECT FETCHER ===`);
  console.log(`📦 Item: "${itemName}"`);
  console.log(`🏷️ HYDRA Category: ${category || 'unknown'}`);

  // Check credentials
  const creds = getCredentials();
  if (!creds) {
    console.log('⚠️ Colnect: API credentials not configured');
    return {
      source: 'colnect',
      available: false,
      query: itemName,
      totalListings: 0,
      error: 'COLNECT_API_KEY / COLNECT_API_SECRET not configured',
    };
  }

  // Map HYDRA category to Colnect category slug
  const colnectCategory = mapToColnectCategory(category || 'general', itemName);
  if (!colnectCategory) {
    console.log(`⚠️ Colnect: No matching Colnect category for "${category}"`);
    return {
      source: 'colnect',
      available: false,
      query: itemName,
      totalListings: 0,
      error: `No Colnect category mapping for "${category}"`,
    };
  }

  console.log(`🗂️ Colnect Category: ${colnectCategory} (${COLNECT_CATEGORY_DISPLAY[colnectCategory] || colnectCategory})`);

  try {
    // Step 1: Search for items using the list action
    const searchResults = await searchItems(creds.appId, colnectCategory, itemName);

    if (!searchResults || searchResults.length === 0) {
      console.log(`⚠️ Colnect: No items found for "${itemName}" in ${colnectCategory}`);
      return {
        source: 'colnect',
        available: false,
        query: itemName,
        totalListings: 0,
        error: 'No matching items found',
      };
    }

    console.log(`✅ Colnect: Found ${searchResults.length} items`);

    // Step 2: Get details for the best match
    const bestMatch = searchResults[0];
    const itemId = bestMatch[0]; // First element is always item_id

    // Step 3: Try to get market prices (may not be available for all categories)
    let marketPrices: ColnectMarketPrice[] | null = null;
    try {
      marketPrices = await getMarketPrices(creds.appId, colnectCategory, [itemId]);
    } catch (priceError: any) {
      console.log(`⚠️ Colnect: Market prices unavailable: ${priceError.message}`);
    }

    // Step 4: Build the response
    const priceAnalysis = buildPriceAnalysis(marketPrices);
    const authorityData = buildAuthorityData(
      bestMatch,
      colnectCategory,
      marketPrices,
      itemName
    );

    const fetchTime = Date.now() - startTime;
    console.log(`✅ Colnect fetch complete in ${fetchTime}ms`);

    return {
      source: 'colnect',
      available: true,
      query: itemName,
      totalListings: searchResults.length,
      priceAnalysis: priceAnalysis || undefined,
      authorityData,
      data: {
        colnectCategory,
        itemId,
        itemName: bestMatch[5] || bestMatch[7] || itemName, // item_description or item_name
        totalResults: searchResults.length,
        fetchTime,
      },
    };
  } catch (error: any) {
    const fetchTime = Date.now() - startTime;
    console.error(`❌ Colnect fetch failed (${fetchTime}ms):`, error.message);

    return {
      source: 'colnect',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error.message || 'Colnect fetch failed',
    };
  }
}

// =============================================================================
// SEARCH ITEMS
// =============================================================================
// Uses the "list" action to find items matching the search query
// Returns: array of [item_id, series_id, producer_id, front_picture_id,
//          back_picture_id, item_description, catalog_codes, item_name]

type ColnectListItem = (string | number)[];

async function searchItems(
  appId: string,
  colnectCategory: string,
  itemName: string
): Promise<ColnectListItem[]> {
  // Build search URL with the item name as a filter
  // Colnect list action requires at least one filter
  // We use the item name to search
  const slugName = urlize(itemName);
  const urlPath = `/${DEFAULT_LANG}/api/${appId}/list/cat/${colnectCategory}/item_name/${slugName}`;

  console.log(`🔍 Colnect search: ${urlPath}`);

  try {
    const data = await colnectRequest<ColnectListItem[] | Record<string, unknown>>(urlPath);

    if (Array.isArray(data)) {
      return data;
    }

    // Sometimes Colnect returns an object with error info
    console.log('⚠️ Colnect returned non-array:', JSON.stringify(data).slice(0, 200));
    return [];
  } catch (error: any) {
    // If list fails, try list_id as a fallback (lighter response)
    console.log(`⚠️ Colnect list failed, trying alternative search...`);

    try {
      const altPath = `/${DEFAULT_LANG}/api/${appId}/list_id/cat/${colnectCategory}`;
      const ids = await colnectRequest<number[]>(altPath);
      // Return minimal data - just IDs wrapped in arrays
      return ids.slice(0, 10).map(id => [id]);
    } catch {
      throw error; // Re-throw original error
    }
  }
}

// =============================================================================
// MARKET PRICES
// =============================================================================
// Gets sale price history for items
// Returns: { item_id: { condition: [[currency_id, price], ...], ... } }

interface ColnectMarketPrice {
  itemId: number;
  condition: string;
  prices: Array<{ currencyId: number; price: number }>;
}

async function getMarketPrices(
  appId: string,
  colnectCategory: string,
  itemIds: number[],
  days: number = 90
): Promise<ColnectMarketPrice[]> {
  const idsStr = itemIds.join(',');
  const urlPath = `/${DEFAULT_LANG}/api/${appId}/market_prices/cat/${colnectCategory}/ids/${idsStr}/days/${days}`;

  const data = await colnectRequest<Record<string, Record<string, Array<[number, number]>>>>(urlPath);

  const results: ColnectMarketPrice[] = [];

  for (const [itemId, conditions] of Object.entries(data)) {
    for (const [condition, priceEntries] of Object.entries(conditions)) {
      results.push({
        itemId: parseInt(itemId, 10),
        condition,
        prices: priceEntries.map(([currencyId, price]) => ({ currencyId, price })),
      });
    }
  }

  return results;
}

// =============================================================================
// ITEM DETAILS
// =============================================================================
// Gets detailed info for a specific item
// Returns: array of field values (use /fields to know the order)

export async function getItemDetails(
  appId: string,
  colnectCategory: string,
  itemId: number,
  includeFieldIds: boolean = true,
  includeDetails: boolean = true
): Promise<Record<string, unknown>> {
  const urlPath = `/${DEFAULT_LANG}/api/${appId}/item/cat/${colnectCategory}/id/${itemId}/include_field_ids/${includeFieldIds ? 1 : 0}/include_details/${includeDetails ? 1 : 0}`;

  return colnectRequest<Record<string, unknown>>(urlPath);
}

// =============================================================================
// CATEGORY MAPPING
// =============================================================================

function mapToColnectCategory(hydraCategory: string, itemName?: string): string | null {
  const catLower = hydraCategory.toLowerCase().trim();

  // Direct mapping
  if (HYDRA_TO_COLNECT_CATEGORY[catLower]) {
    return HYDRA_TO_COLNECT_CATEGORY[catLower];
  }

  // Name-based detection for Colnect-specific categories
  if (itemName) {
    const nameLower = itemName.toLowerCase();

    if (nameLower.includes('stamp') || nameLower.includes('postage')) return 'stamps';
    if (nameLower.includes('banknote') || nameLower.includes('bank note') || nameLower.includes('paper money')) return 'banknotes';
    if (nameLower.includes('postcard')) return 'postcards';
    if (nameLower.includes('phone card') || nameLower.includes('phonecard')) return 'phonecards';
    if (nameLower.includes('medal') || nameLower.includes('medallion')) return 'medals';
    if (nameLower.includes('token')) return 'tokens';
    if (nameLower.includes('pin ') || nameLower.includes(' pin') || nameLower.includes('enamel pin') || nameLower.includes('lapel pin')) return 'pins';
    if (nameLower.includes('patch') || nameLower.includes('embroidered')) return 'patches';
    if (nameLower.includes('sticker')) return 'stickers';
    if (nameLower.includes('ticket') || nameLower.includes('concert ticket')) return 'tickets';
    if (nameLower.includes('magnet') || nameLower.includes('fridge magnet')) return 'magnets';
    if (nameLower.includes('keychain') || nameLower.includes('key chain') || nameLower.includes('key ring')) return 'keychains';
    if (nameLower.includes('beer coaster') || nameLower.includes('beermat')) return 'beer_coasters';
    if (nameLower.includes('bottle cap') || nameLower.includes('bottlecap')) return 'bottlecaps';
    if (nameLower.includes('gift card')) return 'gift_cards';
  }

  return null;
}

// =============================================================================
// RESPONSE BUILDERS
// =============================================================================

function buildPriceAnalysis(marketPrices: ColnectMarketPrice[] | null): PriceAnalysis | null {
  if (!marketPrices || marketPrices.length === 0) return null;

  // Extract all prices (in various currencies - we'll use as-is for now)
  const allPrices = marketPrices.flatMap(mp =>
    mp.prices.map(p => p.price)
  ).filter(p => p > 0);

  if (allPrices.length === 0) return null;

  allPrices.sort((a, b) => a - b);

  const sum = allPrices.reduce((acc, p) => acc + p, 0);
  const median = allPrices.length % 2 === 0
    ? (allPrices[allPrices.length / 2 - 1] + allPrices[allPrices.length / 2]) / 2
    : allPrices[Math.floor(allPrices.length / 2)];

  return {
    average: parseFloat((sum / allPrices.length).toFixed(2)),
    median: parseFloat(median.toFixed(2)),
    low: allPrices[0],
    high: allPrices[allPrices.length - 1],
    sampleSize: allPrices.length,
    currency: 'USD', // Note: Colnect returns multiple currencies - normalize later
  };
}

function buildAuthorityData(
  listItem: ColnectListItem,
  colnectCategory: string,
  marketPrices: ColnectMarketPrice[] | null,
  originalQuery: string
) {
  // list returns: [item_id, series_id, producer_id, front_picture_id,
  //                back_picture_id, item_description, catalog_codes, item_name]
  const itemId = listItem[0] as number;
  const seriesId = listItem[1] as number;
  const producerId = listItem[2] as number;
  const frontPicId = listItem[3] as number;
  const backPicId = listItem[4] as number;
  const description = (listItem[5] as string) || '';
  const catalogCodes = (listItem[6] as string) || '';
  const itemName = (listItem[7] as string) || description || originalQuery;

  // Build image URLs using Colnect's image CDN
  // Format: https://i.colnect.net/f/{id}/{slug}.jpg (full size)
  // Format: https://i.colnect.net/t/{id}/{slug}.jpg (thumbnail)
  const frontImageUrl = frontPicId ? `https://i.colnect.net/f/${frontPicId}/item.jpg` : undefined;
  const backImageUrl = backPicId ? `https://i.colnect.net/t/${backPicId}/item.jpg` : undefined;

  // Build Colnect URL for the item
  const categoryDisplay = COLNECT_CATEGORY_DISPLAY[colnectCategory] || colnectCategory;
  const colnectUrl = `https://colnect.com/en/${colnectCategory}/item/${itemId}`;

  // Extract conditions and prices from market data
  const conditionPrices: Record<string, number> = {};
  if (marketPrices) {
    for (const mp of marketPrices) {
      if (mp.itemId === itemId && mp.prices.length > 0) {
        // Use the first price entry for each condition
        conditionPrices[mp.condition] = mp.prices[0].price;
      }
    }
  }

  return {
    source: 'colnect',
    verified: true,
    confidence: 0.85,
    title: itemName,
    catalogNumber: catalogCodes || undefined,
    externalUrl: colnectUrl,
    lastUpdated: new Date().toISOString(),
    itemDetails: {
      // Core identification
      colnectItemId: itemId,
      colnectCategory,
      categoryDisplay,
      itemName,
      description,
      catalogCodes,

      // Relationships
      seriesId,
      producerId,

      // Images
      frontImageUrl,
      backImageUrl,

      // Market data
      conditionPrices: Object.keys(conditionPrices).length > 0 ? conditionPrices : undefined,

      // Attribution (REQUIRED by Colnect ToS)
      attribution: 'Catalog information courtesy of Colnect, an online collectors community.',
      attributionUrl: 'https://colnect.com',
    },
    marketValue: Object.keys(conditionPrices).length > 0 ? {
      ...conditionPrices,
    } : undefined,
  };
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  message: string;
}> {
  const startTime = Date.now();
  const creds = getCredentials();

  if (!creds) {
    return {
      status: 'unhealthy',
      latency: 0,
      message: 'COLNECT_API_KEY / COLNECT_API_SECRET not configured',
    };
  }

  try {
    // Test with the categories endpoint (lightweight)
    const urlPath = `/${DEFAULT_LANG}/api/${creds.appId}/categories`;
    const data = await colnectRequest<string[]>(urlPath);
    const latency = Date.now() - startTime;

    if (Array.isArray(data) && data.length > 0) {
      return {
        status: 'healthy',
        latency,
        message: `Colnect API responding. ${data.length} categories available.`,
      };
    }

    return {
      status: 'degraded',
      latency,
      message: 'Colnect API responded but returned unexpected data',
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: error.message || 'Colnect health check failed',
    };
  }
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

/**
 * Get list of Colnect categories available
 */
export async function getColnectCategories(): Promise<string[]> {
  const creds = getCredentials();
  if (!creds) throw new Error('Colnect credentials not configured');

  const urlPath = `/${DEFAULT_LANG}/api/${creds.appId}/categories`;
  return colnectRequest<string[]>(urlPath);
}

/**
 * Get item sales (active marketplace listings)
 */
export async function getItemSales(
  colnectCategory: string,
  itemId: number,
  maxSales: number = 10
): Promise<Record<string, unknown>> {
  const creds = getCredentials();
  if (!creds) throw new Error('Colnect credentials not configured');

  const urlPath = `/${DEFAULT_LANG}/api/${creds.appId}/item_sales/cat/${colnectCategory}/item_id/${itemId}/max_sales/${maxSales}`;
  return colnectRequest<Record<string, unknown>>(urlPath);
}

/**
 * Get fields for a category (to know the order of item data)
 */
export async function getCategoryFields(colnectCategory: string): Promise<string[]> {
  const creds = getCredentials();
  if (!creds) throw new Error('Colnect credentials not configured');

  const urlPath = `/${DEFAULT_LANG}/api/${creds.appId}/fields/cat/${colnectCategory}`;
  return colnectRequest<string[]>(urlPath);
}

/**
 * Get countries for a category
 */
export async function getCountries(colnectCategory: string): Promise<Array<[number, string, number]>> {
  const creds = getCredentials();
  if (!creds) throw new Error('Colnect credentials not configured');

  const urlPath = `/${DEFAULT_LANG}/api/${creds.appId}/countries/cat/${colnectCategory}`;
  return colnectRequest<Array<[number, string, number]>>(urlPath);
}

/**
 * Check if a HYDRA category has Colnect support
 */
export function hasColnectSupport(hydraCategory: string): boolean {
  return mapToColnectCategory(hydraCategory) !== null;
}

/**
 * Get the Colnect category slug for a HYDRA category
 */
export function getColnectCategorySlug(hydraCategory: string, itemName?: string): string | null {
  return mapToColnectCategory(hydraCategory, itemName);
}