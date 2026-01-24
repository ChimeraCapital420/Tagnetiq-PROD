// FILE: api/comicvine/health-check.ts
// Comic Vine API Health Check

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

const COMIC_VINE_BASE_URL = 'https://comicvine.gamespot.com/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.COMIC_VINE_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      provider: 'comic-vine',
      status: 'unconfigured',
      message: 'COMIC_VINE_API_KEY environment variable not set',
      timestamp: new Date().toISOString()
    });
  }

  const startTime = Date.now();

  try {
    // Test with a search for Batman
    const response = await fetch(
      `${COMIC_VINE_BASE_URL}/search/?api_key=${apiKey}&format=json&query=batman&resources=issue&limit=1`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'TagnetIQ/1.0 (Collectibles Identification Platform)'
        }
      }
    );

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(200).json({
        provider: 'comic-vine',
        status: 'unhealthy',
        message: `Comic Vine API returned ${response.status}: ${errorText}`,
        responseTime,
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();

    if (data.error !== 'OK') {
      return res.status(200).json({
        provider: 'comic-vine',
        status: 'unhealthy',
        message: `Comic Vine API error: ${data.error}`,
        responseTime,
        timestamp: new Date().toISOString()
      });
    }

    const testIssue = data.results?.[0];

    return res.status(200).json({
      provider: 'comic-vine',
      status: 'healthy',
      message: 'Comic Vine API is operational',
      responseTime,
      testResult: testIssue ? {
        id: testIssue.id,
        name: testIssue.name,
        volumeName: testIssue.volume?.name,
        issueNumber: testIssue.issue_number,
        coverDate: testIssue.cover_date
      } : null,
      capabilities: {
        issueSearch: true,
        volumeSearch: true,
        characterSearch: true,
        publisherSearch: true,
        storyArcSearch: true,
        images: true
      },
      rateLimit: '200 requests/hour',
      documentation: 'https://comicvine.gamespot.com/api/documentation'
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Comic Vine health check failed:', error);

    return res.status(200).json({
      provider: 'comic-vine',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Failed to connect to Comic Vine API',
      responseTime,
      timestamp: new Date().toISOString()
    });
  }
}