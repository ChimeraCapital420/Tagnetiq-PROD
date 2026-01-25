// FILE: src/lib/hydra/fetchers/retailed.ts
// HYDRA v5.2 - Retailed API Fetcher (Sneakers & Streetwear)
// Documentation: https://docs.retailed.io

import type { MarketDataSource, AuthorityData } from '../types.js';

const RETAILED_API = 'https://api.retailed.io/v1';

export async function fetchRetailedData(itemName: string): Promise<MarketDataSource> {
  const startTime = Date.now();
  const apiKey = process.env.RETAILED_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️ Retailed API key not configured');
    return createFallbackResult(itemName);
  }
  
  try {
    // Build search query
    const searchQuery = cleanSneakerQuery(itemName);
    console.log(`🔍 Retailed search: "${searchQuery}"`);
    
    // Extract SKU/style code if present
    const styleCode = extractStyleCode(itemName);
    
    // Search for products
    let searchUrl = `${RETAILED_API}/products/search?query=${encodeURIComponent(searchQuery)}&limit=10`;
    if (styleCode) {
      searchUrl += `&sku=${encodeURIComponent(styleCode)}`;
    }
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'TagnetIQ-HYDRA/5.2',
      },
    });
    
    if (!response.ok) {
      console.error(`❌ Retailed API error: ${response.status}`);
      return createFallbackResult(itemName);
    }
    
    const data = await response.json();
    const products = data.products || data.results || [];
    
    if (products.length === 0) {
      console.log('⚠️ Retailed: No matching products found');
      return {
        source: 'retailed',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: 'No matching sneakers/streetwear found',
      };
    }
    
    // Get the best match
    const bestMatch = products[0];
    console.log(`✅ Retailed: Found "${bestMatch.name || bestMatch.title}" (SKU: ${bestMatch.sku || bestMatch.styleId || 'N/A'})`);
    
    // Extract price data from market prices
    const priceData = extractPriceData(bestMatch);
    
    // Build authority data
    const authorityData: AuthorityData = {
      source: 'retailed',
      verified: true,
      confidence: calculateMatchConfidence(itemName, bestMatch.name || bestMatch.title, bestMatch.sku),
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
      externalUrl: bestMatch.stockxUrl || bestMatch.goatUrl || `https://stockx.com/search?s=${encodeURIComponent(searchQuery)}`,
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
      query: searchQuery,
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
      },
    };
    
  } catch (error) {
    console.error('❌ Retailed fetch error:', error);
    return {
      source: 'retailed',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function cleanSneakerQuery(itemName: string): string {
  // Remove common noise words but keep brand/model info
  return itemName
    .replace(/\b(sneaker|sneakers|shoe|shoes|deadstock|ds|vnds|pads|og all)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
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
  
  // Check for SKU match (highest confidence)
  if (sku && searchLower.includes(sku.toLowerCase())) {
    return 0.98;
  }
  
  // Check for exact name match
  if (nameLower === searchLower || searchLower.includes(nameLower)) {
    return 0.95;
  }
  
  // Check key words (Jordan, Yeezy, etc.)
  const keyBrands = ['jordan', 'yeezy', 'dunk', 'air max', 'air force'];
  for (const brand of keyBrands) {
    if (searchLower.includes(brand) && nameLower.includes(brand)) {
      return 0.85;
    }
  }
  
  // Check word overlap
  const searchWords = searchLower.split(/\s+/).filter(w => w.length > 2);
  const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2);
  const overlap = searchWords.filter(w => nameWords.some(n => n.includes(w) || w.includes(n)));
  
  return Math.min(0.5 + (overlap.length / Math.max(searchWords.length, 1)) * 0.4, 0.85);
}

function createFallbackResult(itemName: string): MarketDataSource {
  const searchUrl = `https://stockx.com/search?s=${encodeURIComponent(itemName)}`;
  
  return {
    source: 'retailed',
    available: true,
    query: itemName,
    totalListings: 0,
    sampleListings: [{
      title: `Search StockX for "${itemName}"`,
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