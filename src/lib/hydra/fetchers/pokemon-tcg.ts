// FILE: src/lib/hydra/fetchers/pokemon-tcg.ts
// HYDRA v7.0 - Pokemon TCG API Fetcher
// FIXED v6.3: Retry now uses DIFFERENT query strategies, not identical query
// FIXED v7.0: Timeout bumped from 10s → 30s (API is slow on cold starts)
// FIXED v7.5: Added missing Pokemon names (mamoswine, etc), fixed query building

import type { MarketDataSource, AuthorityData } from '../types.js';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const POKEMON_TCG_TIMEOUT = 30000; // FIXED v7.0: 30 second timeout (was 10s, API is slow)

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
      
      // If error, try simplified search strategies
      if (response.status === 404 || response.status === 400) {
        console.log('🔄 Pokemon TCG: Retrying with simplified query...');
        return await retryWithSimpleQuery(itemName, headers, startTime, 1);
      }
      
      return createFallbackResult(itemName, searchQuery);
    }
    
    const data = await response.json();
    const cards = data.data || [];
    
    if (cards.length === 0) {
      console.log('⚠️ Pokemon TCG: No matching cards found, trying simplified search...');
      return await retryWithSimpleQuery(itemName, headers, startTime, 1);
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
      title: `${bestMatch.name} - ${bestMatch.set?.name}`,
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
      console.error(`❌ Pokemon TCG API timeout (${POKEMON_TCG_TIMEOUT / 1000}s)`);
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
 * Retry with progressively simpler query strategies
 * FIXED v6.3.1: Don't use quotes for single-word names, fix set.id lookup
 */
async function retryWithSimpleQuery(
  itemName: string, 
  headers: Record<string, string>,
  startTime: number,
  retryLevel: number
): Promise<MarketDataSource> {
  const pokemonName = extractPokemonName(itemName);
  
  if (!pokemonName) {
    console.log('⚠️ Pokemon TCG: Could not extract Pokemon name');
    return createFallbackResult(itemName, itemName);
  }
  
  let simpleQuery: string;
  
  switch (retryLevel) {
    case 1:
      // FIXED v7.5: Just the name, no "Pokemon" suffix
      simpleQuery = `name:${pokemonName}`;
      break;
    case 2:
      simpleQuery = `name:${pokemonName.toLowerCase()}`;
      break;
    case 3: {
      const setId = extractSetId(itemName);
      if (setId) {
        simpleQuery = `name:${pokemonName} set.id:${setId}`;
      } else {
        const setName = extractSetName(itemName);
        if (setName) {
          simpleQuery = setName.includes(' ') 
            ? `name:${pokemonName} set.name:"${setName}"`
            : `name:${pokemonName} set.name:${setName}`;
        } else {
          simpleQuery = pokemonName;
        }
      }
      break;
    }
    default:
      return createFallbackResult(itemName, itemName);
  }
  
  console.log(`🔄 Pokemon TCG retry #${retryLevel}: "${simpleQuery}"`);
  
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
    
    if (!response.ok) {
      if (retryLevel < 3) {
        return await retryWithSimpleQuery(itemName, headers, startTime, retryLevel + 1);
      }
      return createFallbackResult(itemName, simpleQuery);
    }
    
    const data = await response.json();
    const cards = data.data || [];
    
    if (cards.length === 0) {
      if (retryLevel < 3) {
        return await retryWithSimpleQuery(itemName, headers, startTime, retryLevel + 1);
      }
      return createFallbackResult(itemName, simpleQuery);
    }
    
    const bestMatch = cards[0];
    console.log(`✅ Pokemon TCG (retry #${retryLevel}): Found "${bestMatch.name}" from ${bestMatch.set?.name}`);
    
    const prices = bestMatch.tcgplayer?.prices || {};
    const priceData = extractPriceData(prices);
    
    const authorityData: AuthorityData = {
      source: 'pokemon_tcg',
      verified: true,
      confidence: calculateMatchConfidence(itemName, bestMatch.name, bestMatch.set?.name) * (1 - retryLevel * 0.05),
      title: `${bestMatch.name} - ${bestMatch.set?.name}`,
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
        retryLevel,
      },
    };
    
  } catch (error) {
    console.error(`❌ Pokemon TCG retry #${retryLevel} error:`, error);
    if (retryLevel < 3) {
      return await retryWithSimpleQuery(itemName, headers, startTime, retryLevel + 1);
    }
    return createFallbackResult(itemName, itemName);
  }
}

