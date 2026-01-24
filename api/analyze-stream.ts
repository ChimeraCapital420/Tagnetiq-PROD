// HYDRA v5.0 STREAMING - Real-time Analysis Updates via Server-Sent Events
// Separate file for streaming - easier to debug/update independently
// Usage: POST /api/analyze-stream with Accept: text/event-stream header

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BASE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://tagnetiq-prod.vercel.app';

// ==================== TYPES ====================

interface StreamEvent {
  type: 'init' | 'phase' | 'ai_start' | 'ai_complete' | 'ai_error' | 
        'category' | 'price' | 'api_start' | 'api_complete' | 'consensus' | 
        'complete' | 'error';
  timestamp: number;
  data: any;
}

interface AIModel {
  name: string;
  icon: string;
  color: string;
  weight: number;
}

// AI Models with their display info
const AI_MODELS: AIModel[] = [
  { name: 'Perplexity', icon: '🔮', color: '#20B2AA', weight: 1.72 },
  { name: 'OpenAI', icon: '🧠', color: '#10A37F', weight: 1.57 },
  { name: 'Anthropic', icon: '🎭', color: '#D4A574', weight: 1.13 },
  { name: 'Google', icon: '🔷', color: '#4285F4', weight: 1.06 },
  { name: 'Mistral', icon: '🌀', color: '#FF7000', weight: 0.94 },
  { name: 'Groq', icon: '⚡', color: '#F55036', weight: 0.90 },
  { name: 'xAI', icon: '✖️', color: '#1DA1F2', weight: 0.90 },
];

// Category to API mapping (mirrors analyze.ts)
const CATEGORY_API_MAP: Record<string, string[]> = {
  'pokemon_cards': ['Pokemon TCG', 'eBay'],
  'trading_cards': ['Pokemon TCG', 'eBay'],
  'coins': ['Numista', 'eBay'],
  'lego': ['Brickset', 'eBay'],
  'video_games': ['RAWG', 'eBay'],
  'vinyl_records': ['Discogs', 'eBay'],
  'comics': ['Comic Vine', 'eBay'],
  'books': ['Google Books', 'eBay'],
  'sneakers': ['Retailed', 'eBay'],
  'general': ['eBay'],
};

// ==================== SSE HELPERS ====================

function sendSSE(res: VercelResponse, event: StreamEvent) {
  const data = JSON.stringify(event);
  res.write(`data: ${data}\n\n`);
}

function sendInit(res: VercelResponse) {
  sendSSE(res, {
    type: 'init',
    timestamp: Date.now(),
    data: {
      message: 'Initializing Hydra Consensus Engine v5.0...',
      models: AI_MODELS.map(m => ({
        name: m.name,
        icon: m.icon,
        color: m.color,
        weight: m.weight,
        status: 'pending'
      })),
      totalModels: AI_MODELS.length
    }
  });
}

// ==================== STREAMING ANALYSIS ====================

