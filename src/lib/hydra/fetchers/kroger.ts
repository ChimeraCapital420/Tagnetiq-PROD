// FILE: src/lib/hydra/fetchers/kroger.ts
// HYDRA v8.2 - Kroger Product & Price Fetcher
// Real retail store prices for grocery, household, beauty, health items
// API: https://api.kroger.com/v1/products
// Auth: OAuth2 Client Credentials (KROGER_CLIENT_ID + KROGER_CLIENT_SECRET)
// Rate: Standard API limits
//
// Kroger operates 2,700+ stores under banners: Kroger, Ralphs, Fred Meyer,
// Harris Teeter, King Soopers, Fry's, QFC, Dillons, Smith's, etc.
// Their API gives REAL current shelf prices — gold for household item valuation.
//
// Can search by:
//   - UPC barcode (filter.productId) — exact match
//   - Product name (filter.term) — fuzzy search

import type { MarketDataSource, AuthorityData } from '../types.js';

// =============================================================================
// CONFIG
// =============================================================================

const KROGER_TOKEN_URL = 'https://api.kroger.com/v1/connect/oauth2/token';
const KROGER_PRODUCTS_URL = 'https://api.kroger.com/v1/products';

// Token cache (OAuth2 tokens last 1800s = 30 min)
let cachedToken: string | null = null;
let tokenExpiry = 0;

// =============================================================================
// AVAILABILITY CHECK
// =============================================================================

export function isKrogerAvailable(): boolean {
  return !!(process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET);
}

// =============================================================================
// OAUTH2 TOKEN
// =============================================================================

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('⚠️ Kroger: Missing KROGER_CLIENT_ID or KROGER_CLIENT_SECRET');
    return null;
  }

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(KROGER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=product.compact',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ Kroger OAuth failed: ${response.status} ${errorText}`);
      return null;
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);

    console.log(`🔑 Kroger OAuth token obtained (expires in ${data.expires_in}s)`);
    return cachedToken;

  } catch (error) {
    console.error('❌ Kroger OAuth error:', error);
    return null;
  }
}

// =============================================================================
// BARCODE EXTRACTION
// =============================================================================

/**
 * Extract UPC from additionalContext or item name
 * Kroger's filter.productId accepts UPC-A (12 digits) with leading zeros padded to 13
 */
