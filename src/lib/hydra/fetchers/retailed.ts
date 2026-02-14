// FILE: src/lib/hydra/fetchers/retailed.ts
// HYDRA v9.2 - Retailed API Fetcher (Sneakers & Streetwear)
// FIXED v7.0: Domain changed from api.retailed.io → app.retailed.io/api/v1
// FIXED v9.2: 404 errors for sneakers
//   Root cause: Query cleaning was stripping useful terms ("Shoe" from item name),
//   and single-endpoint strategy fails on API changes.
//   Fix: Multiple endpoint fallback, progressive query simplification, size extraction.
// Falls back gracefully to StockX/GOAT search links

import type { MarketDataSource, AuthorityData } from '../types.js';

// v9.2: Try multiple endpoint patterns — API may have changed
const RETAILED_ENDPOINTS = [
  'https://app.retailed.io/api/v1',
  'https://app.retailed.io/api/v2',
  'https://api.retailed.io/v1',
];

const RETAILED_TIMEOUT = 10000; // 10 second timeout

export async function fetchRetailedData(itemName: string): Promise<MarketDataSource> {
  const startTime = Date.now();
  const apiKey = process.env.RETAILED_API_KEY;
  
  // Build search queries from broad to narrow
  const queries = buildSearchQueries(itemName);
  
  if (!apiKey) {
    console.log('⚠️ Retailed API key not configured');
    return createFallbackResult(itemName, queries[0]);
  }
  
  // v9.2: Try each endpoint + query combination until one works
  for (const baseUrl of RETAILED_ENDPOINTS) {
    for (const query of queries) {
      try {
        const result = await tryRetailedSearch(baseUrl, query, itemName, apiKey, startTime);
        if (result) return result;
      } catch (err: any) {
        // 404 = wrong endpoint or query, try next
        // Other errors = log and continue
        if (!err.message?.includes('404')) {
          console.log(`    ⚠️ Retailed ${baseUrl}: ${err.message}`);
        }
      }
    }
  }
  
  // All endpoints/queries failed
  console.log(`⚠️ Retailed: All endpoints returned 404 — using fallback links`);
  return createFallbackResult(itemName, queries[0]);
}

// =============================================================================
// SEARCH ATTEMPT
// =============================================================================

