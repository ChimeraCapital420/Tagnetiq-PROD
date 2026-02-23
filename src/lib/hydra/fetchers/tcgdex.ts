// FILE: src/lib/hydra/fetchers/tcgdex.ts
// HYDRA v8.4 - TCGdex Authority Data Fetcher
// PRIMARY authority for Pokemon cards — replaces unreliable pokemontcg.io
//
// Why TCGdex over Pokemon TCG API:
//   - pokemontcg.io: 80% error rate, 6.3s avg response, constant 504s
//   - TCGdex: Free, no API key, includes TCGPlayer + Cardmarket pricing
//   - TCGdex: Open source, community maintained, fast responses (<1s typical)
//
// Data includes:
//   - Card details (name, set, rarity, HP, attacks, illustrator)
//   - TCGPlayer pricing (USD) — low, mid, high, market price
//   - Cardmarket pricing (EUR) — avg, trend, 7-day, 30-day
//   - Card images (small + high-res)
//   - Variant info (holo, 1st edition, reverse, shadowless, etc.)
//
// Docs: https://tcgdex.dev
// No API key required. No rate limit issues.

import type { MarketDataSource, AuthorityData } from '../types.js';

const TCGDEX_BASE_URL = 'https://api.tcgdex.net/v2/en';
const TCGDEX_TIMEOUT = 15000; // 15s — usually responds in <1s

// =============================================================================
// MAIN FETCHER
// =============================================================================

