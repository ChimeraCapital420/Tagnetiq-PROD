// FILE: src/lib/hydra/category-detection.ts
// HYDRA v5.2 - Category Detection System
// Extracted from analyze.ts for modularity

import type { ItemCategory, CategoryDetection } from './types.js';

// ==================== CATEGORY API MAPPING ====================

export const CATEGORY_API_MAP: Record<string, string[]> = {
  'coins': ['numista', 'ebay'],
  'banknotes': ['numista', 'ebay'],
  'currency': ['numista', 'ebay'],
  'lego': ['brickset', 'ebay'],
  'building_blocks': ['brickset', 'ebay'],
  'trading_cards': ['pokemon_tcg', 'psa', 'ebay'],
  'pokemon_cards': ['pokemon_tcg', 'psa', 'ebay'],
  'pokemon': ['pokemon_tcg', 'psa', 'ebay'],
  'mtg_cards': ['psa', 'ebay'],
  'sports_cards': ['psa', 'ebay'],  // PSA is the authority for sports cards
  'baseball_cards': ['psa', 'ebay'],
  'football_cards': ['psa', 'ebay'],
  'basketball_cards': ['psa', 'ebay'],
  'hockey_cards': ['psa', 'ebay'],
  'graded_cards': ['psa', 'ebay'],  // Any graded card
  'yugioh_cards': ['psa', 'ebay'],
  'books': ['google_books', 'ebay'],
  'rare_books': ['google_books', 'ebay'],
  'textbooks': ['google_books', 'ebay'],
  'comics': ['comicvine', 'psa', 'ebay'],  // PSA grades comics too
  'manga': ['comicvine', 'ebay'],
  'graphic_novels': ['comicvine', 'ebay'],
  'video_games': ['rawg', 'ebay'],
  'retro_games': ['rawg', 'ebay'],
  'game_consoles': ['rawg', 'ebay'],
  'vinyl_records': ['discogs', 'ebay'],
  'vinyl': ['discogs', 'ebay'],
  'music': ['discogs', 'ebay'],
  'records': ['discogs', 'ebay'],
  'cds': ['discogs', 'ebay'],
  'cassettes': ['discogs', 'ebay'],
  'sneakers': ['retailed', 'ebay'],
  'shoes': ['retailed', 'ebay'],
  'streetwear': ['retailed', 'ebay'],
  'jordans': ['retailed', 'ebay'],
  'nike': ['retailed', 'ebay'],
  'yeezy': ['retailed', 'ebay'],
  'general': ['ebay'],
  'collectibles': ['ebay'],
  'antiques': ['ebay'],
  'vintage': ['ebay'],
  'toys': ['ebay'],
  'action_figures': ['ebay'],
  'watches': ['ebay'],
  'jewelry': ['ebay'],
  'electronics': ['ebay'],
  'art': ['ebay'],
};

export function getApisForCategory(category: string): string[] {
  const catLower = category.toLowerCase().trim();
  
  if (CATEGORY_API_MAP[catLower]) {
    return CATEGORY_API_MAP[catLower];
  }
  
  for (const [key, apis] of Object.entries(CATEGORY_API_MAP)) {
    if (catLower.includes(key) || key.includes(catLower)) {
      return apis;
    }
  }
  
  return ['ebay'];
}

// ==================== MAIN CATEGORY DETECTION ====================

