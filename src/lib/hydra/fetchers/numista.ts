// FILE: src/lib/hydra/fetchers/numista.ts
// HYDRA v6.3 - Numista Authority Data Fetcher (Coins & Banknotes)
// FIXED v6.3: Better US coin detection, don't strip denominations, filter by issuer

import type { MarketDataSource, AuthorityData } from '../types.js';

const NUMISTA_API_BASE = 'https://api.numista.com/api/v3';

// US coin patterns - when these are detected, add "United States" to search
const US_COIN_PATTERNS = [
  // Presidents/Figures on US coins
  { pattern: /\bwashington\b/i, denomination: 'quarter' },
  { pattern: /\blincoln\b/i, denomination: 'cent' },
  { pattern: /\bjefferson\b/i, denomination: 'nickel' },
  { pattern: /\broosevelt\b/i, denomination: 'dime' },
  { pattern: /\bkennedy\b/i, denomination: 'half dollar' },
  { pattern: /\beisenhower\b/i, denomination: 'dollar' },
  { pattern: /\bsacagawea\b/i, denomination: 'dollar' },
  { pattern: /\bsusan\s*b\.?\s*anthony\b/i, denomination: 'dollar' },
  { pattern: /\bmorgan\b/i, denomination: 'dollar' },
  { pattern: /\bpeace\s+dollar\b/i, denomination: 'dollar' },
  { pattern: /\bwalking\s+liberty\b/i, denomination: 'half dollar' },
  { pattern: /\bstanding\s+liberty\b/i, denomination: 'quarter' },
  { pattern: /\bseated\s+liberty\b/i, denomination: null },
  { pattern: /\bbarber\b/i, denomination: null },
  { pattern: /\bmercury\b/i, denomination: 'dime' },
  { pattern: /\bbuffalo\b/i, denomination: 'nickel' },
  { pattern: /\bindian\s+head\b/i, denomination: null },
  { pattern: /\bwheat\b/i, denomination: 'cent' },
  { pattern: /\bflying\s+eagle\b/i, denomination: 'cent' },
  { pattern: /\btrade\s+dollar\b/i, denomination: 'dollar' },
  
  // US-specific terms
  { pattern: /\bbicentennial\b/i, denomination: null },
  { pattern: /\bstate\s+quarter\b/i, denomination: 'quarter' },
  { pattern: /\bnational\s+park\b/i, denomination: 'quarter' },
  { pattern: /\bamerica\s+the\s+beautiful\b/i, denomination: 'quarter' },
  
  // Explicit US mentions
  { pattern: /\bunited\s+states\b/i, denomination: null },
  { pattern: /\bu\.?s\.?\s+(mint|coin)\b/i, denomination: null },
  { pattern: /\bamerican\s+(eagle|buffalo)\b/i, denomination: null },
];

// Numista issuer ID for United States
const US_ISSUER_ID = 34; // United States of America

