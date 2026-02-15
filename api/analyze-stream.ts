// HYDRA v5.2 STREAMING - Real-time Analysis Updates via Server-Sent Events
// FIX v5.2: valuation_factors aggregated from AI vote rawResponses (was always [])
// FIX v5.2: summary_reasoning picked from highest-weighted vote (was always 'Analysis complete')
// FIX v5.2: finalConfidence normalized to 0-1 decimal (was 77 integer → display showed 7700%)
// FIX v5.2: confidenceScore sent as integer percentage (was raw 77 which confused some displays)
// FIX v5.2: aiConfidence in blended price calc handles both 0-100 and 0-1 formats
// FIX v5.2: Added electronics, watches, jewelry, toys, art, antiques to CATEGORY_API_MAP + normalizeCategory
// FIX v5.1: buildFinalResult includes votes/allVotes arrays for display components
// FIX v5.1: All consensus.consensus.* access is defensively guarded
// PERF: Reduced streaming delays for mobile-first responsiveness
// Usage: POST /api/analyze-stream with Accept: text/event-stream header

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://tagnetiq-prod.vercel.app';

// ==================== TYPES ====================

interface StreamEvent {
  type:
    | 'init'
    | 'phase'
    | 'ai_start'
    | 'ai_complete'
    | 'ai_error'
    | 'category'
    | 'price'
    | 'api_start'
    | 'api_complete'
    | 'consensus'
    | 'complete'
    | 'error';
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
// FIX v5.2: Added electronics, watches, jewelry, toys, art, antiques
const CATEGORY_API_MAP: Record<string, string[]> = {
  pokemon_cards: ['Pokemon TCG', 'eBay'],
  trading_cards: ['Pokemon TCG', 'eBay'],
  coins: ['Numista', 'eBay'],
  lego: ['Brickset', 'eBay'],
  video_games: ['RAWG', 'eBay'],
  vinyl_records: ['Discogs', 'eBay'],
  comics: ['Comic Vine', 'eBay'],
  books: ['Google Books', 'eBay'],
  sneakers: ['Retailed', 'eBay'],
  electronics: ['eBay'],
  watches: ['eBay'],
  jewelry: ['eBay'],
  toys: ['eBay'],
  art: ['eBay'],
  antiques: ['eBay'],
  general: ['eBay'],
};

// ==================== SSE HELPERS ====================

function sendSSE(res: VercelResponse, event: StreamEvent) {
  try {
    const data = JSON.stringify(event);
    res.write(`data: ${data}\n\n`);
  } catch (e) {
    // Stream may have closed — swallow write errors
    console.warn('SSE write failed (client likely disconnected):', (e as Error).message);
  }
}

function sendInit(res: VercelResponse) {
  sendSSE(res, {
    type: 'init',
    timestamp: Date.now(),
    data: {
      message: 'Initializing Hydra Consensus Engine v5.2...',
      models: AI_MODELS.map((m) => ({
        name: m.name,
        icon: m.icon,
        color: m.color,
        weight: m.weight,
        status: 'pending',
      })),
      totalModels: AI_MODELS.length,
    },
  });
}

// ==================== CONFIDENCE NORMALIZER ====================
// hydra-engine.ts returns confidence as 0-100 integer (e.g. 77)
// All downstream consumers expect 0-1 decimal (e.g. 0.77)
// This single function prevents every double-multiplication bug

function normalizeConfidenceTo01(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0.75;
  // If > 1, it's a percentage (0-100) → divide by 100
  // If <= 1, it's already a decimal → use as-is
  return value > 1 ? value / 100 : value;
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
    data: { phase: 'ai', message: 'Running AI consensus analysis...' },
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

  // Stagger AI start notifications — reduced delay for mobile responsiveness
  AI_MODELS.forEach((model, index) => {
    setTimeout(() => {
      sendSSE(res, {
        type: 'ai_start',
        timestamp: Date.now(),
        data: {
          model: model.name,
          icon: model.icon,
          color: model.color,
          index,
        },
      });
    }, index * 80); // Was 150ms, reduced for faster mobile feedback
  });

  // Run analysis
  const consensus = await hydra.analyzeWithAuthority(
    [imageData],
    jsonPrompt,
    categoryHint
  );

  // Safely extract votes — handle both field names from different Hydra versions
  const votes: any[] = consensus.votes || consensus.allVotes || [];

  // Stream the votes that came back
  let runningEstimate = 0;
  let totalWeight = 0;

  if (votes.length > 0) {
    for (let i = 0; i < votes.length; i++) {
      const vote = votes[i];
      const modelInfo = AI_MODELS[i % AI_MODELS.length];

      // Reduced delay for mobile — was 80ms
      await new Promise((resolve) => setTimeout(resolve, 40));

      sendSSE(res, {
        type: 'ai_complete',
        timestamp: Date.now(),
        data: {
          model: vote.providerName || modelInfo.name,
          icon: modelInfo.icon,
          color: modelInfo.color,
          success: vote.success,
          responseTime:
            vote.responseTime || Math.floor(Math.random() * 1500) + 500,
          weight: vote.weight,
          estimate: vote.rawResponse?.estimatedValue,
          category: vote.rawResponse?.category,
          decision: vote.rawResponse?.decision,
        },
      });

      // Update running estimate
      if (vote.success && vote.rawResponse?.estimatedValue) {
        totalWeight += vote.weight;
        runningEstimate =
          (runningEstimate * (totalWeight - vote.weight) +
            vote.rawResponse.estimatedValue * vote.weight) /
          totalWeight;

        sendSSE(res, {
          type: 'price',
          timestamp: Date.now(),
          data: {
            estimate: Math.round(runningEstimate * 100) / 100,
            votesIn: i + 1,
            totalVotes: votes.length,
            confidence: (i + 1) / votes.length,
          },
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
      source: 'ai_consensus',
    },
  });

  // Phase 2: Market Data
  const apisForCategory =
    CATEGORY_API_MAP[detectedCategory] || CATEGORY_API_MAP['general'];

  sendSSE(res, {
    type: 'phase',
    timestamp: Date.now(),
    data: {
      phase: 'market',
      message: `Fetching market data from ${apisForCategory.join(', ')}...`,
      apis: apisForCategory,
    },
  });

  // Safely access consensus fields with fallbacks
  const consensusData = consensus.consensus || {};
  const itemName = consensusData.itemName || 'Unknown Item';
  const aiEstimatedValue = consensusData.estimatedValue || runningEstimate || 0;

  // FIX v5.2: Normalize confidence to 0-1 before passing to blended price calc
  // hydra-engine returns 77 (integer), blended price calc needs 0.77 (decimal)
  const aiConfidence = normalizeConfidenceTo01(consensusData.confidence);

  // Fetch market data with streaming updates
  const marketData = await fetchMarketDataWithStreaming(
    res,
    itemName,
    detectedCategory,
    aiEstimatedValue,
    aiConfidence
  );

  // Final price with market blend
  sendSSE(res, {
    type: 'price',
    timestamp: Date.now(),
    data: {
      estimate: marketData.blendedPrice,
      votesIn: votes.length || AI_MODELS.length,
      totalVotes: votes.length || AI_MODELS.length,
      confidence: 1,
      source: 'market_blended',
      marketInfluence: marketData.marketInfluence,
    },
  });

  // Phase 3: Finalizing
  sendSSE(res, {
    type: 'phase',
    timestamp: Date.now(),
    data: { phase: 'finalizing', message: 'Building final analysis...' },
  });

  // Reduced dramatic delay for mobile — was 300ms
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Build final result (matching analyze.ts output format)
  const finalResult = buildFinalResult(
    consensus,
    votes,
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
    data: finalResult,
  });
}

// ==================== HELPER FUNCTIONS ====================

function detectCategory(consensus: any, hint: string): string {
  const categoryVotes = new Map<string, number>();

  // Handle both votes field names
  const votes: any[] = consensus.votes || consensus.allVotes || [];

  votes.forEach((vote: any) => {
    if (vote.success && vote.rawResponse?.category) {
      const cat = normalizeCategory(vote.rawResponse.category);
      categoryVotes.set(
        cat,
        (categoryVotes.get(cat) || 0) + (vote.weight || 1)
      );
    }
  });

  let maxVotes = 0;
  let detected = 'general';

  categoryVotes.forEach((voteCount, cat) => {
    if (voteCount > maxVotes && cat !== 'general') {
      maxVotes = voteCount;
      detected = cat;
    }
  });

  if (detected === 'general' && hint !== 'general') {
    detected = normalizeCategory(hint);
  }

  return detected;
}

// FIX v5.2: Added electronics, watches, jewelry, toys, art, antiques
function normalizeCategory(cat: string): string {
  const catLower = cat.toLowerCase().trim();

  if (catLower.includes('pokemon') || catLower.includes('pokémon')) {
    return 'pokemon_cards';
  }
  if (catLower.includes('coin') || catLower.includes('numismatic')) {
    return 'coins';
  }
  if (catLower.includes('lego')) {
    return 'lego';
  }
  if (
    catLower.includes('vinyl') ||
    catLower.includes('record') ||
    catLower === 'music'
  ) {
    return 'vinyl_records';
  }
  if (catLower.includes('comic') || catLower.includes('manga')) {
    return 'comics';
  }
  if (catLower.includes('video_game') || catLower.includes('game')) {
    return 'video_games';
  }
  if (
    catLower.includes('sneaker') ||
    catLower.includes('shoe') ||
    catLower.includes('jordan')
  ) {
    return 'sneakers';
  }
  if (
    catLower.includes('electron') ||
    catLower.includes('laptop') ||
    catLower.includes('computer') ||
    catLower.includes('phone') ||
    catLower.includes('tablet') ||
    catLower.includes('console')
  ) {
    return 'electronics';
  }
  if (catLower.includes('watch')) {
    return 'watches';
  }
  if (
    catLower.includes('jewel') ||
    catLower.includes('ring') ||
    catLower.includes('necklace') ||
    catLower.includes('bracelet')
  ) {
    return 'jewelry';
  }
  if (
    catLower.includes('toy') ||
    catLower.includes('funko') ||
    catLower.includes('action figure') ||
    catLower.includes('plush')
  ) {
    return 'toys';
  }
  if (
    catLower.includes('art') ||
    catLower.includes('painting') ||
    catLower.includes('print') ||
    catLower.includes('sculpture')
  ) {
    return 'art';
  }
  if (catLower.includes('antique') || catLower.includes('vintage')) {
    return 'antiques';
  }

  return catLower;
}

async function fetchMarketDataWithStreaming(
  res: VercelResponse,
  itemName: string,
  category: string,
  aiEstimate: number,
  aiConfidence: number
): Promise<{
  blendedPrice: number;
  marketInfluence: string;
  sources: any[];
}> {
  const apisToCall = getApisForCategory(category);
  const sources: any[] = [];

  for (const api of apisToCall) {
    sendSSE(res, {
      type: 'api_start',
      timestamp: Date.now(),
      data: { api, message: `Checking ${api}...` },
    });

    try {
      const result = await fetchApiData(
        api.toLowerCase().replace(/ /g, '_'),
        itemName
      );
      sources.push(result);

      sendSSE(res, {
        type: 'api_complete',
        timestamp: Date.now(),
        data: {
          api,
          success: result.available,
          listings: result.totalListings || 0,
          priceRange: result.priceAnalysis
            ? `$${result.priceAnalysis.lowest} - $${result.priceAnalysis.highest}`
            : null,
          median: result.priceAnalysis?.median,
        },
      });
    } catch (error: any) {
      sources.push({ source: api, available: false, error: error.message });
      sendSSE(res, {
        type: 'api_complete',
        timestamp: Date.now(),
        data: {
          api,
          success: false,
          error: error.message,
        },
      });
    }
  }

  // Calculate blended price
  const availableSources = sources.filter(
    (s) => s.available && s.priceAnalysis
  );
  let blendedPrice = aiEstimate;

  if (availableSources.length > 0) {
    // FIX v5.2: aiConfidence is now guaranteed 0-1 from normalizeConfidenceTo01()
    // Before: was doing (77 / 100) which happened to work by accident
    // After: aiConfidence is already 0.77, use directly
    let weightTotal = aiConfidence * 0.4;
    let weightedSum = aiEstimate * weightTotal;

    availableSources.forEach((source) => {
      const weight = Math.min((source.totalListings || 1) / 50, 0.35);
      weightedSum += source.priceAnalysis.median * weight;
      weightTotal += weight;
    });

    blendedPrice =
      weightTotal > 0
        ? Math.round((weightedSum / weightTotal) * 100) / 100
        : aiEstimate;
  }

  return {
    blendedPrice,
    marketInfluence:
      availableSources.length > 0
        ? availableSources.map((s) => s.source).join(' + ')
        : 'AI estimate only',
    sources,
  };
}

function getApisForCategory(category: string): string[] {
  return CATEGORY_API_MAP[category] || ['eBay'];
}

async function fetchApiData(api: string, itemName: string): Promise<any> {
  const apiEndpoints: Record<string, string> = {
    pokemon_tcg: '/api/pokemon/search',
    numista: '/api/numista/search',
    brickset: '/api/brickset/search',
    discogs: '/api/discogs/search',
    rawg: '/api/rawg/search',
    comic_vine: '/api/comicvine/search',
    google_books: '/api/google-books/search',
    retailed: '/api/retailed/search',
    ebay: '/api/ebay/search',
  };

  const endpoint = apiEndpoints[api] || apiEndpoints['ebay'];
  const url = `${BASE_URL}${endpoint}?q=${encodeURIComponent(itemName)}`;

  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    return {
      source: api,
      available: true,
      ...data,
    };
  } catch (error: any) {
    return {
      source: api,
      available: false,
      error: error.message,
    };
  }
}

// =============================================================================
// FIX v5.2: AGGREGATE VALUATION FACTORS FROM AI VOTES
// hydra-engine.calculateConsensus() never includes valuation_factors.
// They only exist on individual vote rawResponse objects.
// This collects them, deduplicates, and ranks by citation frequency.
// =============================================================================

function aggregateValuationFactors(votes: any[]): string[] {
  const factorCounts = new Map<string, number>();

  for (const vote of votes) {
    const factors: any[] = vote.rawResponse?.valuation_factors || [];
    for (const factor of factors) {
      if (typeof factor === 'string' && factor.trim()) {
        const normalized = factor.trim();
        factorCounts.set(normalized, (factorCounts.get(normalized) || 0) + 1);
      }
    }
  }

  // Sort by frequency (most-cited first), take top 8
  return [...factorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([factor]) => factor);
}

// =============================================================================
// FIX v5.2: AGGREGATE SUMMARY REASONING FROM AI VOTES
// hydra-engine.calculateConsensus() never includes summary_reasoning.
// Pick the best one from the highest-weighted successful vote.
// =============================================================================

function aggregateSummaryReasoning(votes: any[]): string {
  const successfulVotes = votes
    .filter((v: any) => v.success && v.rawResponse?.summary_reasoning)
    .sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0));

  if (successfulVotes.length === 0) return 'Analysis complete';

  return successfulVotes[0].rawResponse.summary_reasoning;
}

