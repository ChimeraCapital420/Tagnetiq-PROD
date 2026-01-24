// FILE: api/discogs/release.ts
// Discogs Release Details - Get full info including marketplace pricing

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const DISCOGS_BASE_URL = 'https://api.discogs.com';

interface MarketStats {
  lowestPrice: number | null;
  numForSale: number;
  currency: string;
}

interface ReleaseDetails {
  id: number;
  title: string;
  artists: Array<{ name: string; id: number }>;
  year: number;
  country: string;
  genres: string[];
  styles: string[];
  formats: Array<{
    name: string;
    qty: string;
    descriptions: string[];
  }>;
  labels: Array<{
    name: string;
    catno: string;
    id: number;
  }>;
  tracklist: Array<{
    position: string;
    title: string;
    duration: string;
  }>;
  images: Array<{
    type: string;
    uri: string;
    uri150: string;
  }>;
  community: {
    have: number;
    want: number;
    rating: {
      average: number;
      count: number;
    };
  };
  lowestPrice: number | null;
  numForSale: number;
  uri: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
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
    // Get release ID from query
    const releaseId = typeof req.query.id === 'string' ? req.query.id : '';
    const currency = typeof req.query.currency === 'string' ? req.query.currency : 'USD';

    if (!releaseId) {
      return res.status(400).json({
        error: 'Release ID required',
        hint: 'Provide id parameter with Discogs release ID',
        example: '/api/discogs/release?id=249504'
      });
    }

    // Fetch release details
    const response = await fetch(
      `${DISCOGS_BASE_URL}/releases/${releaseId}?curr_abbr=${currency}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Discogs token=${token}`,
          'User-Agent': 'TagnetIQ/1.0.0'
        }
      }
    );

    const responseTime = Date.now() - startTime;

    // Get rate limit info
    const rateLimit = response.headers.get('X-Discogs-Ratelimit');
    const rateLimitRemaining = response.headers.get('X-Discogs-Ratelimit-Remaining');

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          error: 'Release not found',
          message: `No release found with ID ${releaseId}`
        });
      }

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

    const data: ReleaseDetails = await response.json();

    // Parse the response into a clean format
    const artistNames = data.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
    const primaryLabel = data.labels?.[0];
    const primaryFormat = data.formats?.[0];
    const primaryImage = data.images?.find(i => i.type === 'primary') || data.images?.[0];

    // Calculate value indicators
    const wantHaveRatio = data.community?.have > 0 
      ? (data.community.want / data.community.have).toFixed(2) 
      : null;

    // Build response
    return res.status(200).json({
      success: true,
      release: {
        id: data.id,
        title: data.title,
        artist: artistNames,
        year: data.year,
        country: data.country,
        genres: data.genres || [],
        styles: data.styles || [],
        format: {
          name: primaryFormat?.name || '',
          quantity: primaryFormat?.qty || '1',
          descriptions: primaryFormat?.descriptions || []
        },
        label: {
          name: primaryLabel?.name || '',
          catalogNumber: primaryLabel?.catno || '',
          id: primaryLabel?.id
        },
        tracklist: data.tracklist?.map(t => ({
          position: t.position,
          title: t.title,
          duration: t.duration
        })) || [],
        images: {
          primary: primaryImage?.uri || null,
          thumbnail: primaryImage?.uri150 || null
        },
        discogsUrl: data.uri ? `https://www.discogs.com${data.uri}` : null
      },
      community: {
        have: data.community?.have || 0,
        want: data.community?.want || 0,
        rating: data.community?.rating?.average || null,
        ratingCount: data.community?.rating?.count || 0,
        wantHaveRatio: wantHaveRatio
      },
      marketplace: {
        lowestPrice: data.lowestPrice,
        numForSale: data.numForSale || 0,
        currency: currency,
        // Value assessment based on community stats
        demandIndicator: data.community?.want > data.community?.have 
          ? 'high' 
          : data.community?.want > (data.community?.have * 0.5) 
            ? 'medium' 
            : 'low'
      },
      // Valuation context for Hydra integration
      valuationContext: {
        itemName: `${artistNames} - ${data.title}`,
        category: 'music_records',
        estimatedValue: data.lowestPrice,
        currency: currency,
        identifiers: {
          discogsId: data.id,
          artist: artistNames,
          title: data.title,
          year: data.year,
          format: primaryFormat?.name,
          catalogNumber: primaryLabel?.catno
        },
        marketData: {
          lowestPrice: data.lowestPrice,
          numForSale: data.numForSale,
          communityHave: data.community?.have,
          communityWant: data.community?.want,
          rating: data.community?.rating?.average
        }
      },
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
    console.error('Discogs release fetch error:', error);

    return res.status(500).json({
      error: 'Failed to fetch release',
      message: error.message || 'Internal server error',
      responseTime,
      timestamp: new Date().toISOString()
    });
  }
}