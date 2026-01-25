// FILE: src/lib/hydra/fetchers/pokemon-tcg.ts
// HYDRA v5.2 - Pokemon TCG API Fetcher

import type { MarketDataSource, AuthorityData } from '../types.js';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const POKEMON_TCG_TIMEOUT = 8000; // 8 second timeout

export async function fetchPokemonTcgData(itemName: string): Promise<MarketDataSource> {
  const startTime = Date.now();
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  
  try {
    // Build search query
    const searchQuery = buildPokemonQuery(itemName);
    console.log(`🔍 Pokemon TCG search: "${searchQuery}"`);
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    if (apiKey) {
      headers['X-Api-Key'] = apiKey;
    }
    
    // Search for cards with timeout
    const searchUrl = `${POKEMON_TCG_API}/cards?q=${encodeURIComponent(searchQuery)}&pageSize=10&orderBy=-set.releaseDate`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), POKEMON_TCG_TIMEOUT);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`❌ Pokemon TCG API error: ${response.status}`);
      return createFallbackResult(itemName, searchQuery);
    }
    
    const data = await response.json();
    const cards = data.data || [];
    
    if (cards.length === 0) {
      console.log('⚠️ Pokemon TCG: No matching cards found');
      return {
        source: 'pokemon_tcg',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: 'No matching cards found',
      };
    }
    
    // Get the best match
    const bestMatch = cards[0];
    console.log(`✅ Pokemon TCG: Found "${bestMatch.name}" from ${bestMatch.set?.name}`);
    
    // Extract price data from TCGPlayer prices
    const prices = bestMatch.tcgplayer?.prices || {};
    const priceData = extractPriceData(prices);
    
    // Build authority data
    const authorityData: AuthorityData = {
      source: 'pokemon_tcg',
      verified: true,
      confidence: calculateMatchConfidence(itemName, bestMatch.name, bestMatch.set?.name),
      itemDetails: {
        cardId: bestMatch.id,
        name: bestMatch.name,
        setName: bestMatch.set?.name,
        setId: bestMatch.set?.id,
        number: bestMatch.number,
        rarity: bestMatch.rarity,
        artist: bestMatch.artist,
        types: bestMatch.types,
        hp: bestMatch.hp,
        supertype: bestMatch.supertype,
        subtypes: bestMatch.subtypes,
        imageSmall: bestMatch.images?.small,
        imageLarge: bestMatch.images?.large,
        releaseDate: bestMatch.set?.releaseDate,
        tcgplayerUrl: bestMatch.tcgplayer?.url,
        cardmarketUrl: bestMatch.cardmarket?.url,
      },
      priceData: priceData ? {
        market: priceData.market,
        conditions: priceData.conditions,
      } : undefined,
      externalUrl: bestMatch.tcgplayer?.url || `https://pokemontcg.io/card/${bestMatch.id}`,
      lastUpdated: bestMatch.tcgplayer?.updatedAt || new Date().toISOString(),
    };
    
    // Build sample listings
    const sampleListings = cards.slice(0, 5).map((card: any) => {
      const cardPrices = card.tcgplayer?.prices || {};
      const marketPrice = cardPrices.holofoil?.market || 
                         cardPrices.reverseHolofoil?.market || 
                         cardPrices.normal?.market || 
                         cardPrices['1stEditionHolofoil']?.market || 0;
      return {
        title: `${card.name} - ${card.set?.name} (${card.number}/${card.set?.printedTotal || '?'})`,
        price: marketPrice,
        condition: card.rarity || 'Unknown',
        url: card.tcgplayer?.url || `https://pokemontcg.io/card/${card.id}`,
      };
    });
    
    console.log(`✅ Pokemon TCG: Authority data retrieved in ${Date.now() - startTime}ms`);
    
    return {
      source: 'pokemon_tcg',
      available: true,
      query: searchQuery,
      totalListings: data.totalCount || cards.length,
      priceAnalysis: priceData ? {
        lowest: priceData.low,
        highest: priceData.high,
        average: priceData.market,
        median: priceData.mid,
      } : undefined,
      suggestedPrices: priceData ? {
        goodDeal: parseFloat((priceData.low * 1.1).toFixed(2)),
        fairMarket: priceData.market,
        sellPrice: parseFloat((priceData.market * 1.15).toFixed(2)),
      } : undefined,
      sampleListings,
      authorityData,
      metadata: {
        responseTime: Date.now() - startTime,
        totalCards: data.totalCount,
        bestMatchId: bestMatch.id,
        tcgplayerUpdated: bestMatch.tcgplayer?.updatedAt,
      },
    };
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('❌ Pokemon TCG API timeout');
      return {
        source: 'pokemon_tcg',
        available: false,
        query: itemName,
        totalListings: 0,
        error: 'API request timed out',
      };
    }
    
    console.error('❌ Pokemon TCG fetch error:', error);
    return {
      source: 'pokemon_tcg',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function buildPokemonQuery(itemName: string): string {
  const nameLower = itemName.toLowerCase();
  let query = '';
  
  // Extract Pokemon name
  const pokemonNames = [
    'pikachu', 'charizard', 'blastoise', 'venusaur', 'mewtwo', 'mew',
    'ampharos', 'dragonite', 'gyarados', 'snorlax', 'gengar', 'alakazam',
    'machamp', 'golem', 'arcanine', 'lapras', 'vaporeon', 'jolteon', 'flareon',
    'articuno', 'zapdos', 'moltres', 'lugia', 'ho-oh', 'celebi',
    'rayquaza', 'groudon', 'kyogre', 'dialga', 'palkia', 'giratina', 'arceus',
    'reshiram', 'zekrom', 'kyurem', 'xerneas', 'yveltal', 'zygarde',
    'solgaleo', 'lunala', 'necrozma', 'zacian', 'zamazenta', 'eternatus',
    'umbreon', 'espeon', 'leafeon', 'glaceon', 'sylveon', 'eevee'
  ];
  
  for (const pokemon of pokemonNames) {
    if (nameLower.includes(pokemon)) {
      query = `name:"${pokemon}"`;
      break;
    }
  }
  
  // If no Pokemon name found, use general search
  if (!query) {
    // Clean up the name for search
    const cleanName = itemName
      .replace(/\b(pokemon|pokémon|card|tcg|holo|holographic)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleanName) {
      query = `name:"${cleanName}"`;
    } else {
      return itemName;
    }
  }
  
  // Add rarity filters if detected
  if (nameLower.includes('vmax')) {
    query += ' subtypes:VMAX';
  } else if (nameLower.includes('vstar')) {
    query += ' subtypes:VSTAR';
  } else if (nameLower.includes(' v ') || nameLower.endsWith(' v')) {
    query += ' subtypes:V';
  } else if (nameLower.includes(' gx')) {
    query += ' subtypes:GX';
  } else if (nameLower.includes(' ex') && !nameLower.includes('exec')) {
    query += ' (subtypes:EX OR subtypes:"ex")';
  }
  
  // Add set filter if detected
  const setPatterns: Record<string, string> = {
    'base set': 'set.id:base1',
    'jungle': 'set.id:jungle',
    'fossil': 'set.id:fossil',
    'team rocket': 'set.id:teamrocket',
    'scarlet violet': 'set.series:"Scarlet & Violet"',
    'sword shield': 'set.series:"Sword & Shield"',
    'sun moon': 'set.series:"Sun & Moon"',
    'xy': 'set.series:XY',
  };
  
  for (const [pattern, filter] of Object.entries(setPatterns)) {
    if (nameLower.includes(pattern)) {
      query += ` ${filter}`;
      break;
    }
  }
  
  return query;
}

function extractPriceData(prices: any): { market: number; low: number; mid: number; high: number; conditions: any[] } | null {
  // Priority order for price types
  const priceTypes = ['holofoil', '1stEditionHolofoil', 'reverseHolofoil', 'normal', '1stEditionNormal', 'unlimited'];
  
  for (const type of priceTypes) {
    if (prices[type]?.market) {
      return {
        market: prices[type].market || 0,
        low: prices[type].low || 0,
        mid: prices[type].mid || prices[type].market || 0,
        high: prices[type].high || 0,
        conditions: Object.entries(prices).map(([condition, data]: [string, any]) => ({
          condition: formatConditionName(condition),
          price: data.market || 0,
          low: data.low || 0,
          high: data.high || 0,
        })).filter(c => c.price > 0),
      };
    }
  }
  
  return null;
}

function formatConditionName(condition: string): string {
  const names: Record<string, string> = {
    'holofoil': 'Holofoil',
    '1stEditionHolofoil': '1st Edition Holofoil',
    'reverseHolofoil': 'Reverse Holofoil',
    'normal': 'Normal',
    '1stEditionNormal': '1st Edition Normal',
    'unlimited': 'Unlimited',
    'unlimitedHolofoil': 'Unlimited Holofoil',
  };
  return names[condition] || condition;
}

function calculateMatchConfidence(searchTerm: string, cardName: string, setName?: string): number {
  const searchLower = searchTerm.toLowerCase();
  const nameLower = cardName.toLowerCase();
  
  // Check for exact Pokemon name match
  if (nameLower === searchLower || searchLower.includes(nameLower)) {
    return 0.95;
  }
  
  // Check if Pokemon name is in search term
  if (searchLower.includes(nameLower.split(' ')[0])) {
    return 0.85;
  }
  
  // Check set name match
  if (setName && searchLower.includes(setName.toLowerCase())) {
    return 0.80;
  }
  
  return 0.65;
}

function createFallbackResult(itemName: string, query: string): MarketDataSource {
  const searchUrl = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(itemName)}`;
  
  return {
    source: 'pokemon_tcg',
    available: true,
    query,
    totalListings: 0,
    sampleListings: [{
      title: `Search TCGPlayer for "${itemName}"`,
      price: 0,
      condition: 'N/A',
      url: searchUrl,
    }],
    metadata: {
      fallback: true,
      searchUrl,
    },
  };
}