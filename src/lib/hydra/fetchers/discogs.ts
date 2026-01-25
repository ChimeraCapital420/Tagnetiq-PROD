// FILE: src/lib/hydra/fetchers/discogs.ts
// HYDRA v5.2 - Discogs API Fetcher (Vinyl Records & Music)

import type { MarketDataSource, AuthorityData } from '../types.js';

const DISCOGS_API = 'https://api.discogs.com';

export async function fetchDiscogsData(itemName: string): Promise<MarketDataSource> {
  const startTime = Date.now();
  const consumerKey = process.env.DISCOGS_CONSUMER_KEY;
  const consumerSecret = process.env.DISCOGS_CONSUMER_SECRET;
  const userToken = process.env.DISCOGS_USER_TOKEN;
  
  if (!userToken && !consumerKey) {
    console.log('⚠️ Discogs credentials not configured');
    return createFallbackResult(itemName);
  }
  
  try {
    // Build search query
    const searchQuery = cleanMusicQuery(itemName);
    console.log(`🔍 Discogs search: "${searchQuery}"`);
    
    // Build auth header
    const authHeader = userToken 
      ? `Discogs token=${userToken}`
      : `Discogs key=${consumerKey}, secret=${consumerSecret}`;
    
    // Search for releases
    const searchUrl = `${DISCOGS_API}/database/search?q=${encodeURIComponent(searchQuery)}&type=release&per_page=10`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'TagnetIQ-HYDRA/5.2',
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`❌ Discogs API error: ${response.status}`);
      return createFallbackResult(itemName);
    }
    
    const data = await response.json();
    const releases = data.results || [];
    
    if (releases.length === 0) {
      console.log('⚠️ Discogs: No matching releases found');
      return {
        source: 'discogs',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: 'No matching vinyl/music found',
      };
    }
    
    // Get the best match
    const bestMatch = releases[0];
    console.log(`✅ Discogs: Found "${bestMatch.title}" (ID: ${bestMatch.id})`);
    
    // Fetch detailed release info and pricing
    const releaseDetails = await fetchReleaseDetails(bestMatch.id, authHeader);
    const priceData = await fetchPriceStats(bestMatch.id, authHeader);
    
    // Build authority data
    const authorityData: AuthorityData = {
      source: 'discogs',
      verified: true,
      confidence: calculateMatchConfidence(itemName, bestMatch.title),
      itemDetails: {
        discogsId: bestMatch.id,
        title: bestMatch.title,
        type: bestMatch.type,
        year: bestMatch.year,
        country: bestMatch.country,
        format: bestMatch.format,
        label: bestMatch.label,
        genre: bestMatch.genre,
        style: bestMatch.style,
        catno: bestMatch.catno,
        barcode: bestMatch.barcode,
        thumb: bestMatch.thumb,
        coverImage: bestMatch.cover_image,
        resourceUrl: bestMatch.resource_url,
        uri: bestMatch.uri,
        masterUrl: bestMatch.master_url,
        ...releaseDetails,
      },
      priceData: priceData || undefined,
      externalUrl: `https://www.discogs.com/release/${bestMatch.id}`,
      lastUpdated: new Date().toISOString(),
    };
    
    // Build sample listings
    const sampleListings = releases.slice(0, 5).map((release: any) => ({
      title: `${release.title} (${release.year || 'Unknown'})`,
      price: 0, // Discogs search doesn't include prices
      condition: release.format?.join(', ') || 'Unknown Format',
      url: `https://www.discogs.com/release/${release.id}`,
    }));
    
    console.log(`✅ Discogs: Authority data retrieved in ${Date.now() - startTime}ms`);
    
    return {
      source: 'discogs',
      available: true,
      query: searchQuery,
      totalListings: data.pagination?.items || releases.length,
      priceAnalysis: priceData ? {
        lowest: priceData.lowest,
        highest: priceData.highest,
        average: priceData.median,
        median: priceData.median,
      } : undefined,
      suggestedPrices: priceData ? {
        goodDeal: parseFloat((priceData.lowest * 1.1).toFixed(2)),
        fairMarket: priceData.median,
        sellPrice: parseFloat((priceData.median * 1.2).toFixed(2)),
      } : undefined,
      sampleListings,
      authorityData,
      metadata: {
        responseTime: Date.now() - startTime,
        totalReleases: data.pagination?.items,
        bestMatchId: bestMatch.id,
        format: bestMatch.format,
      },
    };
    
  } catch (error) {
    console.error('❌ Discogs fetch error:', error);
    return {
      source: 'discogs',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function fetchReleaseDetails(releaseId: number, authHeader: string): Promise<any> {
  try {
    const response = await fetch(`${DISCOGS_API}/releases/${releaseId}`, {
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'TagnetIQ-HYDRA/5.2',
      },
    });
    
    if (!response.ok) return {};
    
    const data = await response.json();
    return {
      artists: data.artists?.map((a: any) => a.name),
      tracklist: data.tracklist?.length,
      released: data.released,
      notes: data.notes?.substring(0, 300),
      community: {
        have: data.community?.have,
        want: data.community?.want,
        rating: data.community?.rating?.average,
      },
    };
  } catch {
    return {};
  }
}

async function fetchPriceStats(releaseId: number, authHeader: string): Promise<{ lowest: number; median: number; highest: number } | null> {
  try {
    const response = await fetch(`${DISCOGS_API}/marketplace/price_suggestions/${releaseId}`, {
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'TagnetIQ-HYDRA/5.2',
      },
    });
    
    if (!response.ok) {
      // Try to get stats from marketplace listings instead
      return await fetchMarketplaceStats(releaseId, authHeader);
    }
    
    const data = await response.json();
    
    // Extract prices from different conditions
    const prices: number[] = [];
    const conditions = ['Mint (M)', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good Plus (G+)', 'Good (G)'];
    
    for (const condition of conditions) {
      if (data[condition]?.value) {
        prices.push(data[condition].value);
      }
    }
    
    if (prices.length === 0) return null;
    
    return {
      lowest: Math.min(...prices),
      median: prices[Math.floor(prices.length / 2)],
      highest: Math.max(...prices),
    };
  } catch {
    return null;
  }
}

async function fetchMarketplaceStats(releaseId: number, authHeader: string): Promise<{ lowest: number; median: number; highest: number } | null> {
  try {
    const response = await fetch(`${DISCOGS_API}/marketplace/stats/${releaseId}`, {
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'TagnetIQ-HYDRA/5.2',
      },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.lowest_price?.value) {
      return {
        lowest: data.lowest_price.value,
        median: data.median_price?.value || data.lowest_price.value * 1.5,
        highest: data.highest_price?.value || data.lowest_price.value * 3,
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

function cleanMusicQuery(itemName: string): string {
  return itemName
    .replace(/\b(vinyl|record|lp|album|12"|7"|45 rpm|33 rpm)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateMatchConfidence(searchTerm: string, title: string): number {
  const searchLower = searchTerm.toLowerCase();
  const titleLower = title.toLowerCase();
  
  // Check for exact match
  if (titleLower === searchLower) return 0.98;
  
  // Check for title containment
  if (titleLower.includes(searchLower) || searchLower.includes(titleLower)) {
    return 0.85;
  }
  
  // Check word overlap
  const searchWords = searchLower.split(/[\s\-]+/).filter(w => w.length > 2);
  const titleWords = titleLower.split(/[\s\-]+/).filter(w => w.length > 2);
  const overlap = searchWords.filter(w => titleWords.some(t => t.includes(w) || w.includes(t)));
  
  return Math.min(0.5 + (overlap.length / Math.max(searchWords.length, 1)) * 0.4, 0.90);
}

function createFallbackResult(itemName: string): MarketDataSource {
  const searchUrl = `https://www.discogs.com/search/?q=${encodeURIComponent(itemName)}&type=release`;
  
  return {
    source: 'discogs',
    available: true,
    query: itemName,
    totalListings: 0,
    sampleListings: [{
      title: `Search Discogs for "${itemName}"`,
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