// =============================================================================
// BUILD FINAL RESULT
// FIX v5.2: valuation_factors aggregated from votes (was always [])
// FIX v5.2: summary_reasoning from best vote (was always 'Analysis complete')
// FIX v5.2: finalConfidence normalized to 0-1 (was 77 → 7700% in display)
// FIX v5.2: confidenceScore as clean integer percentage
// FIX v5.1: includes votes/allVotes arrays for display components
// =============================================================================

function buildFinalResult(
  consensus: any,
  votes: any[],
  marketData: any,
  detectedCategory: string,
  requestedCategory: string,
  imageData: string,
  startTime: number
): any {
  const successfulVotes = votes.filter((v: any) => v.success);
  const respondedAIs = successfulVotes.map(
    (v: any) => v.providerName || 'Unknown'
  );
  const respondedAPIs =
    marketData.sources
      ?.filter((s: any) => s.available)
      .map((s: any) => s.source) || [];

  // Safely extract consensus data with fallbacks
  const consensusData = consensus.consensus || {};

  // FIX v5.2: Normalize confidence to 0-1 for all downstream consumers
  const normalizedConfidence = normalizeConfidenceTo01(consensusData.confidence);

  // FIX v5.2: Aggregate valuation_factors from all AI votes
  // hydra-engine.calculateConsensus doesn't include these — they only exist
  // on individual vote rawResponse objects. Was always returning [].
  const valuationFactors = aggregateValuationFactors(votes);

  // FIX v5.2: Get the best summary_reasoning from votes
  // hydra-engine.calculateConsensus doesn't include this either.
  const summaryReasoning = aggregateSummaryReasoning(votes);

  // Build normalized vote objects for display components
  // This is what HydraConsensusDisplay.tsx and NexusDecisionCard.tsx consume
  const normalizedVotes = votes.map((v: any, i: number) => {
    const modelInfo = AI_MODELS[i % AI_MODELS.length];
    return {
      providerName: v.providerName || modelInfo.name,
      icon: modelInfo.icon,
      color: modelInfo.color,
      success: v.success ?? false,
      weight: v.weight ?? modelInfo.weight,
      responseTime:
        v.responseTime || Math.floor(Math.random() * 1500) + 500,
      estimatedValue: v.rawResponse?.estimatedValue ?? v.estimatedValue ?? 0,
      decision: v.rawResponse?.decision ?? v.decision ?? 'SELL',
      confidence: v.rawResponse?.confidence ?? v.confidence ?? 0.5,
      category: v.rawResponse?.category ?? detectedCategory,
      itemName: v.rawResponse?.itemName ?? consensusData.itemName ?? 'Unknown Item',
      rawResponse: v.rawResponse || null,
    };
  });

  return {
    id: consensus.analysisId || `hydra-stream-${Date.now()}`,
    itemName: consensusData.itemName || 'Unknown Item',
    estimatedValue: marketData.blendedPrice,
    decision: consensusData.decision || 'SELL',

    // FIX v5.2: Clean integer percentage (e.g. 77) for display as "77%"
    confidenceScore: Math.round(normalizedConfidence * 100),

    // FIX v5.2: Aggregated from vote rawResponses instead of empty defaults
    summary_reasoning: summaryReasoning,
    valuation_factors: valuationFactors,

    analysis_quality: consensusData.analysisQuality || 'OPTIMAL',
    capturedAt: new Date().toISOString(),
    category: detectedCategory,
    requestedCategory: requestedCategory,
    imageUrl: imageData?.substring(0, 100) + '...',
    marketComps: marketData.sources?.slice(0, 5) || [],
    processingTime: Date.now() - startTime,

    // ================================================================
    // HYDRA CONSENSUS — NOW INCLUDES votes AND allVotes
    // HydraConsensusDisplay reads: hydraConsensus.votes
    // NexusDecisionCard reads: hydraConsensus.votes for weight display
    // Both field names provided for backward compatibility
    // ================================================================
    hydraConsensus: {
      totalSources: respondedAIs.length + respondedAPIs.length,

      // ★ THE FIX — votes array for display components
      votes: normalizedVotes,
      allVotes: normalizedVotes, // Alias for components checking either name

      aiModels: {
        responded: respondedAIs,
        weights: successfulVotes.reduce((acc: any, v: any) => {
          if (v.providerName) acc[v.providerName] = v.weight;
          return acc;
        }, {}),
      },
      apiSources: {
        responded: respondedAPIs,
        data: marketData.sources?.reduce((acc: any, s: any) => {
          if (s.available) {
            acc[s.source] = {
              confidence: 0.8,
              dataPoints: s.totalListings || 0,
            };
          }
          return acc;
        }, {}) || {},
      },
      consensusMethod: 'weighted_blend_v5_streaming',

      // FIX v5.2: Always 0-1 decimal — display components do × 100
      finalConfidence: normalizedConfidence,
    },

    // Market data section
    marketData: {
      sources: marketData.sources,
      primarySource: marketData.sources?.[0]?.source || 'AI',
      blendMethod: 'multi_source_weighted',
      marketInfluence: marketData.marketInfluence,
    },

    // Resale toolkit flags
    resale_toolkit: {
      listInArena: true,
      sellOnProPlatforms: true,
      linkToMyStore: true,
      shareToSocial: true,
    },

    tags: [detectedCategory, 'hydra-v5.2', 'streaming'],
  };
}

// ==================== AUTH VERIFICATION ====================

async function verifyUser(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Authentication required');
  }

  const token = authHeader.split(' ')[1];
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error('Authentication failed');
  }

  return user;
}

// ==================== API HANDLER ====================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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
      if (
        !body.items ||
        !Array.isArray(body.items) ||
        body.items.length === 0
      ) {
        return res
          .status(400)
          .json({ error: 'Multi-modal analysis requires items array' });
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
      // Non-streaming fallback — redirect to standard endpoint
      return res.status(200).json({
        message:
          'For real-time updates, set Accept: text/event-stream header',
        redirect: '/api/analyze',
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
        data: { message },
      });
      res.end();
    } else {
      // Otherwise send JSON error
      if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
      }
      return res.status(500).json({
        error: 'Analysis failed',
        details: message,
      });
    }
  }
}