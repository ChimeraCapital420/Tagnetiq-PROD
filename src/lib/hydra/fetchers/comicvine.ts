// FILE: src/lib/hydra/fetchers/comicvine.ts
// HYDRA v7.0 - Comic Vine Fetcher for Comic Book Data
// Comic Vine provides comprehensive comic metadata (no pricing - use eBay for that)
// API Docs: https://comicvine.gamespot.com/api/documentation
// ENHANCED v7.0: Now fetches full issue details after search for richer authority data
// FIXED v7.5: Better issue number matching, warns when exact issue not found
// FIXED v7.6: Year-aware matching — 1978 Star Wars #18 no longer matches 2015 reboot

import type { MarketDataSource, AuthorityData } from '../types.js';

const COMIC_VINE_API_KEY = process.env.COMIC_VINE_API_KEY;
const BASE_URL = 'https://comicvine.gamespot.com/api';

// ==================== TYPES ====================

interface ComicVineCredit {
  id: number;
  name: string;
  role: string;
  api_detail_url: string;
  site_detail_url: string;
}

interface ComicVineCharacter {
  id: number;
  name: string;
  api_detail_url: string;
  site_detail_url: string;
}

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
  // Full details (from issue endpoint)
  person_credits?: ComicVineCredit[];
  character_credits?: ComicVineCharacter[];
  first_appearance_characters?: ComicVineCharacter[];
  first_appearance_teams?: any[];
  character_died_in?: ComicVineCharacter[];  // ADDED v7.5
  story_arc_credits?: any[];
}