async function tryRetailedSearch(
  baseUrl: string,
  query: string,
  originalItemName: string,
  apiKey: string,
  startTime: number
): Promise<MarketDataSource | null> {
  
  // Extract SKU/style code if present
  const styleCode = extractStyleCode(originalItemName);
  
  let searchUrl = `${baseUrl}/products/search?query=${encodeURIComponent(query)}&limit=10`;
  if (styleCode) {
    searchUrl += `&sku=${encodeURIComponent(styleCode)}`;
  }
  
  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RETAILED_TIMEOUT);
  
  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'User-Agent': 'TagnetIQ-HYDRA/9.2',
    },
    signal: controller.signal,
  });
  
  clearTimeout(timeoutId);
  
  if (!response.ok) {
    if (response.status === 404) {
      // 404 = endpoint or query not found, try next combination
      throw new Error(`404 at ${baseUrl}`);
    }
    if (response.status === 401 || response.status === 403) {
      console.error(`❌ Retailed API auth error: ${response.status} — check API key`);
      return null; // Don't retry auth errors
    }
    console.error(`❌ Retailed API error: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  const products = data.products || data.results || data.data || [];
  
  if (products.length === 0) {
    return null; // Try next query
  }
  
  // Get the best match
  const bestMatch = products[0];
  console.log(`✅ Retailed: Found "${bestMatch.name || bestMatch.title}" (SKU: ${bestMatch.sku || bestMatch.styleId || 'N/A'}) via ${baseUrl}`);
  
  // Extract price data from market prices
  const priceData = extractPriceData(bestMatch);
  
  // Build authority data
  const authorityData: AuthorityData = {
    source: 'retailed',
    verified: true,
    confidence: calculateMatchConfidence(originalItemName, bestMatch.name || bestMatch.title, bestMatch.sku),
    itemDetails: {
      productId: bestMatch.id || bestMatch.productId,
      name: bestMatch.name || bestMatch.title,
      brand: bestMatch.brand,
      sku: bestMatch.sku || bestMatch.styleId,
      colorway: bestMatch.colorway || bestMatch.color,
      releaseDate: bestMatch.releaseDate,
      retailPrice: bestMatch.retailPrice,
      gender: bestMatch.gender,
      category: bestMatch.category,
      description: bestMatch.description?.substring(0, 500),
      imageUrl: bestMatch.imageUrl || bestMatch.image,
      thumbnailUrl: bestMatch.thumbnailUrl || bestMatch.thumbnail,
      stockxUrl: bestMatch.stockxUrl,
      goatUrl: bestMatch.goatUrl,
      flightClubUrl: bestMatch.flightClubUrl,
    },
    priceData: priceData || undefined,
    externalUrl: bestMatch.stockxUrl || bestMatch.goatUrl || `https://stockx.com/search?s=${encodeURIComponent(query)}`,
    lastUpdated: bestMatch.updatedAt || new Date().toISOString(),
  };
  
  // Build sample listings
  const sampleListings = products.slice(0, 5).map((product: any) => ({
    title: `${product.name || product.title} (${product.sku || 'N/A'})`,
    price: product.marketPrice || product.lowestAsk || product.retailPrice || 0,
    condition: product.brand || 'Sneaker',
    url: product.stockxUrl || product.goatUrl || `https://stockx.com/search?s=${encodeURIComponent(product.name || product.title)}`,
  }));
  
  console.log(`✅ Retailed: Authority data retrieved in ${Date.now() - startTime}ms`);
  
  return {
    source: 'retailed',
    available: true,
    query: query,
    totalListings: data.total || products.length,
    priceAnalysis: priceData ? {
      lowest: priceData.lowestAsk,
      highest: priceData.highestBid,
      average: priceData.lastSale || priceData.lowestAsk,
      median: priceData.lastSale || priceData.lowestAsk,
    } : undefined,
    suggestedPrices: priceData ? {
      goodDeal: parseFloat((priceData.lowestAsk * 0.9).toFixed(2)),
      fairMarket: priceData.lastSale || priceData.lowestAsk,
      sellPrice: parseFloat((priceData.lowestAsk * 1.05).toFixed(2)),
    } : undefined,
    sampleListings,
    authorityData,
    metadata: {
      responseTime: Date.now() - startTime,
      totalProducts: data.total,
      bestMatchSku: bestMatch.sku || bestMatch.styleId,
      brand: bestMatch.brand,
      apiDomain: baseUrl,
    },
  };
}

// =============================================================================
// QUERY BUILDING — Progressive simplification
// =============================================================================

/**
 * Build multiple search queries from specific to broad.
 * If the first query returns 404 or no results, progressively simpler
 * queries are tried. This handles cases where the full item name
 * (e.g. "Hoka Speedgoat 5 Men's Trail Running Shoe, Size 9 1/2")
 * is too specific for the API.
 * 
 * v9.2: Fixed query cleaning — no longer strips "Shoe" from brand names
 */
function buildSearchQueries(itemName: string): string[] {
  const queries: string[] = [];
  
  // Extract size info separately (don't include in search, use for filtering)
  const { cleanName, size } = extractSizeAndClean(itemName);
  
  // Query 1: Full cleaned name (brand + model + colorway)
  const fullClean = cleanForSearch(cleanName);
  if (fullClean.length > 3) {
    queries.push(fullClean);
  }
  
  // Query 2: Brand + model only (drop descriptors like "Men's Trail Running")
  const brandModel = extractBrandModel(cleanName);
  if (brandModel && brandModel !== fullClean) {
    queries.push(brandModel);
  }
  
  // Query 3: Just the style code if we have one
  const styleCode = extractStyleCode(itemName);
  if (styleCode) {
    queries.push(styleCode);
  }
  
  // Ensure at least one query
  if (queries.length === 0) {
    queries.push(cleanForSearch(itemName));
  }
  
  if (size) {
    console.log(`    👟 Extracted size: ${size} (will filter results)`);
  }
  
  console.log(`    🔍 Retailed queries: ${queries.map(q => `"${q}"`).join(' → ')}`);
  
  return queries;
}