export function detectItemCategory(
  itemName: string, 
  categoryId?: string,
  aiDetectedCategory?: string
): CategoryDetection {
  const nameLower = itemName.toLowerCase();
  
  console.log(`\n🔍 === CATEGORY DETECTION DEBUG ===`);
  console.log(`📝 Item Name: "${itemName}"`);
  console.log(`📝 Name Lower: "${nameLower}"`);
  console.log(`🤖 AI Category Input: ${aiDetectedCategory || 'none'}`);
  console.log(`💡 Category Hint: ${categoryId || 'none'}`);
  
  // Priority 0 - AGGRESSIVE name-based detection (runs first!)
  const nameBasedCategory = detectCategoryFromName(nameLower);
  if (nameBasedCategory && nameBasedCategory !== 'general') {
    console.log(`🎯 NAME PARSING detected: ${nameBasedCategory}`);
    return {
      category: nameBasedCategory as ItemCategory,
      confidence: 0.92,
      keywords: ['name_parsing'],
      source: 'name_parsing'
    };
  }
  
  // Priority 1 - AI detected category
  if (aiDetectedCategory && aiDetectedCategory !== 'general' && aiDetectedCategory !== 'unknown') {
    const normalizedAiCategory = normalizeCategory(aiDetectedCategory);
    if (normalizedAiCategory !== 'general') {
      console.log(`🤖 AI VOTE accepted: ${normalizedAiCategory}`);
      return { 
        category: normalizedAiCategory as ItemCategory, 
        confidence: 0.95, 
        keywords: ['ai_detection'],
        source: 'ai_vote'
      };
    }
  }
  
  // Priority 2 - Category hint from request
  if (categoryId && categoryId !== 'general') {
    const normalizedHint = normalizeCategory(categoryId);
    if (normalizedHint !== 'general') {
      console.log(`💡 CATEGORY HINT used: ${normalizedHint}`);
      return { 
        category: normalizedHint as ItemCategory, 
        confidence: 0.9, 
        keywords: ['category_hint'],
        source: 'category_hint'
      };
    }
  }
  
  // Priority 3 - Keyword detection from item name
  const keywordResult = detectCategoryByKeywords(nameLower);
  console.log(`🔑 KEYWORD DETECTION result: ${keywordResult.category} (confidence: ${keywordResult.confidence})`);
  console.log(`🔑 Matched keywords: ${keywordResult.keywords.join(', ') || 'none'}`);
  
  if (keywordResult.category !== 'general') {
    return { ...keywordResult, source: 'keyword_detection' };
  }
  
  console.log(`⚠️ No category detected, defaulting to general`);
  return { category: 'general', confidence: 0.5, keywords: [], source: 'default' };
}

// ==================== NAME-BASED DETECTION ====================

