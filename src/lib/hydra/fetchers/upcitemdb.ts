// FILE: src/lib/hydra/fetchers/upcitemdb.ts
// HYDRA v8.2 - UPCitemdb Barcode Lookup Fetcher (with Barcode Spider cascade)
// FREE API - 100 requests/day
// Documentation: https://www.upcitemdb.com/wp/docs/main/development/api/
// FIXED v8.1: Now accepts additionalContext with raw barcode from device scanner
// ADDED v8.2: Cascade fallback to Barcode Spider on 400/404/no-results
//   - UPCitemdb free tier rejects some international barcodes (e.g. 697-prefix China)
//   - Barcode Spider has broader global coverage via BARCODE_SPIDER_TOKEN
//   - Cascade: UPCitemdb → Barcode Spider → give up

import type { MarketDataSource, AuthorityData } from '../types.js';
import { fetchBarcodeSpiderData, isBarcodeSpiderAvailable } from './barcode-spider.js';

const UPCITEMDB_API_BASE = 'https://api.upcitemdb.com/prod/trial';

// Rate limit tracking
let dailyRequestCount = 0;
let lastResetDate = new Date().toDateString();
const DAILY_LIMIT = 100;

export interface UPCItemData {
  upc: string;
  ean: string;
  title: string;
  description: string;
  brand: string;
  model: string;
  color: string;
  size: string;
  dimension: string;
  weight: string;
  category: string;
  currency: string;
  lowestPrice: number;
  highestPrice: number;
  msrp: number;
  images: string[];
  offers: Array<{
    merchant: string;
    domain: string;
    title: string;
    currency: string;
    listPrice: number;
    price: number;
    shipping: string;
    condition: string;
    availability: string;
    link: string;
    updatedAt: number;
  }>;
  asin: string;
  elid: string;
}

/**
 * Check and reset daily rate limit counter
 */
function checkRateLimit(): boolean {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyRequestCount = 0;
    lastResetDate = today;
  }
  return dailyRequestCount < DAILY_LIMIT;
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(): { remaining: number; limit: number; resetDate: string } {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    return { remaining: DAILY_LIMIT, limit: DAILY_LIMIT, resetDate: today };
  }
  return { 
    remaining: Math.max(0, DAILY_LIMIT - dailyRequestCount), 
    limit: DAILY_LIMIT, 
    resetDate: lastResetDate 
  };
}

/**
 * Extract UPC/EAN barcode from item name or description
 */
