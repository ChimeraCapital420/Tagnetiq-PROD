// FILE: src/lib/hydra/fetchers/index.ts
// HYDRA v8.5 - Market Data Fetchers Index
// FIXED v6.3: Now passes additionalContext to fetchers
// FIXED v7.0: Default timeout bumped from 10s → 30s
// FIXED v7.1: Proper timeout cancellation
// FIXED v7.2: Brickset timeout increased to 25s
// ADDED v8.0: Colnect fetcher
// FIXED v8.1: UPCitemdb context-aware
// ADDED v8.2: Barcode Spider + Kroger fetchers
// FIXED v8.3: Barcode-aware injection
// ADDED v8.4: TCGdex fetcher
// ADDED v8.5: fetchEbayDataByImage export + imageBase64 param in fetchMarketData
//   eBay visual search: POST search_by_image → visual matches → price analysis
//   Integration path:
//     IMMEDIATE:   Call fetchEbayDataByImage() directly from oracle/see.ts
//     POST-UNFREEZE: Add imageBase64 param to runFetchStage in pipeline/stages/fetch-evidence.ts
//                    so HYDRA runs image search on every scan that has a photo

import type { MarketDataSource, MarketDataResult, ItemCategory } from '../types.js';
import { getApisForCategory } from '../category-detection/index.js';

// Export individual fetchers
export { fetchEbayData, fetchEbayDataByImage } from './ebay.js';   // v8.5: added fetchEbayDataByImage
export { fetchNumistaData } from './numista.js';
export { fetchPokemonTcgData } from './pokemon-tcg.js';
export { fetchTcgdexData } from './tcgdex.js';
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
import { fetchEbayData, fetchEbayDataByImage } from './ebay.js';
import { fetchNumistaData } from './numista.js';
import { fetchPokemonTcgData } from './pokemon-tcg.js';
import { fetchTcgdexData } from './tcgdex.js';
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

type StandardFetcherFunction = (itemName: string, category?: string) => Promise<MarketDataSource>;
type ExtendedFetcherFunction = (itemName: string, additionalContext?: string) => Promise<MarketDataSource>;

const FETCHER_REGISTRY: Record<string, StandardFetcherFunction | ExtendedFetcherFunction> = {
  'ebay':          fetchEbayData,
  'numista':       fetchNumistaData,
  'pokemon_tcg':   fetchPokemonTcgData,
  'tcgdex':        fetchTcgdexData,
  'brickset':      fetchBricksetData,
  'google_books':  fetchGoogleBooksData,
  'discogs':       fetchDiscogsData,
  'retailed':      fetchRetailedData,
  'psa':           fetchPsaData,
  'nhtsa':         fetchNhtsaData,
  'upcitemdb':     fetchUpcItemDbData,
  'comicvine':     fetchComicVineData,
  'colnect':       fetchColnectData,
  'barcode_spider': fetchBarcodeSpiderData,
  'kroger':        fetchKrogerData,
};

const CONTEXT_AWARE_FETCHERS = ['nhtsa', 'psa', 'upcitemdb', 'kroger'];

const FETCHER_TIMEOUTS: Record<string, number> = {
  'pokemon_tcg':   45000,
  'tcgdex':        15000,
  'ebay':          20000,
  'ebay_image':    25000,   // v8.5: image upload + search takes slightly longer
  'retailed':      15000,
  'brickset':      25000,
  'numista':       15000,
  'google_books':  10000,
  'discogs':       10000,
  'psa':           15000,
  'nhtsa':         10000,
  'upcitemdb':     15000,
  'comicvine':     15000,
  'colnect':       15000,
  'barcode_spider': 10000,
  'kroger':        15000,
};

// ==================== BARCODE DETECTION ====================

function contextHasBarcode(additionalContext?: string): boolean {
  if (!additionalContext) return false;
  return /(?:UPC|EAN|GTIN|barcode)[:\s]*\d{8,14}/i.test(additionalContext)
      || /\b\d{8,14}\b/.test(additionalContext);
}

// ==================== UNIFIED FETCH FUNCTION ====================

/**
 * Fetch market data from multiple sources.
 *
 * v8.5: Added optional imageBase64 parameter.
 * When provided, eBay image search runs ALONGSIDE (not instead of)
 * the keyword search. The image search result gets merged — if it
 * returns more listings or a tighter price range, it wins.
 *
 * Note: fetch-evidence.ts (frozen) calls this without imageBase64.
 * When that file is unfrozen, pass pipelineImages[0] here to get
 * visual eBay search on every scan.
 */