async function performStreamingAnalysis(
  request: any,
  res: VercelResponse
): Promise<void> {
  const startTime = Date.now();
  
  // Send initialization
  sendInit(res);
  
  // Extract image data
  let imageData = '';
  if (request.scanType === 'multi-modal' && request.items?.length) {
    imageData = request.items[0].data;
  } else if (request.data) {
    imageData = request.data;
  }
  
  const categoryHint = request.category_id || 'general';
  
  // Phase 1: AI Analysis
  sendSSE(res, {
    type: 'phase',
    timestamp: Date.now(),
    data: { phase: 'ai', message: 'Running AI consensus analysis...' }
  });
  
  // Import and initialize Hydra
  const { HydraEngine } = await import('../src/lib/hydra-engine.js');
  const hydra = new HydraEngine();
  await hydra.initialize();
  
  // Build prompt (same as main analyze.ts)
  const jsonPrompt = `You are a professional appraiser analyzing an item for resale value.

RESPOND WITH ONLY VALID JSON:
{
  "itemName": "specific item name",
  "category": "detected_category",
  "estimatedValue": 25.99,
  "decision": "BUY",
  "valuation_factors": ["factor1", "factor2", "factor3", "factor4", "factor5"],
  "summary_reasoning": "Brief explanation",
  "confidence": 0.85
}

CATEGORY OPTIONS: pokemon_cards, trading_cards, coins, lego, video_games, vinyl_records, comics, books, sneakers, watches, jewelry, toys, art, antiques, electronics, general`;

  // Stagger AI start notifications (visual effect)
  AI_MODELS.forEach((model, index) => {
    setTimeout(() => {
      sendSSE(res, {
        type: 'ai_start',
        timestamp: Date.now(),
        data: {
          model: model.name,
          icon: model.icon,
          color: model.color,
          index
        }
      });
    }, index * 150);
  });
  
  // Run analysis
  const consensus = await hydra.analyzeWithAuthority([imageData], jsonPrompt, categoryHint);
  
  // Stream the votes that came back (simulating real-time)
  let runningEstimate = 0;
  let totalWeight = 0;
  
  if (consensus.votes && consensus.votes.length > 0) {
    for (let i = 0; i < consensus.votes.length; i++) {
      const vote = consensus.votes[i];
      const modelInfo = AI_MODELS[i % AI_MODELS.length];
      
      // Small delay for visual effect
      await new Promise(resolve => setTimeout(resolve, 80));
      
      sendSSE(res, {
        type: 'ai_complete',
        timestamp: Date.now(),
        data: {
          model: vote.providerName || modelInfo.name,
          icon: modelInfo.icon,
          color: modelInfo.color,
          success: vote.success,
          responseTime: vote.responseTime || Math.floor(Math.random() * 1500) + 500,
          weight: vote.weight,
          estimate: vote.rawResponse?.estimatedValue,
          category: vote.rawResponse?.category,
          decision: vote.rawResponse?.decision
        }
      });
      
      // Update running estimate
      if (vote.success && vote.rawResponse?.estimatedValue) {
        totalWeight += vote.weight;
        runningEstimate = (runningEstimate * (totalWeight - vote.weight) + 
                         vote.rawResponse.estimatedValue * vote.weight) / totalWeight;
        
        sendSSE(res, {
          type: 'price',
          timestamp: Date.now(),
          data: {
            estimate: Math.round(runningEstimate * 100) / 100,
            votesIn: i + 1,
            totalVotes: consensus.votes.length,
            confidence: (i + 1) / consensus.votes.length
          }
        });
      }
    }
  }
  
  // Detect category from consensus
  const detectedCategory = detectCategory(consensus, categoryHint);
  sendSSE(res, {
    type: 'category',
    timestamp: Date.now(),
    data: {
      category: detectedCategory,
      displayName: detectedCategory.replace(/_/g, ' '),
      confidence: 0.85,
      source: 'ai_consensus'
    }
  });
  
  // Phase 2: Market Data
  const apisForCategory = CATEGORY_API_MAP[detectedCategory] || CATEGORY_API_MAP['general'];
  
  sendSSE(res, {
    type: 'phase',
    timestamp: Date.now(),
    data: { 
      phase: 'market', 
      message: `Fetching market data from ${apisForCategory.join(', ')}...`,
      apis: apisForCategory
    }
  });
  
  // Fetch market data with streaming updates
  const marketData = await fetchMarketDataWithStreaming(
    res,
    consensus.consensus.itemName,
    detectedCategory,
    consensus.consensus.estimatedValue,
    consensus.consensus.confidence
  );
  
  // Final price with market blend
  sendSSE(res, {
    type: 'price',
    timestamp: Date.now(),
    data: {
      estimate: marketData.blendedPrice,
      votesIn: consensus.votes?.length || AI_MODELS.length,
      totalVotes: consensus.votes?.length || AI_MODELS.length,
      confidence: 1,
      source: 'market_blended',
      marketInfluence: marketData.marketInfluence
    }
  });
  
  // Phase 3: Finalizing
  sendSSE(res, {
    type: 'phase',
    timestamp: Date.now(),
    data: { phase: 'finalizing', message: 'Building final analysis...' }
  });
  
  // Small delay for dramatic effect
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Build final result (matching analyze.ts output format)
  const finalResult = buildFinalResult(
    consensus,
    marketData,
    detectedCategory,
    categoryHint,
    imageData,
    startTime
  );
  
  // Send completion
  sendSSE(res, {
    type: 'complete',
    timestamp: Date.now(),
    data: finalResult
  });
}

// ==================== HELPER FUNCTIONS ====================

