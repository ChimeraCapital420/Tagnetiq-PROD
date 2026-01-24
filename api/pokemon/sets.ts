// FILE: api/pokemon/sets.ts
// Pokemon TCG Sets Listing

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const POKEMON_TCG_BASE_URL = 'https://api.pokemontcg.io/v2';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.POKEMON_TCG_API_KEY;
  const { 
    q,           // General search
    name,        // Set name
    series,      // Series (e.g., "Scarlet & Violet", "Sword & Shield")
    page = '1',
    pageSize = '50',
    orderBy = '-releaseDate' // Newest first
  } = req.query;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['X-Api-Key'] = apiKey;
    }

    // Build query
    const queryParts: string[] = [];
    
    if (q) {
      queryParts.push(`name:"${q}*"`);
    }
    if (name) {
      queryParts.push(`name:"${name}*"`);
    }
    if (series) {
      queryParts.push(`series:"${series}*"`);
    }

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(Math.min(Number(pageSize), 100)),
      orderBy: String(orderBy)
    });

    if (queryParts.length > 0) {
      params.set('q', queryParts.join(' '));
    }

    const response = await fetch(
      `${POKEMON_TCG_BASE_URL}/sets?${params}`,
      {
        method: 'GET',
        headers
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'Pokemon TCG API error',
        status: response.status,
        message: errorText
      });
    }

    const data = await response.json();
    
    // Group sets by series for better organization
    const setsBySeries: Record<string, any[]> = {};
    
    const sets = (data.data || []).map((set: any) => {
      const formatted = {
        id: set.id,
        name: set.name,
        series: set.series,
        printedTotal: set.printedTotal,
        total: set.total,
        releaseDate: set.releaseDate,
        images: set.images,
        legalities: set.legalities,
        // Useful for card lookups
        cardIdFormat: `${set.id}-{number}`,
        exampleCardId: `${set.id}-1`
      };
      
      // Group by series
      if (!setsBySeries[set.series]) {
        setsBySeries[set.series] = [];
      }
      setsBySeries[set.series].push(formatted);
      
      return formatted;
    });

    return res.status(200).json({
      success: true,
      totalResults: data.totalCount || sets.length,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil((data.totalCount || sets.length) / Number(pageSize)),
      sets,
      // Also provide grouped view
      bySeries: setsBySeries,
      // List unique series
      availableSeries: Object.keys(setsBySeries).sort(),
      usage: {
        searchCards: 'Use set.id in /api/pokemon/search?set={id}',
        getCard: 'Card IDs follow pattern: {set.id}-{card_number}'
      }
    });

  } catch (error: any) {
    console.error('Pokemon TCG sets fetch failed:', error);
    return res.status(500).json({
      error: 'Failed to fetch sets',
      message: error.message
    });
  }
}