// FILE: src/lib/hydra/category-detection.ts
// HYDRA v7.4 - Category Detection System
// 
// CHANGELOG:
// v7.4: Added apparel category, keyword override for bad AI votes
// v6.3: Added comicvine to comics category mapping
// v6.2: Fixed vinyl vs vin bug - check vinyl BEFORE vehicle/vin patterns
//
// =============================================================================
// HOW TO ADD A NEW CATEGORY:
// =============================================================================
// 1. Add to CATEGORY_API_MAP with appropriate APIs
// 2. Add to CATEGORY_KEYWORDS with detection keywords
// 3. Add to normalizeCategory() for AI category normalization
// 4. (Optional) Add to NAME_PATTERN_OVERRIDES for specific patterns
// =============================================================================

import type { ItemCategory, CategoryDetection } from './types.js';

// =============================================================================
// CATEGORY → API MAPPING
// =============================================================================
// Maps each category to the APIs that should be queried for pricing data
// Order matters: first API is primary authority, others are fallbacks

export const CATEGORY_API_MAP: Record<string, string[]> = {
  // ==================== COINS & CURRENCY ====================
  'coins': ['numista', 'ebay'],
  'banknotes': ['numista', 'ebay'],
  'currency': ['numista', 'ebay'],
  
  // ==================== LEGO ====================
  'lego': ['brickset', 'ebay'],
  'building_blocks': ['brickset', 'ebay'],
  
  // ==================== TRADING CARDS ====================
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
  
  // ==================== BOOKS ====================
  'books': ['google_books', 'ebay'],
  'rare_books': ['google_books', 'ebay'],
  'textbooks': ['google_books', 'ebay'],
  
  // ==================== COMICS ====================
  'comics': ['comicvine', 'psa', 'ebay'],
  'manga': ['comicvine', 'ebay'],
  'graphic_novels': ['comicvine', 'ebay'],
  
  // ==================== VIDEO GAMES ====================
  'video_games': ['ebay'],
  'retro_games': ['ebay'],
  'game_consoles': ['ebay'],
  
  // ==================== MUSIC ====================
  'vinyl_records': ['discogs', 'ebay'],
  'vinyl': ['discogs', 'ebay'],
  'music': ['discogs', 'ebay'],
  'records': ['discogs', 'ebay'],
  'cds': ['discogs', 'ebay'],
  'cassettes': ['discogs', 'ebay'],
  
  // ==================== SNEAKERS (FOOTWEAR ONLY) ====================
  'sneakers': ['retailed', 'ebay'],
  'shoes': ['retailed', 'ebay'],
  'jordans': ['retailed', 'ebay'],
  
  // ==================== STREETWEAR / HYPE APPAREL (v7.5) ====================
  // Retailed has StockX data for hype brands: Supreme, BAPE, Off-White, etc.
  'streetwear': ['retailed', 'ebay'],
  'hype_apparel': ['retailed', 'ebay'],
  'supreme': ['retailed', 'ebay'],
  'bape': ['retailed', 'ebay'],
  
  // ==================== GENERAL APPAREL & CLOTHING (v7.4) ====================
  // Sports jerseys, regular clothing - no hype authority, use eBay
  'apparel': ['ebay'],
  'clothing': ['ebay'],
  'jerseys': ['ebay'],
  'vintage_clothing': ['ebay'],
  'designer_fashion': ['ebay'],
  
  // ==================== VEHICLES ====================
  'vehicles': ['nhtsa', 'ebay'],
  'cars': ['nhtsa', 'ebay'],
  'trucks': ['nhtsa', 'ebay'],
  'motorcycles': ['nhtsa', 'ebay'],
  'automotive': ['nhtsa', 'ebay'],
  'autos': ['nhtsa', 'ebay'],
  
  // ==================== HOUSEHOLD & RETAIL ====================
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
  
  // ==================== GENERAL ====================
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

// =============================================================================
// KEYWORD DEFINITIONS BY CATEGORY
// =============================================================================
// Add keywords here for automatic detection from item names
// More specific/longer phrases should come first for better matching

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // ==================== STREETWEAR / HYPE BRANDS (NEW v7.5) ====================
  // These trigger Retailed API which has StockX pricing data
  streetwear: [
    // Supreme
    'supreme', 'supreme box logo', 'supreme bogo', 'supreme hoodie', 'supreme tee',
    'supreme jacket', 'supreme beanie', 'supreme cap',
    // BAPE / A Bathing Ape
    'bape', 'a bathing ape', 'bathing ape', 'bape hoodie', 'bape shark',
    'baby milo', 'bape camo', 'bape sta',
    // Off-White
    'off-white', 'off white', 'offwhite', 'virgil abloh',
    // Fear of God / Essentials
    'fear of god', 'fog essentials', 'essentials hoodie', 'essentials sweatpants',
    'jerry lorenzo',
    // Kith
    'kith', 'kith treats', 'ronnie fieg',
    // Palace
    'palace skateboards', 'palace hoodie', 'palace tee', 'tri-ferg',
    // Travis Scott / Cactus Jack
    'travis scott', 'cactus jack', 'astroworld', 'utopia merch',
    // Yeezy (non-shoes)
    'yeezy gap', 'yeezy season', 'yzy gap',
    // Stussy
    'stussy', 'stüssy',
    // Anti Social Social Club
    'anti social social club', 'assc',
    // VLONE
    'vlone', 'v lone',
    // Chrome Hearts
    'chrome hearts',
    // Gallery Dept
    'gallery dept', 'gallerydept',
    // Rhude
    'rhude',
    // Amiri
    'amiri',
    // Human Made
    'human made', 'nigo',
    // Drew House (Justin Bieber)
    'drew house', 'drewhouse',
    // Represent
    'represent clo',
    // Corteiz
    'corteiz', 'crtz',
    // Sp5der
    'sp5der', 'spider worldwide',
    // Eric Emanuel
    'eric emanuel', 'ee shorts',
    // Hellstar
    'hellstar',
    // Broken Planet
    'broken planet',
    // Market/Chinatown Market
    'chinatown market', 'market smiley',
    // Billionaire Boys Club
    'billionaire boys club', 'bbc icecream',
    // The Hundreds
    'the hundreds',
    // Undefeated
    'undefeated', 'undftd',
    // Hype collab keywords
    'collab', 'collaboration', 'limited edition drop', 'sold out', 'resale',
    'deadstock', 'ds', 'bnwt', 'brand new with tags',
  ],

  // ==================== APPAREL & CLOTHING (General - v7.4) ====================
  apparel: [
    // Tops
    'hoodie', 'hoody', 'sweatshirt', 'sweater', 'pullover', 'crewneck', 'crew neck',
    'jacket', 'coat', 'blazer', 'cardigan', 'windbreaker', 'parka', 'bomber jacket',
    'vest', 'gilet', 'fleece', 'zip up', 'zip-up', 'quarter zip',
    'shirt', 't-shirt', 'tee', 'polo', 'button up', 'button down', 'flannel',
    'tank top', 'henley', 'long sleeve', 'short sleeve',
    // Bottoms  
    'pants', 'jeans', 'shorts', 'joggers', 'sweatpants', 'track pants',
    'trousers', 'chinos', 'khakis', 'cargo pants', 'leggings', 'skirt',
    // Full body
    'dress', 'jumpsuit', 'romper', 'overalls', 'tracksuit', 'onesie',
    // Headwear
    'hat', 'cap', 'beanie', 'snapback', 'fitted cap', 'dad hat', 'trucker hat',
    'bucket hat', 'visor', 'headband',
    // Accessories
    'scarf', 'gloves', 'mittens', 'socks', 'belt', 'tie', 'bow tie',
    // Sports apparel
    'jersey', 'uniform', 'team jersey', 'basketball jersey', 'football jersey',
    'hockey jersey', 'baseball jersey', 'soccer jersey',
    // Sports teams (triggers apparel if combined with clothing words)
    'avalanche', 'broncos', 'nuggets', 'rockies', 'rapids',  // Colorado teams
    'nfl', 'nba', 'mlb', 'nhl', 'mls',  // Leagues
    // Designer/Brand clothing (not shoes)
    'gucci shirt', 'louis vuitton', 'chanel', 'prada', 'hermes', 'versace',
    'burberry', 'balenciaga', 'givenchy', 'fendi', 'dior',
    // Vintage/Thrift
    'vintage tee', 'vintage shirt', 'band tee', 'concert tee', 'tour shirt',
    'graphic tee', 'vintage jacket', 'varsity jacket', 'letterman jacket',
  ],

  // ==================== SNEAKERS (FOOTWEAR ONLY - v7.4 REFINED) ====================
  sneakers: [
    // Specific sneaker keywords - NOT general clothing
    'sneaker', 'sneakers', 'kicks', 'trainers',
    'air jordan', 'jordan 1', 'jordan 3', 'jordan 4', 'jordan 5', 'jordan 6',
    'jordan 11', 'jordan 12', 'jordan 13', 'jordan retro',
    'yeezy', 'yeezy 350', 'yeezy 500', 'yeezy 700', 'yeezy slide', 'yeezy foam',
    'nike dunk', 'dunk low', 'dunk high', 'sb dunk',
    'air force 1', 'af1', 'air force one',
    'air max', 'air max 1', 'air max 90', 'air max 95', 'air max 97',
    'new balance 550', 'new balance 990', 'new balance 2002r',
    'adidas samba', 'adidas gazelle', 'adidas superstar', 'adidas stan smith',
    'converse', 'chuck taylor', 'vans old skool', 'vans sk8',
    'asics gel', 'nike blazer', 'puma suede',
    'deadstock', 'ds shoes', 'vnds', 'og all',
    'travis scott', 'off-white nike', 'union jordan',
    'stockx', 'goat app',  // Sneaker marketplaces
  ],

  // ==================== HOUSEHOLD ====================
  household: [
    'appliance', 'kitchen', 'blender', 'mixer', 'coffee maker', 'keurig', 'nespresso',
    'instant pot', 'air fryer', 'toaster', 'microwave', 'food processor', 'juicer',
    'vacuum', 'dyson', 'roomba', 'shark', 'bissell', 'hoover', 'mop', 'steam cleaner',
    'vitamix', 'cuisinart', 'kitchenaid', 'ninja', 'hamilton beach', 'black decker',
    'baby monitor', 'car seat', 'stroller', 'pack n play', 'high chair', 'crib',
    'pet feeder', 'litter box', 'aquarium', 'dog bed', 'cat tree',
    'new in box', 'nib', 'sealed', 'factory sealed', 'unopened',
    'walmart', 'target', 'costco', 'amazon basics',
  ],

  // ==================== VEHICLES ====================
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
    'harley davidson', 'harley', 'indian motorcycle', 'ducati', 'kawasaki', 'suzuki',
  ],

  // ==================== COINS ====================
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
    'pcgs', 'ngc', 'anacs', 'icg', 'mint state', 'proof coin',
  ],

  // ==================== LEGO ====================
  lego: [
    'lego', 'legos', 'brick', 'minifig', 'minifigure',
    'star wars lego', 'technic', 'creator', 'ninjago',
    'city lego', 'friends lego', 'duplo', 'bionicle',
    'millennium falcon', 'death star', 'hogwarts', 'batman lego',
    'marvel lego', 'architecture', 'ideas lego', 'creator expert',
  ],

  // ==================== POKEMON CARDS ====================
  pokemon_cards: [
    'pokemon', 'pokémon', 'poke mon', 'poké',
    'pikachu', 'charizard', 'blastoise', 'venusaur', 'mewtwo', 'mew',
    'bulbasaur', 'charmander', 'squirtle', 'eevee', 'snorlax', 'gengar',
    'dragonite', 'gyarados', 'alakazam', 'machamp', 'arcanine', 'lapras',
    'vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon',
    'articuno', 'zapdos', 'moltres', 'lugia', 'ho-oh', 'celebi',
    'rayquaza', 'groudon', 'kyogre', 'dialga', 'palkia', 'giratina', 'arceus',
    'vmax', 'vstar', 'v card', 'gx card', 'ex card', 'full art',
    'rainbow rare', 'secret rare', 'shiny', 'holo', 'holographic',
    'reverse holo', 'promo', 'trainer gallery', 'alt art',
    'illustration rare', 'special art', 'gold star', 'shining',
    'base set', 'jungle', 'fossil', 'team rocket',
  ],

  // ==================== TRADING CARDS (GENERAL) ====================
  trading_cards: [
    'trading card', 'tcg', 'holographic', 'foil card',
    'first edition', 'psa', 'graded card', 'booster', 'pack',
    'cgc', 'bgs', 'beckett', 'card game',
  ],

  // ==================== SPORTS CARDS ====================
  sports_cards: [
    'topps', 'panini', 'rookie card', 'sports card', 'baseball card',
    'football card', 'basketball card', 'hockey card', 'prizm', 'select',
    'optic', 'mosaic', 'donruss', 'bowman', 'upper deck',
  ],

  // ==================== BOOKS ====================
  books: [
    'book', 'novel', 'hardcover', 'paperback', 'first edition book',
    'signed copy', 'isbn', 'author', 'rare book', 'antique book',
    'leather bound', 'dust jacket', 'manuscript',
  ],

  // ==================== COMICS ====================
  comics: [
    'comic', 'comic book', 'graphic novel', 'manga', 'issue',
    'marvel', 'dc comics', 'spider-man', 'batman', 'superman', 'x-men',
    'first appearance', 'key issue', 'cgc', 'cbcs', 'graded comic',
    'golden age', 'silver age', 'bronze age', 'modern age',
    'variant cover', 'newsstand', 'direct edition',
  ],

  // ==================== VIDEO GAMES ====================
  video_games: [
    'video game', 'game', 'nintendo', 'playstation', 'xbox', 'ps5', 'ps4', 'ps3', 'ps2',
    'switch', 'wii', 'gamecube', 'n64', 'snes', 'nes', 'gameboy', 'game boy',
    'sega', 'genesis', 'dreamcast', 'atari', 'steam', 'pc game',
    'sealed game', 'cib', 'complete in box', 'cartridge', 'disc',
    'zelda', 'mario', 'final fantasy', 'call of duty', 'halo',
  ],

  // ==================== VINYL RECORDS ====================
  vinyl_records: [
    'vinyl', 'record', 'lp', 'album', '45 rpm', '33 rpm', '78 rpm',
    'first pressing', 'original pressing', 'limited edition vinyl',
    'picture disc', 'colored vinyl', 'audiophile', 'mono', 'stereo',
    'discogs', 'rare vinyl', 'sealed vinyl', 'mint vinyl',
  ],

  // ==================== ELECTRONICS ====================
  electronics: [
    'electronic', 'gadget', 'device', 'speaker', 'headphone', 'earbuds',
    'tablet', 'laptop', 'computer', 'monitor', 'keyboard', 'mouse',
    'smart home', 'alexa', 'echo', 'google home', 'ring doorbell',
    'gopro', 'drone', 'camera', 'lens',
  ],

  // ==================== WATCHES & JEWELRY ====================
  watches: ['watch', 'rolex', 'omega', 'seiko', 'casio', 'timepiece', 'wristwatch'],
  jewelry: ['jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'gold', 'silver', 'diamond'],

  // ==================== TOYS & COLLECTIBLES ====================
  toys: ['toy', 'action figure', 'doll', 'plush', 'stuffed animal'],
  action_figures: ['action figure', 'figure', 'statue', 'funko', 'pop vinyl', 'hot toys'],
  collectibles: ['collectible', 'collector', 'rare', 'limited edition'],
  antiques: ['antique', 'victorian', 'art deco', 'edwardian'],
  vintage: ['vintage', 'retro', 'mid-century'],
};

