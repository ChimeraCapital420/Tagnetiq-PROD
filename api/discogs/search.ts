// FILE: api/discogs/search.ts
// Discogs Search - Find vinyl records, CDs, and music releases

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const DISCOGS_BASE_URL = 'https://api.discogs.com';

interface DiscogsSearchResult {
  id: number;
  type: string;
  title: string;
  thumb: string;
  cover_image: string;
  resource_url: string;
  uri: string;
  country: string;
  year: string;
  format: string[];
  label: string[];
  genre: string[];
  style: string[];
  catno: string;
  community?: {
    want: number;
    have: number;
  };
}

interface ParsedResult {
  id: number;
  type: string;
  title: string;
  artist: string;
  year: string;
  country: string;
  format: string;
  label: string;
  genre: string;
  style: string;
  catalogNumber: string;
  thumbnail: string;
  coverImage: string;
  discogsUrl: string;
  community: {
    want: number;
    have: number;
  };
}

function parseSearchResult(result: DiscogsSearchResult): ParsedResult {
  // Title often contains "Artist - Album" format
  const titleParts = result.title.split(' - ');
  const artist = titleParts.length > 1 ? titleParts[0] : '';
  const albumTitle = titleParts.length > 1 ? titleParts.slice(1).join(' - ') : result.title;

  return {
    id: result.id,
    type: result.type,
    title: albumTitle,
    artist: artist,
    year: result.year || '',
    country: result.country || '',
    format: result.format?.join(', ') || '',
    label: result.label?.join(', ') || '',
    genre: result.genre?.join(', ') || '',
    style: result.style?.join(', ') || '',
    catalogNumber: result.catno || '',
    thumbnail: result.thumb || '',
    coverImage: result.cover_image || '',
    discogsUrl: result.uri ? `https://www.discogs.com${result.uri}` : '',
    community: {
      want: result.community?.want || 0,
      have: result.community?.have || 0
    }
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.DISCOGS_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: 'Discogs API not configured',
      message: 'DISCOGS_TOKEN environment variable is not set'
    });
  }

  const startTime = Date.now();

  try {
    // Get search parameters
    let query: string;
    let type: string | undefined;
    let artist: string | undefined;
    let title: string | undefined;
    let year: string | undefined;
    let country: string | undefined;
    let format: string | undefined;
    let catno: string | undefined;
    let barcode: string | undefined;
    let page: number;
    let perPage: number;

    if (req.method === 'GET') {
      query = typeof req.query.q === 'string' ? req.query.q : '';
      type = typeof req.query.type === 'string' ? req.query.type : undefined;
      artist = typeof req.query.artist === 'string' ? req.query.artist : undefined;
      title = typeof req.query.title === 'string' ? req.query.title : undefined;
      year = typeof req.query.year === 'string' ? req.query.year : undefined;
      country = typeof req.query.country === 'string' ? req.query.country : undefined;
      format = typeof req.query.format === 'string' ? req.query.format : undefined;
      catno = typeof req.query.catno === 'string' ? req.query.catno : undefined;
      barcode = typeof req.query.barcode === 'string' ? req.query.barcode : undefined;
      page = parseInt(typeof req.query.page === 'string' ? req.query.page : '1', 10);
      perPage = parseInt(typeof req.query.per_page === 'string' ? req.query.per_page : '10', 10);
    } else {
      query = req.body?.q || req.body?.query || '';
      type = req.body?.type;
      artist = req.body?.artist;
      title = req.body?.title;
      year = req.body?.year;
      country = req.body?.country;
      format = req.body?.format;
      catno = req.body?.catno;
      barcode = req.body?.barcode;
      page = req.body?.page || 1;
      perPage = req.body?.per_page || 10;
    }

    // Need at least one search parameter
    if (!query && !artist && !title && !catno && !barcode) {
      return res.status(400).json({
        error: 'Search query required',
        hint: 'Provide q (general query), artist, title, catno (catalog number), or barcode',
        examples: [
          '/api/discogs/search?q=dark+side+of+the+moon',
          '/api/discogs/search?artist=pink+floyd&title=wish+you+were+here',
          '/api/discogs/search?barcode=074643811224',
          '/api/discogs/search?catno=SHVL-804'
        ]
      });
    }

    // Build search URL
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (type) params.append('type', type); // release, master, artist, label
    if (artist) params.append('artist', artist);
    if (title) params.append('title', title);
    if (year) params.append('year', year);
    if (country) params.append('country', country);
    if (format) params.append('format', format); // Vinyl, CD, Cassette, etc.
    if (catno) params.append('catno', catno);
    if (barcode) params.append('barcode', barcode);
    params.append('page', page.toString());
    params.append('per_page', Math.min(perPage, 50).toString()); // Discogs max is 100

    const url = `${DISCOGS_BASE_URL}/database/search?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Discogs token=${token}`,
        'User-Agent': 'TagnetIQ/1.0.0'
      }
    });

    const responseTime = Date.now() - startTime;

    // Get rate limit info
    const rateLimit = response.headers.get('X-Discogs-Ratelimit');
    const rateLimitRemaining = response.headers.get('X-Discogs-Ratelimit-Remaining');

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Discogs search error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests to Discogs API',
          retryAfter: response.headers.get('Retry-After') || '60'
        });
      }

      return res.status(502).json({
        error: 'Discogs API error',
        message: `API returned ${response.status}`,
        responseTime
      });
    }

    const data = await response.json();

    // Parse results
    const results: ParsedResult[] = (data.results || []).map(parseSearchResult);

    // Build response
    return res.status(200).json({
      success: true,
      query: {
        q: query,
        artist,
        title,
        year,
        format,
        catno,
        barcode
      },
      pagination: {
        page: data.pagination?.page || page,
        perPage: data.pagination?.per_page || perPage,
        totalPages: data.pagination?.pages || 1,
        totalResults: data.pagination?.items || results.length
      },
      results: results,
      // Include for Hydra integration
      valuationContext: results.length > 0 ? {
        topMatch: {
          itemName: `${results[0].artist} - ${results[0].title}`,
          category: 'music_records',
          identifiers: {
            discogsId: results[0].id,
            artist: results[0].artist,
            title: results[0].title,
            year: results[0].year,
            format: results[0].format,
            catalogNumber: results[0].catalogNumber
          },
          communityStats: results[0].community
        }
      } : null,
      rateLimit: {
        limit: rateLimit,
        remaining: rateLimitRemaining
      },
      responseTime,
      source: 'Discogs',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('Discogs search error:', error);

    return res.status(500).json({
      error: 'Search failed',
      message: error.message || 'Internal server error',
      responseTime,
      timestamp: new Date().toISOString()
    });
  }
}