function extractBarcodeForKroger(itemName: string, additionalContext?: string): string | null {
  // Check additionalContext first (scanner barcode)
  if (additionalContext) {
    const upcMatch = additionalContext.match(/UPC:\s*(\d{8,14})/i);
    if (upcMatch) return upcMatch[1];
  }

  // Check item name for embedded barcodes
  const barcodePatterns = [
    /\b(\d{12})\b/,  // UPC-A
    /\b(\d{13})\b/,  // EAN-13
    /(?:upc|ean|barcode)[:\s#]*(\d{8,13})/i,
  ];

  for (const pattern of barcodePatterns) {
    const match = itemName.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Clean item name for Kroger text search
 * Remove barcodes, model numbers, and other noise
 */
function cleanSearchTerm(itemName: string): string {
  return itemName
    .replace(/\b\d{8,14}\b/g, '')           // Remove barcode numbers
    .replace(/(?:upc|ean|model)[:\s#]*\S+/gi, '') // Remove UPC:/Model: prefixes
    .replace(/\b[A-Z0-9]{8,}\b/g, '')       // Remove long model codes
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50); // Kroger search works best with short queries
}

// =============================================================================
// MAIN FETCHER
// =============================================================================

/**
 * Fetch product data from Kroger API
 * Context-aware: accepts additionalContext with barcode from scanner
 *
 * @param itemName - AI-identified item name
 * @param additionalContext - May contain "UPC: <digits>" from scanner
 */
export async function fetchKrogerData(
  itemName: string,
  additionalContext?: string
): Promise<MarketDataSource> {
  const startTime = Date.now();

  if (!isKrogerAvailable()) {
    return createFallbackResult(itemName, 'Kroger API not configured');
  }

  try {
    // Get OAuth token
    const token = await getAccessToken();
    if (!token) {
      return createFallbackResult(itemName, 'OAuth token failed');
    }

    // Try barcode lookup first (most accurate), then fall back to name search
    const barcode = extractBarcodeForKroger(itemName, additionalContext);
    let searchUrl: string;

    if (barcode) {
      // Pad UPC to 13 digits for Kroger API (they expect GTIN-13)
      const gtin = barcode.padStart(13, '0');
      searchUrl = `${KROGER_PRODUCTS_URL}?filter.productId=${gtin}&filter.limit=5`;
      console.log(`🛒 Kroger: Barcode lookup GTIN-13: ${gtin}`);
    } else {
      // Fall back to name search
      const searchTerm = cleanSearchTerm(itemName);
      if (!searchTerm || searchTerm.length < 3) {
        return createFallbackResult(itemName, 'Search term too short');
      }
      searchUrl = `${KROGER_PRODUCTS_URL}?filter.term=${encodeURIComponent(searchTerm)}&filter.limit=5`;
      console.log(`🛒 Kroger: Name search: "${searchTerm}"`);
    }

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear cache and retry once
        cachedToken = null;
        tokenExpiry = 0;
        console.log('⚠️ Kroger: Token expired, retrying...');
        const newToken = await getAccessToken();
        if (newToken) {
          const retryResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${newToken}`,
              'Accept': 'application/json',
            },
          });
          if (!retryResponse.ok) {
            return createFallbackResult(itemName, `API error after retry: ${retryResponse.status}`);
          }
          return parseKrogerResponse(await retryResponse.json(), itemName, barcode, startTime, additionalContext);
        }
      }
      console.error(`❌ Kroger API error: ${response.status}`);
      return createFallbackResult(itemName, `API error: ${response.status}`);
    }

    const data = await response.json();
    return parseKrogerResponse(data, itemName, barcode, startTime, additionalContext);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Kroger fetch error (${responseTime}ms):`, error);
    return {
      source: 'kroger',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// RESPONSE PARSER
// =============================================================================

function parseKrogerResponse(
  data: any,
  itemName: string,
  barcode: string | null,
  startTime: number,
  additionalContext?: string
): MarketDataSource {
  const products = data.data || [];

  if (products.length === 0) {
    console.log('⚠️ Kroger: No products found');
    return createFallbackResult(itemName, 'Product not found');
  }

  // Use first (best match) product
  const product = products[0];
  const productName = product.description || product.productId || itemName;

  // Extract pricing - Kroger returns items[].price with regular and promo
  const priceData = product.items?.[0]?.price || {};
  const regularPrice = priceData.regular || 0;
  const promoPrice = priceData.promo || 0;
  const currentPrice = promoPrice > 0 ? promoPrice : regularPrice;

  // Collect all prices from multiple items/sizes
  const allPrices: number[] = [];
  for (const item of (product.items || [])) {
    if (item.price?.regular > 0) allPrices.push(item.price.regular);
    if (item.price?.promo > 0) allPrices.push(item.price.promo);
  }

  // Also check other products in results for price range
  for (const p of products.slice(1, 5)) {
    for (const item of (p.items || [])) {
      if (item.price?.regular > 0) allPrices.push(item.price.regular);
    }
  }

  const lowestPrice = allPrices.length > 0 ? Math.min(...allPrices) : currentPrice;
  const highestPrice = allPrices.length > 0 ? Math.max(...allPrices) : currentPrice;
  const avgPrice = allPrices.length > 0
    ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length
    : currentPrice;

  // Extract images
  const images = (product.images || [])
    .flatMap((img: any) => (img.sizes || []))
    .filter((s: any) => s.size === 'large' || s.size === 'medium')
    .map((s: any) => s.url)
    .filter(Boolean);

  // Build authority data
  const authorityData: AuthorityData = {
    source: 'kroger',
    verified: true,
    confidence: calculateConfidence(product),
    title: productName,
    catalogNumber: barcode || product.upc || product.productId,
    marketValue: {
      low: lowestPrice,
      mid: currentPrice || avgPrice,
      high: highestPrice,
    },
    itemDetails: {
      productId: product.productId,
      upc: product.upc,
      description: product.description,
      brand: product.brand?.name || '',
      categories: product.categories || [],
      regularPrice,
      promoPrice: promoPrice > 0 ? promoPrice : undefined,
      currentPrice,
      size: product.items?.[0]?.size || '',
      images,
      temperature: product.temperature?.indicator || '',
      fulfillment: product.items?.[0]?.fulfillment || {},
    },
    externalUrl: `https://www.kroger.com/p/${product.productId}`,
    lastUpdated: new Date().toISOString(),
  };

  // Build price analysis
  const priceAnalysis = {
    lowest: lowestPrice,
    highest: highestPrice,
    average: parseFloat(avgPrice.toFixed(2)),
    median: currentPrice || parseFloat(avgPrice.toFixed(2)),
    sampleSize: allPrices.length || 1,
  };

  const responseTime = Date.now() - startTime;
  console.log(`✅ Kroger: Found "${productName}" in ${responseTime}ms`);
  console.log(`   Brand: ${product.brand?.name || 'Unknown'}`);
  console.log(`   Price: $${currentPrice.toFixed(2)} (reg: $${regularPrice.toFixed(2)}${promoPrice > 0 ? `, promo: $${promoPrice.toFixed(2)}` : ''})`);
  console.log(`   Products returned: ${products.length}`);

  return {
    source: 'kroger',
    available: true,
    query: barcode || itemName,
    totalListings: products.length,
    priceAnalysis,
    suggestedPrices: {
      goodDeal: parseFloat((lowestPrice * 0.5).toFixed(2)),
      fairMarket: parseFloat(currentPrice.toFixed(2)),
      sellPrice: parseFloat((currentPrice * 0.9).toFixed(2)), // Resale is below retail
    },
    sampleListings: products.slice(0, 5).map((p: any) => ({
      title: p.description || 'Kroger Product',
      price: p.items?.[0]?.price?.regular || 0,
      condition: 'New',
      url: `https://www.kroger.com/p/${p.productId}`,
    })),
    authorityData,
    metadata: {
      responseTime,
      barcode,
      brand: product.brand?.name,
      regularPrice,
      promoPrice: promoPrice > 0 ? promoPrice : undefined,
      productCount: products.length,
      barcodeSource: additionalContext?.includes('UPC:') ? 'scanner' : 'name_search',
    },
  };
}

// =============================================================================
// CONFIDENCE CALCULATION
// =============================================================================

function calculateConfidence(product: any): number {
  let score = 0;
  let maxScore = 0;

  // Critical: has price data
  maxScore += 30;
  if (product.items?.[0]?.price?.regular > 0) score += 30;

  // Important: has description
  maxScore += 20;
  if (product.description) score += 20;

  // Important: has brand
  maxScore += 15;
  if (product.brand?.name) score += 15;

  // Helpful: has images
  maxScore += 10;
  if (product.images?.length > 0) score += 10;

  // Helpful: has UPC
  maxScore += 15;
  if (product.upc) score += 15;

  // Helpful: has categories
  maxScore += 10;
  if (product.categories?.length > 0) score += 10;

  return Math.min(0.99, score / maxScore);
}

// =============================================================================
// FALLBACK
// =============================================================================

function createFallbackResult(query: string, reason: string): MarketDataSource {
  return {
    source: 'kroger',
    available: false,
    query,
    totalListings: 0,
    error: reason,
    metadata: {
      fallback: true,
      reason,
    },
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

  if (!isKrogerAvailable()) {
    return {
      status: 'unhealthy',
      latency: 0,
      message: 'KROGER_CLIENT_ID or KROGER_CLIENT_SECRET not configured',
    };
  }

  try {
    const token = await getAccessToken();
    if (!token) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        message: 'OAuth token acquisition failed',
      };
    }

    // Test with a simple product search
    const response = await fetch(
      `${KROGER_PRODUCTS_URL}?filter.term=milk&filter.limit=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      const productCount = data.data?.length || 0;
      return {
        status: 'healthy',
        latency,
        message: `API responding. Found ${productCount} product(s) for test query.`,
      };
    }

    return {
      status: 'degraded',
      latency,
      message: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}