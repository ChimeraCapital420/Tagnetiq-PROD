// FILE: src/lib/hydra/category-detection.ts
// HYDRA v6.3 - Category Detection System
// FIXED v6.2: vinyl vs vin bug - check vinyl BEFORE vehicle/vin patterns
// FIXED v6.3: Added comicvine to comics category mapping

import type { ItemCategory, CategoryDetection } from './types.js';

// ==================== CATEGORY API MAPPING ====================

export const CATEGORY_API_MAP: Record<string, string[]> = {
  // Coins & Currency
  'coins': ['numista', 'ebay'],
  'banknotes': ['numista', 'ebay'],
  'currency': ['numista', 'ebay'],
  
  // LEGO
  'lego': ['brickset', 'ebay'],
  'building_blocks': ['brickset', 'ebay'],
  
  // Trading Cards
  'trading_cards': ['pokemon_tcg', 'psa', 'ebay'],
  'pokemon_cards': ['pokemon_tcg', 'psa', 'ebay'],
  'pokemon': ['pokemon_tcg', 'psa', 'ebay'],
  'mtg_cards': ['psa', 'ebay'],
  'sports_cards': ['psa', 'ebay'],
  'baseball_cards': ['psa', 'ebay'],
  'football_cards': ['psa', 'ebay'],
  'basketball_cards': ['psa', 'ebay'],
  'hockey_cards': ['psa', 'ebay'],
  'graded_cards': ['psa', 'ebay'],
  'yugioh_cards': ['psa', 'ebay'],
  
  // Books
  'books': ['google_books', 'ebay'],
  'rare_books': ['google_books', 'ebay'],
  'textbooks': ['google_books', 'ebay'],
  
  // Comics - FIXED v6.3: Added comicvine as primary authority
  'comics': ['comicvine', 'psa', 'ebay'],
  'manga': ['comicvine', 'ebay'],
  'graphic_novels': ['comicvine', 'ebay'],
  
  // Video Games
  'video_games': ['ebay'],
  'retro_games': ['ebay'],
  'game_consoles': ['ebay'],
  
  // Music
  'vinyl_records': ['discogs', 'ebay'],
  'vinyl': ['discogs', 'ebay'],
  'music': ['discogs', 'ebay'],
  'records': ['discogs', 'ebay'],
  'cds': ['discogs', 'ebay'],
  'cassettes': ['discogs', 'ebay'],
  
  // Sneakers & Streetwear
  'sneakers': ['retailed', 'ebay'],
  'shoes': ['retailed', 'ebay'],
  'streetwear': ['retailed', 'ebay'],
  'jordans': ['retailed', 'ebay'],
  'nike': ['retailed', 'ebay'],
  'yeezy': ['retailed', 'ebay'],
  
  // Vehicles - NHTSA VIN Decoder (FREE API!)
  'vehicles': ['nhtsa', 'ebay'],
  'cars': ['nhtsa', 'ebay'],
  'trucks': ['nhtsa', 'ebay'],
  'motorcycles': ['nhtsa', 'ebay'],
  'automotive': ['nhtsa', 'ebay'],
  'autos': ['nhtsa', 'ebay'],
  
  // Household & Retail Items - UPCitemdb (FREE API!)
  'household': ['upcitemdb', 'ebay'],
  'appliances': ['upcitemdb', 'ebay'],
  'kitchen': ['upcitemdb', 'ebay'],
  'home': ['upcitemdb', 'ebay'],
  'tools': ['upcitemdb', 'ebay'],
  'power_tools': ['upcitemdb', 'ebay'],
  'baby': ['upcitemdb', 'ebay'],
  'pets': ['upcitemdb', 'ebay'],
  'grocery': ['upcitemdb', 'ebay'],
  'beauty': ['upcitemdb', 'ebay'],
  'health': ['upcitemdb', 'ebay'],
  
  // General categories
  'general': ['ebay'],
  'collectibles': ['ebay'],
  'antiques': ['ebay'],
  'vintage': ['ebay'],
  'toys': ['ebay'],
  'action_figures': ['ebay'],
  'watches': ['ebay'],
  'jewelry': ['ebay'],
  'electronics': ['upcitemdb', 'ebay'],
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
// FIXED v6.2: Reordered priorities - AI vote now comes FIRST since AI saw the image!

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
  
  // Priority 1 - AI detected category (HIGHEST PRIORITY - AI saw the image!)
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
  
  // Priority 3 - Name-based detection (only runs if AI didn't identify category)
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
  
  // Priority 4 - Keyword detection from item name
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
  // Barcode Detection - 8-13 digit numbers
  const barcodePattern = /\b\d{8,13}\b/;
  if (barcodePattern.test(nameLower)) {
    return 'household'; // Will trigger UPCitemdb
  }
  
  // IMPORTANT: Check for vinyl BEFORE checking for VIN!
  // "vinyl" contains "vin" so we must check this first
  if (nameLower.includes('vinyl') || nameLower.includes('record') ||
      nameLower.includes(' lp') || nameLower.includes('lp ') ||
      nameLower.includes('33 rpm') || nameLower.includes('45 rpm') ||
      nameLower.includes('album')) {
    return 'vinyl_records';
  }
  
  // VIN Detection - 17 character alphanumeric (excluding I, O, Q)
  // Only check for "vin" as a word, not as part of "vinyl"
  const vinPattern = /\b[A-HJ-NPR-Z0-9]{17}\b/i;
  const hasVinWord = /\bvin\b/i.test(nameLower); // "vin" as whole word only
  if (vinPattern.test(nameLower) || hasVinWord) {
    return 'vehicles';
  }
  
  // Vehicle patterns - BUT only if it really looks like a vehicle, not a trading card
  // Skip vehicle detection if it contains card-related keywords
  const cardKeywords = ['card', 'pokemon', 'tcg', 'holo', 'vmax', 'vstar', 'ex', 'gx', 'trading'];
  const hasCardKeyword = cardKeywords.some(kw => nameLower.includes(kw));
  
  if (!hasCardKeyword) {
    const vehiclePatterns = [
      'vehicle', 'automobile', 'automotive', 'car ', ' car', 'sedan', 'coupe',
      'truck', 'pickup', 'suv', 'crossover', 'minivan', 'van ',
      'motorcycle', 'motorbike', 'harley', 'honda motorcycle', 'yamaha',
      'ford ', 'chevrolet', 'chevy', 'toyota', 'honda ', 'nissan', 'dodge',
      'jeep', 'gmc', 'bmw', 'mercedes', 'audi', 'lexus', 'acura', 'infiniti',
      'volkswagen', 'vw ', 'subaru', 'mazda', 'hyundai', 'kia', 'tesla',
      'mustang', 'camaro', 'corvette', 'challenger', 'charger', 'wrangler',
      'f-150', 'f150', 'silverado', 'ram 1500', 'tacoma', 'tundra',
      'civic', 'accord', 'camry', 'corolla', 'altima', 'maxima',
      'model s', 'model 3', 'model x', 'model y'
    ];
    
    for (const pattern of vehiclePatterns) {
      if (nameLower.includes(pattern)) {
        return 'vehicles';
      }
    }
  }
  
  // Household/Appliance patterns - triggers UPCitemdb
  const householdPatterns = [
    'blender', 'coffee maker', 'keurig', 'nespresso', 'instant pot', 'air fryer',
    'toaster', 'microwave', 'mixer', 'food processor', 'juicer', 'waffle maker',
    'vacuum', 'dyson', 'roomba', 'shark', 'bissell', 'hoover',
    'speaker', 'bluetooth speaker', 'soundbar', 'headphones', 'airpods', 'earbuds',
    'fitbit', 'garmin', 'apple watch', 'kindle', 'fire tablet',
    'roku', 'firestick', 'chromecast', 'apple tv',
    'drill', 'saw', 'dewalt', 'makita', 'milwaukee', 'ryobi', 'craftsman',
    'baby monitor', 'car seat', 'stroller', 'pack n play', 'high chair',
    'pet feeder', 'litter box', 'aquarium', 'dog crate',
    'vitamix', 'cuisinart', 'kitchenaid', 'ninja', 'hamilton beach',
    'new in box', 'nib', 'factory sealed', 'brand new sealed'
  ];
  
  for (const pattern of householdPatterns) {
    if (nameLower.includes(pattern)) {
      return 'household';
    }
  }
  
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
      return 'graded_cards';
    }
  }
  
  // Pokemon patterns - very aggressive
  if (nameLower.includes('pokemon') || nameLower.includes('pokémon') || 
      nameLower.includes('poke mon') || nameLower.includes('poké')) {
    return 'pokemon_cards';
  }
  
  // Check for Pokemon names
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
    'umbreon', 'espeon', 'leafeon', 'glaceon', 'sylveon',
    'stonjourner', 'dracovish', 'dragapult', 'corviknight', 'toxtricity'
  ];
  
  for (const pokemon of pokemonNames) {
    if (nameLower.includes(pokemon)) {
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
       nameLower.includes('paperback') || nameLower.includes('novel') ||
       nameLower.includes('isbn')) &&
      !nameLower.includes('comic')) {
    return 'books';
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
// FIXED v6.2: Check vinyl BEFORE vehicle to prevent "vinyl" matching "vin"

export function normalizeCategory(category: string): string {
  const catLower = category.toLowerCase().trim().replace(/[_\s-]+/g, '_');
  
  // Pokemon/trading card normalization - check FIRST
  if (catLower.includes('pokemon') || catLower.includes('pokémon')) {
    return 'pokemon_cards';
  }
  
  if (catLower.includes('trading_card') || catLower.includes('tcg') || catLower === 'cards') {
    return 'trading_cards';
  }
  
  // CRITICAL: Check vinyl BEFORE vehicle! "vinyl" contains "vin"
  if (catLower.includes('vinyl') || catLower.includes('record') || 
      catLower === 'music' || catLower === 'album' || catLower.includes('discogs')) {
    return 'vinyl_records';
  }
  
  // Household normalization
  if (catLower.includes('household') || catLower.includes('appliance') || 
      catLower.includes('kitchen') || catLower.includes('home_goods')) {
    return 'household';
  }
  
  // Vehicle normalization - AFTER vinyl check!
  // Only match "vin" as a standalone word or with underscores, not as part of "vinyl"
  const isVinRelated = catLower === 'vin' || 
                       catLower.startsWith('vin_') || 
                       catLower.endsWith('_vin') ||
                       catLower.includes('_vin_');
  
  if (catLower.includes('vehicle') || catLower.includes('auto') ||
      catLower.includes('truck') || catLower.includes('motorcycle') || isVinRelated) {
    // Double-check it's not a card or vinyl
    if (!catLower.includes('card') && !catLower.includes('pokemon') && 
        !catLower.includes('tcg') && !catLower.includes('vinyl')) {
      return 'vehicles';
    }
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
  
  if (catLower.includes('electronic') || catLower.includes('gadget') || catLower.includes('tech')) {
    return 'electronics';
  }
  
  return catLower;
}

// ==================== KEYWORD-BASED DETECTION ====================

export function detectCategoryByKeywords(nameLower: string): { category: ItemCategory; confidence: number; keywords: string[] } {
  const categoryKeywords: Record<ItemCategory, string[]> = {
    // Household/Retail (UPCitemdb)
    household: [
      'appliance', 'kitchen', 'blender', 'mixer', 'coffee maker', 'keurig', 'nespresso',
      'instant pot', 'air fryer', 'toaster', 'microwave', 'food processor', 'juicer',
      'vacuum', 'dyson', 'roomba', 'shark', 'bissell', 'hoover', 'mop', 'steam cleaner',
      'vitamix', 'cuisinart', 'kitchenaid', 'ninja', 'hamilton beach', 'black decker',
      'baby monitor', 'car seat', 'stroller', 'pack n play', 'high chair', 'crib',
      'pet feeder', 'litter box', 'aquarium', 'dog bed', 'cat tree',
      'new in box', 'nib', 'sealed', 'factory sealed', 'unopened',
      'walmart', 'target', 'costco', 'amazon basics'
    ],
    // Vehicle keywords - removed 'vin' to avoid matching 'vinyl'
    vehicles: [
      'vehicle', 'automobile', 'automotive', 'sedan', 'coupe', 'hatchback',
      'truck', 'pickup', 'suv', 'crossover', 'minivan', 'wagon',
      'motorcycle', 'motorbike', 'scooter', 'atv', 'utv',
      'odometer', 'mileage', 'title', 'carfax',
      'ford', 'chevrolet', 'chevy', 'toyota', 'honda', 'nissan', 'dodge', 'ram',
      'jeep', 'gmc', 'bmw', 'mercedes', 'audi', 'lexus', 'acura', 'infiniti',
      'volkswagen', 'subaru', 'mazda', 'hyundai', 'kia', 'tesla', 'rivian', 'lucid',
      'porsche', 'ferrari', 'lamborghini', 'maserati', 'bentley', 'rolls royce',
      'mustang', 'camaro', 'corvette', 'challenger', 'charger', 'wrangler',
      'f-150', 'f150', 'silverado', 'sierra', 'ram 1500', 'tacoma', 'tundra',
      'civic', 'accord', 'camry', 'corolla', 'altima', 'maxima', 'sentra',
      'model s', 'model 3', 'model x', 'model y', 'cybertruck',
      'harley davidson', 'harley', 'indian motorcycle', 'ducati', 'kawasaki', 'suzuki'
    ],
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
      'bulbasaur', 'charmander', 'squirtle', 'eevee', 'snorlax', 'gengar',
      'dragonite', 'gyarados', 'alakazam', 'machamp', 'arcanine', 'lapras',
      'vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon',
      'articuno', 'zapdos', 'moltres', 'lugia', 'ho-oh', 'celebi',
      'rayquaza', 'groudon', 'kyogre', 'dialga', 'palkia', 'giratina', 'arceus',
      'reshiram', 'zekrom', 'kyurem', 'xerneas', 'yveltal', 'zygarde',
      'solgaleo', 'lunala', 'necrozma', 'zacian', 'zamazenta', 'eternatus',
      'stonjourner', 'dracovish', 'dragapult', 'corviknight', 'toxtricity',
      'vmax', 'vstar', 'v card', 'gx card', 'ex card', 'full art',
      'rainbow rare', 'secret rare', 'shiny', 'holo', 'holographic',
      'reverse holo', 'promo', 'trainer gallery', 'alt art',
      'illustration rare', 'special art', 'gold star', 'shining',
      'base set', 'jungle', 'fossil', 'team rocket',
      'single strike', 'rapid strike', 'fusion strike'
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
    electronics: [
      'electronic', 'gadget', 'device', 'speaker', 'headphone', 'earbuds',
      'tablet', 'laptop', 'computer', 'monitor', 'keyboard', 'mouse',
      'smart home', 'alexa', 'echo', 'google home', 'ring doorbell',
      'gopro', 'drone', 'camera', 'lens'
    ],
    cameras: ['camera', 'lens', 'photography', 'dslr', 'mirrorless'],
    audio_equipment: ['amplifier', 'speaker', 'headphone', 'turntable'],
    musical_instruments: ['guitar', 'piano', 'violin', 'instrument'],
    guitars: ['guitar', 'fender', 'gibson', 'acoustic', 'electric guitar'],
    keyboards: ['keyboard', 'synthesizer', 'piano'],
    tools: ['tool', 'drill', 'saw', 'wrench', 'screwdriver'],
    power_tools: ['power tool', 'drill', 'circular saw', 'jigsaw', 'sander', 'grinder'],
    baby: ['baby', 'infant', 'toddler', 'nursery', 'diaper', 'formula'],
    pets: ['pet', 'dog', 'cat', 'fish', 'bird', 'aquarium', 'terrarium'],
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