// =============================================================================
// NAME PATTERN OVERRIDES
// =============================================================================
// High-confidence patterns that OVERRIDE AI votes when detected in item name
// These run BEFORE AI vote is accepted to catch obvious misclassifications

const NAME_PATTERN_OVERRIDES: Array<{ patterns: string[]; category: string; priority: number }> = [
  // ==========================================================================
  // STREETWEAR / HYPE BRANDS (NEW v7.5) - Check BEFORE general apparel
  // These trigger Retailed API for StockX pricing
  // ==========================================================================
  {
    patterns: ['supreme', 'box logo', 'bogo'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['bape', 'bathing ape', 'baby milo', 'bape shark'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['off-white', 'off white', 'offwhite', 'virgil abloh'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['fear of god', 'fog essentials', 'essentials hoodie', 'essentials'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['palace', 'tri-ferg', 'palace skate'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['travis scott', 'cactus jack', 'astroworld', 'utopia merch'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['anti social social club', 'assc'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['vlone', 'chrome hearts', 'gallery dept', 'rhude', 'amiri'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['stussy', 'kith', 'undefeated', 'undftd'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['yeezy gap', 'yzy gap', 'yeezy season'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['sp5der', 'spider worldwide', 'hellstar', 'eric emanuel', 'ee shorts'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['drew house', 'human made', 'billionaire boys club', 'bbc icecream'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['corteiz', 'crtz', 'broken planet'],
    category: 'streetwear',
    priority: 110,
  },

  // ==========================================================================
  // GENERAL APPAREL - Lower priority than streetwear
  // ==========================================================================
  // Apparel overrides - catch clothing items AI might miscategorize
  {
    patterns: ['hoodie', 'hoody', 'sweatshirt', 'sweater', 'pullover', 'crewneck'],
    category: 'apparel',
    priority: 100,
  },
  {
    patterns: ['jacket', 'coat', 'blazer', 'windbreaker', 'parka', 'vest'],
    category: 'apparel',
    priority: 100,
  },
  {
    patterns: ['jersey', 'team jersey', 'nfl jersey', 'nba jersey', 'nhl jersey', 'mlb jersey'],
    category: 'apparel',
    priority: 100,
  },
  {
    patterns: ['t-shirt', 'tee shirt', 'polo shirt', 'button up', 'flannel shirt'],
    category: 'apparel',
    priority: 100,
  },
  {
    patterns: ['pants', 'jeans', 'shorts', 'joggers', 'sweatpants', 'trousers'],
    category: 'apparel',
    priority: 100,
  },
  {
    patterns: ['hat', 'cap', 'beanie', 'snapback', 'fitted cap', 'bucket hat'],
    category: 'apparel',
    priority: 100,
  },
  
  // Vinyl - must check before vehicles (vinyl contains "vin")
  {
    patterns: ['vinyl', 'record', ' lp', 'lp ', '33 rpm', '45 rpm', 'album'],
    category: 'vinyl_records',
    priority: 95,
  },
  
  // Pokemon - very specific
  {
    patterns: ['pokemon', 'pokémon', 'pikachu', 'charizard', 'mewtwo'],
    category: 'pokemon_cards',
    priority: 90,
  },
  
  // LEGO - very specific
  {
    patterns: ['lego', 'minifig', 'minifigure'],
    category: 'lego',
    priority: 90,
  },
  
  // Graded cards
  {
    patterns: ['psa 10', 'psa 9', 'bgs 10', 'bgs 9.5', 'cgc 9.8'],
    category: 'graded_cards',
    priority: 90,
  },
];

// =============================================================================
// API LOOKUP
// =============================================================================

export function getApisForCategory(category: string): string[] {
  const catLower = category.toLowerCase().trim();
  
  // Direct match
  if (CATEGORY_API_MAP[catLower]) {
    return CATEGORY_API_MAP[catLower];
  }
  
  // Partial match
  for (const [key, apis] of Object.entries(CATEGORY_API_MAP)) {
    if (catLower.includes(key) || key.includes(catLower)) {
      return apis;
    }
  }
  
  return ['ebay'];
}

// =============================================================================
// MAIN CATEGORY DETECTION
// =============================================================================

export function detectItemCategory(
  itemName: string,
  categoryId?: string,
  aiDetectedCategory?: string
): CategoryDetection {
  const nameLower = itemName.toLowerCase();
  
  console.log(`\n🔍 === CATEGORY DETECTION DEBUG v7.4 ===`);
  console.log(`📝 Item Name: "${itemName}"`);
  console.log(`📝 Name Lower: "${nameLower}"`);
  console.log(`🤖 AI Category Input: ${aiDetectedCategory || 'none'}`);
  console.log(`💡 Category Hint: ${categoryId || 'none'}`);
  
  // ==========================================================================
  // Priority 0 - NAME PATTERN OVERRIDES (NEW v7.4)
  // These override bad AI votes by detecting obvious keywords in item name
  // ==========================================================================
  const overrideResult = checkNamePatternOverrides(nameLower);
  if (overrideResult) {
    console.log(`🚨 NAME OVERRIDE triggered: "${overrideResult.pattern}" → ${overrideResult.category}`);
    
    // Check if AI vote conflicts with override
    if (aiDetectedCategory && normalizeCategory(aiDetectedCategory) !== overrideResult.category) {
      console.log(`⚠️ AI voted "${aiDetectedCategory}" but name contains "${overrideResult.pattern}" - OVERRIDING to ${overrideResult.category}`);
    }
    
    return {
      category: overrideResult.category as ItemCategory,
      confidence: 0.98,
      keywords: [overrideResult.pattern],
      source: 'name_override',
    };
  }
  
  // ==========================================================================
  // Priority 1 - AI detected category (if no override triggered)
  // ==========================================================================
  if (aiDetectedCategory && aiDetectedCategory !== 'general' && aiDetectedCategory !== 'unknown') {
    const normalizedAiCategory = normalizeCategory(aiDetectedCategory);
    if (normalizedAiCategory !== 'general') {
      console.log(`🤖 AI VOTE accepted: ${normalizedAiCategory}`);
      return {
        category: normalizedAiCategory as ItemCategory,
        confidence: 0.95,
        keywords: ['ai_detection'],
        source: 'ai_vote',
      };
    }
  }
  
  // ==========================================================================
  // Priority 2 - Category hint from request
  // ==========================================================================
  if (categoryId && categoryId !== 'general') {
    const normalizedHint = normalizeCategory(categoryId);
    if (normalizedHint !== 'general') {
      console.log(`💡 CATEGORY HINT used: ${normalizedHint}`);
      return {
        category: normalizedHint as ItemCategory,
        confidence: 0.9,
        keywords: ['category_hint'],
        source: 'category_hint',
      };
    }
  }
  
  // ==========================================================================
  // Priority 3 - Name-based detection
  // ==========================================================================
  const nameBasedCategory = detectCategoryFromName(nameLower);
  if (nameBasedCategory && nameBasedCategory !== 'general') {
    console.log(`🎯 NAME PARSING detected: ${nameBasedCategory}`);
    return {
      category: nameBasedCategory as ItemCategory,
      confidence: 0.92,
      keywords: ['name_parsing'],
      source: 'name_parsing',
    };
  }
  
  // ==========================================================================
  // Priority 4 - Keyword detection
  // ==========================================================================
  const keywordResult = detectCategoryByKeywords(nameLower);
  console.log(`🔑 KEYWORD DETECTION result: ${keywordResult.category} (confidence: ${keywordResult.confidence})`);
  console.log(`🔑 Matched keywords: ${keywordResult.keywords.join(', ') || 'none'}`);
  
  if (keywordResult.category !== 'general') {
    return { ...keywordResult, source: 'keyword_detection' };
  }
  
  console.log(`⚠️ No category detected, defaulting to general`);
  return { category: 'general', confidence: 0.5, keywords: [], source: 'default' };
}

// =============================================================================
// NAME PATTERN OVERRIDE CHECK (NEW v7.4)
// =============================================================================

function checkNamePatternOverrides(nameLower: string): { category: string; pattern: string } | null {
  // Sort by priority descending
  const sortedOverrides = [...NAME_PATTERN_OVERRIDES].sort((a, b) => b.priority - a.priority);
  
  for (const override of sortedOverrides) {
    for (const pattern of override.patterns) {
      if (nameLower.includes(pattern)) {
        return { category: override.category, pattern };
      }
    }
  }
  
  return null;
}

// =============================================================================
// NAME-BASED DETECTION
// =============================================================================

export function detectCategoryFromName(nameLower: string): string | null {
  // Barcode Detection - 8-13 digit numbers
  const barcodePattern = /\b\d{8,13}\b/;
  if (barcodePattern.test(nameLower)) {
    return 'household';
  }
  
  // IMPORTANT: Check for vinyl BEFORE checking for VIN!
  if (nameLower.includes('vinyl') || nameLower.includes('record') ||
      nameLower.includes(' lp') || nameLower.includes('lp ') ||
      nameLower.includes('33 rpm') || nameLower.includes('45 rpm') ||
      nameLower.includes('album')) {
    return 'vinyl_records';
  }
  
  // VIN Detection - 17 character alphanumeric
  const vinPattern = /\b[A-HJ-NPR-Z0-9]{17}\b/i;
  const hasVinWord = /\bvin\b/i.test(nameLower);
  if (vinPattern.test(nameLower) || hasVinWord) {
    return 'vehicles';
  }
  
  // ==========================================================================
  // STREETWEAR / HYPE BRANDS (v7.5) - Check BEFORE general apparel
  // ==========================================================================
  const streetwearBrands = [
    // Supreme
    'supreme', 'box logo', 'bogo',
    // BAPE
    'bape', 'bathing ape', 'baby milo',
    // Off-White
    'off-white', 'off white', 'offwhite',
    // Fear of God / Essentials
    'fear of god', 'fog essentials', 'essentials',
    // Palace
    'palace',
    // Travis Scott
    'travis scott', 'cactus jack', 'astroworld',
    // ASSC
    'anti social social club', 'assc',
    // Others
    'vlone', 'chrome hearts', 'gallery dept', 'rhude', 'amiri',
    'stussy', 'kith', 'undefeated',
    'yeezy gap', 'yzy gap',
    'sp5der', 'hellstar', 'eric emanuel',
    'drew house', 'human made', 'corteiz', 'broken planet',
    'billionaire boys club',
  ];
  
  for (const brand of streetwearBrands) {
    if (nameLower.includes(brand)) {
      return 'streetwear';
    }
  }
  
  // ==========================================================================
  // GENERAL APPAREL (v7.4) - Sports jerseys, regular clothing
  // ==========================================================================
  const apparelPatterns = [
    'hoodie', 'hoody', 'sweatshirt', 'sweater', 'pullover', 'crewneck',
    'jacket', 'coat', 'blazer', 'windbreaker', 'parka', 'vest', 'fleece',
    'jersey', 'uniform',
    't-shirt', 'tee', 'polo', 'shirt', 'flannel', 'button up',
    'pants', 'jeans', 'shorts', 'joggers', 'sweatpants', 'trousers',
    'hat', 'cap', 'beanie', 'snapback',
  ];
  
  for (const pattern of apparelPatterns) {
    if (nameLower.includes(pattern)) {
      return 'apparel';
    }
  }
  
  // Skip vehicle detection if it contains card-related keywords
  const cardKeywords = ['card', 'pokemon', 'tcg', 'holo', 'vmax', 'vstar', 'ex', 'gx', 'trading'];
  const hasCardKeyword = cardKeywords.some(kw => nameLower.includes(kw));
  
  if (!hasCardKeyword) {
    const vehiclePatterns = [
      'vehicle', 'automobile', 'automotive', 'car ', ' car', 'sedan', 'coupe',
      'truck', 'pickup', 'suv', 'crossover', 'minivan', 'van ',
      'motorcycle', 'motorbike', 'harley',
      'ford ', 'chevrolet', 'chevy', 'toyota', 'honda ', 'nissan', 'dodge',
      'jeep', 'gmc', 'bmw', 'mercedes', 'audi', 'tesla',
      'mustang', 'camaro', 'corvette', 'f-150', 'f150', 'silverado',
    ];
    
    for (const pattern of vehiclePatterns) {
      if (nameLower.includes(pattern)) {
        return 'vehicles';
      }
    }
  }
  
  // Household patterns
  const householdPatterns = [
    'blender', 'coffee maker', 'keurig', 'instant pot', 'air fryer',
    'vacuum', 'dyson', 'roomba', 'vitamix', 'cuisinart', 'kitchenaid',
    'new in box', 'nib', 'factory sealed',
  ];
  
  for (const pattern of householdPatterns) {
    if (nameLower.includes(pattern)) {
      return 'household';
    }
  }
  
  // PSA/Graded detection
  const psaPatterns = [
    'psa 10', 'psa 9', 'psa 8', 'bgs 10', 'bgs 9.5', 'cgc 9.8',
    'psa graded', 'beckett graded', 'gem mint',
  ];
  
  for (const pattern of psaPatterns) {
    if (nameLower.includes(pattern)) {
      if (nameLower.includes('pokemon') || nameLower.includes('charizard')) {
        return 'pokemon_cards';
      }
      if (nameLower.includes('baseball') || nameLower.includes('football') ||
          nameLower.includes('basketball') || nameLower.includes('topps')) {
        return 'sports_cards';
      }
      return 'graded_cards';
    }
  }
  
  // Pokemon detection
  if (nameLower.includes('pokemon') || nameLower.includes('pokémon') ||
      nameLower.includes('pikachu') || nameLower.includes('charizard')) {
    return 'pokemon_cards';
  }
  
  // LEGO detection
  if (nameLower.includes('lego') || nameLower.includes('minifig')) {
    return 'lego';
  }
  
  // Book detection
  if ((nameLower.includes('book') || nameLower.includes('hardcover') ||
       nameLower.includes('paperback') || nameLower.includes('isbn')) &&
      !nameLower.includes('comic')) {
    return 'books';
  }
  
  // Video game detection
  if (nameLower.includes('video game') || nameLower.includes('nintendo') ||
      nameLower.includes('playstation') || nameLower.includes('xbox')) {
    return 'video_games';
  }
  
  // Sneaker detection - ONLY for actual shoes
  const sneakerOnlyPatterns = [
    'sneaker', 'jordan 1', 'jordan 4', 'jordan 11', 'yeezy 350',
    'nike dunk', 'air force 1', 'air max',
  ];
  
  for (const pattern of sneakerOnlyPatterns) {
    if (nameLower.includes(pattern)) {
      return 'sneakers';
    }
  }
  
  // Comic detection
  if (nameLower.includes('comic') || nameLower.includes('manga')) {
    return 'comics';
  }
  
  return null;
}

// =============================================================================
// CATEGORY NORMALIZATION
// =============================================================================

export function normalizeCategory(category: string): string {
  const catLower = category.toLowerCase().trim().replace(/[_\s-]+/g, '_');
  
  // Pokemon/trading cards
  if (catLower.includes('pokemon') || catLower.includes('pokémon')) {
    return 'pokemon_cards';
  }
  
  if (catLower.includes('trading_card') || catLower.includes('tcg') || catLower === 'cards') {
    return 'trading_cards';
  }
  
  // CRITICAL: Check vinyl BEFORE vehicle
  if (catLower.includes('vinyl') || catLower.includes('record') ||
      catLower === 'music' || catLower === 'album') {
    return 'vinyl_records';
  }
  
  // Streetwear / Hype brands (NEW v7.5) - check BEFORE general apparel
  const HYPE_BRANDS = [
    'supreme', 'bape', 'bathing_ape', 'off_white', 'offwhite', 'fear_of_god',
    'fog', 'essentials', 'palace', 'travis_scott', 'cactus_jack', 'astroworld',
    'anti_social', 'assc', 'vlone', 'chrome_hearts', 'gallery_dept', 'rhude',
    'amiri', 'stussy', 'kith', 'undefeated', 'yeezy_gap', 'sp5der', 'hellstar',
    'eric_emanuel', 'drew_house', 'human_made', 'corteiz', 'broken_planet'
  ];
  
  for (const brand of HYPE_BRANDS) {
    if (catLower.includes(brand)) {
      return 'streetwear';
    }
  }
  
  // Streetwear category normalization
  if (catLower === 'streetwear' || catLower === 'hype' || catLower === 'hype_apparel') {
    return 'streetwear';
  }
  
  // Apparel normalization (v7.4) - general clothing, NOT hype
  if (catLower.includes('apparel') || catLower.includes('clothing') ||
      catLower.includes('fashion') || catLower.includes('garment') ||
      catLower.includes('hoodie') || catLower.includes('jacket') ||
      catLower.includes('jersey') || catLower.includes('shirt') ||
      catLower.includes('pants') || catLower.includes('hat')) {
    return 'apparel';
  }
  
  // Household
  if (catLower.includes('household') || catLower.includes('appliance') ||
      catLower.includes('kitchen') || catLower.includes('home_goods')) {
    return 'household';
  }
  
  // Vehicle - AFTER vinyl check
  const isVinRelated = catLower === 'vin' ||
                       catLower.startsWith('vin_') ||
                       catLower.endsWith('_vin');
  
  if (catLower.includes('vehicle') || catLower.includes('auto') ||
      catLower.includes('truck') || catLower.includes('motorcycle') || isVinRelated) {
    if (!catLower.includes('card') && !catLower.includes('vinyl')) {
      return 'vehicles';
    }
  }
  
  if (catLower.includes('coin') || catLower.includes('numismatic')) {
    return 'coins';
  }
  
  if (catLower.includes('lego') || catLower.includes('brick')) {
    return 'lego';
  }
  
  if (catLower.includes('video_game') || catLower === 'gaming') {
    return 'video_games';
  }
  
  if (catLower.includes('comic') || catLower.includes('manga')) {
    return 'comics';
  }
  
  if (catLower.includes('book') && !catLower.includes('comic')) {
    return 'books';
  }
  
  // Sneakers - ONLY if specifically about shoes/footwear
  if (catLower.includes('sneaker') || catLower.includes('footwear') ||
      catLower === 'shoes' || catLower === 'jordans' || catLower === 'yeezy') {
    return 'sneakers';
  }
  
  if (catLower.includes('electronic') || catLower.includes('gadget')) {
    return 'electronics';
  }
  
  return catLower;
}

// =============================================================================
// KEYWORD-BASED DETECTION
// =============================================================================

export function detectCategoryByKeywords(nameLower: string): {
  category: ItemCategory;
  confidence: number;
  keywords: string[];
} {
  const scores: Record<string, { score: number; matches: string[] }> = {};
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[category] = { score: 0, matches: [] };
    keywords.forEach(kw => {
      if (nameLower.includes(kw)) {
        // Longer phrases score higher
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