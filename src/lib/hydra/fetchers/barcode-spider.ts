// FILE: src/lib/hydra/fetchers/barcode-spider.ts
// HYDRA v8.2 - Barcode Spider Fetcher
// International UPC/EAN/ISBN barcode lookup with store pricing
// API: https://api.barcodespider.com/v1/lookup
// Auth: token header (BARCODE_SPIDER_TOKEN env var)
// Coverage: Global — handles international EANs that UPCitemdb rejects (e.g. 697-prefix China)
// Rate: Varies by plan (free trial available)
//
// This fetcher is called as a CASCADE FALLBACK from upcitemdb.ts when:
//   - UPCitemdb returns 400 (unsupported barcode format/region)
//   - UPCitemdb returns 404 (product not in their database)
// It can also be called directly from the fetcher registry.

import type { MarketDataSource, AuthorityData } from '../types.js';

const BARCODE_SPIDER_API = 'https://api.barcodespider.com/v1/lookup';

// =============================================================================
// TYPES
// =============================================================================

interface BarcodeSpiderResponse {
  item_response: {
    code: number;
    status: string;
    message: string;
  };
  item_attributes: {
    title: string;
    upc: string;
    ean: string;
    parent_category: string;
    category: string;
    brand: string;
    model: string;
    mpn: string;
    manufacturer: string;
    publisher: string;
    asin: string;
    color: string;
    size: string;
    weight: string;
    image: string;
    description: string;
  };
  Stores: Array<{
    store_name: string;
    store_price: string;
    product_url: string;
    currency_code: string;
    currency_symbol: string;
  }>;
}

// =============================================================================
// AVAILABILITY CHECK
// =============================================================================

export function isBarcodeSpiderAvailable(): boolean {
  return !!process.env.BARCODE_SPIDER_TOKEN;
}

// =============================================================================
// MAIN FETCHER
// =============================================================================

/**
 * Look up a barcode via Barcode Spider API
 * Supports UPC-A (12), EAN-13 (13), EAN-8 (8), ISBN-10/13
 * Has broader international coverage than UPCitemdb free tier
 *
 * @param barcode - The raw barcode digits (8-14 digits)
 * @param itemNameHint - Optional AI-identified item name for logging
 */