// ==================== QUERY BUILDING ====================

function buildPokemonQuery(itemName: string): string {
  const nameLower = itemName.toLowerCase();
  
  // First, try to extract Pokemon name
  const pokemonName = extractPokemonName(itemName);
  
  if (pokemonName) {
    // FIXED v7.5: Do NOT include "Pokemon" in name search - causes 400 errors
    let query = `name:${pokemonName}`;
    
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
      query += ' subtypes:ex';
    }
    
    // Add set filter using extractSetId for correct IDs
    const setId = extractSetId(itemName);
    if (setId) {
      query += ` set.id:${setId}`;
    }
    
    return query;
  }
  
  // Fallback: Clean up the name for search (remove mechanics/noise)
  // FIXED v7.5: Remove "pokemon" from the search to avoid API errors
  const cleanName = itemName
    .replace(/\b(pokemon|pokémon|card|tcg|holo|holographic|reverse holo)\b/gi, '')
    .replace(/\b(single strike|rapid strike|fusion strike)\b/gi, '')
    .replace(/\b(vmax|vstar|gx|ex|v)\b/gi, '')
    .replace(/\b(full art|alt art|rainbow|secret rare|promo)\b/gi, '')
    .replace(/#?\d+\/\d+/g, '')
    .replace(/from\s+\w+\s+set/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleanName && cleanName.length > 2) {
    return `name:${cleanName}`;
  }
  
  return itemName;
}

// ==================== EXTRACTION HELPERS ====================

function extractSetId(itemName: string): string | null {
  const nameLower = itemName.toLowerCase();
  
  const setIdPatterns: Record<string, string> = {
    'celebrations': 'cel25',
    'base set': 'base1',
    'jungle': 'base2',
    'fossil': 'base3',
    'team rocket': 'base5',
    'gym heroes': 'gym1',
    'gym challenge': 'gym2',
    'neo genesis': 'neo1',
    'neo discovery': 'neo2',
    'neo revelation': 'neo3',
    'neo destiny': 'neo4',
    'legendary collection': 'base6',
    'evolving skies': 'swsh7',
    'brilliant stars': 'swsh9',
    'astral radiance': 'swsh10',
    'lost origin': 'swsh11',
    'silver tempest': 'swsh12',
    'crown zenith': 'swsh12pt5',
    'paldea evolved': 'sv2',
    'obsidian flames': 'sv3',
    'paradox rift': 'sv4',
    'temporal forces': 'sv5',
    'twilight masquerade': 'sv6',
    'shrouded fable': 'sv6pt5',
    'surging sparks': 'sv7',
    'prismatic evolutions': 'sv8',
    'battle styles': 'swsh5',
    'chilling reign': 'swsh6',
    'fusion strike': 'swsh8',
    'vivid voltage': 'swsh4',
    'darkness ablaze': 'swsh3',
    'rebel clash': 'swsh2',
    'sword shield': 'swsh1',
    'cosmic eclipse': 'sm12',
    'hidden fates': 'sm115',
    'shining fates': 'swsh45',
    'champions path': 'swsh35',
    'scarlet violet': 'sv1',
  };
  
  for (const [pattern, setId] of Object.entries(setIdPatterns)) {
    if (nameLower.includes(pattern)) {
      return setId;
    }
  }
  
  return null;
}