export async function fetchMarketData(
  itemName: string,
  category: ItemCategory,
  additionalContext?: string,
  options?: {
    maxSources?: number;
    timeout?: number;
    includeEbay?: boolean;
    imageBase64?: string;        // v8.5: optional scan image for eBay visual search
  }
): Promise<MarketDataResult> {
  const startTime    = Date.now();
  const maxSources   = options?.maxSources  || 3;
  const defaultTimeout = options?.timeout   || 45000;
  const includeEbay  = options?.includeEbay !== false;
  const imageBase64  = options?.imageBase64 || null;

  console.log(`\n📊 === FETCHING MARKET DATA ===`);
  console.log(`📝 Item: "${itemName}"`);
  console.log(`🏷️ Category: ${category}`);
  if (additionalContext) console.log(`🔎 Additional Context: "${additionalContext}"`);
  if (imageBase64)       console.log(`📸 Image search: enabled (${(imageBase64.length * 0.75 / 1024).toFixed(0)}KB)`);

  let apis = getApisForCategory(category);
  console.log(`🔌 APIs for category: ${apis.join(', ')}`);

  const hasBarcode = contextHasBarcode(additionalContext);
  if (hasBarcode && !apis.includes('upcitemdb')) {
    console.log(`📦 Barcode detected — injecting upcitemdb`);
    apis = ['upcitemdb', ...apis];
  }

  if (includeEbay && !apis.includes('ebay')) {
    apis = [...apis, 'ebay'];
  }

  if (apis.length > maxSources) {
    if (hasBarcode) {
      const withoutUpc = apis.filter(a => a !== 'upcitemdb');
      apis = ['upcitemdb', ...withoutUpc.slice(0, maxSources - 1)];
    } else {
      apis = apis.slice(0, maxSources);
    }
  }

  console.log(`🚀 Final API list: ${apis.join(', ')}`);

  // ── Run keyword fetchers in parallel ────────────────────────────────────
  const fetchPromises = apis.map(async (api) => {
    const fetcher = FETCHER_REGISTRY[api];
    if (!fetcher) {
      console.warn(`⚠️ No fetcher found for API: ${api}`);
      return null;
    }

    const timeout = FETCHER_TIMEOUTS[api] || defaultTimeout;

    try {
      let timeoutId: NodeJS.Timeout;
      let timedOut = false;

      const timeoutPromise = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          console.error(`⏱️ ${api} fetch timed out (${timeout / 1000}s)`);
          resolve(null);
        }, timeout);
      });

      let fetchPromise: Promise<MarketDataSource>;
      if (CONTEXT_AWARE_FETCHERS.includes(api) && additionalContext) {
        fetchPromise = (fetcher as ExtendedFetcherFunction)(itemName, additionalContext);
      } else {
        fetchPromise = (fetcher as StandardFetcherFunction)(itemName, category);
      }

      const wrappedFetch = fetchPromise
        .then((result) => { clearTimeout(timeoutId); return result; })
        .catch((err)   => { clearTimeout(timeoutId); throw err; });

      const result = await Promise.race([wrappedFetch, timeoutPromise]);

      if (result === null || timedOut) {
        return {
          source: api, available: false, query: itemName, totalListings: 0,
          error: `Fetch timed out (${timeout / 1000}s)`,
        } as MarketDataSource;
      }

      return result;
    } catch (error: any) {
      console.error(`❌ ${api} fetch failed:`, error.message);
      return {
        source: api, available: false, query: itemName, totalListings: 0,
        error: error.message || 'Fetch failed',
      } as MarketDataSource;
    }
  });

  // ── v8.5: eBay image search runs in parallel with keyword fetchers ────────
  // Fires only when imageBase64 is provided. Falls back to keyword internally
  // if the image search fails. Non-blocking — won't delay other fetchers.
  let imageSearchPromise: Promise<MarketDataSource | null> = Promise.resolve(null);

  if (imageBase64 && includeEbay) {
    const imgTimeout = FETCHER_TIMEOUTS['ebay_image'];
    imageSearchPromise = Promise.race([
      fetchEbayDataByImage(imageBase64, itemName, category),
      new Promise<null>((resolve) =>
        setTimeout(() => {
          console.error(`⏱️ eBay image search timed out (${imgTimeout / 1000}s)`);
          resolve(null);
        }, imgTimeout)
      ),
    ]).catch(err => {
      console.error('❌ eBay image search failed (non-fatal):', err.message);
      return null;
    });
  }

  // ── Await all in parallel ─────────────────────────────────────────────────
  const [keywordResults, imageResult] = await Promise.all([
    Promise.all(fetchPromises),
    imageSearchPromise,
  ]);

  let sources = keywordResults.filter((r): r is MarketDataSource => r !== null);

  // ── Merge image search result ─────────────────────────────────────────────
  // If image search returned data, merge with or replace eBay keyword result.
  // Image search wins if it found MORE listings or a tighter price range —
  // visual matches are more accurate than keyword matches.
  if (imageResult && imageResult.available) {
    const ebayKeywordIdx = sources.findIndex(s => s.source === 'ebay');

    if (ebayKeywordIdx >= 0) {
      const keyword = sources[ebayKeywordIdx];
      const keywordListings = keyword.totalListings || 0;
      const imageListings   = imageResult.totalListings || 0;

      if (imageListings >= keywordListings || !keyword.available) {
        // Image result is equal or better — replace keyword result
        console.log(`📸 eBay image search (${imageListings} matches) ≥ keyword (${keywordListings}) — using image result`);
        sources[ebayKeywordIdx] = { ...imageResult, source: 'ebay' };
      } else {
        // Keyword has more results — blend the price ranges
        console.log(`🔀 eBay blending: image (${imageListings}) + keyword (${keywordListings})`);
        sources[ebayKeywordIdx] = blendEbayResults(keyword, imageResult);
      }
    } else {
      // No keyword eBay result — just add image result
      sources.push({ ...imageResult, source: 'ebay' });
    }
  }

  const authoritySources   = sources.filter(s => s.authorityData && s.source !== 'ebay');
  const primaryAuthority   = authoritySources[0]?.authorityData;
  const { blendedPrice, blendMethod } = calculateBlendedPrice(sources);
  const primarySource      = authoritySources.length > 0
    ? authoritySources[0].source
    : sources.find(s => s.available)?.source || 'none';
  const marketInfluence    = determineMarketInfluence(sources, category);
  const fetchTime          = Date.now() - startTime;

  console.log(`\n📊 === MARKET DATA COMPLETE ===`);
  console.log(`⏱️ Total fetch time: ${fetchTime}ms`);
  console.log(`📦 Sources: ${sources.length} (${sources.filter(s => s.available).length} available)`);
  console.log(`💰 Blended price: $${blendedPrice} (${blendMethod})`);
  console.log(`🏛️ Primary authority: ${primaryAuthority?.source || 'none'}`);

  return {
    sources,
    primaryAuthority,
    blendedPrice: blendedPrice > 0 ? {
      value:      blendedPrice,
      confidence: calculatePriceConfidence(sources),
      method:     blendMethod,
    } : undefined,
    primarySource,
    marketInfluence,
    fetchTime,
  };
}

