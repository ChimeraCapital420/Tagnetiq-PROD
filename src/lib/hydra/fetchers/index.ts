// FILE: src/lib/hydra/fetchers/index.ts
// HYDRA v5.2 - Market Data Fetchers Index
// Unified interface for all market data sources

import type { MarketDataSource, MarketDataResult, ItemCategory } from '../types.js';
import { getApisForCategory } from '../category-detection.js';

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

// ==================== FETCHER REGISTRY ====================

type FetcherFunction = (itemName: string, category?: string) => Promise<MarketDataSource>;

const FETCHER_REGISTRY: Record<string, FetcherFunction> = {
  'ebay': fetchEbayData,
  'numista': fetchNumistaData,
  'pokemon_tcg': fetchPokemonTcgData,
  'brickset': fetchBricksetData,
  'google_books': fetchGoogleBooksData,
  'discogs': fetchDiscogsData,
  'retailed': fetchRetailedData,
  'psa': fetchPsaData,
  'nhtsa': fetchNhtsaData,
};

// ==================== UNIFIED FETCH FUNCTION ====================

export async function fetchMarketData(
  itemName: string,
  category: ItemCategory,
  options?: {
    maxSources?: number;
    timeout?: number;
    includeEbay?: boolean;
  }
): Promise<MarketDataResult> {
  const startTime = Date.now();
  const maxSources = options?.maxSources || 3;
  const timeout = options?.timeout || 10000;
  const includeEbay = options?.includeEbay !== false;
  
  console.log(`\n📊 === FETCHING MARKET DATA ===`);
  console.log(`📝 Item: "${itemName}"`);
  console.log(`🏷️ Category: ${category}`);
  
  // Get APIs for this category
  let apis = getApisForCategory(category);
  console.log(`🔌 APIs for category: ${apis.join(', ')}`);
  
  // Ensure eBay is included if requested
  if (includeEbay && !apis.includes('ebay')) {
    apis = [...apis, 'ebay'];
  }
  
  // Limit to max sources
  apis = apis.slice(0, maxSources);
  
  // Run fetchers in parallel with timeout
  const fetchPromises = apis.map(async (api) => {
    const fetcher = FETCHER_REGISTRY[api];
    if (!fetcher) {
      console.warn(`⚠️ No fetcher found for API: ${api}`);
      return null;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const result = await fetcher(itemName, category);
      clearTimeout(timeoutId);
      
      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error(`⏱️ ${api} fetch timed out`);
      } else {
        console.error(`❌ ${api} fetch failed:`, error.message);
      }
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
  
  console.log(`\n📊 === MARKET DATA RESULTS ===`);
  console.log(`✅ Sources queried: ${apis.join(', ')}`);
  console.log(`✅ Sources with data: ${sources.filter(s => s.available).map(s => s.source).join(', ') || 'none'}`);
  console.log(`💰 Blended price: $${blendedPrice.toFixed(2)} (${blendMethod})`);
  console.log(`🎯 Primary authority: ${primaryAuthority?.source || 'none'}`);
  console.log(`⏱️ Total time: ${Date.now() - startTime}ms`);
  
  return {
    sources,
    primarySource,
    blendedPrice,
    blendMethod,
    marketInfluence,
    apisUsed: apis,
    primaryAuthority,
    allAuthorities: authoritySources.map(s => s.authorityData!),
  };
}

// ==================== PRICE BLENDING ====================

function calculateBlendedPrice(sources: MarketDataSource[]): { blendedPrice: number; blendMethod: string } {
  const availableSources = sources.filter(s => s.available && s.priceAnalysis);
  
  if (availableSources.length === 0) {
    return { blendedPrice: 0, blendMethod: 'no_data' };
  }
  
  // Collect all prices with source weights
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

function determineMarketInfluence(sources: MarketDataSource[], category: ItemCategory): string {
  const availableSources = sources.filter(s => s.available);
  
  if (availableSources.length === 0) {
    return 'insufficient_data';
  }
  
  const hasAuthority = availableSources.some(s => s.authorityData);
  const hasEbay = availableSources.some(s => s.source === 'ebay' && s.totalListings > 5);
  
  if (hasAuthority && hasEbay) {
    return 'high_confidence_multi_source';
  }
  
  if (hasAuthority) {
    return 'authority_verified';
  }
  
  if (hasEbay) {
    return 'market_data_only';
  }
  
  return 'limited_data';
}

// ==================== BATCH FETCH ====================

export async function fetchMarketDataBatch(
  items: Array<{ name: string; category: ItemCategory }>,
  options?: {
    maxConcurrent?: number;
    delayBetween?: number;
  }
): Promise<Map<string, MarketDataResult>> {
  const maxConcurrent = options?.maxConcurrent || 3;
  const delayBetween = options?.delayBetween || 500;
  
  const results = new Map<string, MarketDataResult>();
  
  // Process in batches
  for (let i = 0; i < items.length; i += maxConcurrent) {
    const batch = items.slice(i, i + maxConcurrent);
    
    const batchResults = await Promise.all(
      batch.map(item => fetchMarketData(item.name, item.category))
    );
    
    batch.forEach((item, index) => {
      results.set(item.name, batchResults[index]);
    });
    
    // Add delay between batches to avoid rate limiting
    if (i + maxConcurrent < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetween));
    }
  }
  
  return results;
}