export async function fetchTcgdexData(itemName: string): Promise<MarketDataSource> {
  const startTime = Date.now();

  try {
    // Extract Pokemon name from item description
    const pokemonName = extractPokemonName(itemName);
    if (!pokemonName) {
      console.log(`⚠️ TCGdex: Could not extract Pokemon name from "${itemName}"`);
      return createEmptyResult(itemName, 'Could not extract Pokemon name');
    }

    console.log(`🔍 TCGdex search: "${pokemonName}" (from "${itemName}")`);

    // Step 1: Search for matching cards
    const searchResults = await searchCards(pokemonName);
    if (!searchResults || searchResults.length === 0) {
      console.log(`⚠️ TCGdex: No cards found for "${pokemonName}"`);
      return createEmptyResult(itemName, 'No matching cards found');
    }

    console.log(`✅ TCGdex: Found ${searchResults.length} cards for "${pokemonName}"`);

    // Step 2: Find best match based on set name, card number, variant
    const bestMatchId = findBestMatch(searchResults, itemName);

    // Step 3: Fetch full card detail (includes pricing)
    const cardDetail = await fetchCardDetail(bestMatchId);
    if (!cardDetail) {
      console.log(`⚠️ TCGdex: Could not fetch detail for card ${bestMatchId}`);
      return createEmptyResult(itemName, 'Card detail fetch failed');
    }

    console.log(`✅ TCGdex: "${cardDetail.name}" from ${cardDetail.set?.name} (${bestMatchId})`);

    // Step 4: Extract pricing
    const priceData = extractPriceData(cardDetail.pricing);

    // Step 5: Build authority data (matches AuthorityData type from types.ts)
    const authorityData: AuthorityData = {
      source: 'tcgdex',
      verified: true,
      confidence: calculateMatchConfidence(itemName, cardDetail.name, cardDetail.set?.name),
      title: `${cardDetail.name} - ${cardDetail.set?.name || 'Unknown Set'}`,
      itemDetails: {
        cardId: cardDetail.id,
        name: cardDetail.name,
        setName: cardDetail.set?.name,
        setId: cardDetail.set?.id,
        number: cardDetail.localId,
        rarity: cardDetail.rarity,
        artist: cardDetail.illustrator,
        types: cardDetail.types,
        hp: cardDetail.hp,
        supertype: cardDetail.category, // "Pokemon", "Trainer", "Energy"
        subtypes: cardDetail.stage ? [cardDetail.stage] : undefined,
        imageSmall: cardDetail.image ? `${cardDetail.image}/low.webp` : undefined,
        imageLarge: cardDetail.image ? `${cardDetail.image}/high.webp` : undefined,
        releaseDate: cardDetail.set?.releaseDate,
        // TCGdex-specific extras
        evolveFrom: cardDetail.evolveFrom,
        variants: cardDetail.variants,
        variantsDetailed: cardDetail.variants_detailed,
        legal: cardDetail.legal,
        attacks: cardDetail.attacks,
        abilities: cardDetail.abilities,
        weaknesses: cardDetail.weaknesses,
        resistances: cardDetail.resistances,
        retreat: cardDetail.retreat,
        // Pricing URLs
        tcgplayerUrl: cardDetail.pricing?.tcgplayer?.holofoil?.productId
          ? `https://www.tcgplayer.com/product/${cardDetail.pricing.tcgplayer.holofoil.productId}`
          : undefined,
        cardmarketUrl: cardDetail.pricing?.cardmarket?.idProduct
          ? `https://www.cardmarket.com/en/Pokemon/Products/Singles/${cardDetail.pricing.cardmarket.idProduct}`
          : undefined,
      },
      priceData: priceData ? {
        market: priceData.market,
        conditions: priceData.conditions,
      } : undefined,
      externalUrl: `https://www.tcgdex.net/database/${cardDetail.set?.id || 'unknown'}/${cardDetail.localId || cardDetail.id}`,
      lastUpdated: cardDetail.pricing?.tcgplayer?.updated || cardDetail.pricing?.cardmarket?.updated || new Date().toISOString(),
    };

    // Step 6: Build sample listings from search results (no extra API calls)
    const sampleListings = searchResults.slice(0, 5).map((card: any) => ({
      title: `${card.name} - ${card.localId || card.id}`,
      price: 0, // Price only available from detail endpoint
      condition: 'N/A',
      url: `https://www.tcgdex.net/database/${card.id?.split('-')[0] || 'unknown'}/${card.localId || card.id}`,
    }));

    const responseTime = Date.now() - startTime;
    console.log(`✅ TCGdex: Authority data retrieved in ${responseTime}ms`);

    return {
      source: 'tcgdex',
      available: true,
      query: pokemonName,
      totalListings: searchResults.length,
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
        responseTime,
        totalCards: searchResults.length,
        bestMatchId: cardDetail.id,
        hasTcgplayerPricing: !!cardDetail.pricing?.tcgplayer,
        hasCardmarketPricing: !!cardDetail.pricing?.cardmarket,
        tcgplayerUpdated: cardDetail.pricing?.tcgplayer?.updated,
        cardmarketUpdated: cardDetail.pricing?.cardmarket?.updated,
      },
    };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`❌ TCGdex timeout (${TCGDEX_TIMEOUT / 1000}s)`);
      return {
        source: 'tcgdex',
        available: false,
        query: itemName,
        totalListings: 0,
        error: 'API request timed out',
      };
    }
    console.error('❌ TCGdex fetch error:', error.message || error);
    return {
      source: 'tcgdex',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// API CALLS
// =============================================================================

async function searchCards(pokemonName: string): Promise<any[] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TCGDEX_TIMEOUT);

  try {
    const url = `${TCGDEX_BASE_URL}/cards?name=${encodeURIComponent(pokemonName)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`❌ TCGdex search error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return Array.isArray(data) ? data : null;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchCardDetail(cardId: string): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TCGDEX_TIMEOUT);

  try {
    const url = `${TCGDEX_BASE_URL}/cards/${cardId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`❌ TCGdex card detail error: ${response.status} for ${cardId}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// =============================================================================
// BEST MATCH SELECTION
// =============================================================================

function findBestMatch(searchResults: any[], itemName: string): string {
  const nameLower = itemName.toLowerCase();

  // Try to extract set info from item name
  const setId = extractSetId(nameLower);
  const cardNumber = extractCardNumber(nameLower);

  // Priority 1: Match by set + card number
  if (setId && cardNumber) {
    const exactMatch = searchResults.find((card: any) =>
      card.id?.toLowerCase().includes(setId) &&
      card.localId === cardNumber
    );
    if (exactMatch) return exactMatch.id;
  }

  // Priority 2: Match by set only
  if (setId) {
    const setMatch = searchResults.find((card: any) =>
      card.id?.toLowerCase().includes(setId)
    );
    if (setMatch) return setMatch.id;
  }

  // Priority 3: Match by card number pattern (e.g., "125/195")
  if (cardNumber) {
    const numberMatch = searchResults.find((card: any) =>
      card.localId === cardNumber
    );
    if (numberMatch) return numberMatch.id;
  }

  // Priority 4: Check for variant keywords
  if (nameLower.includes('vmax')) {
    const vmaxMatch = searchResults.find((c: any) => c.name?.toLowerCase().includes('vmax'));
    if (vmaxMatch) return vmaxMatch.id;
  }
  if (nameLower.includes('vstar')) {
    const vstarMatch = searchResults.find((c: any) => c.name?.toLowerCase().includes('vstar'));
    if (vstarMatch) return vstarMatch.id;
  }
  if (nameLower.includes(' gx')) {
    const gxMatch = searchResults.find((c: any) => c.name?.toLowerCase().includes('gx'));
    if (gxMatch) return gxMatch.id;
  }
  if (nameLower.includes(' ex') && !nameLower.includes('exec')) {
    const exMatch = searchResults.find((c: any) => c.name?.toLowerCase().includes(' ex'));
    if (exMatch) return exMatch.id;
  }

  // Priority 5: Default to first result
  return searchResults[0].id;
}

function extractCardNumber(nameLower: string): string | null {
  // Match patterns like "125/195", "#125", "card 125"
  const slashMatch = nameLower.match(/(\d{1,4})\s*\/\s*\d{1,4}/);
  if (slashMatch) return slashMatch[1];

  const hashMatch = nameLower.match(/#(\d{1,4})/);
  if (hashMatch) return hashMatch[1];

  return null;
}

// =============================================================================
// SET ID EXTRACTION (TCGdex set IDs)
// =============================================================================

function extractSetId(nameLower: string): string | null {
  // TCGdex uses its own set ID format (different from pokemontcg.io)
  const setPatterns: Record<string, string> = {
    'base set': 'base1',
    'jungle': 'base2',
    'fossil': 'base3',
    'base set 2': 'base4',
    'team rocket': 'base5',
    'gym heroes': 'gym1',
    'gym challenge': 'gym2',
    'neo genesis': 'neo1',
    'neo discovery': 'neo2',
    'neo revelation': 'neo3',
    'neo destiny': 'neo4',
    'legendary collection': 'lc',
    'expedition': 'ecard1',
    'aquapolis': 'ecard2',
    'skyridge': 'ecard3',
    'ruby sapphire': 'ex1',
    'sandstorm': 'ex2',
    'dragon': 'ex3',
    'evolving skies': 'swsh7',
    'brilliant stars': 'swsh9',
    'astral radiance': 'swsh10',
    'lost origin': 'swsh11',
    'silver tempest': 'swsh12',
    'crown zenith': 'swsh12.5',
    'paldea evolved': 'sv02',
    'obsidian flames': 'sv03',
    '151': 'sv03.5',
    'paradox rift': 'sv04',
    'paldean fates': 'sv04.5',
    'temporal forces': 'sv05',
    'twilight masquerade': 'sv06',
    'shrouded fable': 'sv06.5',
    'surging sparks': 'sv07',
    'prismatic evolutions': 'sv08',
    'battle styles': 'swsh5',
    'chilling reign': 'swsh6',
    'fusion strike': 'swsh8',
    'vivid voltage': 'swsh4',
    'shining fates': 'swsh4.5',
    'darkness ablaze': 'swsh3',
    'champions path': 'swsh3.5',
    'rebel clash': 'swsh2',
    'sword shield': 'swsh1',
    'cosmic eclipse': 'sm12',
    'hidden fates': 'sm115',
    'unified minds': 'sm11',
    'unbroken bonds': 'sm10',
    'team up': 'sm9',
    'lost thunder': 'sm8',
    'dragon majesty': 'sm7.5',
    'celestial storm': 'sm7',
    'forbidden light': 'sm6',
    'ultra prism': 'sm5',
    'crimson invasion': 'sm4',
    'shining legends': 'sm3.5',
    'burning shadows': 'sm3',
    'guardians rising': 'sm2',
    'sun moon': 'sm1',
    'scarlet violet': 'sv01',
    'celebrations': 'cel25',
    'detective pikachu': 'det1',
  };

  for (const [pattern, setId] of Object.entries(setPatterns)) {
    if (nameLower.includes(pattern)) {
      return setId;
    }
  }

  return null;
}

// =============================================================================
// POKEMON NAME EXTRACTION
// =============================================================================

function extractPokemonName(itemName: string): string | null {
  const nameLower = itemName.toLowerCase();

  // Comprehensive list — sorted by length descending at runtime
  // so "klinklang" matches before "klink", "charizard" before "char"
  const pokemonNames = [
    // Multi-word / special names
    'reshiram & charizard', 'charizard & braixen', 'mega charizard',
    'tapu koko', 'tapu lele', 'tapu bulu', 'tapu fini',
    'mr. mime', 'mr. rime', 'type: null', 'ho-oh', 'porygon-z', 'jangmo-o',
    // Gen 1
    'bulbasaur', 'ivysaur', 'venusaur', 'charmander', 'charmeleon', 'charizard',
    'squirtle', 'wartortle', 'blastoise', 'caterpie', 'metapod', 'butterfree',
    'weedle', 'kakuna', 'beedrill', 'pidgey', 'pidgeotto', 'pidgeot',
    'rattata', 'raticate', 'spearow', 'fearow', 'ekans', 'arbok',
    'pikachu', 'raichu', 'sandshrew', 'sandslash', 'nidoran', 'nidorina',
    'nidoqueen', 'nidorino', 'nidoking', 'clefairy', 'clefable',
    'vulpix', 'ninetales', 'jigglypuff', 'wigglytuff', 'zubat', 'golbat',
    'oddish', 'gloom', 'vileplume', 'paras', 'parasect', 'venonat', 'venomoth',
    'diglett', 'dugtrio', 'meowth', 'persian', 'psyduck', 'golduck',
    'mankey', 'primeape', 'growlithe', 'arcanine', 'poliwag', 'poliwhirl',
    'poliwrath', 'abra', 'kadabra', 'alakazam', 'machop', 'machoke', 'machamp',
    'bellsprout', 'weepinbell', 'victreebel', 'tentacool', 'tentacruel',
    'geodude', 'graveler', 'golem', 'ponyta', 'rapidash', 'slowpoke', 'slowbro',
    'magnemite', 'magneton', 'farfetchd', 'doduo', 'dodrio', 'seel', 'dewgong',
    'grimer', 'muk', 'shellder', 'cloyster', 'gastly', 'haunter', 'gengar',
    'onix', 'drowzee', 'hypno', 'krabby', 'kingler', 'voltorb', 'electrode',
    'exeggcute', 'exeggutor', 'cubone', 'marowak', 'hitmonlee', 'hitmonchan',
    'lickitung', 'koffing', 'weezing', 'rhyhorn', 'rhydon', 'chansey',
    'tangela', 'kangaskhan', 'horsea', 'seadra', 'goldeen', 'seaking',
    'staryu', 'starmie', 'scyther', 'jynx', 'electabuzz', 'magmar',
    'pinsir', 'tauros', 'magikarp', 'gyarados', 'lapras', 'ditto',
    'eevee', 'vaporeon', 'jolteon', 'flareon', 'porygon', 'omanyte', 'omastar',
    'kabuto', 'kabutops', 'aerodactyl', 'snorlax', 'articuno', 'zapdos',
    'moltres', 'dratini', 'dragonair', 'dragonite', 'mewtwo', 'mew',
    // Gen 2
    'chikorita', 'bayleef', 'meganium', 'cyndaquil', 'quilava', 'typhlosion',
    'totodile', 'croconaw', 'feraligatr', 'sentret', 'furret', 'hoothoot',
    'noctowl', 'ledyba', 'ledian', 'spinarak', 'ariados', 'crobat',
    'chinchou', 'lanturn', 'pichu', 'cleffa', 'igglybuff', 'togepi', 'togetic',
    'natu', 'xatu', 'mareep', 'flaaffy', 'ampharos', 'bellossom', 'marill',
    'azumarill', 'sudowoodo', 'politoed', 'hoppip', 'skiploom', 'jumpluff',
    'aipom', 'sunkern', 'sunflora', 'yanma', 'wooper', 'quagsire',
    'espeon', 'umbreon', 'murkrow', 'slowking', 'misdreavus', 'unown',
    'wobbuffet', 'girafarig', 'pineco', 'forretress', 'dunsparce', 'gligar',
    'steelix', 'snubbull', 'granbull', 'qwilfish', 'scizor', 'shuckle',
    'heracross', 'sneasel', 'teddiursa', 'ursaring', 'slugma', 'magcargo',
    'swinub', 'piloswine', 'corsola', 'remoraid', 'octillery', 'delibird',
    'mantine', 'skarmory', 'houndour', 'houndoom', 'kingdra', 'phanpy',
    'donphan', 'porygon2', 'stantler', 'smeargle', 'tyrogue', 'hitmontop',
    'smoochum', 'elekid', 'magby', 'miltank', 'blissey', 'raikou', 'entei',
    'suicune', 'larvitar', 'pupitar', 'tyranitar', 'lugia', 'ho-oh', 'celebi',
    // Gen 3
    'treecko', 'grovyle', 'sceptile', 'torchic', 'combusken', 'blaziken',
    'mudkip', 'marshtomp', 'swampert', 'poochyena', 'mightyena', 'zigzagoon',
    'linoone', 'ralts', 'kirlia', 'gardevoir', 'sableye', 'mawile',
    'aron', 'lairon', 'aggron', 'roselia', 'wailmer', 'wailord',
    'trapinch', 'vibrava', 'flygon', 'swablu', 'altaria', 'absol',
    'bagon', 'shelgon', 'salamence', 'beldum', 'metang', 'metagross',
    'regirock', 'regice', 'registeel', 'latias', 'latios', 'kyogre',
    'groudon', 'rayquaza', 'jirachi', 'deoxys',
    // Gen 4
    'turtwig', 'grotle', 'torterra', 'chimchar', 'monferno', 'infernape',
    'piplup', 'prinplup', 'empoleon', 'shinx', 'luxio', 'luxray',
    'roserade', 'cranidos', 'rampardos', 'shieldon', 'bastiodon',
    'riolu', 'lucario', 'gible', 'gabite', 'garchomp', 'rotom',
    'weavile', 'magnezone', 'rhyperior', 'electivire', 'magmortar',
    'togekiss', 'yanmega', 'gliscor', 'mamoswine', 'porygon-z', 'gallade',
    'probopass', 'dusknoir', 'froslass', 'uxie', 'mesprit', 'azelf',
    'dialga', 'palkia', 'heatran', 'regigigas', 'giratina', 'cresselia',
    'manaphy', 'darkrai', 'shaymin', 'arceus',
    // Gen 5
    'victini', 'snivy', 'servine', 'serperior', 'tepig', 'pignite', 'emboar',
    'oshawott', 'dewott', 'samurott', 'zorua', 'zoroark',
    'klink', 'klang', 'klinklang', 'axew', 'fraxure', 'haxorus',
    'deino', 'zweilous', 'hydreigon', 'larvesta', 'volcarona',
    'cobalion', 'terrakion', 'virizion', 'tornadus', 'thundurus', 'landorus',
    'reshiram', 'zekrom', 'kyurem', 'keldeo', 'meloetta', 'genesect',
    // Gen 6
    'chespin', 'quilladin', 'chesnaught', 'fennekin', 'braixen', 'delphox',
    'froakie', 'frogadier', 'greninja', 'fletchling', 'fletchinder', 'talonflame',
    'honedge', 'doublade', 'aegislash', 'goomy', 'sliggoo', 'goodra',
    'noibat', 'noivern', 'xerneas', 'yveltal', 'zygarde',
    'diancie', 'hoopa', 'volcanion',
    // Gen 7
    'rowlet', 'dartrix', 'decidueye', 'litten', 'torracat', 'incineroar',
    'popplio', 'brionne', 'primarina', 'rockruff', 'lycanroc', 'mimikyu',
    'cosmog', 'cosmoem', 'solgaleo', 'lunala', 'necrozma',
    'nihilego', 'buzzwole', 'pheromosa', 'xurkitree', 'celesteela',
    'marshadow', 'zeraora',
    // Gen 8
    'grookey', 'thwackey', 'rillaboom', 'scorbunny', 'raboot', 'cinderace',
    'sobble', 'drizzile', 'inteleon', 'wooloo', 'dubwool',
    'toxel', 'toxtricity', 'applin', 'flapple', 'appletun',
    'dreepy', 'drakloak', 'dragapult', 'corviknight', 'grimmsnarl',
    'zacian', 'zamazenta', 'eternatus', 'urshifu', 'calyrex',
    // Gen 9
    'sprigatito', 'floragato', 'meowscarada', 'fuecoco', 'crocalor', 'skeledirge',
    'quaxly', 'quaxwell', 'quaquaval', 'pawmi', 'pawmo', 'pawmot',
    'charcadet', 'armarouge', 'ceruledge', 'tinkatink', 'tinkatuff', 'tinkaton',
    'gholdengo', 'gimmighoul', 'annihilape', 'kingambit',
    'roaringmoon', 'ironvaliant', 'koraidon', 'miraidon',
  ];

  // Sort by length descending so "klinklang" matches before "klink"
  const sorted = [...pokemonNames].sort((a, b) => b.length - a.length);
  for (const pokemon of sorted) {
    if (nameLower.includes(pokemon)) {
      // Capitalize first letter of each word
      return pokemon.split(/[-\s&]/).filter(Boolean).map(w =>
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join(' ');
    }
  }

  // Fallback: Try to extract from "Name Card" or "Name Pokemon" pattern
  const cardNameMatch = itemName.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:Pokemon|Pokémon|Card|#|\d)/i);
  if (cardNameMatch) {
    const potentialName = cardNameMatch[1].trim();
    if (potentialName.length >= 3 && potentialName.length <= 20) {
      return potentialName;
    }
  }

  return null;
}

// =============================================================================
// PRICE EXTRACTION
// =============================================================================

interface PriceResult {
  market: number;
  low: number;
  mid: number;
  high: number;
  marketEUR: number;
  trendEUR: number;
  conditions: Array<{ condition: string; price: number; low: number; high: number }>;
}

function extractPriceData(pricing: any): PriceResult | null {
  if (!pricing) return null;

  const tcg = pricing.tcgplayer;
  const cm = pricing.cardmarket;

  // Try TCGPlayer first (USD) — same variant priority as pokemon-tcg.ts
  if (tcg) {
    const variants = ['holofoil', '1stEditionHolofoil', 'reverseHolofoil', 'normal', '1stEditionNormal', 'unlimited'];
    for (const variant of variants) {
      if (tcg[variant]?.marketPrice || tcg[variant]?.midPrice) {
        const v = tcg[variant];
        const conditions: Array<{ condition: string; price: number; low: number; high: number }> = [];

        // Collect all available variants
        for (const vName of variants) {
          if (tcg[vName]?.marketPrice || tcg[vName]?.midPrice) {
            conditions.push({
              condition: formatVariantName(vName),
              price: tcg[vName].marketPrice || tcg[vName].midPrice || 0,
              low: tcg[vName].lowPrice || 0,
              high: tcg[vName].highPrice || 0,
            });
          }
        }

        return {
          market: v.marketPrice || v.midPrice || 0,
          low: v.lowPrice || 0,
          mid: v.midPrice || v.marketPrice || 0,
          high: v.highPrice || 0,
          marketEUR: cm?.avg || 0,
          trendEUR: cm?.trend || 0,
          conditions,
        };
      }
    }
  }

  // Fall back to Cardmarket (EUR → approximate USD)
  if (cm && (cm.avg || cm.trend)) {
    const eurToUsd = 1.08; // Approximate conversion
    const avgUSD = parseFloat(((cm.avg || cm.trend || 0) * eurToUsd).toFixed(2));
    const lowUSD = parseFloat(((cm.low || 0) * eurToUsd).toFixed(2));
    const highUSD = parseFloat((avgUSD * 1.5).toFixed(2));

    return {
      market: avgUSD,
      low: lowUSD,
      mid: avgUSD,
      high: highUSD,
      marketEUR: cm.avg || cm.trend || 0,
      trendEUR: cm.trend || 0,
      conditions: [{
        condition: 'Cardmarket Average (EUR→USD)',
        price: avgUSD,
        low: lowUSD,
        high: highUSD,
      }],
    };
  }

  return null;
}

function formatVariantName(variant: string): string {
  const names: Record<string, string> = {
    'holofoil': 'Holofoil',
    '1stEditionHolofoil': '1st Edition Holofoil',
    'reverseHolofoil': 'Reverse Holofoil',
    'normal': 'Normal',
    '1stEditionNormal': '1st Edition Normal',
    'unlimited': 'Unlimited',
  };
  return names[variant] || variant;
}

// =============================================================================
// CONFIDENCE CALCULATION
// =============================================================================

function calculateMatchConfidence(searchTerm: string, cardName: string, setName?: string): number {
  const searchLower = searchTerm.toLowerCase();
  const nameLower = (cardName || '').toLowerCase();
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

// =============================================================================
// EMPTY RESULT
// =============================================================================

function createEmptyResult(itemName: string, error: string): MarketDataSource {
  const pokemonName = extractPokemonName(itemName) || itemName;
  const searchUrl = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(pokemonName)}`;

  return {
    source: 'tcgdex',
    available: false,
    query: itemName,
    totalListings: 0,
    error,
    sampleListings: [{
      title: `Search TCGPlayer for "${pokemonName}"`,
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