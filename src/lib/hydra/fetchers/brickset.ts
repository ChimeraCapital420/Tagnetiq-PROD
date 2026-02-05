// FILE: src/lib/hydra/fetchers/brickset.ts
// HYDRA v7.1 - Brickset API Fetcher (LEGO Sets)
// FIXED v7.0: Now properly authenticates with userHash before API calls
// FIXED v7.1: Set numbers must include variant (e.g., "8011-1" not "8011")
// The Brickset v3 API requires: 1) login to get userHash, 2) then call getSets with userHash

import type { MarketDataSource, AuthorityData } from '../types.js';

const BRICKSET_API = 'https://brickset.com/api/v3.asmx';

// Cache userHash for 1 hour to avoid repeated logins
let cachedUserHash: string | null = null;
let userHashExpiry: number = 0;

// ==================== MAIN FETCHER ====================

export async function fetchBricksetData(itemName: string): Promise<MarketDataSource> {
  const startTime = Date.now();
  const apiKey = process.env.BRICKSET_API_KEY;
  const username = process.env.BRICKSET_USERNAME;
  const password = process.env.BRICKSET_PASSWORD;
  
  if (!apiKey) {
    console.log('⚠️ Brickset: API key not configured');
    return createFallbackResult(itemName, startTime, 'API key not configured');
  }
  
  if (!username || !password) {
    console.log('⚠️ Brickset: Username/password not configured');
    return createFallbackResult(itemName, startTime, 'Login credentials not configured');
  }
  
  try {
    // Step 1: Get userHash (login if needed)
    const userHash = await getBricksetUserHash(apiKey, username, password);
    
    if (!userHash) {
      console.error('❌ Brickset: Failed to authenticate');
      return createFallbackResult(itemName, startTime, 'Authentication failed');
    }
    
    // Step 2: Extract set number if present
    const setNumber = extractSetNumber(itemName);
    const searchQuery = setNumber || cleanLegoName(itemName);
    console.log(`🔍 Brickset search: "${searchQuery}" (set#: ${setNumber || 'none'})`);
    
    // Step 3: Build search parameters as JSON
    const searchParams: Record<string, any> = {
      pageSize: 10,
      orderBy: 'YearFromDESC',
    };
    
    if (setNumber) {
      // Brickset requires full set number with variant (e.g., "8011-1" not "8011")
      // Most sets are variant 1, so append -1 if not present
      const fullSetNumber = setNumber.includes('-') ? setNumber : `${setNumber}-1`;
      searchParams.setNumber = fullSetNumber;
      console.log(`🔍 Brickset: Using full set number "${fullSetNumber}"`);
    } else {
      searchParams.query = searchQuery;
    }
    
    // Step 4: Execute search with proper authentication
    const searchUrl = `${BRICKSET_API}/getSets?apiKey=${encodeURIComponent(apiKey)}&userHash=${encodeURIComponent(userHash)}&params=${encodeURIComponent(JSON.stringify(searchParams))}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`❌ Brickset API error: ${response.status}`);
      return createFallbackResult(itemName, startTime, `API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      console.error(`❌ Brickset: ${data.message || 'Unknown error'}`);
      return createFallbackResult(itemName, startTime, data.message || 'Search failed');
    }
    
    const sets = data.sets || [];
    
    // If no results with setNumber, try query search as fallback
    if (sets.length === 0 && setNumber) {
      console.log('⚠️ Brickset: No results with setNumber, trying query search...');
      
      const fallbackParams = {
        pageSize: 10,
        query: itemName.replace(/\b(lego|set)\b/gi, '').trim(),
      };
      
      const fallbackUrl = `${BRICKSET_API}/getSets?apiKey=${encodeURIComponent(apiKey)}&userHash=${encodeURIComponent(userHash)}&params=${encodeURIComponent(JSON.stringify(fallbackParams))}`;
      
      const fallbackResponse = await fetch(fallbackUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.status === 'success' && fallbackData.sets?.length > 0) {
          console.log(`✅ Brickset: Fallback query found ${fallbackData.sets.length} results`);
          sets.push(...fallbackData.sets);
        }
      }
    }
    
    if (sets.length === 0) {
      console.log('⚠️ Brickset: No matching sets found');
      return {
        source: 'brickset',
        available: false,
        responseTime: Date.now() - startTime,
        query: searchQuery,
        totalResults: 0,
        error: 'No matching LEGO sets found',
      };
    }
    
    // Get the best match
    const bestMatch = sets[0];
    const responseTime = Date.now() - startTime;
    const displayName = `${bestMatch.name} (${bestMatch.number}${bestMatch.numberVariant > 1 ? `-${bestMatch.numberVariant}` : ''})`;
    
    console.log(`✅ Brickset: Found "${displayName}" in ${responseTime}ms`);
    
    // Extract price data
    const priceData = extractPriceData(bestMatch);
    
    // Build authority data
    const authorityData: AuthorityData = {
      source: 'brickset',
      verified: true,
      confidence: calculateMatchConfidence(itemName, bestMatch.name, bestMatch.number),
      externalUrl: bestMatch.bricksetURL,
      
      // Brickset-specific fields
      bricksetId: bestMatch.setID,
      setNumber: `${bestMatch.number}${bestMatch.numberVariant > 1 ? `-${bestMatch.numberVariant}` : ''}`,
      year: bestMatch.year,
      theme: bestMatch.theme,
      themeGroup: bestMatch.themeGroup,
      subtheme: bestMatch.subtheme,
      pieces: bestMatch.pieces,
      minifigs: bestMatch.minifigs,
      ageRange: bestMatch.ageRange ? `${bestMatch.ageRange.min || '?'}-${bestMatch.ageRange.max || '?'}` : undefined,
      packagingType: bestMatch.packagingType,
      availability: bestMatch.availability,
      
      // Pricing
      rrp: priceData?.retail,
      pricePerPiece: bestMatch.pieces && priceData?.retail 
        ? parseFloat((priceData.retail / bestMatch.pieces).toFixed(3)) 
        : undefined,
      
      // Market value range
      marketValue: priceData ? {
        low: `$${priceData.used.toFixed(2)}`,
        mid: `$${priceData.retail.toFixed(2)}`,
        high: `$${priceData.new.toFixed(2)}`,
      } : undefined,
      
      // Images
      imageLinks: bestMatch.image ? {
        thumbnail: bestMatch.image.thumbnailURL,
        smallThumbnail: bestMatch.image.imageURL,
      } : undefined,
      
      // Ratings
      averageRating: bestMatch.rating,
      ratingsCount: bestMatch.reviewCount,
      
      lastUpdated: new Date().toISOString(),
    };
    
    return {
      source: 'brickset',
      available: true,
      responseTime,
      query: searchQuery,
      totalResults: data.matches || sets.length,
      
      // Price analysis from Brickset data
      priceAnalysis: priceData ? {
        median: priceData.retail,
        average: priceData.retail,
        low: priceData.used,
        high: priceData.new,
        currency: 'USD',
        sampleSize: 1,
      } : undefined,
      
      // Authority data for the report card
      authorityData,
      
      // Additional metadata
      metadata: {
        setId: bestMatch.setID,
        bricksetUrl: bestMatch.bricksetURL,
        totalSets: data.matches || sets.length,
      },
    };
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      console.error('⏱️ Brickset: Request timed out');
      return createFallbackResult(itemName, startTime, 'Request timed out');
    }
    
    console.error(`❌ Brickset error:`, error.message);
    return createFallbackResult(itemName, responseTime, error.message);
  }
}

