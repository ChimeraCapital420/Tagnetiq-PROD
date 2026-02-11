// FILE: src/lib/hydra/fetchers/index.ts
// HYDRA v8.3 - Market Data Fetchers Index
// FIXED v6.3: Now passes additionalContext to fetchers (especially NHTSA for VIN)
// FIXED v7.0: Default timeout bumped from 10s → 30s (Pokemon TCG needs it)
// FIXED v7.1: Proper timeout cancellation - clearTimeout when fetch completes
// FIXED v7.2: Brickset timeout increased to 25s for login + search on cold start
// ADDED v8.0: Colnect fetcher for 40+ collectible categories (HMAC auth, server-side only)
// FIXED v8.1: UPCitemdb now context-aware — receives raw barcodes from scanner
// ADDED v8.2: Barcode Spider fetcher (international barcode fallback)
// ADDED v8.2: Kroger fetcher (real retail store prices for household/grocery)
// FIXED v8.3: Barcode-aware injection — when additionalContext contains a UPC/EAN,
//             upcitemdb is ALWAYS included regardless of detected category.
//             This ensures scanned barcodes always get a product lookup + report card.

import type { MarketDataSource, MarketDataResult, ItemCategory } from '../types.js';
import { getApisForCategory } from '../category-detection/index.js';

// Export individual fetchers
export { fetchEbayData } from './ebay.js';
export { fetchNumistaData } from './numista.js';
export { fetchPokemonTcgData } from './pokemon-tcg.js';
export { fetchBricksetData } from './brickset.js';
export { fetchGoogleBooksData } from './google-books.js';
export { fetchDiscogsData } from './discogs.js';
export { fetchRetailedData } from './retailed.js';
export { fetchPsaData, verifyPsaCerts } from './psa.js';
export { fetchNhtsaData, validateVIN, decodeVINBatch } from './nhtsa.js';
export { fetchUpcItemDbData, extractBarcode, validateUPC, searchByName as searchUpcByName, getRateLimitStatus as getUpcRateLimitStatus } from './upcitemdb.js';
export { fetchComicVineData } from './comicvine.js';
export { fetchColnectData, hasColnectSupport, getColnectCategories, getColnectCategorySlug } from './colnect.js';
export { fetchBarcodeSpiderData, isBarcodeSpiderAvailable } from './barcode-spider.js';
export { fetchKrogerData, isKrogerAvailable } from './kroger.js';

// Import for internal use
import { fetchEbayData } from './ebay.js';
import { fetchNumistaData } from './numista.js';
import { fetchPokemonTcgData } from './pokemon-tcg.js';
import { fetchBricksetData } from './brickset.js';
import { fetchGoogleBooksData } from './google-books.js';
import { fetchDiscogsData } from './discogs.js';
import { fetchRetailedData } from './retailed.js';
import { fetchPsaData } from './psa.js';
import { fetchNhtsaData } from './nhtsa.js';
import { fetchUpcItemDbData } from './upcitemdb.js';
import { fetchComicVineData } from './comicvine.js';
import { fetchColnectData } from './colnect.js';
import { fetchBarcodeSpiderData } from './barcode-spider.js';
import { fetchKrogerData } from './kroger.js';

// ==================== FETCHER REGISTRY ====================

// Standard fetcher function type (itemName, category)
type StandardFetcherFunction = (itemName: string, category?: string) => Promise<MarketDataSource>;

// Extended fetcher function type (itemName, additionalContext) - for NHTSA, PSA, UPCitemdb, Kroger
type ExtendedFetcherFunction = (itemName: string, additionalContext?: string) => Promise<MarketDataSource>;

// Registry uses standard type, but some fetchers accept additional params
const FETCHER_REGISTRY: Record<string, StandardFetcherFunction | ExtendedFetcherFunction> = {
  'ebay': fetchEbayData,
  'numista': fetchNumistaData,
  'pokemon_tcg': fetchPokemonTcgData,
  'brickset': fetchBricksetData,
  'google_books': fetchGoogleBooksData,
  'discogs': fetchDiscogsData,
  'retailed': fetchRetailedData,
  'psa': fetchPsaData,
  'nhtsa': fetchNhtsaData,
  'upcitemdb': fetchUpcItemDbData,
  'comicvine': fetchComicVineData,
  'colnect': fetchColnectData,
  'barcode_spider': fetchBarcodeSpiderData,
  'kroger': fetchKrogerData,
};

// Fetchers that accept additionalContext as their second parameter
// v8.1: upcitemdb — receives raw barcodes from device scanner
// v8.2: kroger — receives barcodes for UPC-based product lookup
const CONTEXT_AWARE_FETCHERS = ['nhtsa', 'psa', 'upcitemdb', 'kroger'];