export function extractBarcode(text: string): string | null {
  // UPC-A: 12 digits
  const upcA = text.match(/\b(\d{12})\b/);
  if (upcA) return upcA[1];
  
  // EAN-13: 13 digits
  const ean13 = text.match(/\b(\d{13})\b/);
  if (ean13) return ean13[1];
  
  // UPC-E: 8 digits (compact form)
  const upcE = text.match(/\b(\d{8})\b/);
  if (upcE) return upcE[1];
  
  // Look for explicit barcode mentions
  const barcodeMatch = text.match(/(?:upc|ean|barcode)[:\s#]*(\d{8,13})/i);
  if (barcodeMatch) return barcodeMatch[1];
  
  return null;
}

/**
 * Validate barcode checksum (UPC-A)
 */
export function validateUPC(upc: string): boolean {
  if (upc.length !== 12) return false;
  
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(upc[i], 10);
    sum += (i % 2 === 0) ? digit * 3 : digit;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(upc[11], 10);
}

/**
 * Main fetch function - lookup by UPC/EAN barcode
 * 
 * FIXED v8.1: Now accepts additionalContext parameter
 * ADDED v8.2: Cascade fallback to Barcode Spider on failure
 * 
 * Flow:
 *   1. Extract barcode from scanner (additionalContext) or AI item name
 *   2. Try UPCitemdb free API
 *   3. On 400/404/no-results → cascade to Barcode Spider (if token available)
 *   4. Return best result or fallback
 * 
 * @param itemName - The AI-identified item name (may contain partial barcode)
 * @param additionalContext - Context string, may contain "UPC: <digits>" from scanner
 */
export async function fetchUpcItemDbData(itemName: string, additionalContext?: string): Promise<MarketDataSource> {
  const startTime = Date.now();

  try {
    // Check rate limit
    if (!checkRateLimit()) {
      console.log('⚠️ UPCitemdb: Daily rate limit reached (100/day)');
      // v8.2: Even if rate-limited, try Barcode Spider if we have a barcode
      const barcode = extractBarcodeFromContext(itemName, additionalContext);
      if (barcode && isBarcodeSpiderAvailable()) {
        console.log('🕷️ UPCitemdb rate-limited, cascading to Barcode Spider...');
        return fetchBarcodeSpiderData(barcode, itemName);
      }
      return createFallbackResult(itemName, 'Rate limit exceeded');
    }

    // Extract barcode from scanner context or AI item name
    const barcode = extractBarcodeFromContext(itemName, additionalContext);
    
    if (!barcode) {
      console.log('⚠️ UPCitemdb: No barcode found in item name or scanner context');
      return createFallbackResult(itemName, 'No barcode detected');
    }

    console.log(`🔍 UPCitemdb lookup: "${barcode}"`);

    // Make API request
    const response = await fetch(`${UPCITEMDB_API_BASE}/lookup?upc=${barcode}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Tagnetiq-HYDRA/1.0',
      },
    });

    // Increment request counter
    dailyRequestCount++;

    // =========================================================================
    // v8.2: CASCADE TO BARCODE SPIDER on failure
    // UPCitemdb free tier rejects some international barcodes (400 error)
    // and doesn't have all products (404/empty results)
    // =========================================================================
    if (!response.ok) {
      if (response.status === 429) {
        console.error('❌ UPCitemdb: Rate limited by server');
      } else {
        console.error(`❌ UPCitemdb API error: ${response.status}`);
      }

      // Cascade to Barcode Spider
      if (isBarcodeSpiderAvailable()) {
        console.log(`🕷️ UPCitemdb ${response.status} → cascading to Barcode Spider...`);
        return fetchBarcodeSpiderData(barcode, itemName);
      }

      return createFallbackResult(itemName, `API error: ${response.status}`);
    }

    const data = await response.json();

    // Check for valid results — cascade on empty
    if (!data.items || data.items.length === 0) {
      console.log('⚠️ UPCitemdb: No products found for barcode');

      // Cascade to Barcode Spider
      if (isBarcodeSpiderAvailable()) {
        console.log('🕷️ UPCitemdb empty → cascading to Barcode Spider...');
        return fetchBarcodeSpiderData(barcode, itemName);
      }

      return createFallbackResult(itemName, 'Product not found');
    }

    const item = data.items[0];
    console.log(`✅ UPCitemdb: Found "${item.title}"`);

    // Parse offers for price data
    const prices = (item.offers || [])
      .map((o: any) => o.price)
      .filter((p: number) => p > 0);
    
    const lowestPrice = prices.length > 0 ? Math.min(...prices) : item.lowest_recorded_price || 0;
    const highestPrice = prices.length > 0 ? Math.max(...prices) : item.highest_recorded_price || 0;
    const avgPrice = prices.length > 0 ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0;

    // Build authority data with rich itemDetails
    const authorityData: AuthorityData = {
      source: 'upcitemdb',
      verified: true,
      confidence: calculateConfidence(item),
      title: item.title,
      catalogNumber: barcode,
      marketValue: {
        low: lowestPrice,
        mid: avgPrice || lowestPrice,
        high: highestPrice,
      },
      itemDetails: {
        upc: item.upc || barcode,
        ean: item.ean,
        title: item.title,
        description: item.description,
        brand: item.brand,
        model: item.model,
        color: item.color,
        size: item.size,
        dimension: item.dimension,
        weight: item.weight,
        category: item.category,
        msrp: item.msrp || item.highest_recorded_price,
        lowestRecordedPrice: item.lowest_recorded_price,
        highestRecordedPrice: item.highest_recorded_price,
        images: item.images || [],
        asin: item.asin,
        elid: item.elid,
        offers: (item.offers || []).slice(0, 5).map((o: any) => ({
          merchant: o.merchant,
          domain: o.domain,
          price: o.price,
          listPrice: o.list_price,
          condition: o.condition,
          availability: o.availability,
          link: o.link,
          updatedAt: o.updated_t,
        })),
      },
      externalUrl: `https://www.upcitemdb.com/upc/${barcode}`,
      lastUpdated: new Date().toISOString(),
    };

    // Build price analysis
    const priceAnalysis = {
      lowest: lowestPrice,
      highest: highestPrice,
      average: avgPrice || lowestPrice,
      median: avgPrice || lowestPrice,
      sampleSize: prices.length || 1,
    };

    console.log(`✅ UPCitemdb: Authority data retrieved in ${Date.now() - startTime}ms`);
    console.log(`   Brand: ${item.brand || 'Unknown'}`);
    console.log(`   Category: ${item.category || 'Unknown'}`);
    console.log(`   Price range: $${lowestPrice.toFixed(2)} - $${highestPrice.toFixed(2)}`);
    console.log(`   MSRP: $${(item.msrp || 0).toFixed(2)}`);

    return {
      source: 'upcitemdb',
      available: true,
      query: barcode,
      totalListings: prices.length || 1,
      priceAnalysis,
      suggestedPrices: {
        goodDeal: parseFloat((lowestPrice * 0.5).toFixed(2)),
        fairMarket: parseFloat(avgPrice.toFixed(2)),
        sellPrice: parseFloat((avgPrice * 1.2).toFixed(2)),
      },
      sampleListings: (item.offers || []).slice(0, 5).map((o: any) => ({
        title: `${item.title} - ${o.merchant}`,
        price: o.price,
        condition: o.condition || 'New',
        url: o.link,
      })),
      authorityData,
      metadata: {
        responseTime: Date.now() - startTime,
        barcode,
        brand: item.brand,
        category: item.category,
        offersCount: (item.offers || []).length,
        rateLimitRemaining: DAILY_LIMIT - dailyRequestCount,
        barcodeSource: additionalContext?.includes('UPC:') ? 'scanner' : 'ai_vision',
      },
    };

  } catch (error) {
    console.error('❌ UPCitemdb fetch error:', error);

    // v8.2: Last-resort cascade on unexpected errors
    const barcode = extractBarcodeFromContext(itemName, additionalContext);
    if (barcode && isBarcodeSpiderAvailable()) {
      console.log('🕷️ UPCitemdb exception → cascading to Barcode Spider...');
      try {
        return await fetchBarcodeSpiderData(barcode, itemName);
      } catch (spiderError) {
        console.error('❌ Barcode Spider cascade also failed:', spiderError);
      }
    }

    return {
      source: 'upcitemdb',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// BARCODE EXTRACTION HELPER (v8.1 + v8.2 refactored)
// =============================================================================

/**
 * Extract barcode from additionalContext (scanner) or item name (AI vision)
 * Scanner barcodes are always preferred — they're the full, accurate digits.
 */
function extractBarcodeFromContext(itemName: string, additionalContext?: string): string | null {
  // Priority 1: Raw barcode from device scanner via additionalContext
  if (additionalContext) {
    const upcMatch = additionalContext.match(/UPC:\s*(\d{8,14})/i);
    if (upcMatch) {
      console.log(`📊 Barcode from scanner: ${upcMatch[1]}`);
      return upcMatch[1];
    }
  }

  // Priority 2: Extract from AI-identified item name (may be truncated)
  const barcode = extractBarcode(itemName);
  if (barcode) {
    console.log(`🔍 Barcode from item name: ${barcode}`);
  }
  return barcode;
}

/**
 * Search by product name (less accurate than barcode)
 */
export async function searchByName(productName: string): Promise<MarketDataSource> {
  const startTime = Date.now();

  try {
    if (!checkRateLimit()) {
      return createFallbackResult(productName, 'Rate limit exceeded');
    }

    console.log(`🔍 UPCitemdb name search: "${productName}"`);

    const response = await fetch(`${UPCITEMDB_API_BASE}/search?s=${encodeURIComponent(productName)}&match=contain&type=product`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Tagnetiq-HYDRA/1.0',
      },
    });

    dailyRequestCount++;

    if (!response.ok) {
      return createFallbackResult(productName, `API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return createFallbackResult(productName, 'No products found');
    }

    // Return first match (best match) - use UPC lookup for full data
    const item = data.items[0];
    
    if (item.upc) {
      return fetchUpcItemDbData(item.upc);
    }

    return createFallbackResult(productName, 'No UPC found for product');

  } catch (error) {
    console.error('❌ UPCitemdb search error:', error);
    return {
      source: 'upcitemdb',
      available: false,
      query: productName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Calculate confidence based on data completeness
 */
function calculateConfidence(item: any): number {
  let score = 0;
  let maxScore = 0;

  // Critical fields
  const criticalFields = ['title', 'brand', 'upc'];
  for (const field of criticalFields) {
    maxScore += 20;
    if (item[field]) score += 20;
  }

  // Important fields
  const importantFields = ['category', 'description', 'model'];
  for (const field of importantFields) {
    maxScore += 10;
    if (item[field]) score += 10;
  }

  // Price data
  maxScore += 20;
  if (item.offers && item.offers.length > 0) score += 20;
  else if (item.lowest_recorded_price || item.highest_recorded_price) score += 10;

  // Images
  maxScore += 10;
  if (item.images && item.images.length > 0) score += 10;

  return Math.min(0.99, score / maxScore);
}

/**
 * Create fallback result
 */
function createFallbackResult(query: string, reason: string): MarketDataSource {
  return {
    source: 'upcitemdb',
    available: false,
    query,
    totalListings: 0,
    error: reason,
    metadata: {
      fallback: true,
      reason,
      rateLimitRemaining: Math.max(0, DAILY_LIMIT - dailyRequestCount),
      searchUrl: 'https://www.upcitemdb.com/',
    },
  };
}

/**
 * Health check for UPCitemdb API
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  rateLimitRemaining: number;
  message: string;
}> {
  const startTime = Date.now();
  
  try {
    // Check rate limit first
    const rateStatus = getRateLimitStatus();
    if (rateStatus.remaining === 0) {
      return {
        status: 'degraded',
        latency: 0,
        rateLimitRemaining: 0,
        message: 'Rate limit exhausted for today',
      };
    }

    // Test with a known UPC (Coca-Cola Classic 12oz can)
    const testUPC = '049000028911';
    const response = await fetch(`${UPCITEMDB_API_BASE}/lookup?upc=${testUPC}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Tagnetiq-HYDRA-HealthCheck/1.0',
      },
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        return {
          status: 'healthy',
          latency,
          rateLimitRemaining: rateStatus.remaining,
          message: `API responding normally. Found test product: ${data.items[0].title}`,
        };
      }
    }

    return {
      status: 'degraded',
      latency,
      rateLimitRemaining: rateStatus.remaining,
      message: `API responded with status ${response.status}`,
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      rateLimitRemaining: getRateLimitStatus().remaining,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Detect if item might have a barcode (for category detection)
 */
export function mightHaveBarcode(itemName: string): boolean {
  const nameLower = itemName.toLowerCase();
  
  // Explicit barcode
  if (extractBarcode(itemName)) return true;
  
  // Retail product indicators
  const retailIndicators = [
    'new in box', 'nib', 'sealed', 'unopened', 'retail',
    'walmart', 'target', 'amazon', 'best buy', 'costco',
    'brand new', 'factory sealed', 'original packaging',
  ];
  
  for (const indicator of retailIndicators) {
    if (nameLower.includes(indicator)) return true;
  }
  
  // Product categories typically sold with barcodes
  const barcodeCategories = [
    'blender', 'coffee maker', 'keurig', 'instant pot', 'air fryer',
    'vacuum', 'dyson', 'roomba', 'speaker', 'headphones', 'airpods',
    'fitbit', 'garmin', 'kindle', 'roku', 'firestick', 'chromecast',
    'power tool', 'drill', 'dewalt', 'makita', 'milwaukee',
    'baby monitor', 'car seat', 'stroller', 'pack n play',
    'litter box', 'pet feeder', 'aquarium',
  ];
  
  for (const cat of barcodeCategories) {
    if (nameLower.includes(cat)) return true;
  }
  
  return false;
}