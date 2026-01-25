// FILE: src/lib/hydra/fetchers/brickset.ts
// HYDRA v5.2 - Brickset API Fetcher (LEGO Sets)

import type { MarketDataSource, AuthorityData } from '../types.js';

const BRICKSET_API = 'https://brickset.com/api/v3.asmx';

export async function fetchBricksetData(itemName: string): Promise<MarketDataSource> {
  const startTime = Date.now();
  const apiKey = process.env.BRICKSET_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️ Brickset API key not configured');
    return createFallbackResult(itemName);
  }
  
  try {
    // Extract set number if present
    const setNumber = extractSetNumber(itemName);
    const searchQuery = setNumber || cleanLegoName(itemName);
    console.log(`🔍 Brickset search: "${searchQuery}" (set#: ${setNumber || 'none'})`);
    
    // Build API request
    const params = new URLSearchParams({
      apiKey,
      query: searchQuery,
      pageSize: '10',
      orderBy: 'YearFrom',
    });
    
    // If we have a set number, search by that specifically
    if (setNumber) {
      params.set('setNumber', setNumber);
    }
    
    const response = await fetch(`${BRICKSET_API}/getSets?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`❌ Brickset API error: ${response.status}`);
      return createFallbackResult(itemName);
    }
    
    const data = await response.json();
    const sets = data.sets || [];
    
    if (sets.length === 0) {
      console.log('⚠️ Brickset: No matching sets found');
      return {
        source: 'brickset',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: 'No matching LEGO sets found',
      };
    }
    
    // Get the best match
    const bestMatch = sets[0];
    console.log(`✅ Brickset: Found "${bestMatch.name}" (${bestMatch.number}-${bestMatch.numberVariant || 1})`);
    
    // Extract price data
    const priceData = extractPriceData(bestMatch);
    
    // Build authority data
    const authorityData: AuthorityData = {
      source: 'brickset',
      verified: true,
      confidence: calculateMatchConfidence(itemName, bestMatch.name, bestMatch.number),
      itemDetails: {
        setId: bestMatch.setID,
        setNumber: bestMatch.number,
        numberVariant: bestMatch.numberVariant,
        name: bestMatch.name,
        year: bestMatch.year,
        theme: bestMatch.theme,
        themeGroup: bestMatch.themeGroup,
        subtheme: bestMatch.subtheme,
        category: bestMatch.category,
        pieces: bestMatch.pieces,
        minifigs: bestMatch.minifigs,
        packagingType: bestMatch.packagingType,
        availability: bestMatch.availability,
        rating: bestMatch.rating,
        reviewCount: bestMatch.reviewCount,
        instructionsCount: bestMatch.instructionsCount,
        ageRange: bestMatch.ageRange,
        dimensions: bestMatch.dimensions,
        barcodes: bestMatch.barcode,
        imageUrl: bestMatch.image?.imageURL,
        thumbnailUrl: bestMatch.image?.thumbnailURL,
        bricksetUrl: bestMatch.bricksetURL,
      },
      priceData: priceData || undefined,
      externalUrl: bestMatch.bricksetURL || `https://brickset.com/sets/${bestMatch.number}`,
      lastUpdated: bestMatch.lastUpdated || new Date().toISOString(),
    };
    
    // Build sample listings
    const sampleListings = sets.slice(0, 5).map((set: any) => ({
      title: `${set.number}: ${set.name} (${set.year})`,
      price: set.LEGOCom?.US?.retailPrice || set.LEGOCom?.UK?.retailPrice || 0,
      condition: `${set.pieces || '?'} pieces`,
      url: set.bricksetURL || `https://brickset.com/sets/${set.number}`,
    }));
    
    console.log(`✅ Brickset: Authority data retrieved in ${Date.now() - startTime}ms`);
    
    return {
      source: 'brickset',
      available: true,
      query: searchQuery,
      totalListings: data.matches || sets.length,
      priceAnalysis: priceData ? {
        lowest: priceData.used || priceData.retail * 0.5,
        highest: priceData.new || priceData.retail * 2,
        average: priceData.retail,
        median: (priceData.new + priceData.used) / 2 || priceData.retail,
      } : undefined,
      suggestedPrices: priceData ? {
        goodDeal: parseFloat(((priceData.used || priceData.retail * 0.6) * 0.9).toFixed(2)),
        fairMarket: priceData.used || priceData.retail * 0.7,
        sellPrice: priceData.new || priceData.retail * 1.2,
      } : undefined,
      sampleListings,
      authorityData,
      metadata: {
        responseTime: Date.now() - startTime,
        totalSets: data.matches,
        bestMatchId: bestMatch.setID,
        theme: bestMatch.theme,
      },
    };
    
  } catch (error) {
    console.error('❌ Brickset fetch error:', error);
    return {
      source: 'brickset',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function extractSetNumber(itemName: string): string | null {
  // Look for LEGO set numbers (usually 4-6 digits)
  const patterns = [
    /\b(\d{4,6})\b/,           // Plain number
    /set\s*#?\s*(\d{4,6})/i,   // "set #12345"
    /\b(\d{4,6})-\d\b/,        // "12345-1" format
    /#(\d{4,6})/,              // "#12345"
  ];
  
  for (const pattern of patterns) {
    const match = itemName.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

function cleanLegoName(itemName: string): string {
  return itemName
    .replace(/\b(lego|legos|set|#)\b/gi, '')
    .replace(/\b\d{4,6}(-\d)?\b/g, '') // Remove set numbers
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPriceData(set: any): { retail: number; new: number; used: number } | null {
  const usRetail = set.LEGOCom?.US?.retailPrice;
  const ukRetail = set.LEGOCom?.UK?.retailPrice;
  const retail = usRetail || (ukRetail ? ukRetail * 1.25 : 0); // Convert UK to USD approx
  
  // BrickEconomy prices if available
  const newPrice = set.collections?.qtyOwned?.newPrice || retail * 1.5;
  const usedPrice = set.collections?.qtyOwned?.usedPrice || retail * 0.6;
  
  if (retail > 0 || newPrice > 0 || usedPrice > 0) {
    return {
      retail: parseFloat(retail.toFixed(2)),
      new: parseFloat(newPrice.toFixed(2)),
      used: parseFloat(usedPrice.toFixed(2)),
    };
  }
  
  return null;
}

function calculateMatchConfidence(searchTerm: string, setName: string, setNumber: string): number {
  const searchLower = searchTerm.toLowerCase();
  
  // Check for set number match
  if (setNumber && searchLower.includes(setNumber)) {
    return 0.98;
  }
  
  // Check for exact name match
  const nameLower = setName.toLowerCase();
  if (nameLower === searchLower || searchLower.includes(nameLower)) {
    return 0.90;
  }
  
  // Check word overlap
  const searchWords = searchLower.split(/\s+/).filter(w => w.length > 2);
  const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2);
  const overlap = searchWords.filter(w => nameWords.some(n => n.includes(w) || w.includes(n)));
  
  return Math.min(0.5 + (overlap.length / Math.max(searchWords.length, 1)) * 0.4, 0.85);
}

function createFallbackResult(itemName: string): MarketDataSource {
  const setNumber = extractSetNumber(itemName);
  const searchUrl = setNumber 
    ? `https://brickset.com/sets/${setNumber}`
    : `https://brickset.com/sets?query=${encodeURIComponent(itemName)}`;
  
  return {
    source: 'brickset',
    available: true,
    query: itemName,
    totalListings: 0,
    sampleListings: [{
      title: `Search Brickset for "${itemName}"`,
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