// Per-fetcher timeout overrides (some APIs are slower than others)
const FETCHER_TIMEOUTS: Record<string, number> = {
  'pokemon_tcg': 45000,    // INCREASED v7.1: 45s - API can be very slow
  'ebay': 20000,           // INCREASED v7.1: 20s - OAuth + search
  'retailed': 15000,       // 15s
  'brickset': 25000,       // INCREASED v7.2: 25s - login (15s) + search (12s) on cold start
  'numista': 15000,        // 15s
  'google_books': 10000,   // 10s - usually fast
  'discogs': 10000,        // 10s - usually fast
  'psa': 15000,            // 15s
  'nhtsa': 10000,          // 10s - free API, usually fast
  'upcitemdb': 15000,      // v8.2: INCREASED 10s → 15s (now includes Barcode Spider cascade)
  'comicvine': 15000,      // INCREASED v7.2: 15s - two-stage fetch
  'colnect': 15000,        // v8.0: 15s - HMAC auth + search (no CORS, server-side only)
  'barcode_spider': 10000, // v8.2: 10s - simple REST lookup
  'kroger': 15000,         // v8.2: 15s - OAuth + product search
};

// ==================== BARCODE DETECTION (v8.3) ====================

/**
 * Check if additionalContext contains a barcode (UPC/EAN).
 * Returns true if a 8-14 digit barcode pattern is found.
 * Used to force-inject upcitemdb into the API list when a physical
 * barcode was scanned by the device camera.
 */
function contextHasBarcode(additionalContext?: string): boolean {
  if (!additionalContext) return false;
  // Match "UPC: 053538155504" or raw 8-14 digit sequences
  return /(?:UPC|EAN|GTIN|barcode)[:\s]*\d{8,14}/i.test(additionalContext)
      || /\b\d{8,14}\b/.test(additionalContext);
}

// ==================== UNIFIED FETCH FUNCTION ====================

/**
 * Fetch market data from multiple sources for an item
 *
 * @param itemName - The name/description of the item
 * @param category - The detected category
 * @param additionalContext - Additional context like VIN numbers or barcodes extracted from images/scanner
 * @param options - Fetch options
 */
