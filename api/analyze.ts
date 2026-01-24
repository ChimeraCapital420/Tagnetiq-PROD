// FORCE REDEPLOY v3.1 - Multi-API Market Data Integration (eBay + Numista + Brickset + Google Books)
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
  category: string;
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

// ==================== CATEGORY DETECTION ====================

type ItemCategory = 'coins' | 'lego' | 'trading_cards' | 'books' | 'general';

interface CategoryDetection {
  category: ItemCategory;
  confidence: number;
  keywords: string[];
}

function detectItemCategory(itemName: string, categoryId?: string): CategoryDetection {
  const nameLower = itemName.toLowerCase();
  
  // Coin/Currency detection
  const coinKeywords = [
    'coin', 'penny', 'nickel', 'dime', 'quarter', 'dollar', 'cent',
    'morgan', 'liberty', 'eagle', 'buffalo', 'wheat', 'mercury',
    'numismatic', 'mint', 'uncirculated', 'proof', 'silver dollar',
    'gold coin', 'half dollar', 'commemorative', 'bullion',
    'currency', 'banknote', 'note', 'bill'
  ];
  
  // LEGO detection
  const legoKeywords = [
    'lego', 'legos', 'brick', 'minifig', 'minifigure',
    'star wars lego', 'technic', 'creator', 'ninjago',
    'city lego', 'friends lego', 'duplo', 'bionicle',
    'millennium falcon', 'death star', 'hogwarts'
  ];
  
  // Trading card detection
  const cardKeywords = [
    'pokemon', 'charizard', 'pikachu', 'magic the gathering', 'mtg',
    'yu-gi-oh', 'yugioh', 'trading card', 'tcg', 'holographic',
    'first edition', 'psa', 'graded card', 'booster', 'pack'
  ];
  
  // Book detection
  const bookKeywords = [
    'book', 'novel', 'hardcover', 'paperback', 'first edition book',
    'signed copy', 'isbn', 'author', 'rare book', 'antique book'
  ];
  
  // Check category_id hint
  if (categoryId) {
    const catLower = categoryId.toLowerCase();
    if (catLower.includes('coin') || catLower.includes('currency')) {
      return { category: 'coins', confidence: 0.9, keywords: ['category_hint'] };
    }
    if (catLower.includes('lego') || catLower.includes('toy')) {
      return { category: 'lego', confidence: 0.9, keywords: ['category_hint'] };
    }
    if (catLower.includes('card') || catLower.includes('trading')) {
      return { category: 'trading_cards', confidence: 0.9, keywords: ['category_hint'] };
    }
    if (catLower.includes('book') || catLower.includes('media')) {
      return { category: 'books', confidence: 0.9, keywords: ['category_hint'] };
    }
  }
  
  // Score each category
  const scores: Record<ItemCategory, { score: number; matches: string[] }> = {
    coins: { score: 0, matches: [] },
    lego: { score: 0, matches: [] },
    trading_cards: { score: 0, matches: [] },
    books: { score: 0, matches: [] },
    general: { score: 0.1, matches: [] } // Default baseline
  };
  
  coinKeywords.forEach(kw => {
    if (nameLower.includes(kw)) {
      scores.coins.score += kw.split(' ').length; // Multi-word matches score higher
      scores.coins.matches.push(kw);
    }
  });
  
  legoKeywords.forEach(kw => {
    if (nameLower.includes(kw)) {
      scores.lego.score += kw.split(' ').length;
      scores.lego.matches.push(kw);
    }
  });
  
  cardKeywords.forEach(kw => {
    if (nameLower.includes(kw)) {
      scores.trading_cards.score += kw.split(' ').length;
      scores.trading_cards.matches.push(kw);
    }
  });
  
  bookKeywords.forEach(kw => {
    if (nameLower.includes(kw)) {
      scores.books.score += kw.split(' ').length;
      scores.books.matches.push(kw);
    }
  });
  
  // Find highest scoring category
  let bestCategory: ItemCategory = 'general';
  let bestScore = 0;
  let bestMatches: string[] = [];
  
  (Object.entries(scores) as [ItemCategory, { score: number; matches: string[] }][]).forEach(([cat, data]) => {
    if (data.score > bestScore) {
      bestScore = data.score;
      bestCategory = cat;
      bestMatches = data.matches;
    }
  });
  
  // Calculate confidence based on score
  const confidence = Math.min(0.5 + (bestScore * 0.1), 0.95);
  
  console.log(`🏷️ Category detected: ${bestCategory} (confidence: ${Math.round(confidence * 100)}%, keywords: ${bestMatches.join(', ') || 'none'})`);
  
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

// ==================== MARKET DATA ORCHESTRATOR ====================

interface MarketDataResult {
  sources: MarketDataSource[];
  primarySource: string;
  blendedPrice: number;
  blendMethod: string;
  marketInfluence: string;
}

async function fetchAllMarketData(
  itemName: string, 
  category: ItemCategory,
  aiEstimate: number,
  aiConfidence: number
): Promise<MarketDataResult> {
  
  console.log(`\n📊 Fetching market data for category: ${category}`);
  
  const sources: MarketDataSource[] = [];
  const apiCalls: Promise<MarketDataSource>[] = [];
  
  // Always fetch eBay (universal marketplace)
  apiCalls.push(fetchEbayMarketData(itemName));
  
  // Add category-specific APIs
  switch (category) {
    case 'coins':
      apiCalls.push(fetchNumistaData(itemName));
      break;
    case 'lego':
      apiCalls.push(fetchBricksetData(itemName));
      break;
    case 'trading_cards':
      // Future: Add TCGPlayer here
      break;
    case 'books':
      apiCalls.push(fetchGoogleBooksData(itemName));
      break;
  }
  
  // Execute all API calls in parallel
  const results = await Promise.all(apiCalls);
  sources.push(...results);
  
  // Determine primary source and blend prices
  const availableSources = sources.filter(s => s.available && s.priceAnalysis);
  
  if (availableSources.length === 0) {
    console.log(`⚠️ No market data available, using AI estimate only`);
    return {
      sources,
      primarySource: 'AI Consensus',
      blendedPrice: aiEstimate,
      blendMethod: 'ai_only',
      marketInfluence: 'none - no market data available'
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
  influences.push(`AI: $${aiEstimate} (${Math.round(aiWeight * 100)}%)`);
  
  // Add market sources with weights based on data quality
  availableSources.forEach(source => {
    if (!source.priceAnalysis) return;
    
    let sourceWeight = 0;
    const median = source.priceAnalysis.median;
    
    // Weight based on listing count and source reliability
    if (source.source === 'eBay') {
      // eBay: Weight heavily for high listing counts
      sourceWeight = Math.min(source.totalListings / 100, 0.35);
    } else if (source.source === 'Numista') {
      // Numista: Catalogue data is reliable but may not reflect market
      sourceWeight = Math.min(source.totalListings / 20, 0.25);
    } else if (source.source === 'Brickset') {
      // Brickset: Good for retail/estimated values
      sourceWeight = Math.min(source.totalListings / 10, 0.25);
    } else if (source.source === 'Google Books') {
      // Google Books: Good for ISBN lookups and condition pricing
      sourceWeight = Math.min(source.totalListings / 5, 0.30);
    }
    
    if (sourceWeight > 0.05) { // Only include if weight is meaningful
      weightedSum += median * sourceWeight;
      totalWeight += sourceWeight;
      influences.push(`${source.source}: $${median} (${Math.round(sourceWeight * 100)}%)`);
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
    marketInfluence
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

// ==================== MAIN ANALYSIS FUNCTION ====================

async function performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
  // ENHANCED ANTI-BRAGGING PROMPT
  const jsonPrompt = `You are a professional appraiser analyzing an item for resale value. Focus ONLY on what you can actually observe about the PHYSICAL ITEM.

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY a valid JSON object - no other text, no markdown, no explanations
2. The JSON must have EXACTLY this structure:
{
  "itemName": "specific item name based on what you see",
  "estimatedValue": 25.99,
  "decision": "BUY",
  "valuation_factors": ["Physical condition: excellent/good/fair/poor", "Material quality: leather/fabric/metal/etc", "Brand recognition: visible/none", "Market demand: high/medium/low", "Resale potential: strong/weak"],
  "summary_reasoning": "Brief explanation of why this specific item is worth the estimated value",
  "confidence": 0.85
}

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
  console.log('🚀 Initializing Hydra Consensus Engine...');
  const { HydraEngine } = await import('../src/lib/hydra-engine.js');
  const hydra = new HydraEngine();
  await hydra.initialize();
  
  // Run multi-AI consensus analysis
  const consensus = await hydra.analyzeWithAuthority([imageData], jsonPrompt, request.category_id);
  
  console.log(`✅ Hydra consensus complete: ${consensus.votes.length} AI models voted`);
  
  // Detect item category
  const categoryDetection = detectItemCategory(
    consensus.consensus.itemName, 
    request.category_id
  );
  
  // ===== MULTI-API MARKET DATA INTEGRATION =====
  console.log('\n🌐 === MARKET DATA INTEGRATION ===');
  
  const marketData = await fetchAllMarketData(
    consensus.consensus.itemName,
    categoryDetection.category,
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
    const primaryData = availableMarketSources[0];
    summaryReasoning += ` Market validation from ${sourceNames}: `;
    
    if (primaryData.priceAnalysis) {
      summaryReasoning += `${primaryData.totalListings} listings found with median price $${primaryData.priceAnalysis.median}.`;
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
          confidence: source.totalListings >= 10 ? 0.9 : 0.7,
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
  
  // Build final result
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
    category: request.category_id,
    subCategory: request.subcategory_id,
    imageUrl: imageData,
    marketComps: marketComps.slice(0, 10), // Top 10 comps
    resale_toolkit: {
      listInArena: true,
      sellOnProPlatforms: true,
      linkToMyStore: false,
      shareToSocial: true
    },
    tags: [request.category_id, categoryDetection.category],
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
      details: `Only ${consensus.votes.length} AI model(s) responded. Check API keys.`
    };
  }
  
  // Final logging
  console.log(`\n✅ === ANALYSIS COMPLETE ===`);
  console.log(`📦 Item: ${consensus.consensus.itemName}`);
  console.log(`🏷️ Category: ${categoryDetection.category}`);
  console.log(`💵 AI Estimate: $${consensus.consensus.estimatedValue}`);
  console.log(`💰 Final Value: $${marketData.blendedPrice}`);
  console.log(`📊 Sources: ${totalSources} (${respondedAIs.length} AI + ${apiSources.responded.length} Market APIs)`);
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