function extractSetName(itemName: string): string | null {
  const nameLower = itemName.toLowerCase();
  
  const setPatterns: Record<string, string> = {
    'celebrations': 'Celebrations',
    'base set': 'Base',
    'jungle': 'Jungle',
    'fossil': 'Fossil',
    'team rocket': 'Team Rocket',
    'gym heroes': 'Gym Heroes',
    'gym challenge': 'Gym Challenge',
    'neo genesis': 'Neo Genesis',
    'neo discovery': 'Neo Discovery',
    'legendary collection': 'Legendary Collection',
    'evolving skies': 'Evolving Skies',
    'brilliant stars': 'Brilliant Stars',
    'astral radiance': 'Astral Radiance',
    'lost origin': 'Lost Origin',
    'silver tempest': 'Silver Tempest',
    'crown zenith': 'Crown Zenith',
    'scarlet violet': 'Scarlet & Violet',
    'paldea evolved': 'Paldea Evolved',
    'obsidian flames': 'Obsidian Flames',
    'paradox rift': 'Paradox Rift',
    'temporal forces': 'Temporal Forces',
    'twilight masquerade': 'Twilight Masquerade',
    'shrouded fable': 'Shrouded Fable',
    'surging sparks': 'Surging Sparks',
    'prismatic evolutions': 'Prismatic Evolutions',
    'battle styles': 'Battle Styles',
    'chilling reign': 'Chilling Reign',
    'fusion strike': 'Fusion Strike',
    'vivid voltage': 'Vivid Voltage',
    'darkness ablaze': 'Darkness Ablaze',
    'rebel clash': 'Rebel Clash',
    'sword shield': 'Sword & Shield',
    'cosmic eclipse': 'Cosmic Eclipse',
    'hidden fates': 'Hidden Fates',
    'shining fates': 'Shining Fates',
    'champions path': 'Champion\'s Path',
  };
  
  for (const [pattern, setName] of Object.entries(setPatterns)) {
    if (nameLower.includes(pattern)) {
      return setName;
    }
  }
  
  return null;
}