// ==================== AUTHENTICATION ====================

/**
 * Get userHash via login (cached for 1 hour)
 */
async function getBricksetUserHash(apiKey: string, username: string, password: string): Promise<string | null> {
  // Check cache first
  if (cachedUserHash && Date.now() < userHashExpiry) {
    return cachedUserHash;
  }
  
  try {
    const loginUrl = `${BRICKSET_API}/login?apiKey=${encodeURIComponent(apiKey)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(loginUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`❌ Brickset login HTTP error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.status === 'success' && data.hash) {
      // Cache for 1 hour
      cachedUserHash = data.hash;
      userHashExpiry = Date.now() + (60 * 60 * 1000);
      console.log('🔑 Brickset: Login successful, userHash cached');
      return data.hash;
    }
    
    console.error('❌ Brickset login failed:', data.message);
    return null;
    
  } catch (error: any) {
    console.error('❌ Brickset login error:', error.message);
    return null;
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract LEGO set number from item name
 */
function extractSetNumber(itemName: string): string | null {
  // Look for LEGO set numbers (usually 4-6 digits)
  const patterns = [
    /\b(\d{4,6})\b/,           // Plain number like "75192"
    /set\s*#?\s*(\d{4,6})/i,   // "set #75192"
    /\b(\d{4,6})-\d\b/,        // "75192-1" format
    /#(\d{4,6})/,              // "#75192"
  ];
  
  for (const pattern of patterns) {
    const match = itemName.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Clean up LEGO item name for search
 */
function cleanLegoName(itemName: string): string {
  return itemName
    .replace(/\b(lego|legos|set|#)\b/gi, '')
    .replace(/\b\d{4,6}(-\d)?\b/g, '') // Remove set numbers
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract price data from Brickset set
 */
function extractPriceData(set: any): { retail: number; new: number; used: number } | null {
  // Get retail price (prefer US, fallback to UK with conversion)
  const usRetail = set.LEGOCom?.US?.retailPrice;
  const ukRetail = set.LEGOCom?.UK?.retailPrice;
  const retail = usRetail || (ukRetail ? ukRetail * 1.25 : 0); // Approximate GBP to USD
  
  // Estimate new/used prices based on typical LEGO market patterns
  // Retired sets typically sell for 1.5-2x retail when new
  // Used sets typically sell for 0.5-0.7x retail
  const isRetired = set.availability === 'Retired' || set.LEGOCom?.US?.dateLastAvailable;
  const yearsOld = new Date().getFullYear() - (set.year || 2020);
  
  let newMultiplier = 1.0;
  let usedMultiplier = 0.6;
  
  if (isRetired || yearsOld > 2) {
    // Retired sets appreciate
    newMultiplier = Math.min(1.0 + (yearsOld * 0.15), 3.0);
    usedMultiplier = Math.min(0.6 + (yearsOld * 0.1), 1.5);
  }
  
  const newPrice = retail * newMultiplier;
  const usedPrice = retail * usedMultiplier;
  
  if (retail > 0 || newPrice > 0 || usedPrice > 0) {
    return {
      retail: parseFloat(retail.toFixed(2)),
      new: parseFloat(newPrice.toFixed(2)),
      used: parseFloat(usedPrice.toFixed(2)),
    };
  }
  
  return null;
}

/**
 * Calculate match confidence
 */
function calculateMatchConfidence(searchTerm: string, setName: string, setNumber: string): number {
  const searchLower = searchTerm.toLowerCase();
  
  // Set number match = very high confidence
  if (setNumber && searchLower.includes(setNumber)) {
    return 0.98;
  }
  
  // Exact name match
  const nameLower = setName.toLowerCase();
  if (nameLower === searchLower || searchLower.includes(nameLower)) {
    return 0.90;
  }
  
  // Word overlap scoring
  const searchWords = searchLower.split(/\s+/).filter(w => w.length > 2);
  const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2);
  const overlap = searchWords.filter(w => nameWords.some(n => n.includes(w) || w.includes(n)));
  
  return Math.min(0.5 + (overlap.length / Math.max(searchWords.length, 1)) * 0.4, 0.85);
}

/**
 * Create fallback result for error cases
 */
function createFallbackResult(itemName: string, startTime: number, error: string): MarketDataSource {
  const setNumber = extractSetNumber(itemName);
  const searchUrl = setNumber 
    ? `https://brickset.com/sets/${setNumber}`
    : `https://brickset.com/sets?query=${encodeURIComponent(itemName)}`;
  
  return {
    source: 'brickset',
    available: false,
    responseTime: Date.now() - startTime,
    query: itemName,
    totalResults: 0,
    error,
    metadata: {
      fallback: true,
      searchUrl,
    },
  };
}

// ==================== HEALTH CHECK ====================

export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  error?: string;
}> {
  const apiKey = process.env.BRICKSET_API_KEY;
  
  if (!apiKey) {
    return { status: 'down', error: 'API key not configured' };
  }
  
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // checkKey is the simplest endpoint to validate
    const response = await fetch(
      `${BRICKSET_API}/checkKey?apiKey=${apiKey}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    if (!response.ok) {
      return { status: 'down', latency, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      return { status: 'degraded', latency, error: data.message };
    }
    
    return { status: 'healthy', latency };
    
  } catch (error: any) {
    return {
      status: 'down',
      latency: Date.now() - startTime,
      error: error.message,
    };
  }
}

export default fetchBricksetData;