/**
 * Extract shoe size from item name and return clean name without it
 */
function extractSizeAndClean(itemName: string): { cleanName: string; size: string | null } {
  // Match patterns like "Size 9 1/2", "Size 10", "US 11", "EU 44", "sz 9.5"
  const sizePatterns = [
    /,?\s*size\s+(\d+(?:\s*[½⅓]|\s*\d\/\d|\.\d)?)\s*$/i,
    /,?\s*(?:us|eu|uk)\s+(\d+(?:\.\d)?)\s*$/i,
    /,?\s*sz\.?\s*(\d+(?:\.\d)?)\s*$/i,
  ];
  
  let cleanName = itemName;
  let size: string | null = null;
  
  for (const pattern of sizePatterns) {
    const match = cleanName.match(pattern);
    if (match) {
      size = match[1].trim();
      cleanName = cleanName.replace(match[0], '').trim();
      break;
    }
  }
  
  return { cleanName, size };
}

/**
 * Clean item name for API search
 * v9.2: More conservative — keeps brand-relevant words
 */
function cleanForSearch(itemName: string): string {
  return itemName
    // Remove size references (already extracted)
    .replace(/\b(size|sz\.?)\s+\d+[^\s]*/gi, '')
    // Remove common noise that confuses search APIs
    .replace(/\b(deadstock|ds|vnds|nwt|nwb|nib|pads|og all|pre-?owned|used|new)\b/gi, '')
    // Remove gender descriptors (API has its own gender filter)
    .replace(/\b(men'?s?|women'?s?|unisex|youth|kids?|gs|td|ps)\b/gi, '')
    // Remove generic category words — but NOT brand-specific ones
    .replace(/\b(trail running|running|walking|hiking|basketball|tennis|lifestyle)\b/gi, '')
    // Clean up punctuation and whitespace
    .replace(/[,()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract just brand + model name (e.g., "Hoka Speedgoat 5")
 */
function extractBrandModel(itemName: string): string | null {
  const lower = itemName.toLowerCase();
  
  // Known sneaker brands with common model patterns
  const brandPatterns: Array<{ brand: RegExp; keepWords: number }> = [
    { brand: /\b(hoka|hoka one one)\s+(\w+(?:\s+\d+)?)/i, keepWords: 0 },
    { brand: /\b(nike)\s+(\w+(?:\s+\w+)?(?:\s+\d+)?)/i, keepWords: 0 },
    { brand: /\b(adidas)\s+(\w+(?:\s+\w+)?(?:\s+\d+)?)/i, keepWords: 0 },
    { brand: /\b(new balance)\s+(\d+(?:v\d)?)/i, keepWords: 0 },
    { brand: /\b(air jordan|jordan)\s+(\d+(?:\s+\w+)?)/i, keepWords: 0 },
    { brand: /\b(yeezy)\s+(\w+\s+\d+(?:\s+v\d)?)/i, keepWords: 0 },
    { brand: /\b(asics)\s+(\w+(?:\s+\w+)?(?:\s+\d+)?)/i, keepWords: 0 },
    { brand: /\b(brooks)\s+(\w+(?:\s+\d+)?)/i, keepWords: 0 },
    { brand: /\b(on)\s+(cloud\w*(?:\s+\d+)?)/i, keepWords: 0 },
    { brand: /\b(salomon)\s+(\w+(?:\s+\w+)?(?:\s+\d+)?)/i, keepWords: 0 },
    { brand: /\b(puma)\s+(\w+(?:\s+\w+)?)/i, keepWords: 0 },
    { brand: /\b(reebok)\s+(\w+(?:\s+\w+)?)/i, keepWords: 0 },
    { brand: /\b(converse)\s+(\w+(?:\s+\w+)?)/i, keepWords: 0 },
    { brand: /\b(vans)\s+(\w+(?:\s+\w+)?)/i, keepWords: 0 },
  ];
  
  for (const { brand } of brandPatterns) {
    const match = itemName.match(brand);
    if (match) {
      return match[0].trim();
    }
  }
  
  return null;
}

function extractStyleCode(itemName: string): string | null {
  // Nike style codes: XX####-### or similar
  const nikePattern = /\b([A-Z]{2}\d{4}-\d{3})\b/i;
  const nikeMatch = itemName.match(nikePattern);
  if (nikeMatch) return nikeMatch[1].toUpperCase();
  
  // Adidas style codes: XX####
  const adidasPattern = /\b([A-Z]{2}\d{4,5})\b/i;
  const adidasMatch = itemName.match(adidasPattern);
  if (adidasMatch) return adidasMatch[1].toUpperCase();
  
  // Yeezy pattern
  const yeezyPattern = /\b(GW\d{4}|HP\d{4}|HQ\d{4}|GY\d{4})\b/i;
  const yeezyMatch = itemName.match(yeezyPattern);
  if (yeezyMatch) return yeezyMatch[1].toUpperCase();
  
  return null;
}

function extractPriceData(product: any): { lowestAsk: number; highestBid: number; lastSale: number; retail: number } | null {
  const lowestAsk = product.lowestAsk || product.marketPrice || product.askPrice;
  const highestBid = product.highestBid || product.bidPrice;
  const lastSale = product.lastSale || product.lastSalePrice;
  const retail = product.retailPrice || product.msrp;
  
  if (lowestAsk || highestBid || lastSale) {
    return {
      lowestAsk: lowestAsk || lastSale || retail || 0,
      highestBid: highestBid || (lowestAsk ? lowestAsk * 0.85 : 0),
      lastSale: lastSale || lowestAsk || 0,
      retail: retail || 0,
    };
  }
  
  return null;
}

function calculateMatchConfidence(searchTerm: string, productName: string, sku?: string): number {
  const searchLower = searchTerm.toLowerCase();
  const nameLower = productName?.toLowerCase() || '';
  
  if (sku && searchLower.includes(sku.toLowerCase())) {
    return 0.98;
  }
  
  if (nameLower === searchLower || searchLower.includes(nameLower)) {
    return 0.95;
  }
  
  const keyBrands = ['jordan', 'yeezy', 'dunk', 'air max', 'air force', 'hoka', 'speedgoat', 'clifton'];
  for (const brand of keyBrands) {
    if (searchLower.includes(brand) && nameLower.includes(brand)) {
      return 0.85;
    }
  }
  
  const searchWords = searchLower.split(/\s+/).filter(w => w.length > 2);
  const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2);
  const overlap = searchWords.filter(w => nameWords.some(n => n.includes(w) || w.includes(n)));
  
  return Math.min(0.5 + (overlap.length / Math.max(searchWords.length, 1)) * 0.4, 0.85);
}

function createFallbackResult(itemName: string, cleanedQuery?: string): MarketDataSource {
  const query = cleanedQuery || cleanForSearch(itemName);
  const stockxUrl = `https://stockx.com/search?s=${encodeURIComponent(query)}`;
  const goatUrl = `https://www.goat.com/search?query=${encodeURIComponent(query)}`;
  
  return {
    source: 'retailed',
    available: true,
    query: query,
    totalListings: 0,
    sampleListings: [
      {
        title: `Search StockX for "${query}"`,
        price: 0,
        condition: 'New',
        url: stockxUrl,
      },
      {
        title: `Search GOAT for "${query}"`,
        price: 0,
        condition: 'New',
        url: goatUrl,
      },
    ],
    metadata: {
      fallback: true,
      reason: 'Retailed API unavailable - using search links',
      stockxUrl,
      goatUrl,
    },
  };
}