// ==================== EBAY RESULT BLENDING (v8.5) ====================

/**
 * Blend keyword and image search eBay results.
 * Uses the tighter price range and higher listing count.
 * Image search prices are given slightly higher weight (visual match = more accurate).
 */
function blendEbayResults(
  keyword: MarketDataSource,
  image: MarketDataSource
): MarketDataSource {
  const kw = keyword.priceAnalysis;
  const im = image.priceAnalysis;

  if (!kw && !im) return keyword;
  if (!kw) return { ...image, source: 'ebay' };
  if (!im) return keyword;

  // Weight image result slightly higher (visual match)
  const kwWeight = 0.45;
  const imWeight = 0.55;

  const blendedMedian  = (kw.median  * kwWeight) + (im.median  * imWeight);
  const blendedAverage = (kw.average * kwWeight) + (im.average * imWeight);

  return {
    ...keyword,
    source:        'ebay',
    totalListings: (keyword.totalListings || 0) + (image.totalListings || 0),
    priceAnalysis: {
      lowest:  Math.min(kw.lowest,  im.lowest),
      highest: Math.max(kw.highest, im.highest),
      average: parseFloat(blendedAverage.toFixed(2)),
      median:  parseFloat(blendedMedian.toFixed(2)),
    },
    suggestedPrices: {
      goodDeal:   parseFloat((blendedMedian * 0.75).toFixed(2)),
      fairMarket: parseFloat(blendedMedian.toFixed(2)),
      sellPrice:  parseFloat((blendedMedian * 1.1).toFixed(2)),
    },
    metadata: {
      ...keyword.metadata,
      imageSearchBlended: true,
      keywordListings:    keyword.totalListings,
      imageListings:      image.totalListings,
    },
  };
}

// ==================== PRICE BLENDING ====================