function extractPokemonName(itemName: string): string | null {
  const nameLower = itemName.toLowerCase();
  
  // FIXED v7.5: Added mamoswine + many missing Pokemon from all generations
  const pokemonNames = [
    // Gen 1
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
    'aerodactyl', 'dratini', 'dragonair',
    // Gen 2
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
    // Gen 3
    'treecko', 'torchic', 'mudkip', 'poochyena', 'zigzagoon', 'wurmple',
    'lotad', 'seedot', 'taillow', 'wingull', 'ralts', 'surskit',
    'shroomish', 'slakoth', 'nincada', 'whismur', 'makuhita', 'azurill',
    'nosepass', 'skitty', 'sableye', 'mawile', 'aron', 'meditite',
    'electrike', 'plusle', 'minun', 'volbeat', 'illumise', 'roselia',
    'gulpin', 'carvanha', 'wailmer', 'numel', 'torkoal', 'spoink',
    'spinda', 'trapinch', 'cacnea', 'swablu', 'zangoose', 'seviper',
    'lunatone', 'solrock', 'barboach', 'corphish', 'baltoy', 'lileep',
    'anorith', 'feebas', 'castform', 'kecleon', 'shuppet', 'duskull',
    'tropius', 'chimecho', 'absol', 'wynaut', 'snorunt', 'spheal',
    'clamperl', 'relicanth', 'luvdisc', 'bagon', 'beldum', 'regirock',
    'regice', 'registeel', 'latias', 'latios', 'jirachi', 'deoxys',
    'blaziken', 'swampert', 'sceptile', 'gardevoir', 'flygon', 'salamence', 'metagross',
    // Gen 4 - FIXED v7.5: Added mamoswine and other missing Pokemon
    'turtwig', 'chimchar', 'piplup', 'starly', 'bidoof', 'kricketot',
    'shinx', 'budew', 'cranidos', 'shieldon', 'burmy', 'combee',
    'pachirisu', 'buizel', 'cherubi', 'shellos', 'drifloon', 'buneary',
    'glameow', 'chingling', 'stunky', 'bronzor', 'bonsly', 'mimejr',
    'happiny', 'chatot', 'spiritomb', 'gible', 'munchlax', 'riolu',
    'hippopotas', 'skorupi', 'croagunk', 'carnivine', 'finneon', 'mantyke',
    'snover', 'rotom', 'uxie', 'mesprit', 'azelf', 'heatran',
    'regigigas', 'cresselia', 'phione', 'manaphy', 'darkrai', 'shaymin',
    'luxray', 'roserade', 'garchomp', 'lucario', 'weavile', 'magnezone',
    'rhyperior', 'tangrowth', 'electivire', 'magmortar', 'togekiss', 'yanmega',
    'gliscor', 'mamoswine', 'porygon-z', 'gallade', 'probopass', 'dusknoir',
    'froslass', 'infernape', 'empoleon', 'torterra',
    // Gen 5
    'victini', 'snivy', 'tepig', 'oshawott', 'patrat', 'lillipup',
    'purrloin', 'pansage', 'pansear', 'panpour', 'munna', 'pidove',
    'blitzle', 'roggenrola', 'woobat', 'drilbur', 'audino', 'timburr',
    'tympole', 'throh', 'sawk', 'sewaddle', 'venipede', 'cottonee',
    'petilil', 'basculin', 'sandile', 'darumaka', 'maractus', 'dwebble',
    'scraggy', 'sigilyph', 'yamask', 'tirtouga', 'archen', 'trubbish',
    'zorua', 'zoroark', 'minccino', 'gothita', 'solosis', 'ducklett',
    'vanillite', 'deerling', 'emolga', 'karrablast', 'foongus', 'frillish',
    'alomomola', 'joltik', 'ferroseed', 'klink', 'tynamo', 'elgyem',
    'litwick', 'axew', 'cubchoo', 'cryogonal', 'shelmet', 'stunfisk',
    'mienfoo', 'druddigon', 'golett', 'pawniard', 'bouffalant', 'rufflet',
    'vullaby', 'heatmor', 'durant', 'deino', 'larvesta', 'cobalion',
    'terrakion', 'virizion', 'tornadus', 'thundurus', 'landorus',
    'keldeo', 'meloetta', 'genesect', 'hydreigon', 'volcarona',
    // Gen 6
    'chespin', 'fennekin', 'froakie', 'bunnelby', 'fletchling', 'scatterbug',
    'litleo', 'flabebe', 'skiddo', 'pancham', 'furfrou', 'espurr',
    'honedge', 'spritzee', 'swirlix', 'inkay', 'binacle', 'skrelp',
    'clauncher', 'helioptile', 'tyrunt', 'amaura', 'hawlucha', 'dedenne',
    'carbink', 'goomy', 'klefki', 'phantump', 'pumpkaboo', 'bergmite',
    'noibat', 'diancie', 'hoopa', 'volcanion', 'greninja', 'talonflame',
    'aegislash', 'goodra', 'noivern',
    // Gen 7
    'rowlet', 'litten', 'popplio', 'pikipek', 'yungoos', 'grubbin',
    'crabrawler', 'oricorio', 'cutiefly', 'rockruff', 'wishiwashi', 'mareanie',
    'mudbray', 'dewpider', 'fomantis', 'morelull', 'salandit', 'stufful',
    'bounsweet', 'comfey', 'oranguru', 'passimian', 'wimpod', 'sandygast',
    'pyukumuku', 'type-null', 'silvally', 'minior', 'komala', 'turtonator',
    'togedemaru', 'mimikyu', 'bruxish', 'drampa', 'dhelmise', 'jangmo-o',
    'tapu-koko', 'tapu-lele', 'tapu-bulu', 'tapu-fini', 'cosmog', 'cosmoem',
    'nihilego', 'buzzwole', 'pheromosa', 'xurkitree', 'celesteela', 'kartana',
    'guzzlord', 'necrozma', 'magearna', 'marshadow', 'poipole', 'naganadel',
    'stakataka', 'blacephalon', 'zeraora', 'decidueye', 'incineroar', 'primarina',
    // Gen 8
    'grookey', 'scorbunny', 'sobble', 'skwovet', 'rookidee', 'blipbug',
    'nickit', 'gossifleur', 'wooloo', 'chewtle', 'yamper', 'rolycoly',
    'applin', 'silicobra', 'cramorant', 'arrokuda', 'toxel', 'sizzlipede',
    'clobbopus', 'sinistea', 'hatenna', 'impidimp', 'obstagoon', 'perrserker',
    'cursola', 'sirfetchd', 'mrrime', 'runerigus', 'milcery', 'falinks',
    'pincurchin', 'snom', 'stonjourner', 'eiscue', 'indeedee', 'morpeko',
    'cufant', 'dracozolt', 'arctozolt', 'dracovish', 'arctovish', 'duraludon',
    'dreepy', 'dragapult', 'kubfu', 'urshifu', 'zarude', 'regieleki',
    'regidrago', 'glastrier', 'spectrier', 'calyrex', 'corviknight', 'toxtricity',
    'grimmsnarl', 'alcremie', 'frosmoth', 'copperajah', 'rillaboom', 'cinderace', 'inteleon',
    // Gen 9
    'sprigatito', 'fuecoco', 'quaxly', 'lechonk', 'tarountula', 'nymble',
    'pawmi', 'tandemaus', 'fidough', 'smoliv', 'squawkabilly', 'nacli',
    'charcadet', 'tadbulb', 'wattrel', 'maschiff', 'shroodle', 'bramblin',
    'toedscool', 'klawf', 'capsakid', 'rellor', 'flittle', 'tinkatink',
    'wiglett', 'bombirdier', 'finizen', 'varoom', 'cyclizar', 'orthworm',
    'glimmet', 'greavard', 'flamigo', 'cetoddle', 'veluza', 'dondozo',
    'tatsugiri', 'annihilape', 'clodsire', 'farigiraf', 'dudunsparce', 'kingambit',
    'greattusk', 'screamtail', 'brutebonnet', 'fluttermane', 'slitherwing', 'sandyshocks',
    'irontreads', 'ironbundle', 'ironhands', 'ironjugulis', 'ironmoth', 'ironthorns',
    'frigibax', 'arctibax', 'baxcalibur', 'gimmighoul', 'gholdengo', 'wochien',
    'chienpao', 'tinglu', 'chiyu', 'roaringmoon', 'ironvaliant', 'koraidon',
    'miraidon', 'walkingwake', 'ironleaves', 'tinkaton', 'palafin', 'revavroom',
    'armarouge', 'ceruledge', 'bellibolt', 'kilowattrel', 'mabosstiff', 'grafaiai',
    'brambleghast', 'toedscruel', 'scovillain', 'rabsca', 'espathra', 'wugtrio',
    'cetitan', 'meowscarada', 'skeledirge', 'quaquaval',
  ];
  
  for (const pokemon of pokemonNames) {
    if (nameLower.includes(pokemon)) {
      return pokemon.charAt(0).toUpperCase() + pokemon.slice(1);
    }
  }
  
  // Try to extract from card number pattern (e.g., "Zekrom #010/025")
  const cardNameMatch = itemName.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:Pokemon|Card|#|\d)/i);
  if (cardNameMatch) {
    const potentialName = cardNameMatch[1].trim();
    if (potentialName.length >= 3 && potentialName.length <= 20) {
      return potentialName;
    }
  }
  
  return null;
}

// ==================== PRICE EXTRACTION ====================

function extractPriceData(prices: any): { market: number; low: number; mid: number; high: number; conditions: any[] } | null {
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

// ==================== CONFIDENCE ====================

function calculateMatchConfidence(searchTerm: string, cardName: string, setName?: string): number {
  const searchLower = searchTerm.toLowerCase();
  const nameLower = cardName.toLowerCase();
  
  const searchPokemon = extractPokemonName(searchTerm);
  
  if (searchPokemon && nameLower.includes(searchPokemon.toLowerCase())) {
    if (setName) {
      const setLower = setName.toLowerCase();
      if (searchLower.includes(setLower) || searchLower.includes(setLower.replace(/[^a-z]/g, ''))) {
        return 0.98;
      }
    }
    return 0.95;
  }
  
  if (nameLower === searchLower || searchLower.includes(nameLower)) {
    return 0.95;
  }
  
  if (searchLower.includes(nameLower.split(' ')[0])) {
    return 0.85;
  }
  
  if (setName && searchLower.includes(setName.toLowerCase())) {
    return 0.80;
  }
  
  return 0.65;
}

// ==================== FALLBACK ====================

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
      pokemonName,
    },
  };
}