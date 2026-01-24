// FILE: api/discogs/health-check.ts
// Discogs API Health Check - Vinyl/Music Database

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

const DISCOGS_BASE_URL = 'https://api.discogs.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.DISCOGS_TOKEN;

  if (!token) {
    return res.status(200).json({
      provider: 'discogs',
      status: 'unconfigured',
      message: 'DISCOGS_TOKEN environment variable is not set',
      timestamp: new Date().toISOString()
    });
  }

  const startTime = Date.now();

  try {
    // Test with a known release (Pink Floyd - Dark Side of the Moon)
    const response = await fetch(
      `${DISCOGS_BASE_URL}/releases/249504`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Discogs token=${token}`,
          'User-Agent': 'TagnetIQ/1.0.0'
        }
      }
    );

    const responseTime = Date.now() - startTime;

    // Check rate limit headers
    const rateLimit = response.headers.get('X-Discogs-Ratelimit');
    const rateLimitUsed = response.headers.get('X-Discogs-Ratelimit-Used');
    const rateLimitRemaining = response.headers.get('X-Discogs-Ratelimit-Remaining');

    if (!response.ok) {
      return res.status(200).json({
        provider: 'discogs',
        status: 'unhealthy',
        message: `Discogs API returned ${response.status}`,
        responseTime,
        rateLimit: {
          limit: rateLimit,
          used: rateLimitUsed,
          remaining: rateLimitRemaining
        },
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();

    return res.status(200).json({
      provider: 'discogs',
      status: 'healthy',
      message: 'Discogs API is operational',
      responseTime,
      testRelease: {
        id: data.id,
        title: data.title,
        artist: data.artists?.[0]?.name,
        year: data.year,
        genre: data.genres?.[0],
        format: data.formats?.[0]?.name
      },
      rateLimit: {
        limit: rateLimit,
        used: rateLimitUsed,
        remaining: rateLimitRemaining
      },
      capabilities: {
        search: true,
        releaseDetails: true,
        artistDetails: true,
        labelDetails: true,
        marketplacePricing: true,
        rateLimited: true,
        authRequired: true
      },
      documentation: 'https://www.discogs.com/developers/'
    });

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('Discogs health check failed:', error);

    return res.status(200).json({
      provider: 'discogs',
      status: 'unhealthy',
      message: error.message || 'Failed to connect to Discogs API',
      responseTime,
      timestamp: new Date().toISOString()
    });
  }
}