export function detectCategoryFromName(nameLower: string): string | null {
  // PSA/Graded card detection - check early as it's very specific
  const psaPatterns = [
    'psa 10', 'psa 9', 'psa 8', 'psa 7', 'psa 6', 'psa 5',
    'psa gem', 'psa mint', 'psa cert', 'psa #', 'psa#',
    'bgs 10', 'bgs 9.5', 'bgs 9', 'bgs 8.5', 'bgs 8',
    'cgc 10', 'cgc 9.9', 'cgc 9.8', 'cgc 9.6',
    'beckett graded', 'psa graded', 'cgc graded',
    'gem mint 10', 'pristine 10'
  ];
  
  for (const pattern of psaPatterns) {
    if (nameLower.includes(pattern)) {
      // Determine if sports card or Pokemon/TCG
      if (nameLower.includes('pokemon') || nameLower.includes('pikachu') || 
          nameLower.includes('charizard') || nameLower.includes('tcg')) {
        return 'pokemon_cards';
      }
      if (nameLower.includes('baseball') || nameLower.includes('topps') ||
          nameLower.includes('bowman') || nameLower.includes('rookie card')) {
        return 'sports_cards';
      }
      if (nameLower.includes('football') || nameLower.includes('nfl') ||
          nameLower.includes('panini') || nameLower.includes('prizm')) {
        return 'sports_cards';
      }
      if (nameLower.includes('basketball') || nameLower.includes('nba') ||
          nameLower.includes('hoops')) {
        return 'sports_cards';
      }
      // Default graded items to sports cards (most common)
      return 'graded_cards';
    }
  }
  
  // Pokemon patterns - very aggressive
  if (nameLower.includes('pokemon') || nameLower.includes('pokémon') || 
      nameLower.includes('poke mon') || nameLower.includes('poké')) {
    return 'pokemon_cards';
  }
  
  // Check for Pokemon names + "card"
  const pokemonNames = [
    'pikachu', 'charizard', 'blastoise', 'venusaur', 'mewtwo', 'mew',
    'ampharos', 'dragonite', 'gyarados', 'snorlax', 'gengar', 'alakazam',
    'machamp', 'golem', 'arcanine', 'lapras', 'vaporeon', 'jolteon', 'flareon',
    'articuno', 'zapdos', 'moltres', 'dratini', 'dragonair', 'eevee',
    'lugia', 'ho-oh', 'celebi', 'entei', 'suicune', 'raikou', 'tyranitar',
    'rayquaza', 'groudon', 'kyogre', 'deoxys', 'latios', 'latias',
    'dialga', 'palkia', 'giratina', 'arceus', 'darkrai', 'shaymin',
    'reshiram', 'zekrom', 'kyurem', 'victini', 'genesect',
    'xerneas', 'yveltal', 'zygarde', 'diancie', 'hoopa', 'volcanion',
    'solgaleo', 'lunala', 'necrozma', 'marshadow', 'zeraora',
    'zacian', 'zamazenta', 'eternatus', 'calyrex', 'urshifu',
    'umbreon', 'espeon', 'leafeon', 'glaceon', 'sylveon'
  ];
  
  for (const pokemon of pokemonNames) {
    if (nameLower.includes(pokemon)) {
      if (nameLower.includes('card') || nameLower.includes('tcg') || 
          nameLower.includes('holo') || nameLower.includes('vmax') || 
          nameLower.includes('vstar') || nameLower.includes('ex ') ||
          nameLower.includes(' gx') || nameLower.includes('full art')) {
        return 'pokemon_cards';
      }
      return 'pokemon_cards';
    }
  }
  
  // Coin patterns - very aggressive
  const coinPatterns = [
    'coin', 'penny', 'nickel', 'dime', 'quarter', 'half dollar',
    'dollar coin', 'silver dollar', 'gold coin', 'cent piece',
    'morgan', 'peace dollar', 'walking liberty', 'buffalo nickel',
    'mercury dime', 'barber', 'seated liberty', 'standing liberty',
    'indian head', 'wheat penny', 'steel penny', 'flying eagle',
    'trade dollar', 'commemorative', 'proof coin', 'mint state',
    'ms-', 'ms63', 'ms64', 'ms65', 'ms66', 'ms67', 'ms68', 'ms69', 'ms70',
    'pcgs', 'ngc', 'anacs', 'icg'
  ];
  
  for (const pattern of coinPatterns) {
    if (nameLower.includes(pattern)) {
      return 'coins';
    }
  }
  
  // LEGO patterns
  if (nameLower.includes('lego') || nameLower.includes('legoland') ||
      nameLower.includes('minifig') || nameLower.includes('minifigure')) {
    return 'lego';
  }
  
  // Book patterns
  if ((nameLower.includes('book') || nameLower.includes('hardcover') || 
       nameLower.includes('paperback') || nameLower.includes('novel')) &&
      !nameLower.includes('comic')) {
    return 'books';
  }
  
  // Vinyl patterns
  if (nameLower.includes('vinyl') || nameLower.includes('record') ||
      nameLower.includes(' lp') || nameLower.includes('lp ') ||
      nameLower.includes('33 rpm') || nameLower.includes('45 rpm')) {
    return 'vinyl_records';
  }
  
  // Video game patterns
  if (nameLower.includes('video game') || nameLower.includes('nintendo') ||
      nameLower.includes('playstation') || nameLower.includes('xbox') ||
      nameLower.includes('ps5') || nameLower.includes('ps4') ||
      nameLower.includes('switch game') || nameLower.includes('wii')) {
    return 'video_games';
  }
  
  // Sneaker patterns
  if (nameLower.includes('jordan') || nameLower.includes('yeezy') ||
      nameLower.includes('nike dunk') || nameLower.includes('air force') ||
      nameLower.includes('air max') || nameLower.includes('sneaker')) {
    return 'sneakers';
  }
  
  // Comic patterns
  if (nameLower.includes('comic') || nameLower.includes('marvel') ||
      nameLower.includes('dc comics') || nameLower.includes('manga')) {
    return 'comics';
  }
  
  return null;
}

