// FILE: src/lib/hydra/fetchers/pokemon-tcg.ts
// HYDRA v6.2 - Pokemon TCG API Fetcher
// FIXED: Better query cleaning to remove mechanics and improve matching

import type { MarketDataSource, AuthorityData } from '../types.js';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const POKEMON_TCG_TIMEOUT = 10000; // 10 second timeout (increased from 8)

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
      
      // If 404, try a simpler search
      if (response.status === 404) {
        console.log('🔄 Pokemon TCG: Retrying with simplified query...');
        return await retryWithSimpleQuery(itemName, headers, startTime);
      }
      
      return createFallbackResult(itemName, searchQuery);
    }
    
    const data = await response.json();
    const cards = data.data || [];
    
    if (cards.length === 0) {
      console.log('⚠️ Pokemon TCG: No matching cards found, trying simplified search...');
      return await retryWithSimpleQuery(itemName, headers, startTime);
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

/**
 * Retry with a simpler query if the first one fails
 */
async function retryWithSimpleQuery(
  itemName: string, 
  headers: Record<string, string>,
  startTime: number
): Promise<MarketDataSource> {
  // Extract just the Pokemon name
  const pokemonName = extractPokemonName(itemName);
  
  if (!pokemonName) {
    console.log('⚠️ Pokemon TCG: Could not extract Pokemon name');
    return createFallbackResult(itemName, itemName);
  }
  
  const simpleQuery = `name:${pokemonName}*`;
  console.log(`🔄 Pokemon TCG retry search: "${simpleQuery}"`);
  
  try {
    const searchUrl = `${POKEMON_TCG_API}/cards?q=${encodeURIComponent(simpleQuery)}&pageSize=10&orderBy=-set.releaseDate`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), POKEMON_TCG_TIMEOUT);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok || response.status === 404) {
      return createFallbackResult(itemName, simpleQuery);
    }
    
    const data = await response.json();
    const cards = data.data || [];
    
    if (cards.length === 0) {
      return createFallbackResult(itemName, simpleQuery);
    }
    
    const bestMatch = cards[0];
    console.log(`✅ Pokemon TCG (retry): Found "${bestMatch.name}" from ${bestMatch.set?.name}`);
    
    const prices = bestMatch.tcgplayer?.prices || {};
    const priceData = extractPriceData(prices);
    
    const authorityData: AuthorityData = {
      source: 'pokemon_tcg',
      verified: true,
      confidence: calculateMatchConfidence(itemName, bestMatch.name, bestMatch.set?.name) * 0.9, // Slightly lower confidence for retry
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
    
    const sampleListings = cards.slice(0, 5).map((card: any) => {
      const cardPrices = card.tcgplayer?.prices || {};
      const marketPrice = cardPrices.holofoil?.market || 
                         cardPrices.reverseHolofoil?.market || 
                         cardPrices.normal?.market || 0;
      return {
        title: `${card.name} - ${card.set?.name} (${card.number}/${card.set?.printedTotal || '?'})`,
        price: marketPrice,
        condition: card.rarity || 'Unknown',
        url: card.tcgplayer?.url || `https://pokemontcg.io/card/${card.id}`,
      };
    });
    
    return {
      source: 'pokemon_tcg',
      available: true,
      query: simpleQuery,
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
        retryUsed: true,
      },
    };
    
  } catch (error) {
    console.error('❌ Pokemon TCG retry error:', error);
    return createFallbackResult(itemName, itemName);
  }
}

/**
 * Extract just the Pokemon name from item description
 */