export async function fetchBarcodeSpiderData(
  barcode: string,
  itemNameHint?: string
): Promise<MarketDataSource> {
  const startTime = Date.now();
  const token = process.env.BARCODE_SPIDER_TOKEN;

  if (!token) {
    console.log('⚠️ BarcodeSpider: No API token configured (BARCODE_SPIDER_TOKEN)');
    return createFallbackResult(barcode, 'API token not configured');
  }

  // Validate barcode format
  if (!/^\d{8,14}$/.test(barcode)) {
    console.log(`⚠️ BarcodeSpider: Invalid barcode format: "${barcode}"`);
    return createFallbackResult(barcode, 'Invalid barcode format');
  }

  try {
    console.log(`🕷️ BarcodeSpider lookup: "${barcode}"${itemNameHint ? ` (hint: ${itemNameHint})` : ''}`);

    const response = await fetch(`${BARCODE_SPIDER_API}?upc=${barcode}`, {
      method: 'GET',
      headers: {
        'token': token,
        'Accept': 'application/json',
        'User-Agent': 'Tagnetiq-HYDRA/1.0',
      },
    });

    if (!response.ok) {
      const statusText = await response.text().catch(() => '');
      console.error(`❌ BarcodeSpider API error: ${response.status} ${statusText}`);
      return createFallbackResult(barcode, `API error: ${response.status}`);
    }

    const data: BarcodeSpiderResponse = await response.json();

    // Check response code
    if (data.item_response?.code !== 200) {
      console.log(`⚠️ BarcodeSpider: ${data.item_response?.message || 'Unknown error'}`);
      return createFallbackResult(barcode, data.item_response?.message || 'Lookup failed');
    }

    const attrs = data.item_attributes;
    if (!attrs || !attrs.title) {
      console.log('⚠️ BarcodeSpider: No product data returned');
      return createFallbackResult(barcode, 'Product not found');
    }

    console.log(`✅ BarcodeSpider: Found "${attrs.title}"`);

    // Parse store prices
    const stores = data.Stores || [];
    const prices = stores
      .map(s => parseFloat(s.store_price))
      .filter(p => !isNaN(p) && p > 0);

    const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const highestPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const avgPrice = prices.length > 0
      ? prices.reduce((a, b) => a + b, 0) / prices.length
      : 0;

    // Build authority data
    const authorityData: AuthorityData = {
      source: 'barcode_spider',
      verified: true,
      confidence: calculateConfidence(attrs, stores),
      title: attrs.title,
      catalogNumber: barcode,
      marketValue: {
        low: lowestPrice,
        mid: avgPrice || lowestPrice,
        high: highestPrice,
      },
      itemDetails: {
        upc: attrs.upc,
        ean: attrs.ean,
        title: attrs.title,
        description: attrs.description,
        brand: attrs.brand,
        model: attrs.model,
        mpn: attrs.mpn,
        manufacturer: attrs.manufacturer,
        publisher: attrs.publisher,
        color: attrs.color,
        size: attrs.size,
        weight: attrs.weight,
        category: attrs.category,
        parentCategory: attrs.parent_category,
        asin: attrs.asin,
        image: attrs.image,
        storeCount: stores.length,
        stores: stores.slice(0, 5).map(s => ({
          name: s.store_name,
          price: parseFloat(s.store_price) || 0,
          url: s.product_url,
          currency: s.currency_code || 'USD',
        })),
      },
      externalUrl: `https://www.barcodespider.com/${barcode}`,
      lastUpdated: new Date().toISOString(),
    };

    // Build price analysis
    const priceAnalysis = {
      lowest: lowestPrice,
      highest: highestPrice,
      average: avgPrice || lowestPrice,
      median: avgPrice || lowestPrice, // Could compute true median if needed
      sampleSize: prices.length || 1,
    };

    const responseTime = Date.now() - startTime;
    console.log(`✅ BarcodeSpider: Complete in ${responseTime}ms`);
    console.log(`   Brand: ${attrs.brand || 'Unknown'} | Category: ${attrs.category || 'Unknown'}`);
    console.log(`   Stores: ${stores.length} | Price range: $${lowestPrice.toFixed(2)} - $${highestPrice.toFixed(2)}`);

    return {
      source: 'barcode_spider',
      available: true,
      query: barcode,
      totalListings: stores.length || 1,
      priceAnalysis,
      suggestedPrices: {
        goodDeal: parseFloat((lowestPrice * 0.5).toFixed(2)),
        fairMarket: parseFloat((avgPrice || lowestPrice).toFixed(2)),
        sellPrice: parseFloat(((avgPrice || lowestPrice) * 1.2).toFixed(2)),
      },
      sampleListings: stores.slice(0, 5).map(s => ({
        title: `${attrs.title} - ${s.store_name}`,
        price: parseFloat(s.store_price) || 0,
        condition: 'New',
        url: s.product_url,
      })),
      authorityData,
      metadata: {
        responseTime,
        barcode,
        brand: attrs.brand,
        category: attrs.category,
        parentCategory: attrs.parent_category,
        storeCount: stores.length,
        asin: attrs.asin,
        barcodeSource: 'barcode_spider_api',
      },
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ BarcodeSpider fetch error (${responseTime}ms):`, error);
    return {
      source: 'barcode_spider',
      available: false,
      query: barcode,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// CONFIDENCE CALCULATION
// =============================================================================

function calculateConfidence(attrs: any, stores: any[]): number {
  let score = 0;
  let maxScore = 0;

  // Critical fields
  for (const field of ['title', 'brand', 'upc']) {
    maxScore += 20;
    if (attrs[field]) score += 20;
  }

  // Important fields
  for (const field of ['category', 'description', 'manufacturer']) {
    maxScore += 10;
    if (attrs[field]) score += 10;
  }

  // Store pricing data
  maxScore += 20;
  if (stores.length > 3) score += 20;
  else if (stores.length > 0) score += 10;

  // Image
  maxScore += 10;
  if (attrs.image) score += 10;

  return Math.min(0.99, score / maxScore);
}

// =============================================================================
// FALLBACK
// =============================================================================

function createFallbackResult(query: string, reason: string): MarketDataSource {
  return {
    source: 'barcode_spider',
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

  if (!isBarcodeSpiderAvailable()) {
    return {
      status: 'unhealthy',
      latency: 0,
      message: 'BARCODE_SPIDER_TOKEN not configured',
    };
  }

  try {
    // Test with a known UPC (Coca-Cola 12oz can)
    const response = await fetch(`${BARCODE_SPIDER_API}?upc=049000006346`, {
      method: 'GET',
      headers: {
        'token': process.env.BARCODE_SPIDER_TOKEN!,
        'Accept': 'application/json',
        'User-Agent': 'Tagnetiq-HYDRA-HealthCheck/1.0',
      },
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      if (data.item_attributes?.title) {
        return {
          status: 'healthy',
          latency,
          message: `Found: ${data.item_attributes.title}`,
        };
      }
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