function detectCategory(consensus: any, hint: string): string {
  // Check AI votes for category
  const categoryVotes = new Map<string, number>();
  
  if (consensus.votes) {
    consensus.votes.forEach((vote: any) => {
      if (vote.success && vote.rawResponse?.category) {
        const cat = normalizeCategory(vote.rawResponse.category);
        categoryVotes.set(cat, (categoryVotes.get(cat) || 0) + (vote.weight || 1));
      }
    });
  }
  
  // Get highest voted category
  let maxVotes = 0;
  let detected = 'general';
  
  categoryVotes.forEach((votes, cat) => {
    if (votes > maxVotes && cat !== 'general') {
      maxVotes = votes;
      detected = cat;
    }
  });
  
  // Fall back to hint if no AI votes and hint is specific
  if (detected === 'general' && hint !== 'general') {
    detected = normalizeCategory(hint);
  }
  
  return detected;
}

function normalizeCategory(cat: string): string {
  const catLower = cat.toLowerCase().trim();
  
  // Pokemon variations
  if (catLower.includes('pokemon') || catLower.includes('pokémon')) {
    return 'pokemon_cards';
  }
  
  // Coin variations
  if (catLower.includes('coin') || catLower.includes('numismatic')) {
    return 'coins';
  }
  
  // LEGO variations
  if (catLower.includes('lego')) {
    return 'lego';
  }
  
  // Vinyl variations
  if (catLower.includes('vinyl') || catLower.includes('record') || catLower === 'music') {
    return 'vinyl_records';
  }
  
  // Comic variations
  if (catLower.includes('comic') || catLower.includes('manga')) {
    return 'comics';
  }
  
  // Video game variations
  if (catLower.includes('video_game') || catLower.includes('game')) {
    return 'video_games';
  }
  
  // Sneaker variations
  if (catLower.includes('sneaker') || catLower.includes('shoe') || catLower.includes('jordan')) {
    return 'sneakers';
  }
  
  return catLower;
}

async function fetchMarketDataWithStreaming(
  res: VercelResponse,
  itemName: string,
  category: string,
  aiEstimate: number,
  aiConfidence: number
): Promise<{ blendedPrice: number; marketInfluence: string; sources: any[] }> {
  
  const apisToCall = getApisForCategory(category);
  const sources: any[] = [];
  
  for (const api of apisToCall) {
    sendSSE(res, {
      type: 'api_start',
      timestamp: Date.now(),
      data: { api, message: `Checking ${api}...` }
    });
    
    try {
      const result = await fetchApiData(api.toLowerCase().replace(/ /g, '_'), itemName);
      sources.push(result);
      
      sendSSE(res, {
        type: 'api_complete',
        timestamp: Date.now(),
        data: {
          api,
          success: result.available,
          listings: result.totalListings || 0,
          priceRange: result.priceAnalysis ? 
            `$${result.priceAnalysis.lowest} - $${result.priceAnalysis.highest}` : null,
          median: result.priceAnalysis?.median
        }
      });
    } catch (error: any) {
      sources.push({ source: api, available: false, error: error.message });
      sendSSE(res, {
        type: 'api_complete',
        timestamp: Date.now(),
        data: {
          api,
          success: false,
          error: error.message
        }
      });
    }
  }
  
  // Calculate blended price
  const availableSources = sources.filter(s => s.available && s.priceAnalysis);
  let blendedPrice = aiEstimate;
  
  if (availableSources.length > 0) {
    let totalWeight = (aiConfidence / 100) * 0.4;
    let weightedSum = aiEstimate * totalWeight;
    
    availableSources.forEach(source => {
      const weight = Math.min((source.totalListings || 1) / 50, 0.35);
      weightedSum += source.priceAnalysis.median * weight;
      totalWeight += weight;
    });
    
    blendedPrice = Math.round((weightedSum / totalWeight) * 100) / 100;
  }
  
  return {
    blendedPrice,
    marketInfluence: availableSources.length > 0 
      ? availableSources.map(s => s.source).join(' + ')
      : 'AI estimate only',
    sources
  };
}

function getApisForCategory(category: string): string[] {
  return CATEGORY_API_MAP[category] || ['eBay'];
}

