// FILE: src/lib/hydra/fetchers/numista.ts
// HYDRA v5.2 - Numista Authority Data Fetcher (Coins & Banknotes)

import type { MarketDataSource, AuthorityData } from '../types.js';

const NUMISTA_API_BASE = 'https://api.numista.com/v3';

export async function fetchNumistaData(itemName: string, category?: string): Promise<MarketDataSource> {
  const startTime = Date.now();
  const apiKey = process.env.NUMISTA_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️ Numista API key not configured');
    return createFallbackResult(itemName);
  }
  
  try {
    // Extract search terms from item name
    const searchQuery = buildNumistaQuery(itemName);
    console.log(`🔍 Numista search: "${searchQuery}"`);
    
    // Determine category filter
    const categoryFilter = category === 'banknotes' ? 'banknote' : 'coin';
    
    // Search the Numista catalog
    const searchUrl = `${NUMISTA_API_BASE}/types?q=${encodeURIComponent(searchQuery)}&category=${categoryFilter}&count=10&lang=en`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Numista-API-Key': apiKey,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`❌ Numista API error: ${response.status}`);
      return createFallbackResult(itemName);
    }
    
    const data = await response.json();
    const types = data.types || [];
    
    if (types.length === 0) {
      console.log('⚠️ Numista: No matching types found');
      return {
        source: 'numista',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: 'No matching coins/banknotes found',
      };
    }
    
    // Get the best match
    const bestMatch = types[0];
    console.log(`✅ Numista: Found "${bestMatch.title}" (ID: ${bestMatch.id})`);
    
    // Fetch detailed type information
    const typeDetails = await fetchTypeDetails(bestMatch.id, apiKey);
    
    // Fetch price estimates if available
    const priceData = await fetchPriceEstimates(bestMatch.id, apiKey);
    
    // Build authority data
    const authorityData: AuthorityData = {
      source: 'numista',
      verified: true,
      confidence: calculateMatchConfidence(itemName, bestMatch.title),
      itemDetails: {
        numistaId: bestMatch.id,
        title: bestMatch.title,
        category: bestMatch.category,
        issuer: bestMatch.issuer?.name,
        minYear: bestMatch.min_year,
        maxYear: bestMatch.max_year,
        url: `https://en.numista.com/catalogue/pieces${bestMatch.id}.html`,
        obverseThumb: bestMatch.obverse_thumbnail,
        reverseThumb: bestMatch.reverse_thumbnail,
        ...typeDetails,
      },
      priceData: priceData || undefined,
      externalUrl: `https://en.numista.com/catalogue/pieces${bestMatch.id}.html`,
      lastUpdated: new Date().toISOString(),
    };
    
    // Build sample listings from search results
    const sampleListings = types.slice(0, 5).map((type: any) => ({
      title: type.title,
      price: 0, // Numista doesn't provide direct prices in search
      condition: 'Reference',
      url: `https://en.numista.com/catalogue/pieces${type.id}.html`,
    }));
    
    console.log(`✅ Numista: Authority data retrieved in ${Date.now() - startTime}ms`);
    
    return {
      source: 'numista',
      available: true,
      query: searchQuery,
      totalListings: data.count || types.length,
      priceAnalysis: priceData ? {
        lowest: priceData.conditions?.[0]?.price || 0,
        highest: priceData.conditions?.[priceData.conditions.length - 1]?.price || 0,
        average: priceData.market || 0,
        median: priceData.market || 0,
      } : undefined,
      suggestedPrices: priceData ? {
        goodDeal: parseFloat(((priceData.market || 0) * 0.7).toFixed(2)),
        fairMarket: priceData.market || 0,
        sellPrice: parseFloat(((priceData.market || 0) * 1.15).toFixed(2)),
      } : undefined,
      sampleListings,
      authorityData,
      metadata: {
        responseTime: Date.now() - startTime,
        matchCount: types.length,
        bestMatchId: bestMatch.id,
      },
    };
    
  } catch (error) {
    console.error('❌ Numista fetch error:', error);
    return {
      source: 'numista',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function fetchTypeDetails(typeId: number, apiKey: string): Promise<any> {
  try {
    const response = await fetch(`${NUMISTA_API_BASE}/types/${typeId}?lang=en`, {
      headers: { 'Numista-API-Key': apiKey },
    });
    
    if (!response.ok) return {};
    
    const data = await response.json();
    return {
      value: data.value?.text,
      composition: data.composition?.text,
      weight: data.weight,
      size: data.size,
      thickness: data.thickness,
      shape: data.shape,
      orientation: data.orientation,
      references: data.references?.map((r: any) => `${r.catalogue?.code} ${r.number}`).join(', '),
    };
  } catch {
    return {};
  }
}

async function fetchPriceEstimates(typeId: number, apiKey: string): Promise<any> {
  try {
    // First get issues for this type
    const issuesResponse = await fetch(`${NUMISTA_API_BASE}/types/${typeId}/issues?lang=en`, {
      headers: { 'Numista-API-Key': apiKey },
    });
    
    if (!issuesResponse.ok) return null;
    
    const issues = await issuesResponse.json();
    if (!Array.isArray(issues) || issues.length === 0) return null;
    
    // Get prices for the first issue
    const firstIssue = issues[0];
    const priceResponse = await fetch(
      `${NUMISTA_API_BASE}/types/${typeId}/issues/${firstIssue.id}/prices?currency=USD&lang=en`,
      { headers: { 'Numista-API-Key': apiKey } }
    );
    
    if (!priceResponse.ok) return null;
    
    const priceData = await priceResponse.json();
    const prices = priceData.prices || [];
    
    if (prices.length === 0) return null;
    
    // Map grade codes to readable names
    const gradeNames: Record<string, string> = {
      'g': 'Good',
      'vg': 'Very Good',
      'f': 'Fine',
      'vf': 'Very Fine',
      'xf': 'Extremely Fine',
      'au': 'About Uncirculated',
      'unc': 'Uncirculated',
    };
    
    const conditions = prices.map((p: any) => ({
      condition: gradeNames[p.grade] || p.grade,
      grade: p.grade,
      price: p.price,
    }));
    
    // Calculate market value (VF or middle grade)
    const vfPrice = prices.find((p: any) => p.grade === 'vf')?.price;
    const midIndex = Math.floor(prices.length / 2);
    const marketValue = vfPrice || prices[midIndex]?.price || prices[0]?.price || 0;
    
    return {
      market: marketValue,
      conditions,
      currency: priceData.currency || 'USD',
    };
  } catch (error) {
    console.error('❌ Numista price fetch error:', error);
    return null;
  }
}

function buildNumistaQuery(itemName: string): string {
  // Clean up the item name for better search results
  let query = itemName
    .replace(/\b(coin|penny|nickel|dime|quarter)\b/gi, '')
    .replace(/\b(graded|certified|pcgs|ngc|anacs)\b/gi, '')
    .replace(/\b(ms|pr|pf)\s*\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Keep year if present
  const yearMatch = itemName.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
  if (yearMatch && !query.includes(yearMatch[0])) {
    query = `${query} ${yearMatch[0]}`;
  }
  
  return query || itemName;
}

function calculateMatchConfidence(searchTerm: string, matchTitle: string): number {
  const searchLower = searchTerm.toLowerCase();
  const matchLower = matchTitle.toLowerCase();
  
  // Check for exact match
  if (searchLower === matchLower) return 0.99;
  
  // Check for containment
  if (matchLower.includes(searchLower) || searchLower.includes(matchLower)) {
    return 0.85;
  }
  
  // Check word overlap
  const searchWords = searchLower.split(/\s+/);
  const matchWords = matchLower.split(/\s+/);
  const overlap = searchWords.filter(w => matchWords.some(m => m.includes(w) || w.includes(m)));
  
  return Math.min(0.5 + (overlap.length / searchWords.length) * 0.4, 0.95);
}

function createFallbackResult(itemName: string): MarketDataSource {
  const searchUrl = `https://en.numista.com/catalogue/index.php?r=${encodeURIComponent(itemName)}`;
  
  return {
    source: 'numista',
    available: true,
    query: itemName,
    totalListings: 0,
    sampleListings: [{
      title: `Search Numista for "${itemName}"`,
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