// ==================== CATEGORY NORMALIZATION ====================

export function normalizeCategory(category: string): string {
  const catLower = category.toLowerCase().trim().replace(/[_\s-]+/g, '_');
  
  if (catLower.includes('pokemon') || catLower.includes('pokémon')) {
    return 'pokemon_cards';
  }
  
  if (catLower.includes('trading_card') || catLower.includes('tcg') || catLower === 'cards') {
    return 'trading_cards';
  }
  
  if (catLower.includes('coin') || catLower.includes('numismatic') || catLower.includes('currency')) {
    return 'coins';
  }
  
  if (catLower.includes('lego') || catLower.includes('brick')) {
    return 'lego';
  }
  
  if (catLower.includes('video_game') || catLower.includes('videogame') || catLower === 'gaming') {
    return 'video_games';
  }
  
  if (catLower.includes('vinyl') || catLower.includes('record') || catLower === 'music' || catLower === 'album') {
    return 'vinyl_records';
  }
  
  if (catLower.includes('comic') || catLower.includes('manga')) {
    return 'comics';
  }
  
  if (catLower.includes('book') && !catLower.includes('comic')) {
    return 'books';
  }
  
  if (catLower.includes('sneaker') || catLower.includes('jordan') || catLower.includes('yeezy') || 
      catLower.includes('shoe') || catLower.includes('footwear')) {
    return 'sneakers';
  }
  
  return catLower;
}

// ==================== KEYWORD-BASED DETECTION ====================