export async function fetchNumistaData(itemName: string, category?: string): Promise<MarketDataSource> {
  const startTime = Date.now();
  const apiKey = process.env.NUMISTA_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️ Numista API key not configured');
    return createFallbackResult(itemName);
  }
  
  try {
    // Detect if this is likely a US coin
    const usContext = detectUSCoinContext(itemName);
    
    // Extract search terms from item name
    const searchQuery = buildNumistaQuery(itemName, usContext);
    console.log(`🔍 Numista search: "${searchQuery}"${usContext.isUSCoin ? ' (US coin detected)' : ''}`);
    
    // Determine category filter
    const categoryFilter = category === 'banknotes' ? 'banknote' : 'coin';
    
    // Build search URL - add issuer filter for US coins
    let searchUrl = `${NUMISTA_API_BASE}/types?q=${encodeURIComponent(searchQuery)}&category=${categoryFilter}&count=20&lang=en`;
    
    // If we're confident it's a US coin, filter by issuer
    if (usContext.isUSCoin && usContext.confidence > 0.7) {
      searchUrl += `&issuer=${US_ISSUER_ID}`;
      console.log(`🇺🇸 Filtering by US issuer (confidence: ${(usContext.confidence * 100).toFixed(0)}%)`);
    }
    
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
    let types = data.types || [];
    
    if (types.length === 0) {
      // If US filter returned nothing, try without filter
      if (usContext.isUSCoin) {
        console.log('⚠️ No US coins found, trying broader search...');
        const broadUrl = `${NUMISTA_API_BASE}/types?q=${encodeURIComponent(searchQuery)}&category=${categoryFilter}&count=20&lang=en`;
        const broadResponse = await fetch(broadUrl, {
          method: 'GET',
          headers: { 'Numista-API-Key': apiKey, 'Accept': 'application/json' },
        });
        if (broadResponse.ok) {
          const broadData = await broadResponse.json();
          types = broadData.types || [];
        }
      }
      
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
    }
    
    // Score and rank results
    const scoredTypes = types.map((type: any) => ({
      ...type,
      matchScore: calculateMatchScore(itemName, type, usContext),
    }));
    
    // Sort by match score
    scoredTypes.sort((a: any, b: any) => b.matchScore - a.matchScore);
    
    // Get the best match
    const bestMatch = scoredTypes[0];
    
    // Validate the match makes sense
    if (usContext.isUSCoin && bestMatch.issuer?.name && 
        !bestMatch.issuer.name.toLowerCase().includes('united states') &&
        !bestMatch.issuer.name.toLowerCase().includes('usa')) {
      console.warn(`⚠️ Numista: Best match "${bestMatch.title}" is from ${bestMatch.issuer.name}, not US`);
      
      // Try to find a US match in the results
      const usMatch = scoredTypes.find((t: any) => 
        t.issuer?.name?.toLowerCase().includes('united states') ||
        t.issuer?.name?.toLowerCase().includes('usa')
      );
      
      if (usMatch) {
        console.log(`🇺🇸 Found US match: "${usMatch.title}"`);
        Object.assign(bestMatch, usMatch);
      }
    }
    
    console.log(`✅ Numista: Found "${bestMatch.title}" (ID: ${bestMatch.id})${bestMatch.issuer?.name ? ` from ${bestMatch.issuer.name}` : ''}`);
    
    // Fetch detailed type information
    const typeDetails = await fetchTypeDetails(bestMatch.id, apiKey);
    
    // Fetch price estimates if available
    const priceData = await fetchPriceEstimates(bestMatch.id, apiKey);
    
    // Build authority data
    const authorityData: AuthorityData = {
      source: 'numista',
      verified: true,
      confidence: calculateMatchConfidence(itemName, bestMatch.title, bestMatch.issuer?.name, usContext),
      itemDetails: {
        numistaId: bestMatch.id,
        title: bestMatch.title,
        category: bestMatch.category,
        issuer: bestMatch.issuer?.name,
        issuerId: bestMatch.issuer?.id,
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
    const sampleListings = scoredTypes.slice(0, 5).map((type: any) => ({
      title: `${type.title}${type.issuer?.name ? ` (${type.issuer.name})` : ''}`,
      price: 0,
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
        usContextDetected: usContext.isUSCoin,
        issuer: bestMatch.issuer?.name,
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

/**
 * Detect if the item is likely a US coin
 */
function detectUSCoinContext(itemName: string): { isUSCoin: boolean; confidence: number; denomination: string | null } {
  const nameLower = itemName.toLowerCase();
  let confidence = 0;
  let denomination: string | null = null;
  
  // Check for US coin patterns
  for (const pattern of US_COIN_PATTERNS) {
    if (pattern.pattern.test(itemName)) {
      confidence += 0.3;
      if (pattern.denomination && !denomination) {
        denomination = pattern.denomination;
      }
    }
  }
  
  // Check for explicit US denominations
  if (/\b(cent|penny|nickel|dime|quarter|half\s*dollar|dollar)\b/i.test(nameLower)) {
    confidence += 0.2;
  }
  
  // Check for US currency symbols
  if (/\$|USD/i.test(itemName)) {
    confidence += 0.1;
  }
  
  // Check for years that suggest US coinage
  const yearMatch = itemName.match(/\b(1[7-9]\d{2}|20[0-2]\d)\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    // US coins started in 1792
    if (year >= 1792 && year <= new Date().getFullYear()) {
      confidence += 0.1;
    }
  }
  
  // Cap confidence at 0.95
  confidence = Math.min(confidence, 0.95);
  
  return {
    isUSCoin: confidence > 0.3,
    confidence,
    denomination,
  };
}

/**
 * Build search query - FIXED: Don't strip denominations, add US context when appropriate
 */
function buildNumistaQuery(itemName: string, usContext: { isUSCoin: boolean; denomination: string | null }): string {
  let query = itemName
    // Remove grading terms (but NOT denominations)
    .replace(/\b(graded|certified|pcgs|ngc|anacs|icg)\b/gi, '')
    .replace(/\b(ms|pr|pf|au|xf|vf|f|vg|g)\s*[-]?\s*\d+/gi, '')
    // Remove generic words
    .replace(/\b(coin|commemorative|rare|vintage|antique|collectible)\b/gi, '')
    // Remove extra punctuation
    .replace(/[#()[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // If US coin detected but "United States" not in query, consider adding context
  // But only for the issuer filter, not the text query (to avoid over-constraining)
  
  // Keep denomination in query - it's important!
  // The old code was stripping "quarter", "nickel", etc. which caused bad matches
  
  return query || itemName;
}

/**
 * Calculate how well a result matches the search
 */
function calculateMatchScore(searchTerm: string, result: any, usContext: { isUSCoin: boolean; confidence: number }): number {
  let score = 0;
  const searchLower = searchTerm.toLowerCase();
  const titleLower = (result.title || '').toLowerCase();
  const issuerLower = (result.issuer?.name || '').toLowerCase();
  
  // Issuer match bonus (big bonus for correct country)
  if (usContext.isUSCoin) {
    if (issuerLower.includes('united states') || issuerLower.includes('usa')) {
      score += 50; // Big bonus for US match when we expect US
    } else {
      score -= 30; // Penalty for non-US when we expect US
    }
  }
  
  // Year match
  const searchYear = searchTerm.match(/\b(1[7-9]\d{2}|20[0-2]\d)\b/);
  if (searchYear) {
    const year = parseInt(searchYear[1]);
    if (result.min_year && result.max_year) {
      if (year >= result.min_year && year <= result.max_year) {
        score += 20;
      }
    } else if (titleLower.includes(searchYear[1])) {
      score += 20;
    }
  }
  
  // Title word matches
  const searchWords = searchLower.split(/\s+/).filter(w => w.length > 2);
  for (const word of searchWords) {
    if (titleLower.includes(word)) {
      score += 5;
    }
  }
  
  // Denomination match
  const denominations = ['cent', 'penny', 'nickel', 'dime', 'quarter', 'half dollar', 'dollar'];
  for (const denom of denominations) {
    if (searchLower.includes(denom) && titleLower.includes(denom)) {
      score += 15;
    }
  }
  
  // President/figure match
  const figures = ['washington', 'lincoln', 'jefferson', 'roosevelt', 'kennedy', 'eisenhower', 'morgan', 'peace', 'buffalo', 'mercury'];
  for (const figure of figures) {
    if (searchLower.includes(figure) && titleLower.includes(figure)) {
      score += 20;
    }
  }
  
  return score;
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

/**
 * Calculate confidence in the match - FIXED: Consider issuer match
 */
function calculateMatchConfidence(
  searchTerm: string, 
  matchTitle: string, 
  issuerName: string | undefined,
  usContext: { isUSCoin: boolean; confidence: number }
): number {
  const searchLower = searchTerm.toLowerCase();
  const matchLower = matchTitle.toLowerCase();
  
  let confidence = 0.5; // Base confidence
  
  // Check for exact match
  if (searchLower === matchLower) {
    confidence = 0.99;
  } else {
    // Check word overlap
    const searchWords = searchLower.split(/\s+/).filter(w => w.length > 2);
    const matchWords = matchLower.split(/\s+/);
    const overlap = searchWords.filter(w => matchWords.some(m => m.includes(w) || w.includes(m)));
    confidence += (overlap.length / Math.max(searchWords.length, 1)) * 0.3;
  }
  
  // Issuer match bonus/penalty
  if (usContext.isUSCoin && issuerName) {
    const issuerLower = issuerName.toLowerCase();
    if (issuerLower.includes('united states') || issuerLower.includes('usa')) {
      confidence += 0.15; // Bonus for correct country
    } else {
      confidence -= 0.25; // Penalty for wrong country
    }
  }
  
  // Cap confidence
  return Math.max(0.1, Math.min(confidence, 0.95));
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