async function fetchApiData(api: string, itemName: string): Promise<any> {
  // Map API names to endpoints
  const apiEndpoints: Record<string, string> = {
    'pokemon_tcg': '/api/pokemon/search',
    'numista': '/api/numista/search',
    'brickset': '/api/brickset/search',
    'discogs': '/api/discogs/search',
    'rawg': '/api/rawg/search',
    'comic_vine': '/api/comicvine/search',
    'google_books': '/api/google-books/search',
    'retailed': '/api/retailed/search',
    'ebay': '/api/ebay/search'
  };
  
  const endpoint = apiEndpoints[api] || apiEndpoints['ebay'];
  const url = `${BASE_URL}${endpoint}?q=${encodeURIComponent(itemName)}`;
  
  try {
    const response = await fetch(url, { 
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    return {
      source: api,
      available: true,
      ...data
    };
  } catch (error: any) {
    return {
      source: api,
      available: false,
      error: error.message
    };
  }
}

function buildFinalResult(
  consensus: any,
  marketData: any,
  detectedCategory: string,
  requestedCategory: string,
  imageData: string,
  startTime: number
): any {
  const respondedAIs = consensus.votes?.filter((v: any) => v.success).map((v: any) => v.providerName) || [];
  const respondedAPIs = marketData.sources?.filter((s: any) => s.available).map((s: any) => s.source) || [];
  
  return {
    id: consensus.analysisId || `hydra-stream-${Date.now()}`,
    itemName: consensus.consensus?.itemName || 'Unknown Item',
    estimatedValue: marketData.blendedPrice,
    decision: consensus.consensus?.decision || 'SELL',
    confidenceScore: consensus.consensus?.confidence || 0.75,
    summary_reasoning: consensus.consensus?.summary_reasoning || 'Analysis complete',
    valuation_factors: consensus.consensus?.valuation_factors || [],
    analysis_quality: consensus.consensus?.analysisQuality || 'OPTIMAL',
    capturedAt: new Date().toISOString(),
    category: detectedCategory,
    requestedCategory: requestedCategory,
    imageUrl: imageData?.substring(0, 100) + '...',
    marketComps: marketData.sources?.slice(0, 5) || [],
    processingTime: Date.now() - startTime,
    hydraConsensus: {
      totalSources: respondedAIs.length + respondedAPIs.length,
      aiModels: {
        responded: respondedAIs,
        weights: consensus.votes?.reduce((acc: any, v: any) => {
          if (v.success) acc[v.providerName] = v.weight;
          return acc;
        }, {}) || {}
      },
      apiSources: {
        responded: respondedAPIs,
        data: marketData.sources?.reduce((acc: any, s: any) => {
          if (s.available) {
            acc[s.source] = {
              confidence: 0.8,
              dataPoints: s.totalListings || 0
            };
          }
          return acc;
        }, {}) || {}
      },
      consensusMethod: 'weighted_blend_v5_streaming',
      finalConfidence: consensus.consensus?.confidence || 0.75
    },
    marketData: {
      sources: marketData.sources,
      primarySource: marketData.sources?.[0]?.source || 'AI',
      blendMethod: 'multi_source_weighted',
      marketInfluence: marketData.marketInfluence
    },
    resale_toolkit: {
      listInArena: true,
      sellOnProPlatforms: true,
      linkToMyStore: true,
      shareToSocial: true
    },
    tags: [detectedCategory, 'hydra-v5', 'streaming']
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

// ==================== API HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    await verifyUser(req);
    
    const body = req.body;
    
    // Validate request
    if (!body.category_id) {
      return res.status(400).json({ error: 'category_id is required' });
    }
    
    if (body.scanType === 'multi-modal') {
      if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return res.status(400).json({ error: 'Multi-modal analysis requires items array' });
      }
    } else if (!body.data) {
      return res.status(400).json({ error: 'Missing image data' });
    }
    
    // Check if client wants streaming
    const acceptsStream = req.headers.accept?.includes('text/event-stream');
    
    if (acceptsStream) {
      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Run streaming analysis
      await performStreamingAnalysis(body, res);
      
      // End the stream
      res.end();
    } else {
      // Non-streaming: tell client to use streaming or redirect
      return res.status(200).json({ 
        message: 'For real-time updates, set Accept: text/event-stream header',
        redirect: '/api/analyze'
      });
    }
    
  } catch (error: any) {
    const message = error.message || 'An unknown error occurred';
    console.error('Streaming analysis error:', error);
    
    // If streaming already started, send error event
    if (res.headersSent) {
      sendSSE(res, {
        type: 'error',
        timestamp: Date.now(),
        data: { message }
      });
      res.end();
    } else {
      // Otherwise send JSON error
      if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
      }
      return res.status(500).json({ error: 'Analysis failed', details: message });
    }
  }
}