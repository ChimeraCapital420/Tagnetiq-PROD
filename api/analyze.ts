// HYDRA v5.0 - AI Category Detection + Multi-API Market Data Integration
// Key fixes: 1) AI votes on category, 2) Returns detected category, 3) Proper API routing
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Node.js runtime configuration
export const config = {
  maxDuration: 60, // Increased for multiple API calls
};

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Production URL for internal API calls
const BASE_URL = 'https://tagnetiq-prod.vercel.app';

// ==================== TYPES ====================

interface HydraConsensus {
  analysisId: string;
  votes: any[];
  consensus: {
    itemName: string;
    estimatedValue: number;
    decision: 'BUY' | 'SELL';
    confidence: number;
    totalVotes: number;
    analysisQuality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
    consensusMetrics: any;
  };
  processingTime: number;
  authorityData?: any;
}

interface AnalysisRequest {
  scanType: 'barcode' | 'image' | 'vin' | 'multi-modal';
  data?: string;
  items?: Array<{
    type: string;
    data: string;
    name?: string;
    metadata?: any;
  }>;
  category_id: string;
  subcategory_id?: string;
}

interface MarketDataSource {
  source: string;
  available: boolean;
  query: string;
  totalListings: number;
  priceAnalysis?: {
    lowest: number;
    highest: number;
    average: number;
    median: number;
  };
  suggestedPrices?: {
    goodDeal: number;
    fairMarket: number;
    sellPrice: number;
  };
  sampleListings?: Array<{
    title: string;
    price: number;
    condition: string;
    url: string;
  }>;
  error?: string;
  metadata?: Record<string, any>;
}

interface AnalysisResult {
  id: string;
  itemName: string;
  estimatedValue: number;
  decision: 'BUY' | 'SELL';
  confidenceScore: number;
  summary_reasoning: string;
  valuation_factors: string[];
  analysis_quality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
  capturedAt: string;
  category: string;           // v5.0: Now returns DETECTED category
  requestedCategory?: string; // v5.0: Original request category for reference
  subCategory?: string;
  imageUrl: string;
  marketComps: any[];
  resale_toolkit: {
    listInArena: boolean;
    sellOnProPlatforms: boolean;
    linkToMyStore: boolean;
    shareToSocial: boolean;
  };
  tags: string[];
  hydraConsensus?: HydraConsensus & {
    totalSources: number;
    aiModels: {
      responded: string[];
      weights: Record<string, number>;
    };
    apiSources: {
      responded: string[];
      data: Record<string, { confidence: number; dataPoints: number }>;
    };
    consensusMethod: string;
    finalConfidence: number;
  };
  authorityData?: any;
  marketData?: {
    sources: MarketDataSource[];
    primarySource: string;
    blendMethod: string;
  };
  debug_info?: {
    reason: string;
    details: string;
  };
}

// ==================== v5.0 CATEGORY SYSTEM ====================

// Expanded category list (60+ categories mapped to API endpoints)
type ItemCategory = 
  | 'coins' | 'banknotes' | 'currency'
  | 'lego' | 'building_blocks'
  | 'trading_cards' | 'pokemon_cards' | 'mtg_cards' | 'sports_cards' | 'yugioh_cards'
  | 'books' | 'rare_books' | 'textbooks' | 'comics' | 'manga' | 'graphic_novels'
  | 'video_games' | 'retro_games' | 'game_consoles'
  | 'vinyl_records' | 'music' | 'cds' | 'cassettes'
  | 'sneakers' | 'shoes' | 'streetwear' | 'designer_fashion'
  | 'watches' | 'jewelry' | 'gemstones'
  | 'art' | 'paintings' | 'prints' | 'sculptures'
  | 'antiques' | 'vintage' | 'collectibles'
  | 'toys' | 'action_figures' | 'dolls' | 'model_kits'
  | 'sports_memorabilia' | 'autographs'
  | 'stamps' | 'postcards'
  | 'electronics' | 'cameras' | 'audio_equipment'
  | 'musical_instruments' | 'guitars' | 'keyboards'
  | 'tools' | 'power_tools'
  | 'general';