export function detectCategoryByKeywords(nameLower: string): { category: ItemCategory; confidence: number; keywords: string[] } {
  const categoryKeywords: Record<ItemCategory, string[]> = {
    coins: [
      'coin', 'penny', 'nickel', 'dime', 'quarter', 'dollar', 'cent',
      'morgan', 'liberty', 'eagle', 'buffalo', 'wheat', 'mercury',
      'numismatic', 'mint', 'uncirculated', 'proof', 'silver dollar',
      'gold coin', 'half dollar', 'commemorative', 'bullion',
      'currency', 'banknote', 'note', 'bill', 'peace dollar',
      'walking liberty', 'standing liberty', 'seated liberty',
      'barber', 'indian head', 'flying eagle', 'trade dollar',
      'double eagle', 'gold eagle', 'silver eagle', 'platinum eagle',
      'krugerrand', 'maple leaf', 'britannia', 'philharmonic',
      'ancient coin', 'roman coin', 'greek coin', 'byzantine',
      'ms63', 'ms64', 'ms65', 'ms66', 'ms67', 'ms68', 'ms69', 'ms70',
      'pcgs', 'ngc', 'anacs', 'icg', 'mint state', 'proof coin'
    ],
    banknotes: ['banknote', 'paper money', 'currency note', 'federal reserve note'],
    currency: [],
    lego: [
      'lego', 'legos', 'brick', 'minifig', 'minifigure',
      'star wars lego', 'technic', 'creator', 'ninjago',
      'city lego', 'friends lego', 'duplo', 'bionicle',
      'millennium falcon', 'death star', 'hogwarts', 'batman lego',
      'marvel lego', 'architecture', 'ideas lego', 'creator expert'
    ],
    building_blocks: [],
    trading_cards: [
      'trading card', 'tcg', 'holographic', 'foil card',
      'first edition', 'psa', 'graded card', 'booster', 'pack',
      'cgc', 'bgs', 'beckett', 'card game'
    ],
    pokemon_cards: [
      'pokemon', 'pokémon', 'poke mon', 'poké',
      'pikachu', 'charizard', 'blastoise', 'venusaur', 'mewtwo', 'mew',
      'bulbasaur', 'ivysaur', 'charmander', 'charmeleon', 'squirtle', 'wartortle',
      'caterpie', 'metapod', 'butterfree', 'weedle', 'kakuna', 'beedrill',
      'pidgey', 'pidgeotto', 'pidgeot', 'rattata', 'raticate', 'spearow', 'fearow',
      'ekans', 'arbok', 'raichu', 'sandshrew', 'sandslash',
      'nidoran', 'nidorina', 'nidoqueen', 'nidorino', 'nidoking',
      'clefairy', 'clefable', 'vulpix', 'ninetales', 'jigglypuff', 'wigglytuff',
      'zubat', 'golbat', 'oddish', 'gloom', 'vileplume', 'paras', 'parasect',
      'venonat', 'venomoth', 'diglett', 'dugtrio', 'meowth', 'persian',
      'psyduck', 'golduck', 'mankey', 'primeape', 'growlithe', 'arcanine',
      'poliwag', 'poliwhirl', 'poliwrath', 'abra', 'kadabra', 'alakazam',
      'machop', 'machoke', 'machamp', 'bellsprout', 'weepinbell', 'victreebel',
      'tentacool', 'tentacruel', 'geodude', 'graveler', 'golem',
      'ponyta', 'rapidash', 'slowpoke', 'slowbro', 'magnemite', 'magneton',
      'farfetchd', 'doduo', 'dodrio', 'seel', 'dewgong', 'grimer', 'muk',
      'shellder', 'cloyster', 'gastly', 'haunter', 'gengar',
      'onix', 'drowzee', 'hypno', 'krabby', 'kingler', 'voltorb', 'electrode',
      'exeggcute', 'exeggutor', 'cubone', 'marowak', 'hitmonlee', 'hitmonchan',
      'lickitung', 'koffing', 'weezing', 'rhyhorn', 'rhydon',
      'chansey', 'tangela', 'kangaskhan', 'horsea', 'seadra',
      'goldeen', 'seaking', 'staryu', 'starmie', 'mr. mime', 'scyther',
      'jynx', 'electabuzz', 'magmar', 'pinsir', 'tauros',
      'magikarp', 'gyarados', 'lapras', 'ditto', 'eevee',
      'vaporeon', 'jolteon', 'flareon', 'porygon',
      'omanyte', 'omastar', 'kabuto', 'kabutops', 'aerodactyl',
      'snorlax', 'articuno', 'zapdos', 'moltres',
      'dratini', 'dragonair', 'dragonite',
      'chikorita', 'bayleef', 'meganium', 'cyndaquil', 'quilava', 'typhlosion',
      'totodile', 'croconaw', 'feraligatr', 'sentret', 'furret',
      'hoothoot', 'noctowl', 'ledyba', 'ledian', 'spinarak', 'ariados',
      'crobat', 'chinchou', 'lanturn', 'togepi', 'togetic', 'natu', 'xatu',
      'mareep', 'flaaffy', 'ampharos', 'bellossom', 'marill', 'azumarill',
      'sudowoodo', 'politoed', 'hoppip', 'skiploom', 'jumpluff',
      'aipom', 'sunkern', 'sunflora', 'yanma', 'wooper', 'quagsire',
      'espeon', 'umbreon', 'murkrow', 'slowking', 'misdreavus',
      'unown', 'wobbuffet', 'girafarig', 'pineco', 'forretress',
      'dunsparce', 'gligar', 'steelix', 'snubbull', 'granbull',
      'qwilfish', 'scizor', 'shuckle', 'heracross', 'sneasel',
      'teddiursa', 'ursaring', 'slugma', 'magcargo', 'swinub', 'piloswine',
      'corsola', 'remoraid', 'octillery', 'delibird', 'mantine',
      'skarmory', 'houndour', 'houndoom', 'kingdra', 'phanpy', 'donphan',
      'porygon2', 'stantler', 'smeargle', 'tyrogue', 'hitmontop',
      'smoochum', 'elekid', 'magby', 'miltank', 'blissey',
      'raikou', 'entei', 'suicune', 'larvitar', 'pupitar', 'tyranitar',
      'lugia', 'ho-oh', 'celebi',
      'rayquaza', 'groudon', 'kyogre', 'deoxys', 'latios', 'latias',
      'dialga', 'palkia', 'giratina', 'arceus', 'darkrai', 'shaymin',
      'reshiram', 'zekrom', 'kyurem', 'victini', 'genesect',
      'xerneas', 'yveltal', 'zygarde', 'diancie', 'hoopa', 'volcanion',
      'solgaleo', 'lunala', 'necrozma', 'marshadow', 'zeraora',
      'zacian', 'zamazenta', 'eternatus', 'calyrex', 'urshifu',
      'leafeon', 'glaceon', 'sylveon',
      'vmax', 'vstar', 'v card', 'gx card', 'ex card', 'full art',
      'rainbow rare', 'secret rare', 'shiny', 'holo', 'holographic',
      'reverse holo', 'promo', 'trainer gallery', 'alt art',
      'illustration rare', 'special art', 'gold star', 'shining',
      'crystal', 'delta species', 'lv.x', 'prime', 'legend',
      'mega', 'break', 'tag team', 'amazing rare', 'radiant'
    ],
    mtg_cards: ['magic the gathering', 'mtg', 'planeswalker', 'mana', 'wizards of the coast'],
    sports_cards: [
      'topps', 'panini', 'rookie card', 'sports card', 'baseball card', 
      'football card', 'basketball card', 'hockey card', 'prizm', 'select',
      'optic', 'mosaic', 'donruss', 'bowman', 'upper deck'
    ],
    yugioh_cards: ['yu-gi-oh', 'yugioh', 'blue eyes', 'dark magician', 'exodia', 'konami'],
    books: [
      'book', 'novel', 'hardcover', 'paperback', 'first edition book',
      'signed copy', 'isbn', 'author', 'rare book', 'antique book',
      'leather bound', 'dust jacket', 'manuscript'
    ],
    rare_books: ['first edition', 'signed book', 'rare book', 'antique book'],
    textbooks: ['textbook', 'educational'],
    comics: [
      'comic', 'comic book', 'graphic novel', 'manga', 'issue',
      'marvel', 'dc comics', 'spider-man', 'batman', 'superman', 'x-men',
      'first appearance', 'key issue', 'cgc', 'cbcs', 'graded comic',
      'golden age', 'silver age', 'bronze age', 'modern age',
      'variant cover', 'newsstand', 'direct edition'
    ],
    manga: ['manga', 'anime', 'japanese comic', 'shonen', 'seinen'],
    graphic_novels: ['graphic novel'],
    video_games: [
      'video game', 'game', 'nintendo', 'playstation', 'xbox', 'ps5', 'ps4', 'ps3', 'ps2',
      'switch', 'wii', 'gamecube', 'n64', 'snes', 'nes', 'gameboy', 'game boy',
      'sega', 'genesis', 'dreamcast', 'atari', 'steam', 'pc game',
      'sealed game', 'cib', 'complete in box', 'cartridge', 'disc',
      'zelda', 'mario', 'final fantasy', 'call of duty', 'halo',
      'retro game', 'vintage game', 'collector edition'
    ],
    retro_games: ['retro game', 'vintage game', 'classic game'],
    game_consoles: ['console', 'playstation', 'xbox', 'nintendo', 'sega'],
    vinyl_records: [
      'vinyl', 'record', 'lp', 'album', '45 rpm', '33 rpm', '78 rpm',
      'first pressing', 'original pressing', 'limited edition vinyl',
      'picture disc', 'colored vinyl', 'audiophile', 'mono', 'stereo',
      'discogs', 'rare vinyl', 'sealed vinyl', 'mint vinyl',
      'beatles', 'led zeppelin', 'pink floyd', 'bob dylan'
    ],
    music: [],
    cds: ['cd', 'compact disc'],
    cassettes: ['cassette', 'tape'],
    sneakers: [
      'sneaker', 'sneakers', 'jordan', 'air jordan', 'nike', 'adidas',
      'yeezy', 'dunk', 'air force', 'air max', 'new balance', 'asics',
      'deadstock', 'ds', 'vnds', 'og all', 'retro', 'bred', 'chicago',
      'off-white', 'travis scott', 'collaboration', 'collab',
      'supreme', 'bape', 'streetwear', 'hypebeast', 'stockx', 'goat'
    ],
    shoes: [],
    streetwear: ['supreme', 'bape', 'off-white', 'streetwear'],
    designer_fashion: ['gucci', 'louis vuitton', 'chanel', 'prada', 'hermes'],
    watches: ['watch', 'rolex', 'omega', 'seiko', 'casio', 'timepiece', 'wristwatch'],
    jewelry: ['jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'gold', 'silver', 'diamond'],
    gemstones: ['gemstone', 'ruby', 'emerald', 'sapphire', 'diamond'],
    art: ['painting', 'artwork', 'canvas', 'oil painting', 'watercolor'],
    paintings: ['painting', 'oil on canvas'],
    prints: ['print', 'lithograph', 'screen print', 'art print'],
    sculptures: ['sculpture', 'statue', 'figurine'],
    antiques: ['antique', 'victorian', 'art deco', 'edwardian'],
    vintage: ['vintage', 'retro', 'mid-century'],
    collectibles: ['collectible', 'collector', 'rare', 'limited edition'],
    toys: ['toy', 'action figure', 'doll', 'plush', 'stuffed animal'],
    action_figures: ['action figure', 'figure', 'statue', 'funko', 'pop vinyl', 'hot toys'],
    dolls: ['doll', 'barbie', 'american girl'],
    model_kits: ['model kit', 'gundam', 'plastic model'],
    sports_memorabilia: ['memorabilia', 'autograph', 'signed', 'jersey', 'game used'],
    autographs: ['autograph', 'signed', 'signature'],
    stamps: ['stamp', 'philatelic', 'postage'],
    postcards: ['postcard', 'postal'],
    electronics: ['electronic', 'gadget', 'device'],
    cameras: ['camera', 'lens', 'photography'],
    audio_equipment: ['amplifier', 'speaker', 'headphone', 'turntable'],
    musical_instruments: ['guitar', 'piano', 'violin', 'instrument'],
    guitars: ['guitar', 'fender', 'gibson', 'acoustic', 'electric guitar'],
    keyboards: ['keyboard', 'synthesizer', 'piano'],
    tools: ['tool', 'drill', 'saw'],
    power_tools: ['power tool', 'drill', 'circular saw'],
    general: []
  };
  
  const scores: Record<string, { score: number; matches: string[] }> = {};
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    scores[category] = { score: 0, matches: [] };
    keywords.forEach(kw => {
      if (nameLower.includes(kw)) {
        scores[category].score += kw.split(' ').length;
        scores[category].matches.push(kw);
      }
    });
  }
  
  let bestCategory: ItemCategory = 'general';
  let bestScore = 0;
  let bestMatches: string[] = [];
  
  const sortedScores = Object.entries(scores)
    .filter(([_, data]) => data.score > 0)
    .sort((a, b) => {
      if (b[1].score !== a[1].score) return b[1].score - a[1].score;
      return b[0].length - a[0].length;
    });
  
  if (sortedScores.length > 0) {
    bestCategory = sortedScores[0][0] as ItemCategory;
    bestScore = sortedScores[0][1].score;
    bestMatches = sortedScores[0][1].matches;
  }
  
  const confidence = Math.min(0.5 + (bestScore * 0.1), 0.95);
  
  if (sortedScores.length > 0) {
    console.log(`🔑 Top 3 keyword matches:`);
    sortedScores.slice(0, 3).forEach(([cat, data]) => {
      console.log(`   - ${cat}: score ${data.score} (${data.matches.join(', ')})`);
    });
  }
  
  return { category: bestCategory, confidence, keywords: bestMatches };
}