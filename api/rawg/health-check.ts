// FILE: api/rawg/health-check.ts
// RAWG Video Games API Health Check

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

const RAWG_BASE_URL = 'https://api.rawg.io/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.RAWG_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      provider: 'rawg',
      status: 'unconfigured',
      message: 'RAWG_API_KEY environment variable not set',
      timestamp: new Date().toISOString()
    });
  }

  const startTime = Date.now();

  try {
    // Test with a search for a known game (The Legend of Zelda)
    const response = await fetch(
      `${RAWG_BASE_URL}/games?key=${apiKey}&search=zelda&page_size=1`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(200).json({
        provider: 'rawg',
        status: 'unhealthy',
        message: `RAWG API returned ${response.status}: ${errorText}`,
        responseTime,
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();
    const testGame = data.results?.[0];

    return res.status(200).json({
      provider: 'rawg',
      status: 'healthy',
      message: 'RAWG Video Games API is operational',
      responseTime,
      testGame: testGame ? {
        id: testGame.id,
        name: testGame.name,
        released: testGame.released,
        metacritic: testGame.metacritic,
        platforms: testGame.platforms?.map((p: any) => p.platform.name).slice(0, 5)
      } : null,
      totalGamesInDatabase: data.count || 'Unknown',
      capabilities: {
        gameSearch: true,
        gameDetails: true,
        metacriticScores: true,
        screenshots: true,
        platforms: true,
        genres: true,
        publishers: true,
        stores: true
      },
      coverage: '500,000+ games',
      documentation: 'https://rawg.io/apidocs'
    });

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('RAWG health check failed:', error);

    return res.status(200).json({
      provider: 'rawg',
      status: 'unhealthy',
      message: error.message || 'Failed to connect to RAWG API',
      responseTime,
      timestamp: new Date().toISOString()
    });
  }
}