function extractPokemonName(itemName: string): string | null {
  const nameLower = itemName.toLowerCase();
  
  // Comprehensive list of Pokemon names (add more as needed)
  const pokemonNames = [
    'pikachu', 'charizard', 'blastoise', 'venusaur', 'mewtwo', 'mew',
    'ampharos', 'dragonite', 'gyarados', 'snorlax', 'gengar', 'alakazam',
    'machamp', 'golem', 'arcanine', 'lapras', 'vaporeon', 'jolteon', 'flareon',
    'articuno', 'zapdos', 'moltres', 'lugia', 'ho-oh', 'celebi',
    'rayquaza', 'groudon', 'kyogre', 'dialga', 'palkia', 'giratina', 'arceus',
    'reshiram', 'zekrom', 'kyurem', 'xerneas', 'yveltal', 'zygarde',
    'solgaleo', 'lunala', 'necrozma', 'zacian', 'zamazenta', 'eternatus',
    'umbreon', 'espeon', 'leafeon', 'glaceon', 'sylveon', 'eevee',
    'bulbasaur', 'charmander', 'squirtle', 'caterpie', 'weedle', 'pidgey',
    'rattata', 'spearow', 'ekans', 'sandshrew', 'nidoran', 'clefairy',
    'vulpix', 'jigglypuff', 'zubat', 'oddish', 'paras', 'venonat',
    'diglett', 'meowth', 'psyduck', 'mankey', 'growlithe', 'poliwag',
    'abra', 'machop', 'bellsprout', 'tentacool', 'geodude', 'ponyta',
    'slowpoke', 'magnemite', 'farfetchd', 'doduo', 'seel', 'grimer',
    'shellder', 'gastly', 'onix', 'drowzee', 'krabby', 'voltorb',
    'exeggcute', 'cubone', 'hitmonlee', 'hitmonchan', 'lickitung', 'koffing',
    'rhyhorn', 'chansey', 'tangela', 'kangaskhan', 'horsea', 'goldeen',
    'staryu', 'scyther', 'jynx', 'electabuzz', 'magmar', 'pinsir',
    'tauros', 'magikarp', 'ditto', 'porygon', 'omanyte', 'kabuto',
    'aerodactyl', 'snorlax', 'dratini', 'dragonair',
    // Gen 2+
    'chikorita', 'cyndaquil', 'totodile', 'sentret', 'hoothoot', 'ledyba',
    'spinarak', 'chinchou', 'togepi', 'natu', 'mareep', 'marill',
    'sudowoodo', 'politoed', 'hoppip', 'aipom', 'sunkern', 'yanma',
    'wooper', 'murkrow', 'misdreavus', 'unown', 'wobbuffet', 'girafarig',
    'pineco', 'dunsparce', 'gligar', 'steelix', 'snubbull', 'qwilfish',
    'scizor', 'shuckle', 'heracross', 'sneasel', 'teddiursa', 'slugma',
    'swinub', 'corsola', 'remoraid', 'delibird', 'mantine', 'skarmory',
    'houndour', 'kingdra', 'phanpy', 'porygon2', 'stantler', 'smeargle',
    'tyrogue', 'smoochum', 'elekid', 'magby', 'miltank', 'blissey',
    'raikou', 'entei', 'suicune', 'larvitar', 'tyranitar',
    // Newer gens
    'stonjourner', 'dracovish', 'dragapult', 'corviknight', 'toxtricity',
    'grimmsnarl', 'alcremie', 'falinks', 'pincurchin', 'frosmoth',
    'eiscue', 'indeedee', 'morpeko', 'cufant', 'duraludon', 'dreepy',
    'zacian', 'zamazenta', 'eternatus', 'kubfu', 'urshifu', 'zarude',
    'regieleki', 'regidrago', 'glastrier', 'spectrier', 'calyrex'
  ];
  
  for (const pokemon of pokemonNames) {
    if (nameLower.includes(pokemon)) {
      // Return with proper capitalization
      return pokemon.charAt(0).toUpperCase() + pokemon.slice(1);
    }
  }
  
  return null;
}

function buildPokemonQuery(itemName: string): string {
  const nameLower = itemName.toLowerCase();
  
  // First, try to extract Pokemon name
  const pokemonName = extractPokemonName(itemName);
  
  if (pokemonName) {
    let query = `name:${pokemonName}*`;
    
    // Add subtype filters if detected (but NOT in the name search)
    if (nameLower.includes('vmax')) {
      query += ' subtypes:VMAX';
    } else if (nameLower.includes('vstar')) {
      query += ' subtypes:VSTAR';
    } else if (nameLower.includes(' v ') || nameLower.endsWith(' v') || nameLower.includes(' v-')) {
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
      'battle styles': 'set.id:swsh5',
      'chilling reign': 'set.id:swsh6',
      'evolving skies': 'set.id:swsh7',
      'fusion strike': 'set.id:swsh8',
      'brilliant stars': 'set.id:swsh9',
      'astral radiance': 'set.id:swsh10',
      'lost origin': 'set.id:swsh11',
      'silver tempest': 'set.id:swsh12',
      'crown zenith': 'set.id:swsh12pt5',
    };
    
    for (const [pattern, filter] of Object.entries(setPatterns)) {
      if (nameLower.includes(pattern)) {
        query += ` ${filter}`;
        break;
      }
    }
    
    return query;
  }
  
  // Fallback: Clean up the name for search (remove mechanics/noise)
  const cleanName = itemName
    .replace(/\b(pokemon|pokémon|card|tcg|holo|holographic|reverse holo)\b/gi, '')
    .replace(/\b(single strike|rapid strike|fusion strike)\b/gi, '') // Remove battle styles
    .replace(/\b(vmax|vstar|gx|ex|v)\b/gi, '') // Remove card types
    .replace(/\b(full art|alt art|rainbow|secret rare|promo)\b/gi, '') // Remove rarity indicators
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleanName && cleanName.length > 2) {
    return `name:${cleanName}*`;
  }
  
  // Last resort: just return the original
  return itemName;
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
  
  // Extract Pokemon name from search term
  const searchPokemon = extractPokemonName(searchTerm);
  
  // Check for exact Pokemon name match
  if (searchPokemon && nameLower.includes(searchPokemon.toLowerCase())) {
    return 0.95;
  }
  
  // Check if card name is in search term
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
  const pokemonName = extractPokemonName(itemName);
  const searchTerm = pokemonName || itemName;
  const searchUrl = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(searchTerm)}`;
  
  return {
    source: 'pokemon_tcg',
    available: true,
    query,
    totalListings: 0,
    sampleListings: [{
      title: `Search TCGPlayer for "${searchTerm}"`,
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