function calculateBlendedPrice(sources: MarketDataSource[]): { blendedPrice: number; blendMethod: string } {
  const availableSources = sources.filter(s => s.available && s.priceAnalysis);

  if (availableSources.length === 0) return { blendedPrice: 0, blendMethod: 'no_data' };

  const priceData: { price: number; weight: number; source: string }[] = [];

  for (const source of availableSources) {
    const analysis = source.priceAnalysis!;
    let weight = 1;

    if (source.authorityData) weight = 1.5;
    if (source.source === 'ebay') weight = 1.2;
    // v8.5: If eBay result came from image search (visual match), higher weight
    if (source.source === 'ebay' && (source.metadata as any)?.imageSearch) weight = 1.4;
    if (source.source === 'ebay' && (source.metadata as any)?.imageSearchBlended) weight = 1.3;
    if (source.source === 'colnect'  && source.authorityData) weight = 1.4;
    if (source.source === 'kroger'   && source.authorityData) weight = 1.6;
    if (source.source === 'barcode_spider' && source.authorityData) weight = 1.3;
    if (source.source === 'tcgdex'   && source.authorityData) weight = 1.5;

    if (analysis.median > 0) {
      priceData.push({ price: analysis.median, weight, source: source.source });
    } else if (analysis.average > 0) {
      priceData.push({ price: analysis.average, weight: weight * 0.9, source: source.source });
    }
  }

  if (priceData.length === 0) return { blendedPrice: 0, blendMethod: 'no_prices' };
  if (priceData.length === 1) return {
    blendedPrice: parseFloat(priceData[0].price.toFixed(2)),
    blendMethod: `single_source_${priceData[0].source}`,
  };

  const totalWeight  = priceData.reduce((sum, p) => sum + p.weight, 0);
  const weightedSum  = priceData.reduce((sum, p) => sum + (p.price * p.weight), 0);
  const blendedPrice = weightedSum / totalWeight;

  return {
    blendedPrice: parseFloat(blendedPrice.toFixed(2)),
    blendMethod:  `weighted_blend_${priceData.length}_sources`,
  };
}

function calculatePriceConfidence(sources: MarketDataSource[]): number {
  const available = sources.filter(s => s.available && s.priceAnalysis);
  if (available.length === 0) return 0;
  if (available.length === 1) return 0.6;

  let confidence = 0.5 + (available.length * 0.1);

  if (available.some(s => s.authorityData)) confidence += 0.15;
  if (available.some(s => s.source === 'ebay' && (s.totalListings || 0) > 5)) confidence += 0.1;
  // v8.5: Visual match from eBay is a strong confidence signal
  if (available.some(s => s.source === 'ebay' && (s.metadata as any)?.imageSearch)) confidence += 0.08;
  if (available.some(s => s.source === 'ebay' && (s.metadata as any)?.imageSearchBlended)) confidence += 0.05;
  if (available.some(s => s.source === 'colnect' && s.authorityData)) confidence += 0.05;
  if (available.some(s => s.source === 'kroger'  && s.authorityData)) confidence += 0.1;
  if (available.some(s => s.source === 'tcgdex'  && s.authorityData)) confidence += 0.1;

  return Math.min(confidence, 0.98);
}

function determineMarketInfluence(sources: MarketDataSource[], category: ItemCategory): string {
  const availableSources = sources.filter(s => s.available);
  if (availableSources.length === 0) return 'insufficient_data';

  const hasAuthority    = availableSources.some(s => s.authorityData);
  const hasEbay         = availableSources.some(s => s.source === 'ebay' && (s.totalListings || 0) > 5);
  const hasImageSearch  = availableSources.some(s => s.source === 'ebay' && (s.metadata as any)?.imageSearch);
  const hasColnect      = availableSources.some(s => s.source === 'colnect' && s.authorityData);
  const hasKroger       = availableSources.some(s => s.source === 'kroger'  && s.authorityData);
  const hasTcgdex       = availableSources.some(s => s.source === 'tcgdex'  && s.authorityData);

  if (hasAuthority && hasEbay && hasImageSearch) return 'high_confidence_visual_match_verified';
  if (hasAuthority && hasEbay && (hasColnect || hasKroger || hasTcgdex)) return 'high_confidence_multi_source_catalog_verified';
  if (hasAuthority && hasEbay) return 'high_confidence_multi_source';
  if (hasImageSearch) return 'visual_match_verified';
  if (hasKroger) return 'retail_price_verified';
  if (hasAuthority) return 'authority_verified';
  if (hasColnect || hasTcgdex) return 'catalog_verified';
  if (hasEbay) return 'market_data_only';

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
  const delayBetween  = options?.delayBetween  || 500;
  const results       = new Map<string, MarketDataResult>();

  for (let i = 0; i < items.length; i += maxConcurrent) {
    const batch = items.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(item => fetchMarketData(item.name, item.category, item.additionalContext))
    );
    batch.forEach((item, index) => results.set(item.name, batchResults[index]));
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