interface ComicVineResponse {
  error: string;
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  status_code: number;
  results: ComicVineSearchResult[] | ComicVineSearchResult;
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
    // Clean up search query - remove common words, extract issue number
    // FIXED v7.6: Now also extracts coverYear for era-matching
    const { searchQuery, issueNumber, coverYear } = parseComicSearchQuery(itemName);
    console.log(`🔍 Comic Vine search: "${searchQuery}"${issueNumber ? ` (issue #${issueNumber})` : ''}${coverYear ? ` (year ${coverYear})` : ''}`);
    
    // Search for the issue - FIXED v7.5: Get more results to find exact match
    const params = new URLSearchParams({
      api_key: COMIC_VINE_API_KEY,
      format: 'json',
      query: searchQuery,
      resources: 'issue',
      limit: '20',  // CHANGED from 10 to 20 for better matching
    });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
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
    
    if (data.error !== 'OK' || !data.results || (Array.isArray(data.results) && data.results.length === 0)) {
      console.log(`📭 Comic Vine: No results for "${searchQuery}"`);
      return createEmptyResult('comicvine', startTime, 'No results found');
    }
    
    // Get best matching result - FIXED v7.5: Now returns exactIssueMatch flag
    // FIXED v7.6: Now passes coverYear for era-aware matching
    const results = Array.isArray(data.results) ? data.results : [data.results];
    const { bestMatch, exactIssueMatch } = findBestMatch(results, itemName, issueNumber, coverYear);
    
    // FIXED v7.5: Warn if we couldn't find exact issue
    if (issueNumber && !exactIssueMatch) {
      console.warn(`⚠️ Comic Vine: Requested issue #${issueNumber} not found, returning best match: #${bestMatch.issue_number}`);
    }
    
    // Fetch full issue details for richer data
    const fullDetails = await fetchIssueDetails(bestMatch.id);
    const issueData = fullDetails || bestMatch;
    
    const responseTime = Date.now() - startTime;
    const displayName = buildDisplayName(issueData);
    
    console.log(`✅ Comic Vine: Found "${displayName}" in ${responseTime}ms`);
    
    // Build authority data with full details - FIXED v7.5: Pass match quality
    const authorityData = buildAuthorityData(issueData, exactIssueMatch, issueNumber);
    
    return {
      source: 'comicvine',
      available: true,
      responseTime,
      totalResults: data.number_of_total_results,
      
      // Comic Vine doesn't provide pricing - that's what eBay is for
      priceAnalysis: undefined,
      
      // Rich authority data for the report card
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

// ==================== FETCH FULL ISSUE DETAILS ====================

/**
 * Fetch full issue details by ID for richer data
 * This gets credits, characters, first appearances, etc.
 */
async function fetchIssueDetails(issueId: number): Promise<ComicVineSearchResult | null> {
  if (!COMIC_VINE_API_KEY) return null;
  
  try {
    const params = new URLSearchParams({
      api_key: COMIC_VINE_API_KEY,
      format: 'json',
      field_list: [
        'id', 'name', 'issue_number', 'volume', 'cover_date', 'store_date',
        'image', 'description', 'deck', 'site_detail_url', 'api_detail_url',
        'person_credits', 'character_credits', 'team_credits',
        'story_arc_credits', 'first_appearance_characters',
        'first_appearance_teams', 'first_appearance_concepts',
        'first_appearance_locations', 'first_appearance_objects',
        'character_died_in'  // ADDED v7.5
      ].join(',')
    });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(
      `${BASE_URL}/issue/4000-${issueId}/?${params}`,
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
    
    if (!response.ok) return null;
    
    const data: ComicVineResponse = await response.json();
    
    if (data.error !== 'OK' || !data.results) return null;
    
    return data.results as ComicVineSearchResult;
    
  } catch (error) {
    // Silently fail - we still have search results
    return null;
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse search query and extract issue number + year
 * FIXED v7.6: Now extracts coverYear for era-matching
 */
function parseComicSearchQuery(itemName: string): { searchQuery: string; issueNumber: string | null; coverYear: string | null } {
  const nameLower = itemName.toLowerCase();
  
  // Extract issue number patterns: #18, #1, issue 18, no. 18, etc.
  const issuePatterns = [
    /#(\d+)/,
    /issue\s*(\d+)/i,
    /no\.?\s*(\d+)/i,
    /number\s*(\d+)/i,
  ];
  
  let issueNumber: string | null = null;
  for (const pattern of issuePatterns) {
    const match = itemName.match(pattern);
    if (match) {
      issueNumber = match[1];
      break;
    }
  }
  
  // Clean up search query
  let searchQuery = itemName
    .toLowerCase()
    .replace(/comic\s*book/gi, '')
    .replace(/comic/gi, '')
    .replace(/issue\s*\d+/gi, '')
    .replace(/no\.?\s*\d+/gi, '')
    .replace(/#\d+/g, '')
    .replace(/first\s*appearance/gi, '')
    .replace(/1st\s*appearance/gi, '')
    .replace(/mint\s*condition/gi, '')
    .replace(/graded/gi, '')
    .replace(/cgc\s*\d+\.?\d*/gi, '')
    .replace(/cbcs\s*\d+\.?\d*/gi, '')
    .replace(/[\(\)\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // If we have an issue number, append it to help search
  if (issueNumber) {
    searchQuery = `${searchQuery} ${issueNumber}`.trim();
  }
  
  // FIXED v7.6: Extract year for era-matching (1978 Marvel vs 2015 Marvel Star Wars)
  let coverYear: string | null = null;
  const yearMatch = itemName.match(/\b(19[4-9]\d|20[0-2]\d)\b/);
  if (yearMatch) {
    coverYear = yearMatch[1];
  }
  
  return { searchQuery, issueNumber, coverYear };
}

/**
 * Find best matching result from search results
 * FIXED v7.5: Now returns exactIssueMatch flag to track match quality
 * FIXED v7.6: Year-aware matching — prefers results from the correct era
 */
function findBestMatch(
  results: ComicVineSearchResult[], 
  itemName: string, 
  targetIssue: string | null,
  targetYear: string | null = null
): { bestMatch: ComicVineSearchResult; exactIssueMatch: boolean } {
  const nameLower = itemName.toLowerCase();
  
  // If we have a target issue number, prioritize exact matches
  if (targetIssue) {
    // FIXED v7.6: Collect ALL issue number matches, then pick best by year/era
    const issueMatches = results.filter(r => 
      r.issue_number === targetIssue || 
      (r.issue_number && parseInt(r.issue_number) === parseInt(targetIssue))
    );
    
    if (issueMatches.length > 0) {
      // If we have a target year, prefer the match from that era
      if (targetYear) {
        // Exact year match (e.g. cover_date "1978-12-01" starts with "1978")
        const yearMatch = issueMatches.find(r => 
          r.cover_date && r.cover_date.startsWith(targetYear)
        );
        if (yearMatch) {
          console.log(`✅ Comic Vine: Matched #${targetIssue} from ${targetYear} (${yearMatch.volume?.name})`);
          return { bestMatch: yearMatch, exactIssueMatch: true };
        }
        // Decade match (1978 → prefer 197x over 201x)
        const targetDecade = targetYear.substring(0, 3);
        const decadeMatch = issueMatches.find(r =>
          r.cover_date && r.cover_date.substring(0, 3) === targetDecade
        );
        if (decadeMatch) {
          console.log(`✅ Comic Vine: Matched #${targetIssue} from ${targetDecade}0s decade (${decadeMatch.volume?.name})`);
          return { bestMatch: decadeMatch, exactIssueMatch: true };
        }
      }
      // No year hint or no year match found — return first issue match
      return { bestMatch: issueMatches[0], exactIssueMatch: true };
    }
  }
  
  // Try to find volume name match
  for (const result of results) {
    const volumeName = result.volume?.name?.toLowerCase() || '';
    if (nameLower.includes(volumeName) && volumeName.length > 3) {
      return { bestMatch: result, exactIssueMatch: false };
    }
  }
  
  // Default to first result
  return { bestMatch: results[0], exactIssueMatch: false };
}

/**
 * Build display name from issue data
 */
function buildDisplayName(issue: ComicVineSearchResult): string {
  const volumeName = issue.volume?.name || 'Unknown';
  const issueNum = issue.issue_number || '?';
  const issueName = issue.name;
  
  if (issueName) {
    return `${volumeName} #${issueNum} - ${issueName}`;
  }
  return `${volumeName} #${issueNum}`;
}

/**
 * Build rich authority data from Comic Vine result
 * FIXED v7.5: Now accepts exactIssueMatch and requestedIssue for confidence calculation
 */
function buildAuthorityData(
  issue: ComicVineSearchResult,
  exactIssueMatch: boolean = true,
  requestedIssue: string | null = null
): AuthorityData {
  const displayName = buildDisplayName(issue);
  
  // Organize credits by role
  const credits: Record<string, string[]> = {};
  if (Array.isArray(issue.person_credits)) {
    issue.person_credits.forEach(credit => {
      const role = credit.role || 'Other';
      if (!credits[role]) {
        credits[role] = [];
      }
      if (!credits[role].includes(credit.name)) {
        credits[role].push(credit.name);
      }
    });
  }
  
  // Extract character appearances
  const characters = Array.isArray(issue.character_credits)
    ? issue.character_credits.map(c => c.name).slice(0, 20) // Limit to 20
    : [];
  
  // Extract first appearances (KEY for comic value!)
  const firstAppearances = Array.isArray(issue.first_appearance_characters)
    ? issue.first_appearance_characters.map(c => c.name)
    : [];
  
  // ADDED v7.5: Extract deaths
  const deaths = Array.isArray(issue.character_died_in)
    ? issue.character_died_in.map(c => c.name)
    : [];
  
  // Check if this is a key issue
  const isKeyIssue = firstAppearances.length > 0 || 
                     issue.issue_number === '1' ||
                     (issue.name?.toLowerCase().includes('first') ?? false);
  
  // FIXED v7.5: Lower confidence if we didn't find exact issue
  const confidence = exactIssueMatch ? 0.95 : 0.70;
  
  return {
    source: 'Comic Vine',
    verified: true,
    confidence,  // FIXED v7.5: Now uses calculated confidence
    externalUrl: issue.site_detail_url,
    
    // Detailed item information for the authority card
    itemDetails: {
      // Basic info
      comicVineId: issue.id,
      name: displayName,
      issueName: issue.name,
      issueNumber: issue.issue_number,
      requestedIssue,  // ADDED v7.5: Track what was requested
      exactMatch: exactIssueMatch,  // ADDED v7.5: Track match quality
      
      // Volume/Series info
      volumeName: issue.volume?.name,
      volumeId: issue.volume?.id,
      publisher: null, // Would need separate API call
      
      // Dates
      coverDate: issue.cover_date,
      storeDate: issue.store_date,
      
      // Description
      deck: issue.deck, // Short description
      description: issue.description ? stripHtml(issue.description).substring(0, 500) : null,
      
      // Credits (writers, artists, etc.)
      credits: Object.keys(credits).length > 0 ? credits : null,
      writers: credits['writer'] || credits['Writer'] || null,
      artists: credits['artist'] || credits['Artist'] || credits['penciler'] || credits['Penciler'] || null,
      coverArtists: credits['cover'] || credits['Cover'] || null,
      
      // Characters
      characterAppearances: characters.length > 0 ? characters : null,
      characterCount: characters.length,
      
      // First appearances (IMPORTANT for value!)
      firstAppearances: firstAppearances.length > 0 ? firstAppearances : null,
      hasFirstAppearances: firstAppearances.length > 0,
      isKeyIssue,
      
      // Deaths (ADDED v7.5)
      deaths: deaths.length > 0 ? deaths : null,
      
      // Images
      coverImage: issue.image?.medium_url || issue.image?.small_url || null,
      coverImageLarge: issue.image?.super_url || issue.image?.original_url || null,
      coverImageThumb: issue.image?.thumb_url || issue.image?.icon_url || null,
      
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
 * Strip HTML tags from description
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
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