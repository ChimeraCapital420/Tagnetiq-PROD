// FILE: src/lib/hydra/fetchers/comicvine.ts
// HYDRA v7.0 - Comic Vine Fetcher for Comic Book Data
// Comic Vine provides comprehensive comic metadata (no pricing - use eBay for that)
// API Docs: https://comicvine.gamespot.com/api/documentation

import type { MarketDataSource, AuthorityData } from '../types.js';

const COMIC_VINE_API_KEY = process.env.COMIC_VINE_API_KEY;
const BASE_URL = 'https://comicvine.gamespot.com/api';

// ==================== TYPES ====================

interface ComicVineSearchResult {
  id: number;
  name: string | null;
  issue_number: string | null;
  volume?: {
    id: number;
    name: string;
    api_detail_url: string;
  };
  cover_date: string | null;
  store_date: string | null;
  image?: {
    icon_url: string;
    thumb_url: string;
    small_url: string;
    medium_url: string;
    screen_url: string;
    super_url: string;
    original_url: string;
  };
  site_detail_url: string;
  api_detail_url: string;
  deck?: string;
  description?: string;
}

interface ComicVineResponse {
  error: string;
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  status_code: number;
  results: ComicVineSearchResult[];
}

// ==================== MAIN FETCHER ====================

/**
 * Fetch comic data from Comic Vine API
 * Returns comprehensive metadata for authority card
 */
export async function fetchComicVineData(itemName: string): Promise<MarketDataSource> {
  const startTime = Date.now();
  
  // Check API key
  if (!COMIC_VINE_API_KEY) {
    console.log('⚠️ Comic Vine: API key not configured');
    return createEmptyResult('comicvine', startTime, 'API key not configured');
  }
  
  try {
    // Clean up search query - remove common words
    const searchQuery = cleanComicSearchQuery(itemName);
    console.log(`🔍 Comic Vine search: "${searchQuery}"`);
    
    // Search for the issue
    const params = new URLSearchParams({
      api_key: COMIC_VINE_API_KEY,
      format: 'json',
      query: searchQuery,
      resources: 'issue',
      limit: '5',
    });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(
      `${BASE_URL}/search/?${params}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'TagnetIQ/1.0 (Collectibles Platform)',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`❌ Comic Vine API error: ${response.status}`);
      return createEmptyResult('comicvine', startTime, `API error: ${response.status}`);
    }
    
    const data: ComicVineResponse = await response.json();
    
    if (data.error !== 'OK' || !data.results || data.results.length === 0) {
      console.log(`📭 Comic Vine: No results for "${searchQuery}"`);
      return createEmptyResult('comicvine', startTime, 'No results found');
    }
    
    // Get best matching result
    const bestMatch = findBestMatch(data.results, itemName);
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Comic Vine: Found "${bestMatch.volume?.name} #${bestMatch.issue_number}" in ${responseTime}ms`);
    
    // Build authority data
    const authorityData = buildAuthorityData(bestMatch);
    
    return {
      source: 'comicvine',
      available: true,
      responseTime,
      totalResults: data.number_of_total_results,
      
      // Comic Vine doesn't provide pricing - that's what eBay is for
      priceAnalysis: undefined,
      
      // Authority data for the report card
      authorityData,
    };
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      console.error(`⏱️ Comic Vine: Request timed out`);
      return createEmptyResult('comicvine', startTime, 'Request timed out');
    }
    
    console.error(`❌ Comic Vine error:`, error.message);
    return createEmptyResult('comicvine', responseTime, error.message);
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Clean search query for better results
 */
function cleanComicSearchQuery(itemName: string): string {
  return itemName
    .toLowerCase()
    .replace(/comic\s*book/gi, '')
    .replace(/comic/gi, '')
    .replace(/issue/gi, '')
    .replace(/first\s*appearance/gi, '')
    .replace(/1st\s*appearance/gi, '')
    .replace(/mint\s*condition/gi, '')
    .replace(/graded/gi, '')
    .replace(/cgc/gi, '')
    .replace(/cbcs/gi, '')
    .replace(/[\#\(\)\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find best matching result from search results
 */
function findBestMatch(results: ComicVineSearchResult[], itemName: string): ComicVineSearchResult {
  const nameLower = itemName.toLowerCase();
  
  // Try to find exact volume name match
  for (const result of results) {
    const volumeName = result.volume?.name?.toLowerCase() || '';
    if (nameLower.includes(volumeName) && volumeName.length > 3) {
      return result;
    }
  }
  
  // Try to find issue number match
  const issueMatch = itemName.match(/#?\s*(\d+)/);
  if (issueMatch) {
    const issueNum = issueMatch[1];
    for (const result of results) {
      if (result.issue_number === issueNum) {
        return result;
      }
    }
  }
  
  // Default to first result
  return results[0];
}

/**
 * Build authority data from Comic Vine result
 */
function buildAuthorityData(issue: ComicVineSearchResult): AuthorityData {
  // Build display name
  const issueName = issue.name
    ? `${issue.volume?.name || 'Unknown'} #${issue.issue_number} - ${issue.name}`
    : `${issue.volume?.name || 'Unknown'} #${issue.issue_number}`;
  
  return {
    source: 'Comic Vine',
    verified: true,
    externalUrl: issue.site_detail_url,
    
    // Detailed item information for the authority card
    itemDetails: {
      // Basic info
      comicVineId: issue.id,
      name: issueName,
      issueName: issue.name,
      issueNumber: issue.issue_number,
      
      // Volume/Series info
      volumeName: issue.volume?.name,
      volumeId: issue.volume?.id,
      
      // Dates
      coverDate: issue.cover_date,
      storeDate: issue.store_date,
      
      // Description
      deck: issue.deck,
      
      // Images
      imageLinks: issue.image ? {
        icon: issue.image.icon_url,
        thumbnail: issue.image.thumb_url,
        small: issue.image.small_url,
        medium: issue.image.medium_url,
        large: issue.image.super_url,
        original: issue.image.original_url,
      } : undefined,
      
      // Links
      comicVineUrl: issue.site_detail_url,
      apiUrl: issue.api_detail_url,
    },
    
    // No market value from Comic Vine (use eBay for pricing)
    marketValue: undefined,
    
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Create empty result for error cases
 */
function createEmptyResult(source: string, startTime: number, error: string): MarketDataSource {
  return {
    source,
    available: false,
    responseTime: Date.now() - startTime,
    error,
  };
}

// ==================== HEALTH CHECK ====================

/**
 * Health check for Comic Vine API
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  error?: string;
}> {
  if (!COMIC_VINE_API_KEY) {
    return { status: 'down', error: 'API key not configured' };
  }
  
  const startTime = Date.now();
  
  try {
    const params = new URLSearchParams({
      api_key: COMIC_VINE_API_KEY,
      format: 'json',
      query: 'batman',
      resources: 'issue',
      limit: '1',
    });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(
      `${BASE_URL}/search/?${params}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'TagnetIQ/1.0 (Health Check)',
        },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    if (!response.ok) {
      return { status: 'down', latency, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    if (data.error !== 'OK') {
      return { status: 'degraded', latency, error: data.error };
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

export default fetchComicVineData;