export async function fetchMarketData(
  itemName: string,
  category: ItemCategory,
  additionalContext?: string,
  options?: {
    maxSources?: number;
    timeout?: number;
    includeEbay?: boolean;
  }
): Promise<MarketDataResult> {
  const startTime = Date.now();
  const maxSources = options?.maxSources || 3;
  const defaultTimeout = options?.timeout || 45000; // FIXED v7.1: 45s default (was 30s)
  const includeEbay = options?.includeEbay !== false;

  console.log(`\n📊 === FETCHING MARKET DATA ===`);
  console.log(`📝 Item: "${itemName}"`);
  console.log(`🏷️ Category: ${category}`);
  if (additionalContext) {
    console.log(`🔎 Additional Context: "${additionalContext}"`);
  }

  // Get APIs for this category
  let apis = getApisForCategory(category);
  console.log(`🔌 APIs for category: ${apis.join(', ')}`);

  // === v8.3: BARCODE-AWARE INJECTION ===
  // When the device scanner reads a barcode, ALWAYS include upcitemdb
  // regardless of detected category. This ensures:
  //   1. Products always get a UPCitemdb lookup + report card
  //   2. Works even when category detection misclassifies (e.g. honey → "general")
  //   3. The barcode digits are passed via additionalContext to the fetcher
  const hasBarcode = contextHasBarcode(additionalContext);
  if (hasBarcode && !apis.includes('upcitemdb')) {
    console.log(`📦 Barcode detected in context — injecting upcitemdb`);
    // Insert upcitemdb at the front (primary authority for barcoded items)
    apis = ['upcitemdb', ...apis];
  }

  // Ensure eBay is included if requested
  if (includeEbay && !apis.includes('ebay')) {
    apis = [...apis, 'ebay'];
  }

  // Limit to max sources (but always keep upcitemdb if barcode was detected)
  if (apis.length > maxSources) {
    if (hasBarcode) {
      // Keep upcitemdb + trim the rest to fit maxSources
      const withoutUpc = apis.filter(a => a !== 'upcitemdb');
      apis = ['upcitemdb', ...withoutUpc.slice(0, maxSources - 1)];
    } else {
      apis = apis.slice(0, maxSources);
    }
  }

  console.log(`🚀 Final API list: ${apis.join(', ')}`);

  // Run fetchers in parallel with per-fetcher timeouts
  const fetchPromises = apis.map(async (api) => {
    const fetcher = FETCHER_REGISTRY[api];
    if (!fetcher) {
      console.warn(`⚠️ No fetcher found for API: ${api}`);
      return null;
    }

    // Use per-fetcher timeout if available, otherwise default
    const timeout = FETCHER_TIMEOUTS[api] || defaultTimeout;

    try {
      // FIXED v7.1: Properly clear timeout when fetch completes
      let timeoutId: NodeJS.Timeout;
      let timedOut = false;

      const timeoutPromise = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          console.error(`⏱️ ${api} fetch timed out (${timeout / 1000}s)`);
          resolve(null);
        }, timeout);
      });

      // Build the actual fetch promise
      // v8.1/v8.2: Pass additionalContext to context-aware fetchers
      let fetchPromise: Promise<MarketDataSource>;
      if (CONTEXT_AWARE_FETCHERS.includes(api) && additionalContext) {
        fetchPromise = (fetcher as ExtendedFetcherFunction)(itemName, additionalContext);
      } else {
        fetchPromise = (fetcher as StandardFetcherFunction)(itemName, category);
      }

      // Wrap fetch to clear timeout on completion
      const wrappedFetch = fetchPromise.then((result) => {
        clearTimeout(timeoutId); // Clear timeout if fetch succeeds
        return result;
      }).catch((err) => {
        clearTimeout(timeoutId); // Clear timeout even on error
        throw err;
      });

      // Race: fetcher vs timeout
      const result = await Promise.race([wrappedFetch, timeoutPromise]);

      if (result === null || timedOut) {
        // Timeout won the race
        return {
          source: api,
          available: false,
          query: itemName,
          totalListings: 0,
          error: `Fetch timed out (${timeout / 1000}s)`,
        } as MarketDataSource;
      }

      return result;
    } catch (error: any) {
      console.error(`❌ ${api} fetch failed:`, error.message);
      return {
        source: api,
        available: false,
        query: itemName,
        totalListings: 0,
        error: error.message || 'Fetch failed',
      } as MarketDataSource;
    }
  });

  const results = await Promise.all(fetchPromises);
  const sources = results.filter((r): r is MarketDataSource => r !== null);

  // Identify primary authority source (non-eBay source with authority data)
  const authoritySources = sources.filter(s => s.authorityData && s.source !== 'ebay');
  const primaryAuthority = authoritySources[0]?.authorityData;

  // Calculate blended price
  const { blendedPrice, blendMethod } = calculateBlendedPrice(sources);

  // Determine primary source
  const primarySource = authoritySources.length > 0
    ? authoritySources[0].source
    : sources.find(s => s.available)?.source || 'none';

  // Determine market influence
  const marketInfluence = determineMarketInfluence(sources, category);

  const fetchTime = Date.now() - startTime;

  console.log(`\n📊 === MARKET DATA COMPLETE ===`);
  console.log(`⏱️ Total fetch time: ${fetchTime}ms`);
  console.log(`📦 Sources: ${sources.length} (${sources.filter(s => s.available).length} available)`);
  console.log(`💰 Blended price: $${blendedPrice} (${blendMethod})`);
  console.log(`🏛️ Primary authority: ${primaryAuthority?.source || 'none'}`);

  return {
    sources,
    primaryAuthority,
    blendedPrice: blendedPrice > 0 ? {
      value: blendedPrice,
      confidence: calculatePriceConfidence(sources),
      method: blendMethod,
    } : undefined,
    primarySource,
    marketInfluence,
    fetchTime,
  };
}

// ==================== PRICE BLENDING ====================