// Map categories to their specialized APIs
const CATEGORY_API_MAP: Record<string, string[]> = {
  // Coins & Currency → Numista
  'coins': ['numista', 'ebay'],
  'banknotes': ['numista', 'ebay'],
  'currency': ['numista', 'ebay'],
  
  // LEGO → Brickset
  'lego': ['brickset', 'ebay'],
  'building_blocks': ['brickset', 'ebay'],
  
  // Trading Cards → Pokemon TCG (or specific card APIs)
  'trading_cards': ['pokemon_tcg', 'ebay'],
  'pokemon_cards': ['pokemon_tcg', 'ebay'],
  'pokemon': ['pokemon_tcg', 'ebay'],
  'mtg_cards': ['ebay'], // Could add Scryfall API
  'sports_cards': ['ebay'],
  'yugioh_cards': ['ebay'],
  
  // Books → Google Books
  'books': ['google_books', 'ebay'],
  'rare_books': ['google_books', 'ebay'],
  'textbooks': ['google_books', 'ebay'],
  
  // Comics → Comic Vine
  'comics': ['comicvine', 'ebay'],
  'manga': ['comicvine', 'ebay'],
  'graphic_novels': ['comicvine', 'ebay'],
  
  // Video Games → RAWG
  'video_games': ['rawg', 'ebay'],
  'retro_games': ['rawg', 'ebay'],
  'game_consoles': ['rawg', 'ebay'],
  
  // Music → Discogs
  'vinyl_records': ['discogs', 'ebay'],
  'vinyl': ['discogs', 'ebay'],
  'music': ['discogs', 'ebay'],
  'records': ['discogs', 'ebay'],
  'cds': ['discogs', 'ebay'],
  'cassettes': ['discogs', 'ebay'],
  
  // Sneakers → Retailed
  'sneakers': ['retailed', 'ebay'],
  'shoes': ['retailed', 'ebay'],
  'streetwear': ['retailed', 'ebay'],
  'jordans': ['retailed', 'ebay'],
  'nike': ['retailed', 'ebay'],
  'yeezy': ['retailed', 'ebay'],
  
  // General/fallback → eBay only
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

// Get APIs for a category with fuzzy matching
function getApisForCategory(category: string): string[] {
  const catLower = category.toLowerCase().trim();
  
  // Direct match
  if (CATEGORY_API_MAP[catLower]) {
    return CATEGORY_API_MAP[catLower];
  }
  
  // Fuzzy match - check if category contains or is contained by a key
  for (const [key, apis] of Object.entries(CATEGORY_API_MAP)) {
    if (catLower.includes(key) || key.includes(catLower)) {
      return apis;
    }
  }
  
  // Default to eBay
  return ['ebay'];
}

interface CategoryDetection {
  category: ItemCategory;
  confidence: number;
  keywords: string[];
  source: 'ai_vote' | 'keyword_detection' | 'category_hint' | 'default';
}

// v5.0: Enhanced category detection that combines AI votes + keyword detection
function detectItemCategory(
  itemName: string, 
  categoryId?: string,
  aiDetectedCategory?: string
): CategoryDetection {
  const nameLower = itemName.toLowerCase();
  
  // v5.0: Priority 1 - AI detected category (from JSON response)
  if (aiDetectedCategory && aiDetectedCategory !== 'general' && aiDetectedCategory !== 'unknown') {
    const normalizedAiCategory = normalizeCategory(aiDetectedCategory);
    if (normalizedAiCategory !== 'general') {
      console.log(`🤖 AI detected category: ${normalizedAiCategory}`);
      return { 
        category: normalizedAiCategory as ItemCategory, 
        confidence: 0.95, 
        keywords: ['ai_detection'],
        source: 'ai_vote'
      };
    }
  }
  
  // Priority 2 - Category hint from request (only if specific)
  if (categoryId && categoryId !== 'general') {
    const normalizedHint = normalizeCategory(categoryId);
    if (normalizedHint !== 'general') {
      console.log(`💡 Category hint used: ${normalizedHint}`);
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
  if (keywordResult.category !== 'general') {
    console.log(`🔍 Keyword detected category: ${keywordResult.category} (keywords: ${keywordResult.keywords.join(', ')})`);
    return { ...keywordResult, source: 'keyword_detection' };
  }
  
  // Default
  console.log(`⚠️ No specific category detected, defaulting to general`);
  return { category: 'general', confidence: 0.5, keywords: [], source: 'default' };
}

// Normalize various category strings to our standard categories
function normalizeCategory(category: string): string {
  const catLower = category.toLowerCase().trim().replace(/[_\s-]+/g, '_');
  
  // Pokemon variations
  if (catLower.includes('pokemon') || catLower.includes('pokémon')) {
    return 'pokemon_cards';
  }
  
  // Trading card variations
  if (catLower.includes('trading_card') || catLower.includes('tcg') || catLower === 'cards') {
    return 'trading_cards';
  }
  
  // Coin variations
  if (catLower.includes('coin') || catLower.includes('numismatic') || catLower.includes('currency')) {
    return 'coins';
  }
  
  // LEGO variations
  if (catLower.includes('lego') || catLower.includes('brick')) {
    return 'lego';
  }
  
  // Video game variations
  if (catLower.includes('video_game') || catLower.includes('videogame') || catLower === 'gaming') {
    return 'video_games';
  }
  
  // Vinyl/Music variations
  if (catLower.includes('vinyl') || catLower.includes('record') || catLower === 'music' || catLower === 'album') {
    return 'vinyl_records';
  }
  
  // Comic variations
  if (catLower.includes('comic') || catLower.includes('manga')) {
    return 'comics';
  }
  
  // Book variations
  if (catLower.includes('book') && !catLower.includes('comic')) {
    return 'books';
  }
  
  // Sneaker variations
  if (catLower.includes('sneaker') || catLower.includes('jordan') || catLower.includes('yeezy') || 
      catLower.includes('shoe') || catLower.includes('footwear')) {
    return 'sneakers';
  }
  
  // Return as-is if no normalization needed
  return catLower;
}

// Keyword-based category detection (fallback)
function detectCategoryByKeywords(nameLower: string): { category: ItemCategory; confidence: number; keywords: string[] } {
  // Keyword lists for each category
  const categoryKeywords: Record<ItemCategory, string[]> = {
    coins: [
      'coin', 'penny', 'nickel', 'dime', 'quarter', 'dollar', 'cent',
      'morgan', 'liberty', 'eagle', 'buffalo', 'wheat', 'mercury',
      'numismatic', 'mint', 'uncirculated', 'proof', 'silver dollar',
      'gold coin', 'half dollar', 'commemorative', 'bullion',
      'currency', 'banknote', 'note', 'bill'
    ],
    banknotes: ['banknote', 'paper money', 'currency note'],
    currency: [],
    lego: [
      'lego', 'legos', 'brick', 'minifig', 'minifigure',
      'star wars lego', 'technic', 'creator', 'ninjago',
      'city lego', 'friends lego', 'duplo', 'bionicle',
      'millennium falcon', 'death star', 'hogwarts'
    ],
    building_blocks: [],
    trading_cards: [
      'pokemon', 'pokémon', 'charizard', 'pikachu', 'magic the gathering', 'mtg',
      'yu-gi-oh', 'yugioh', 'trading card', 'tcg', 'holographic',
      'first edition', 'psa', 'graded card', 'booster', 'pack',
      'vmax', 'vstar', 'ex card', 'gx card', 'full art',
      'rainbow rare', 'secret rare', 'shiny', 'holo'
    ],
    pokemon_cards: ['pokemon', 'pokémon', 'pikachu', 'charizard', 'mewtwo', 'gengar', 'eevee'],
    mtg_cards: ['magic the gathering', 'mtg', 'planeswalker', 'mana'],
    sports_cards: ['topps', 'panini', 'rookie card', 'sports card', 'baseball card', 'football card', 'basketball card'],
    yugioh_cards: ['yu-gi-oh', 'yugioh', 'blue eyes', 'dark magician'],
    books: [
      'book', 'novel', 'hardcover', 'paperback', 'first edition book',
      'signed copy', 'isbn', 'author', 'rare book', 'antique book'
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
    manga: ['manga', 'anime', 'japanese comic'],
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
    watches: ['watch', 'rolex', 'omega', 'seiko', 'casio', 'timepiece'],
    jewelry: ['jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'gold', 'silver', 'diamond'],
    gemstones: ['gemstone', 'ruby', 'emerald', 'sapphire', 'diamond'],
    art: ['painting', 'artwork', 'canvas', 'oil painting', 'watercolor'],
    paintings: ['painting', 'oil on canvas'],
    prints: ['print', 'lithograph', 'screen print', 'art print'],
    sculptures: ['sculpture', 'statue', 'figurine'],
    antiques: ['antique', 'vintage', 'victorian', 'art deco'],
    vintage: ['vintage', 'retro', 'mid-century'],
    collectibles: ['collectible', 'collector', 'rare', 'limited edition'],
    toys: ['toy', 'action figure', 'doll', 'plush', 'stuffed animal'],
    action_figures: ['action figure', 'figure', 'statue', 'funko', 'pop vinyl'],
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
  
  // Score each category
  const scores: Record<string, { score: number; matches: string[] }> = {};
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    scores[category] = { score: 0, matches: [] };
    keywords.forEach(kw => {
      if (nameLower.includes(kw)) {
        // Weight multi-word keywords higher
        scores[category].score += kw.split(' ').length;
        scores[category].matches.push(kw);
      }
    });
  }
  
  // Find highest scoring category
  let bestCategory: ItemCategory = 'general';
  let bestScore = 0;
  let bestMatches: string[] = [];
  
  for (const [cat, data] of Object.entries(scores)) {
    if (data.score > bestScore) {
      bestScore = data.score;
      bestCategory = cat as ItemCategory;
      bestMatches = data.matches;
    }
  }
  
  // Calculate confidence
  const confidence = Math.min(0.5 + (bestScore * 0.1), 0.95);
  
  return { category: bestCategory, confidence, keywords: bestMatches };
}

// ==================== API FETCHERS ====================

// eBay Market Data Fetcher
async function fetchEbayMarketData(itemName: string): Promise<MarketDataSource> {
  try {
    console.log(`🛒 [eBay] Fetching market data for: ${itemName}`);
    
    const searchQuery = itemName
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
    
    const url = `${BASE_URL}/api/ebay/price-check?q=${encodeURIComponent(searchQuery)}&limit=10`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      console.warn(`⚠️ [eBay] API returned ${response.status}`);
      return {
        source: 'eBay',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: `API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    const listingCount = data.priceAnalysis?.sampleSize || data.totalListings || 0;
    
    console.log(`✅ [eBay] ${listingCount} listings found`);
    
    return {
      source: 'eBay',
      available: true,
      query: data.query || searchQuery,
      totalListings: listingCount,
      priceAnalysis: data.priceAnalysis ? {
        lowest: data.priceAnalysis.lowestPrice || data.priceAnalysis.lowest,
        highest: data.priceAnalysis.highestPrice || data.priceAnalysis.highest,
        average: data.priceAnalysis.averagePrice || data.priceAnalysis.average,
        median: data.priceAnalysis.medianPrice || data.priceAnalysis.median
      } : undefined,
      suggestedPrices: data.suggestedPrices,
      sampleListings: data.sampleListings?.slice(0, 5).map((listing: any) => ({
        title: listing.title,
        price: listing.price,
        condition: listing.condition,
        url: listing.url
      }))
    };
    
  } catch (error: any) {
    console.warn(`⚠️ [eBay] Fetch failed: ${error.message}`);
    return {
      source: 'eBay',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error.message
    };
  }
}

// Numista Coin Data Fetcher
async function fetchNumistaData(itemName: string): Promise<MarketDataSource> {
  try {
    console.log(`🪙 [Numista] Fetching coin data for: ${itemName}`);
    
    const searchQuery = itemName
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
    
    const url = `${BASE_URL}/api/numista/price-check?q=${encodeURIComponent(searchQuery)}&limit=5`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      console.warn(`⚠️ [Numista] API returned ${response.status}`);
      return {
        source: 'Numista',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: `API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    if (!data.found || !data.priceAnalysis) {
      console.log(`ℹ️ [Numista] No pricing data found`);
      return {
        source: 'Numista',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: 'No pricing data available'
      };
    }
    
    console.log(`✅ [Numista] ${data.priceAnalysis.sampleSize} price points found`);
    
    return {
      source: 'Numista',
      available: true,
      query: data.query || searchQuery,
      totalListings: data.priceAnalysis.sampleSize || 0,
      priceAnalysis: {
        lowest: data.priceAnalysis.lowestPrice,
        highest: data.priceAnalysis.highestPrice,
        average: data.priceAnalysis.averagePrice,
        median: data.priceAnalysis.medianPrice
      },
      suggestedPrices: data.suggestedPrices,
      sampleListings: data.sampleListings?.slice(0, 5).map((listing: any) => ({
        title: listing.title,
        price: listing.price,
        condition: listing.condition || 'Catalogue Price',
        url: listing.url
      })),
      metadata: {
        dataSource: 'numista_catalogue',
        totalTypes: data.totalTypes
      }
    };
    
  } catch (error: any) {
    console.warn(`⚠️ [Numista] Fetch failed: ${error.message}`);
    return {
      source: 'Numista',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error.message
    };
  }
}

// Brickset LEGO Data Fetcher
async function fetchBricksetData(itemName: string): Promise<MarketDataSource> {
  try {
    console.log(`🧱 [Brickset] Fetching LEGO data for: ${itemName}`);
    
    // Extract set number if present (e.g., "75192" from "LEGO 75192 Millennium Falcon")
    const setNumberMatch = itemName.match(/\b(\d{4,6})\b/);
    
    let url: string;
    if (setNumberMatch) {
      url = `${BASE_URL}/api/brickset/price-check?setNumber=${setNumberMatch[1]}`;
      console.log(`🔍 [Brickset] Searching by set number: ${setNumberMatch[1]}`);
    } else {
      const searchQuery = itemName
        .replace(/lego/gi, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);
      url = `${BASE_URL}/api/brickset/price-check?q=${encodeURIComponent(searchQuery)}&limit=5`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ [Brickset] API returned ${response.status}: ${errorText.substring(0, 100)}`);
      return {
        source: 'Brickset',
        available: false,
        query: itemName,
        totalListings: 0,
        error: `API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    if (!data.found || !data.priceAnalysis) {
      console.log(`ℹ️ [Brickset] No LEGO sets found`);
      return {
        source: 'Brickset',
        available: false,
        query: itemName,
        totalListings: 0,
        error: 'No matching LEGO sets found'
      };
    }
    
    console.log(`✅ [Brickset] ${data.totalSets} sets found`);
    
    return {
      source: 'Brickset',
      available: true,
      query: data.query,
      totalListings: data.totalSets || data.priceAnalysis.sampleSize || 0,
      priceAnalysis: {
        lowest: data.priceAnalysis.lowestPrice,
        highest: data.priceAnalysis.highestPrice,
        average: data.priceAnalysis.averagePrice,
        median: data.priceAnalysis.medianPrice
      },
      suggestedPrices: data.suggestedPrices,
      sampleListings: data.sampleListings?.slice(0, 5).map((listing: any) => ({
        title: listing.title,
        price: listing.price,
        condition: listing.condition || 'Estimated Value',
        url: listing.url
      })),
      metadata: {
        dataSource: 'brickset_catalogue',
        note: data.note
      }
    };
    
  } catch (error: any) {
    console.warn(`⚠️ [Brickset] Fetch failed: ${error.message}`);
    return {
      source: 'Brickset',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error.message
    };
  }
}

// Google Books Data Fetcher
async function fetchGoogleBooksData(itemName: string): Promise<MarketDataSource> {
  try {
    console.log(`📚 [Google Books] Fetching book data for: ${itemName}`);
    
    // Try to extract ISBN if present
    const isbnMatch = itemName.match(/(?:isbn[:\s]*)?(\d{10}|\d{13})/i);
    
    let url: string;
    if (isbnMatch) {
      url = `${BASE_URL}/api/google-books/price-check?isbn=${isbnMatch[1]}`;
      console.log(`🔍 [Google Books] Searching by ISBN: ${isbnMatch[1]}`);
    } else {
      const searchQuery = itemName
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);
      url = `${BASE_URL}/api/google-books/price-check?q=${encodeURIComponent(searchQuery)}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ [Google Books] API returned ${response.status}: ${errorText.substring(0, 100)}`);
      return {
        source: 'Google Books',
        available: false,
        query: itemName,
        totalListings: 0,
        error: `API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    if (!data.found || !data.priceAnalysis) {
      console.log(`ℹ️ [Google Books] No books found`);
      return {
        source: 'Google Books',
        available: false,
        query: itemName,
        totalListings: 0,
        error: 'No matching books found'
      };
    }
    
    console.log(`✅ [Google Books] Found: ${data.book?.title || 'Book'} - Retail: $${data.pricing?.retailPrice}`);
    
    return {
      source: 'Google Books',
      available: true,
      query: data.query,
      totalListings: data.conditionPrices?.length || data.priceAnalysis?.priceCount || 1,
      priceAnalysis: {
        lowest: data.priceAnalysis.lowestPrice,
        highest: data.priceAnalysis.highestPrice,
        average: data.priceAnalysis.averagePrice,
        median: data.priceAnalysis.medianPrice
      },
      suggestedPrices: data.suggestedPrices,
      sampleListings: data.sampleListings?.slice(0, 5).map((listing: any) => ({
        title: listing.title,
        price: listing.price,
        condition: listing.condition || 'Good Condition',
        url: listing.url
      })),
      metadata: {
        dataSource: 'google_books',
        book: data.book,
        retailPrice: data.pricing?.retailPrice,
        isbn: data.book?.isbn13 || data.book?.isbn10
      }
    };
    
  } catch (error: any) {
    console.warn(`⚠️ [Google Books] Fetch failed: ${error.message}`);
    return {
      source: 'Google Books',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error.message
    };
  }
}

// Pokemon TCG Data Fetcher
async function fetchPokemonTCGData(itemName: string): Promise<MarketDataSource> {
  try {
    console.log(`🎴 [Pokemon TCG] Fetching card data for: ${itemName}`);
    
    const searchQuery = itemName
      .replace(/pokemon/gi, '')
      .replace(/pokémon/gi, '')
      .replace(/card/gi, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
    
    const url = `${BASE_URL}/api/pokemon/search?q=${encodeURIComponent(searchQuery)}&limit=5`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      console.warn(`⚠️ [Pokemon TCG] API returned ${response.status}`);
      return {
        source: 'Pokemon TCG',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: `API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    if (!data.success || !data.results || data.results.length === 0) {
      console.log(`ℹ️ [Pokemon TCG] No cards found`);
      return {
        source: 'Pokemon TCG',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: 'No matching Pokemon cards found'
      };
    }
    
    // Extract pricing from results
    const prices: number[] = [];
    const listings: any[] = [];
    
    data.results.forEach((card: any) => {
      if (card.pricing?.tcgplayer?.market) {
        prices.push(card.pricing.tcgplayer.market);
        listings.push({
          title: card.name,
          price: card.pricing.tcgplayer.market,
          condition: card.rarity || 'Market Price',
          url: card.tcgplayerUrl || `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(card.name)}`
        });
      } else if (card.pricing?.cardmarket?.averageSellPrice) {
        prices.push(card.pricing.cardmarket.averageSellPrice);
        listings.push({
          title: card.name,
          price: card.pricing.cardmarket.averageSellPrice,
          condition: card.rarity || 'Average Sell',
          url: card.cardmarketUrl || '#'
        });
      }
    });
    
    if (prices.length === 0) {
      return {
        source: 'Pokemon TCG',
        available: false,
        query: searchQuery,
        totalListings: data.totalResults || 0,
        error: 'Cards found but no pricing data available'
      };
    }
    
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
    
    console.log(`✅ [Pokemon TCG] ${data.totalResults} cards found, ${prices.length} with pricing`);
    
    return {
      source: 'Pokemon TCG',
      available: true,
      query: data.query || searchQuery,
      totalListings: data.totalResults || prices.length,
      priceAnalysis: {
        lowest: Math.min(...prices),
        highest: Math.max(...prices),
        average: prices.reduce((a, b) => a + b, 0) / prices.length,
        median: median
      },
      suggestedPrices: {
        goodDeal: Math.min(...prices) * 0.85,
        fairMarket: median,
        sellPrice: median * 1.15
      },
      sampleListings: listings.slice(0, 5),
      metadata: {
        dataSource: 'pokemon_tcg_api',
        totalCards: data.totalResults
      }
    };
    
  } catch (error: any) {
    console.warn(`⚠️ [Pokemon TCG] Fetch failed: ${error.message}`);
    return {
      source: 'Pokemon TCG',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error.message
    };
  }
}

// RAWG Video Games Data Fetcher
async function fetchRAWGData(itemName: string): Promise<MarketDataSource> {
  try {
    console.log(`🎮 [RAWG] Fetching video game data for: ${itemName}`);
    
    const searchQuery = itemName
      .replace(/video game/gi, '')
      .replace(/game/gi, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
    
    const url = `${BASE_URL}/api/rawg/search?q=${encodeURIComponent(searchQuery)}&limit=5`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      console.warn(`⚠️ [RAWG] API returned ${response.status}`);
      return {
        source: 'RAWG',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: `API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    if (!data.success || !data.results || data.results.length === 0) {
      console.log(`ℹ️ [RAWG] No games found`);
      return {
        source: 'RAWG',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: 'No matching video games found'
      };
    }
    
    // Build listings from results (RAWG doesn't have pricing, but has metadata)
    const listings = data.results.map((game: any) => ({
      title: game.name,
      price: 0, // RAWG doesn't provide pricing
      condition: `Metacritic: ${game.metacritic || 'N/A'} | Released: ${game.released || 'Unknown'}`,
      url: `https://rawg.io/games/${game.slug}`
    }));
    
    console.log(`✅ [RAWG] ${data.totalResults} games found`);
    
    // RAWG provides metadata, not pricing - useful for identification
    return {
      source: 'RAWG',
      available: true,
      query: data.query || searchQuery,
      totalListings: data.totalResults || data.results.length,
      // No price analysis since RAWG doesn't provide prices
      sampleListings: listings.slice(0, 5),
      metadata: {
        dataSource: 'rawg_games_db',
        totalGames: data.totalResults,
        topResult: data.results[0] ? {
          name: data.results[0].name,
          released: data.results[0].released,
          metacritic: data.results[0].metacritic,
          platforms: data.results[0].platforms
        } : null,
        note: 'RAWG provides game metadata, not pricing. Use eBay for market prices.'
      }
    };
    
  } catch (error: any) {
    console.warn(`⚠️ [RAWG] Fetch failed: ${error.message}`);
    return {
      source: 'RAWG',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error.message
    };
  }
}

// Discogs Music/Vinyl Data Fetcher
async function fetchDiscogsData(itemName: string): Promise<MarketDataSource> {
  try {
    console.log(`🎵 [Discogs] Fetching music data for: ${itemName}`);
    
    const searchQuery = itemName
      .replace(/vinyl/gi, '')
      .replace(/record/gi, '')
      .replace(/album/gi, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
    
    const url = `${BASE_URL}/api/discogs/search?q=${encodeURIComponent(searchQuery)}&type=release&limit=5`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      console.warn(`⚠️ [Discogs] API returned ${response.status}`);
      return {
        source: 'Discogs',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: `API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    if (!data.success || !data.results || data.results.length === 0) {
      console.log(`ℹ️ [Discogs] No releases found`);
      return {
        source: 'Discogs',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: 'No matching music releases found'
      };
    }
    
    // Extract pricing from results (if available from release endpoint)
    const prices: number[] = [];
    const listings: any[] = [];
    
    data.results.forEach((release: any) => {
      // Discogs search doesn't include pricing, but the release endpoint does
      listings.push({
        title: release.title,
        price: release.lowestPrice || 0,
        condition: `${release.format || 'Unknown format'} | ${release.year || 'Unknown year'}`,
        url: release.url || `https://www.discogs.com/release/${release.id}`
      });
      
      if (release.lowestPrice) {
        prices.push(release.lowestPrice);
      }
    });
    
    console.log(`✅ [Discogs] ${data.totalResults} releases found`);
    
    // If we have pricing data
    if (prices.length > 0) {
      const sortedPrices = [...prices].sort((a: number, b: number) => a - b);
      const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
      
      return {
        source: 'Discogs',
        available: true,
        query: data.query || searchQuery,
        totalListings: data.totalResults || listings.length,
        priceAnalysis: {
          lowest: Math.min(...prices),
          highest: Math.max(...prices),
          average: prices.reduce((a: number, b: number) => a + b, 0) / prices.length,
          median: median
        },
        suggestedPrices: {
          goodDeal: Math.min(...prices) * 0.85,
          fairMarket: median,
          sellPrice: median * 1.15
        },
        sampleListings: listings.slice(0, 5),
        metadata: {
          dataSource: 'discogs_database',
          totalReleases: data.totalResults
        }
      };
    }
    
    // Return without pricing (metadata only)
    return {
      source: 'Discogs',
      available: true,
      query: data.query || searchQuery,
      totalListings: data.totalResults || listings.length,
      sampleListings: listings.slice(0, 5),
      metadata: {
        dataSource: 'discogs_database',
        totalReleases: data.totalResults,
        note: 'Search matched. Use release endpoint or eBay for detailed pricing.'
      }
    };
    
  } catch (error: any) {
    console.warn(`⚠️ [Discogs] Fetch failed: ${error.message}`);
    return {
      source: 'Discogs',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error.message
    };
  }
}

// Comic Vine Comics Data Fetcher
async function fetchComicVineData(itemName: string): Promise<MarketDataSource> {
  try {
    console.log(`📚 [Comic Vine] Fetching comic data for: ${itemName}`);
    
    const searchQuery = itemName
      .replace(/comic/gi, '')
      .replace(/book/gi, '')
      .replace(/[^\w\s#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
    
    const url = `${BASE_URL}/api/comicvine/search?q=${encodeURIComponent(searchQuery)}&type=issue&limit=5`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      console.warn(`⚠️ [Comic Vine] API returned ${response.status}`);
      return {
        source: 'Comic Vine',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: `API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    if (!data.success || !data.results || data.results.length === 0) {
      console.log(`ℹ️ [Comic Vine] No comics found`);
      return {
        source: 'Comic Vine',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: 'No matching comics found'
      };
    }
    
    // Comic Vine provides metadata, not pricing
    const listings = data.results.map((issue: any) => ({
      title: issue.name,
      price: 0,
      condition: `Issue #${issue.issueNumber || 'N/A'} | ${issue.coverDate || 'Unknown date'}`,
      url: issue.url || '#'
    }));
    
    console.log(`✅ [Comic Vine] ${data.totalResults} issues found`);
    
    return {
      source: 'Comic Vine',
      available: true,
      query: data.query || searchQuery,
      totalListings: data.totalResults || listings.length,
      sampleListings: listings.slice(0, 5),
      metadata: {
        dataSource: 'comic_vine_database',
        totalIssues: data.totalResults,
        topResult: data.results[0] ? {
          name: data.results[0].name,
          volumeName: data.results[0].volumeName,
          issueNumber: data.results[0].issueNumber,
          coverDate: data.results[0].coverDate
        } : null,
        note: 'Comic Vine provides comic metadata. Use eBay for market prices.'
      }
    };
    
  } catch (error: any) {
    console.warn(`⚠️ [Comic Vine] Fetch failed: ${error.message}`);
    return {
      source: 'Comic Vine',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error.message
    };
  }
}

// Retailed Sneaker Data Fetcher
async function fetchRetailedData(itemName: string): Promise<MarketDataSource> {
  try {
    console.log(`👟 [Retailed] Fetching sneaker data for: ${itemName}`);
    
    // Try to extract SKU if present (e.g., "DH6927-140")
    const skuMatch = itemName.match(/\b([A-Z]{1,2}\d{4,6}-\d{3})\b/i);
    
    let url: string;
    if (skuMatch) {
      url = `${BASE_URL}/api/retailed/prices?sku=${skuMatch[1]}`;
      console.log(`🔍 [Retailed] Searching by SKU: ${skuMatch[1]}`);
    } else {
      const searchQuery = itemName
        .replace(/sneaker/gi, '')
        .replace(/shoe/gi, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);
      url = `${BASE_URL}/api/retailed/search?q=${encodeURIComponent(searchQuery)}&limit=5`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      console.warn(`⚠️ [Retailed] API returned ${response.status}`);
      return {
        source: 'Retailed',
        available: false,
        query: itemName,
        totalListings: 0,
        error: `API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    // Handle price endpoint response
    if (data.found && data.priceStats) {
      console.log(`✅ [Retailed] Found pricing: $${data.priceStats.lowestAsk} - $${data.priceStats.highestAsk}`);
      
      return {
        source: 'Retailed',
        available: true,
        query: data.query || itemName,
        totalListings: data.priceStats.marketplaceCount || 0,
        priceAnalysis: {
          lowest: data.priceStats.lowestAsk,
          highest: data.priceStats.highestAsk,
          average: data.priceStats.averageAsk,
          median: data.priceStats.averageAsk // Use average as median approximation
        },
        suggestedPrices: {
          goodDeal: data.priceStats.lowestAsk * 0.9,
          fairMarket: data.priceStats.averageAsk,
          sellPrice: data.priceStats.averageAsk * 1.1
        },
        sampleListings: data.prices?.slice(0, 5).map((p: any) => ({
          title: data.product?.title || itemName,
          price: p.lowestAsk,
          condition: `${p.marketplace} (${p.country})`,
          url: p.url
        })),
        metadata: {
          dataSource: 'retailed_sneaker_db',
          product: data.product,
          marketplaces: data.prices?.map((p: any) => p.marketplace)
        }
      };
    }
    
    // Handle search endpoint response
    if (data.success && data.results && data.results.length > 0) {
      const listings = data.results.map((item: any) => ({
        title: item.name,
        price: item.retailPrice || 0,
        condition: `SKU: ${item.sku} | Released: ${item.releaseDate || 'Unknown'}`,
        url: `https://stockx.com/search?s=${encodeURIComponent(item.sku || item.name)}`
      }));
      
      console.log(`✅ [Retailed] ${data.totalResults} sneakers found`);
      
      return {
        source: 'Retailed',
        available: true,
        query: data.query || itemName,
        totalListings: data.totalResults || listings.length,
        sampleListings: listings.slice(0, 5),
        metadata: {
          dataSource: 'retailed_sneaker_db',
          totalProducts: data.totalResults,
          note: 'Use SKU search for detailed pricing from StockX/GOAT'
        }
      };
    }
    
    console.log(`ℹ️ [Retailed] No sneakers found`);
    return {
      source: 'Retailed',
      available: false,
      query: itemName,
      totalListings: 0,
      error: 'No matching sneakers found'
    };
    
  } catch (error: any) {
    console.warn(`⚠️ [Retailed] Fetch failed: ${error.message}`);
    return {
      source: 'Retailed',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error.message
    };
  }
}

// ==================== v5.0 MARKET DATA ORCHESTRATOR ====================

interface MarketDataResult {
  sources: MarketDataSource[];
  primarySource: string;
  blendedPrice: number;
  blendMethod: string;
  marketInfluence: string;
  apisUsed: string[];
}

async function fetchAllMarketData(
  itemName: string, 
  category: string,  // v5.0: Accept any string, normalize internally
  aiEstimate: number,
  aiConfidence: number
): Promise<MarketDataResult> {
  
  console.log(`\n📊 === MARKET DATA INTEGRATION ===`);
  console.log(`🏷️ Category: ${category}`);
  console.log(`🔎 Item: ${itemName}`);
  
  const sources: MarketDataSource[] = [];
  const apiCalls: Promise<MarketDataSource>[] = [];
  
  // v5.0: Get APIs for this category using smart routing
  const apisToCall = getApisForCategory(category);
  console.log(`📡 APIs to call: ${apisToCall.join(', ')}`);
  
  // Build API calls based on category routing
  for (const api of apisToCall) {
    switch (api) {
      case 'ebay':
        apiCalls.push(fetchEbayMarketData(itemName));
        break;
      case 'numista':
        apiCalls.push(fetchNumistaData(itemName));
        break;
      case 'brickset':
        apiCalls.push(fetchBricksetData(itemName));
        break;
      case 'google_books':
        apiCalls.push(fetchGoogleBooksData(itemName));
        break;
      case 'pokemon_tcg':
        apiCalls.push(fetchPokemonTCGData(itemName));
        break;
      case 'rawg':
        apiCalls.push(fetchRAWGData(itemName));
        break;
      case 'discogs':
        apiCalls.push(fetchDiscogsData(itemName));
        break;
      case 'comicvine':
        apiCalls.push(fetchComicVineData(itemName));
        break;
      case 'retailed':
        apiCalls.push(fetchRetailedData(itemName));
        break;
    }
  }
  
  // Execute all API calls in parallel
  const results = await Promise.all(apiCalls);
  sources.push(...results);
  
  // Determine primary source and blend prices
  const availableSources = sources.filter(s => s.available && s.priceAnalysis);
  
  if (availableSources.length === 0) {
    // Check if we have metadata-only sources (like RAWG, Comic Vine)
    const metadataSources = sources.filter(s => s.available && !s.priceAnalysis);
    if (metadataSources.length > 0) {
      console.log(`ℹ️ Found metadata from ${metadataSources.map(s => s.source).join(', ')} but no pricing. Using AI estimate.`);
    } else {
      console.log(`⚠️ No market data available, using AI estimate only`);
    }
    return {
      sources,
      primarySource: 'AI Consensus',
      blendedPrice: aiEstimate,
      blendMethod: 'ai_only',
      marketInfluence: 'none - no market data available',
      apisUsed: apisToCall
    };
  }
  
  // Calculate blended price from all available sources
  let totalWeight = 0;
  let weightedSum = 0;
  const influences: string[] = [];
  
  // AI estimate baseline (weight based on confidence)
  const aiWeight = aiConfidence / 100 * 0.4; // Max 40% for AI
  weightedSum += aiEstimate * aiWeight;
  totalWeight += aiWeight;
  influences.push(`AI: $${aiEstimate.toFixed(2)} (${Math.round(aiWeight * 100)}%)`);
  
  // Add market sources with weights based on data quality
  availableSources.forEach(source => {
    if (!source.priceAnalysis) return;
    
    let sourceWeight = 0;
    const median = source.priceAnalysis.median;
    
    // Weight based on listing count and source reliability
    switch (source.source) {
      case 'eBay':
        // eBay: Weight heavily for high listing counts
        sourceWeight = Math.min(source.totalListings / 100, 0.35);
        break;
      case 'Numista':
        // Numista: Catalogue data is reliable but may not reflect market
        sourceWeight = Math.min(source.totalListings / 20, 0.25);
        break;
      case 'Brickset':
        // Brickset: Good for retail/estimated values
        sourceWeight = Math.min(source.totalListings / 10, 0.25);
        break;
      case 'Google Books':
        // Google Books: Good for ISBN lookups and condition pricing
        sourceWeight = Math.min(source.totalListings / 5, 0.30);
        break;
      case 'Pokemon TCG':
        // Pokemon TCG: Official TCGPlayer/Cardmarket pricing
        sourceWeight = Math.min(source.totalListings / 50, 0.35);
        break;
      case 'Discogs':
        // Discogs: Good for vinyl/music pricing
        sourceWeight = Math.min(source.totalListings / 30, 0.30);
        break;
      case 'Retailed':
        // Retailed: StockX/GOAT pricing for sneakers
        sourceWeight = Math.min(source.totalListings / 5, 0.40);
        break;
      default:
        sourceWeight = 0.1;
    }
    
    if (sourceWeight > 0.05) { // Only include if weight is meaningful
      weightedSum += median * sourceWeight;
      totalWeight += sourceWeight;
      influences.push(`${source.source}: $${median.toFixed(2)} (${Math.round(sourceWeight * 100)}%)`);
    }
  });
  
  const blendedPrice = Math.round((weightedSum / totalWeight) * 100) / 100;
  
  // Determine primary source (highest weighted market source)
  const primarySource = availableSources.reduce((best, current) => {
    const currentListings = current.totalListings || 0;
    const bestListings = best?.totalListings || 0;
    return currentListings > bestListings ? current : best;
  }, availableSources[0])?.source || 'AI Consensus';
  
  const marketInfluence = influences.join(' + ');
  
  console.log(`💰 Blended price: $${blendedPrice} from ${availableSources.length} market sources`);
  console.log(`📈 Blend breakdown: ${marketInfluence}`);
  
  return {
    sources,
    primarySource,
    blendedPrice,
    blendMethod: availableSources.length > 1 ? 'multi_source_weighted' : 'single_source_blend',
    marketInfluence,
    apisUsed: apisToCall
  };
}

// ==================== AUTH VERIFICATION ====================

async function verifyUser(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Authentication required');
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Authentication failed');
  }

  return user;
}

// ==================== v5.0 MAIN ANALYSIS FUNCTION ====================

async function performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
  // v5.0: ENHANCED PROMPT WITH CATEGORY DETECTION
  // AI models now vote on category as part of their analysis
  const jsonPrompt = `You are a professional appraiser analyzing an item for resale value. Focus ONLY on what you can actually observe about the PHYSICAL ITEM.

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY a valid JSON object - no other text, no markdown, no explanations
2. The JSON must have EXACTLY this structure:
{
  "itemName": "specific item name based on what you see",
  "category": "detected_category",
  "estimatedValue": 25.99,
  "decision": "BUY",
  "valuation_factors": ["Physical condition: excellent/good/fair/poor", "Material quality: leather/fabric/metal/etc", "Brand recognition: visible/none", "Market demand: high/medium/low", "Resale potential: strong/weak"],
  "summary_reasoning": "Brief explanation of why this specific item is worth the estimated value",
  "confidence": 0.85
}

CATEGORY DETECTION - Choose the MOST SPECIFIC category that matches:
- "pokemon_cards" - Pokemon trading cards (Pikachu, Charizard, etc.)
- "trading_cards" - Other TCG cards (MTG, Yu-Gi-Oh, sports cards)
- "coins" - Coins, currency, banknotes
- "lego" - LEGO sets and minifigures
- "video_games" - Video games and consoles
- "vinyl_records" - Vinyl records, LPs, music
- "comics" - Comic books, manga, graphic novels
- "books" - Books (non-comic)
- "sneakers" - Sneakers, shoes, streetwear
- "watches" - Watches and timepieces
- "jewelry" - Jewelry and gemstones
- "toys" - Toys and action figures
- "art" - Art and paintings
- "antiques" - Antiques and vintage items
- "electronics" - Electronics and gadgets
- "general" - Only if nothing else fits

FORBIDDEN - NEVER mention these in valuation_factors:
❌ "AI analysis" ❌ "Professional analysis" ❌ "Machine learning" ❌ "Image recognition" 
❌ "Advanced algorithms" ❌ "Technical assessment" ❌ "AI-powered evaluation"

REQUIRED - valuation_factors must ONLY describe the PHYSICAL ITEM:
✅ "Excellent physical condition" ✅ "High-quality leather construction" ✅ "Recognizable brand logo"
✅ "Strong market demand for this type" ✅ "Good resale potential" ✅ "Minimal wear visible"

IMPORTANT RULES:
- ONLY identify brands you can CLEARLY see and verify from logos, tags, or distinctive features
- DO NOT guess or assume luxury brands unless you see clear authentic markings
- If you cannot clearly identify the brand, use generic descriptions
- Be specific about what you observe
- estimatedValue must be a realistic number based on what you can actually see
- decision must be exactly "BUY" or "SELL" (uppercase)
- confidence must be between 0 and 1
- Include exactly 5 valuation_factors focused on observable product features

Analyze this item for resale potential based on physical characteristics only:`;
  
  let imageData = '';
  
  if (request.scanType === 'multi-modal' && request.items?.length) {
    imageData = request.items[0].data;
  } else if (request.data) {
    imageData = request.data;
  }
  
  // Initialize Hydra Engine
  console.log('🚀 Initializing Hydra Consensus Engine v5.0...');
  const { HydraEngine } = await import('../src/lib/hydra-engine.js');
  const hydra = new HydraEngine();
  await hydra.initialize();
  
  // Run multi-AI consensus analysis
  const consensus = await hydra.analyzeWithAuthority([imageData], jsonPrompt, request.category_id);
  
  console.log(`✅ Hydra consensus complete: ${consensus.votes.length} AI models voted`);
  
  // v5.0: Extract AI category votes from responses
  const categoryVotes: Map<string, number> = new Map();
  consensus.votes.forEach(vote => {
    if (vote.success && vote.rawResponse?.category) {
      const cat = normalizeCategory(vote.rawResponse.category);
      const currentWeight = categoryVotes.get(cat) || 0;
      categoryVotes.set(cat, currentWeight + vote.weight);
    }
  });
  
  // Find winning category from AI votes
  let aiDetectedCategory: string | undefined;
  let maxCategoryWeight = 0;
  categoryVotes.forEach((weight, cat) => {
    if (weight > maxCategoryWeight && cat !== 'general') {
      maxCategoryWeight = weight;
      aiDetectedCategory = cat;
    }
  });
  
  if (aiDetectedCategory) {
    console.log(`🤖 AI category votes: ${Array.from(categoryVotes.entries()).map(([c, w]) => `${c}:${w.toFixed(2)}`).join(', ')}`);
    console.log(`🏆 Winning AI category: ${aiDetectedCategory} (weight: ${maxCategoryWeight.toFixed(2)})`);
  }
  
  // v5.0: Enhanced category detection with AI votes
  const categoryDetection = detectItemCategory(
    consensus.consensus.itemName, 
    request.category_id,
    aiDetectedCategory  // v5.0: Pass AI detected category
  );
  
  console.log(`\n🏷️ === CATEGORY DETECTION ===`);
  console.log(`📝 Requested: ${request.category_id}`);
  console.log(`🤖 AI Detected: ${aiDetectedCategory || 'none'}`);
  console.log(`🔍 Keyword Detected: ${categoryDetection.category}`);
  console.log(`✅ Final Category: ${categoryDetection.category} (source: ${categoryDetection.source})`);
  
  // ===== MULTI-API MARKET DATA INTEGRATION =====
  const marketData = await fetchAllMarketData(
    consensus.consensus.itemName,
    categoryDetection.category,  // v5.0: Use DETECTED category, not requested
    consensus.consensus.estimatedValue,
    consensus.consensus.confidence
  );
  
  // Build valuation factors from votes
  const factorCounts = new Map<string, number>();
  consensus.votes.forEach(vote => {
    if (vote.rawResponse?.valuation_factors) {
      vote.rawResponse.valuation_factors.forEach((factor: string) => {
        factorCounts.set(factor, (factorCounts.get(factor) || 0) + vote.weight);
      });
    }
  });
  
  const topFactors = Array.from(factorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);
  
  // Get best summary reasoning
  const bestVote = consensus.votes.reduce((best, vote) => 
    vote.weight > best.weight ? vote : best, consensus.votes[0]);
  
  let summaryReasoning = bestVote?.rawResponse?.summary_reasoning || 
    `Consensus reached by ${consensus.consensus.totalVotes} AI models.`;
  
  // Enhance summary with market data context
  const availableMarketSources = marketData.sources.filter(s => s.available);
  if (availableMarketSources.length > 0) {
    const sourceNames = availableMarketSources.map(s => s.source).join(', ');
    const primaryData = availableMarketSources.find(s => s.priceAnalysis) || availableMarketSources[0];
    summaryReasoning += ` Market validation from ${sourceNames}: `;
    
    if (primaryData.priceAnalysis) {
      summaryReasoning += `${primaryData.totalListings} listings found with median price $${primaryData.priceAnalysis.median.toFixed(2)}.`;
    } else if (primaryData.metadata?.note) {
      summaryReasoning += primaryData.metadata.note;
    }
  }
  
  // Build enhanced source tracking
  const respondedAIs = consensus.votes
    .filter(vote => vote.success)
    .map(vote => vote.providerName);
  
  const aiWeights: Record<string, number> = {};
  consensus.votes.forEach(vote => {
    if (vote.success && vote.providerName) {
      aiWeights[vote.providerName] = vote.weight;
    }
  });
  
  // Build API sources from market data
  const apiSources = {
    responded: marketData.sources.filter(s => s.available).map(s => s.source),
    data: marketData.sources.reduce((acc, source) => {
      if (source.available) {
        acc[source.source] = {
          confidence: source.priceAnalysis ? (source.totalListings >= 10 ? 0.9 : 0.7) : 0.5,
          dataPoints: source.totalListings
        };
      }
      return acc;
    }, {} as Record<string, { confidence: number; dataPoints: number }>)
  };
  
  // Build market comps from all sources
  const marketComps: any[] = [];
  marketData.sources.forEach(source => {
    if (source.sampleListings) {
      source.sampleListings.forEach(listing => {
        marketComps.push({
          source: source.source,
          title: listing.title,
          price: listing.price,
          condition: listing.condition,
          url: listing.url
        });
      });
    }
  });
  
  const totalSources = respondedAIs.length + apiSources.responded.length;
  
  // v5.0: Build final result with DETECTED category
  const fullResult: AnalysisResult = {
    id: consensus.analysisId,
    itemName: consensus.consensus.itemName,
    estimatedValue: marketData.blendedPrice, // Use multi-source blended price
    decision: consensus.consensus.decision,
    confidenceScore: consensus.consensus.confidence,
    summary_reasoning: summaryReasoning,
    valuation_factors: topFactors,
    analysis_quality: consensus.consensus.analysisQuality,
    capturedAt: new Date().toISOString(),
    category: categoryDetection.category,     // v5.0: DETECTED category (THE FIX!)
    requestedCategory: request.category_id,   // v5.0: Original request for reference
    subCategory: request.subcategory_id,
    imageUrl: imageData,
    marketComps: marketComps.slice(0, 10), // Top 10 comps
    resale_toolkit: {
      listInArena: true,
      sellOnProPlatforms: true,
      linkToMyStore: false,
      shareToSocial: true
    },
    tags: [
      categoryDetection.category,  // v5.0: Use detected category in tags
      ...(request.category_id !== categoryDetection.category ? [request.category_id] : []),
      ...categoryDetection.keywords.slice(0, 3)
    ],
    hydraConsensus: {
      ...consensus,
      totalSources,
      aiModels: {
        responded: respondedAIs,
        weights: aiWeights
      },
      apiSources,
      consensusMethod: marketData.blendMethod,
      finalConfidence: consensus.consensus.confidence / 100
    },
    authorityData: consensus.authorityData,
    marketData: {
      sources: marketData.sources,
      primarySource: marketData.primarySource,
      blendMethod: marketData.blendMethod
    }
  };
  
  // Add debug info if needed
  if (consensus.consensus.analysisQuality === 'FALLBACK') {
    fullResult.debug_info = {
      reason: 'Multi-AI consensus degraded',
      details: `Only ${consensus.votes.length} AI model(s) responded. Check API keys and rate limits.`
    };
  }
  
  // Final logging
  console.log(`\n✅ === ANALYSIS COMPLETE ===`);
  console.log(`📦 Item: ${consensus.consensus.itemName}`);
  console.log(`🏷️ Detected Category: ${categoryDetection.category} (source: ${categoryDetection.source})`);
  console.log(`📝 Requested Category: ${request.category_id}`);
  console.log(`💵 AI Estimate: $${consensus.consensus.estimatedValue}`);
  console.log(`💰 Final Value: $${marketData.blendedPrice}`);
  console.log(`📊 Sources: ${totalSources} (${respondedAIs.length} AI + ${apiSources.responded.length} Market APIs)`);
  console.log(`📡 APIs Used: ${marketData.apisUsed.join(', ')}`);
  console.log(`📈 Blend: ${marketData.marketInfluence}\n`);
  
  return fullResult;
}

// ==================== API HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyUser(req);
    
    const body = req.body as AnalysisRequest;
    
    // Validation
    if (body.scanType === 'multi-modal') {
      if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return res.status(400).json({ error: 'Multi-modal analysis requires items array.' });
      }
    } else {
      if (!body.scanType || !body.data || !body.category_id) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
    }
    
    if (!body.category_id) {
      return res.status(400).json({ error: 'category_id is required.' });
    }

    const analysisResult = await performAnalysis(body);
    return res.status(200).json(analysisResult);
    
  } catch (error: any) {
    const message = error.message || 'An unknown error occurred.';
    console.error('Analysis handler error:', error);
    
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    
    return res.status(500).json({ 
      error: 'Analysis failed', 
      details: message 
    });
  }
}