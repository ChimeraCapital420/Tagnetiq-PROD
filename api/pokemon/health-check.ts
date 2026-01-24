// FILE: api/pokemon/health-check.ts
// Pokemon TCG API Health Check

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

const POKEMON_TCG_BASE_URL = 'https://api.pokemontcg.io/v2';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.POKEMON_TCG_API_KEY;

  const startTime = Date.now();

  try {
    // Test with a search for a known card (Charizard)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // API key is optional but increases rate limits
    if (apiKey) {
      headers['X-Api-Key'] = apiKey;
    }

    const response = await fetch(
      `${POKEMON_TCG_BASE_URL}/cards?q=name:charizard&pageSize=1`,
      {
        method: 'GET',
        headers
      }
    );

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return res.status(200).json({
        provider: 'pokemon-tcg',
        status: 'unhealthy',
        message: `Pokemon TCG API returned ${response.status}`,
        responseTime,
        authenticated: !!apiKey,
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();
    const testCard = data.data?.[0];

    return res.status(200).json({
      provider: 'pokemon-tcg',
      status: 'healthy',
      message: 'Pokemon TCG API is operational',
      responseTime,
      authenticated: !!apiKey,
      rateLimit: apiKey ? '20,000 requests/day' : '1,000 requests/day',
      testCard: testCard ? {
        id: testCard.id,
        name: testCard.name,
        set: testCard.set?.name,
        rarity: testCard.rarity,
        hasPrice: !!testCard.tcgplayer?.prices || !!testCard.cardmarket?.prices
      } : null,
      capabilities: {
        cardSearch: true,
        setSearch: true,
        priceData: true,
        images: true,
        rarities: true,
        subtypes: true
      },
      documentation: 'https://docs.pokemontcg.io/'
    });

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('Pokemon TCG health check failed:', error);

    return res.status(200).json({
      provider: 'pokemon-tcg',
      status: 'unhealthy',
      message: error.message || 'Failed to connect to Pokemon TCG API',
      responseTime,
      timestamp: new Date().toISOString()
    });
  }
}