function calculateBlendedPrice(sources: MarketDataSource[]): { blendedPrice: number; blendMethod: string } {
  const availableSources = sources.filter(s => s.available && s.priceAnalysis);

  if (availableSources.length === 0) {
    return { blendedPrice: 0, blendMethod: 'no_data' };
  }

  const priceData: { price: number; weight: number; source: string }[] = [];

  for (const source of availableSources) {
    const analysis = source.priceAnalysis!;
    let weight = 1;

    // Weight by source reliability
    if (source.authorityData) {
      weight = 1.5; // Authority sources get higher weight
    }
    if (source.source === 'ebay') {
      weight = 1.2; // eBay (real market data) gets medium-high weight
    }
    // Colnect market prices are real transaction data - high weight
    if (source.source === 'colnect' && source.authorityData) {
      weight = 1.4; // Slightly less than dedicated authorities but high
    }
    // v8.2: Kroger = real current shelf price — very reliable for retail items
    if (source.source === 'kroger' && source.authorityData) {
      weight = 1.6; // Current retail price is strongest signal for household items
    }
    // v8.2: Barcode Spider store prices — reliable aggregate
    if (source.source === 'barcode_spider' && source.authorityData) {
      weight = 1.3;
    }

    // Use median as primary price (most reliable)
    if (analysis.median > 0) {
      priceData.push({ price: analysis.median, weight, source: source.source });
    } else if (analysis.average > 0) {
      priceData.push({ price: analysis.average, weight: weight * 0.9, source: source.source });
    }
  }

  if (priceData.length === 0) {
    return { blendedPrice: 0, blendMethod: 'no_prices' };
  }

  if (priceData.length === 1) {
    return {
      blendedPrice: parseFloat(priceData[0].price.toFixed(2)),
      blendMethod: `single_source_${priceData[0].source}`
    };
  }

  // Calculate weighted average
  const totalWeight = priceData.reduce((sum, p) => sum + p.weight, 0);
  const weightedSum = priceData.reduce((sum, p) => sum + (p.price * p.weight), 0);
  const blendedPrice = weightedSum / totalWeight;

  return {
    blendedPrice: parseFloat(blendedPrice.toFixed(2)),
    blendMethod: `weighted_blend_${priceData.length}_sources`,
  };
}

function calculatePriceConfidence(sources: MarketDataSource[]): number {
  const available = sources.filter(s => s.available && s.priceAnalysis);

  if (available.length === 0) return 0;
  if (available.length === 1) return 0.6;

  // More sources = more confidence
  let confidence = 0.5 + (available.length * 0.1);

  // Authority source boosts confidence
  if (available.some(s => s.authorityData)) {
    confidence += 0.15;
  }

  // eBay data boosts confidence
  if (available.some(s => s.source === 'ebay' && (s.totalListings || 0) > 5)) {
    confidence += 0.1;
  }

  // Colnect cross-reference boosts confidence
  if (available.some(s => s.source === 'colnect' && s.authorityData)) {
    confidence += 0.05;
  }

  // v8.2: Kroger = real retail price boosts confidence significantly
  if (available.some(s => s.source === 'kroger' && s.authorityData)) {
    confidence += 0.1;
  }

  return Math.min(confidence, 0.98);
}

function determineMarketInfluence(sources: MarketDataSource[], category: ItemCategory): string {
  const availableSources = sources.filter(s => s.available);

  if (availableSources.length === 0) {
    return 'insufficient_data';
  }

  const hasAuthority = availableSources.some(s => s.authorityData);
  const hasEbay = availableSources.some(s => s.source === 'ebay' && (s.totalListings || 0) > 5);
  const hasColnect = availableSources.some(s => s.source === 'colnect' && s.authorityData);
  const hasKroger = availableSources.some(s => s.source === 'kroger' && s.authorityData);

  if (hasAuthority && hasEbay && (hasColnect || hasKroger)) {
    return 'high_confidence_multi_source_catalog_verified';
  }

  if (hasAuthority && hasEbay) {
    return 'high_confidence_multi_source';
  }

  if (hasKroger) {
    return 'retail_price_verified';
  }

  if (hasAuthority) {
    return 'authority_verified';
  }

  if (hasColnect) {
    return 'catalog_verified';
  }

  if (hasEbay) {
    return 'market_data_only';
  }

  return 'limited_data';
}

// ==================== BATCH FETCH ====================

export async function fetchMarketDataBatch(
  items: Array<{ name: string; category: ItemCategory; additionalContext?: string }>,
  options?: {
    maxConcurrent?: number;
    delayBetween?: number;
  }
): Promise<Map<string, MarketDataResult>> {
  const maxConcurrent = options?.maxConcurrent || 3;
  const delayBetween = options?.delayBetween || 500;

  const results = new Map<string, MarketDataResult>();

  for (let i = 0; i < items.length; i += maxConcurrent) {
    const batch = items.slice(i, i + maxConcurrent);

    const batchResults = await Promise.all(
      batch.map(item => fetchMarketData(item.name, item.category, item.additionalContext))
    );

    batch.forEach((item, index) => {
      results.set(item.name, batchResults[index]);
    });

    if (i + maxConcurrent < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetween));
    }
  }

  return results;
}

// ==================== UTILITY EXPORTS ====================

export function getAvailableFetchers(): string[] {
  return Object.keys(FETCHER_REGISTRY);
}

export function isFetcherAvailable(source: string): boolean {
  return source in FETCHER_REGISTRY;
}

export function getFetcherTimeout(source: string): number {
  return FETCHER_TIMEOUTS[source] || 30000;
}