// FILE: api/pokemon/search.ts
// Pokemon TCG Card Search with Market Prices

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const POKEMON_TCG_BASE_URL = 'https://api.pokemontcg.io/v2';

interface PokemonCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  rules?: string[];
  attacks?: any[];
  weaknesses?: any[];
  resistances?: any[];
  retreatCost?: string[];
  convertedRetreatCost?: number;
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    releaseDate: string;
    images: {
      symbol: string;
      logo: string;
    };
  };
  number: string;
  artist?: string;
  rarity?: string;
  flavorText?: string;
  nationalPokedexNumbers?: number[];
  legalities?: Record<string, string>;
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: Record<string, {
      low?: number;
      mid?: number;
      high?: number;
      market?: number;
      directLow?: number;
    }>;
  };
  cardmarket?: {
    url: string;
    updatedAt: string;
    prices?: {
      averageSellPrice?: number;
      lowPrice?: number;
      trendPrice?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
    };
  };
}

function buildSearchQuery(params: Record<string, any>): string {
  const queryParts: string[] = [];
  
  // Name search (supports partial matching with *)
  if (params.name) {
    queryParts.push(`name:"${params.name}*"`);
  }
  
  // Exact set code
  if (params.set) {
    queryParts.push(`set.id:${params.set}`);
  }
  
  // Set name (partial match)
  if (params.setName) {
    queryParts.push(`set.name:"${params.setName}*"`);
  }
  
  // Card number in set
  if (params.number) {
    queryParts.push(`number:${params.number}`);
  }
  
  // Rarity
  if (params.rarity) {
    queryParts.push(`rarity:"${params.rarity}"`);
  }
  
  // Pokemon type (Fire, Water, etc.)
  if (params.type) {
    queryParts.push(`types:${params.type}`);
  }
  
  // Supertype (Pokémon, Trainer, Energy)
  if (params.supertype) {
    queryParts.push(`supertype:${params.supertype}`);
  }
  
  // HP range
  if (params.hp) {
    queryParts.push(`hp:${params.hp}`);
  }
  
  // Artist
  if (params.artist) {
    queryParts.push(`artist:"${params.artist}*"`);
  }
  
  // Pokedex number
  if (params.pokedex) {
    queryParts.push(`nationalPokedexNumbers:${params.pokedex}`);
  }
  
  return queryParts.join(' ');
}

function formatCardResult(card: PokemonCard) {
  // Get best available price data
  let priceData: any = null;
  
  if (card.tcgplayer?.prices) {
    const priceTypes = Object.keys(card.tcgplayer.prices);
    if (priceTypes.length > 0) {
      // Prefer holofoil or normal prices
      const preferredType = priceTypes.find(t => t === 'holofoil') 
        || priceTypes.find(t => t === 'normal')
        || priceTypes[0];
      
      const prices = card.tcgplayer.prices[preferredType];
      priceData = {
        source: 'tcgplayer',
        priceType: preferredType,
        low: prices?.low,
        mid: prices?.mid,
        high: prices?.high,
        market: prices?.market,
        url: card.tcgplayer.url,
        updatedAt: card.tcgplayer.updatedAt
      };
    }
  }
  
  // Fall back to Cardmarket (European pricing)
  if (!priceData && card.cardmarket?.prices) {
    priceData = {
      source: 'cardmarket',
      currency: 'EUR',
      low: card.cardmarket.prices.lowPrice,
      average: card.cardmarket.prices.averageSellPrice,
      trend: card.cardmarket.prices.trendPrice,
      avg7: card.cardmarket.prices.avg7,
      avg30: card.cardmarket.prices.avg30,
      url: card.cardmarket.url,
      updatedAt: card.cardmarket.updatedAt
    };
  }

  return {
    id: card.id,
    name: card.name,
    supertype: card.supertype,
    subtypes: card.subtypes,
    hp: card.hp,
    types: card.types,
    set: {
      id: card.set.id,
      name: card.set.name,
      series: card.set.series,
      releaseDate: card.set.releaseDate,
      logo: card.set.images?.logo
    },
    number: card.number,
    totalInSet: card.set.printedTotal,
    cardNumber: `${card.number}/${card.set.printedTotal}`,
    rarity: card.rarity,
    artist: card.artist,
    images: card.images,
    prices: priceData,
    legalities: card.legalities,
    // For Hydra integration
    valuationContext: {
      category: 'trading-cards',
      subcategory: 'pokemon-tcg',
      identifiers: {
        pokemonTcgId: card.id,
        setCode: card.set.id,
        setName: card.set.name,
        cardNumber: card.number,
        rarity: card.rarity
      },
      marketData: priceData ? {
        source: priceData.source,
        marketPrice: priceData.market || priceData.trend || priceData.average,
        lowPrice: priceData.low,
        highPrice: priceData.high,
        currency: priceData.currency || 'USD'
      } : null
    }
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.POKEMON_TCG_API_KEY;
  const { 
    q, name, set, setName, number, rarity, type, supertype, hp, artist, pokedex,
    page = '1', 
    pageSize = '20',
    orderBy = '-set.releaseDate' // Newest first by default
  } = req.query;

  // Build query
  let searchQuery = '';
  
  if (q) {
    // General query - search name
    searchQuery = `name:"${q}*"`;
  } else {
    searchQuery = buildSearchQuery({
      name, set, setName, number, rarity, type, supertype, hp, artist, pokedex
    });
  }

  if (!searchQuery) {
    return res.status(400).json({
      error: 'Missing search parameters',
      message: 'Provide at least one: q, name, set, setName, number, rarity, type, supertype, hp, artist, pokedex',
      examples: [
        '/api/pokemon/search?q=charizard',
        '/api/pokemon/search?name=pikachu&set=base1',
        '/api/pokemon/search?set=sv1&rarity=Illustration Rare',
        '/api/pokemon/search?pokedex=25&rarity=Secret Rare'
      ]
    });
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['X-Api-Key'] = apiKey;
    }

    const params = new URLSearchParams({
      q: searchQuery,
      page: String(page),
      pageSize: String(Math.min(Number(pageSize), 50)),
      orderBy: String(orderBy)
    });

    const response = await fetch(
      `${POKEMON_TCG_BASE_URL}/cards?${params}`,
      {
        method: 'GET',
        headers
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pokemon TCG API error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'Pokemon TCG API error',
        status: response.status,
        message: errorText
      });
    }

    const data = await response.json();
    
    const results = (data.data || []).map(formatCardResult);

    return res.status(200).json({
      success: true,
      query: searchQuery,
      totalResults: data.totalCount || 0,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil((data.totalCount || 0) / Number(pageSize)),
      results,
      searchTips: results.length === 0 ? {
        suggestions: [
          'Try using partial names (e.g., "char" instead of "charizard")',
          'Check set codes at https://docs.pokemontcg.io/getting-started/sets',
          'Use * for wildcard matching'
        ]
      } : undefined
    });

  } catch (error: any) {
    console.error('Pokemon TCG search failed:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
}