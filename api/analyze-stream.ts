// HYDRA v5.4 STREAMING - Real-time Analysis Updates via Server-Sent Events
// FIX v5.4: SAVES TO DATABASE — was losing all scan data (analysis_history had 0 rows)
//   Uses saveAnalysisAwaited() before sending 'complete' SSE event.
//   Oracle, Argos, vault, scan-context ALL depend on this data persisting.
// FIX v5.3: Uses REAL Hydra fetcher system (fetchMarketData) instead of
//   homebrew fetchApiData() that called non-existent internal endpoints.
//   Comic Vine authority cards, eBay pricing, Numista, Google Books — all now work.
// FIX v5.2: valuation_factors, summary_reasoning, confidence normalization
// FIX v5.1: buildFinalResult includes votes/allVotes arrays
// PERF: Reduced streaming delays for mobile-first responsiveness
// Usage: POST /api/analyze-stream with Accept: text/event-stream header

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// v5.3: Import the REAL Hydra fetcher system — same one analyze.ts uses
import { fetchMarketData } from '../src/lib/hydra/fetchers/index.js';
import type { ItemCategory } from '../src/lib/hydra/types.js';

// v5.4: Import save function — same one analyze.ts uses
import { saveAnalysisAwaited } from '../src/lib/hydra/storage/supabase.js';

export const config = {
  maxDuration: 60,
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

// ==================== SSE HELPERS ====================

function sendSSE(res: VercelResponse, event: StreamEvent) {
  try {
    const data = JSON.stringify(event);
    res.write(`data: ${data}\n\n`);
  } catch (e) {
    console.warn('SSE write failed (client likely disconnected):', (e as Error).message);
  }
}

function sendInit(res: VercelResponse) {
  sendSSE(res, {
    type: 'init',
    timestamp: Date.now(),
    data: {
      message: 'Initializing Hydra Consensus Engine v5.4...',
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

function normalizeConfidenceTo01(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0.75;
  return value > 1 ? value / 100 : value;
}

// ==================== CATEGORY NORMALIZER ====================
// Used for AI vote processing — maps free-text AI responses to standard categories

function normalizeCategory(cat: string): string {
  const catLower = cat.toLowerCase().trim();

  if (catLower.includes('pokemon') || catLower.includes('pokémon')) return 'pokemon_cards';
  if (catLower.includes('coin') || catLower.includes('numismatic')) return 'coins';
  if (catLower.includes('lego')) return 'lego';
  if (catLower.includes('vinyl') || catLower.includes('record') || catLower === 'music') return 'vinyl_records';
  if (catLower.includes('comic') || catLower.includes('manga')) return 'comics';
  if (catLower.includes('video_game') || catLower.includes('game')) return 'video_games';
  if (catLower.includes('sneaker') || catLower.includes('shoe') || catLower.includes('jordan')) return 'sneakers';
  if (catLower.includes('electron') || catLower.includes('laptop') || catLower.includes('computer') || catLower.includes('phone') || catLower.includes('tablet') || catLower.includes('console')) return 'electronics';
  if (catLower.includes('watch')) return 'watches';
  if (catLower.includes('jewel') || catLower.includes('ring') || catLower.includes('necklace') || catLower.includes('bracelet')) return 'jewelry';
  if (catLower.includes('toy') || catLower.includes('funko') || catLower.includes('action figure') || catLower.includes('plush')) return 'toys';
  if (catLower.includes('art') || catLower.includes('painting') || catLower.includes('print') || catLower.includes('sculpture')) return 'art';
  if (catLower.includes('antique') || catLower.includes('vintage')) return 'antiques';
  if (catLower.includes('book')) return 'books';

  return catLower;
}

// ==================== STREAMING ANALYSIS ====================

async function performStreamingAnalysis(
  request: any,
  res: VercelResponse,
  userId?: string,  // v5.4: Accept userId for database save
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

  // v5.4: Extract original image URLs for marketplace persistence
  const originalImageUrls: string[] = [];
  if (request.items && Array.isArray(request.items)) {
    for (const item of request.items) {
      if (item.originalUrl && !item.originalUrl.startsWith('blob:')) {
        originalImageUrls.push(item.originalUrl);
      }
    }
  }
  if (Array.isArray(request.originalImageUrls)) {
    for (const url of request.originalImageUrls) {
      if (url && typeof url === 'string' && !url.startsWith('blob:') && !originalImageUrls.includes(url)) {
        originalImageUrls.push(url);
      }
    }
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

  // Build prompt
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

  // Stagger AI start notifications
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
    }, index * 80);
  });

  // Run analysis
  const consensus = await hydra.analyzeWithAuthority(
    [imageData],
    jsonPrompt,
    categoryHint
  );

  // Safely extract votes
  const votes: any[] = consensus.votes || consensus.allVotes || [];

  // Stream the votes that came back
  let runningEstimate = 0;
  let totalWeight = 0;

  if (votes.length > 0) {
    for (let i = 0; i < votes.length; i++) {
      const vote = votes[i];
      const modelInfo = AI_MODELS[i % AI_MODELS.length];

      await new Promise((resolve) => setTimeout(resolve, 40));

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
          decision: vote.rawResponse?.decision,
        },
      });

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

  // ================================================================
  // Phase 2: Market Data — using the REAL Hydra fetcher system
  // v5.3 FIX: Previous versions called homebrew fetchApiData() which
  // hit non-existent internal endpoints → 401 errors.
  // Now uses fetchMarketData() — same system as analyze.ts.
  // Comic Vine, eBay OAuth, Numista, Google Books all work properly.
  // ================================================================

  sendSSE(res, {
    type: 'phase',
    timestamp: Date.now(),
    data: {
      phase: 'market',
      message: `Fetching market data for ${detectedCategory}...`,
    },
  });

  const consensusData = consensus.consensus || {};
  const itemName = consensusData.itemName || 'Unknown Item';
  const aiEstimatedValue = consensusData.estimatedValue || runningEstimate || 0;
  const aiConfidence = normalizeConfidenceTo01(consensusData.confidence);

  // Call the REAL fetcher system
  const marketResult = await fetchMarketData(
    itemName,
    detectedCategory as ItemCategory,
    undefined, // additionalContext (barcodes) — not available in stream mode yet
    { includeEbay: true }
  );

  // Stream market source results as SSE events
  for (const source of marketResult.sources) {
    sendSSE(res, {
      type: 'api_complete',
      timestamp: Date.now(),
      data: {
        api: source.source,
        success: source.available,
        listings: source.totalListings || 0,
        priceRange: source.priceAnalysis
          ? `$${source.priceAnalysis.lowest} - $${source.priceAnalysis.highest}`
          : null,
        median: source.priceAnalysis?.median,
        hasAuthority: !!source.authorityData,
      },
    });
  }

  // Calculate final blended price
  // Use market blended price if available, otherwise fall back to AI estimate
  const marketBlendedPrice = marketResult.blendedPrice?.value || 0;
  let finalPrice = aiEstimatedValue;

  if (marketBlendedPrice > 0) {
    // Blend AI estimate with market data
    const aiWeight = aiConfidence * 0.4;
    const marketWeight = (marketResult.blendedPrice?.confidence || 0.5) * 0.6;
    const totalBlendWeight = aiWeight + marketWeight;

    finalPrice = totalBlendWeight > 0
      ? (aiEstimatedValue * aiWeight + marketBlendedPrice * marketWeight) / totalBlendWeight
      : aiEstimatedValue;

    finalPrice = Math.round(finalPrice * 100) / 100;
  }

  // Send final price with market blend
  sendSSE(res, {
    type: 'price',
    timestamp: Date.now(),
    data: {
      estimate: finalPrice,
      votesIn: votes.length || AI_MODELS.length,
      totalVotes: votes.length || AI_MODELS.length,
      confidence: 1,
      source: 'market_blended',
      marketInfluence: marketResult.marketInfluence,
    },
  });

  // Phase 3: Finalizing
  sendSSE(res, {
    type: 'phase',
    timestamp: Date.now(),
    data: { phase: 'finalizing', message: 'Building final analysis...' },
  });

  await new Promise((resolve) => setTimeout(resolve, 150));

  // Build final result
  const finalResult = buildFinalResult(
    consensus,
    votes,
    marketResult,
    finalPrice,
    detectedCategory,
    categoryHint,
    imageData,
    startTime
  );

  // ================================================================
  // v5.4: SAVE TO DATABASE — BEFORE sending complete event
  // This is the critical fix. Without this, analysis_history stays
  // empty and Oracle/Argos/vault have zero scan data to work with.
  // Uses saveAnalysisAwaited (same as analyze.ts) with 3s timeout.
  // ================================================================
  if (userId) {
    try {
      const processingTime = Date.now() - startTime;

      // Extract authority data for storage
      const authoritySource = marketResult.sources?.find(
        (s: any) => s.authorityData && s.source !== 'ebay'
      );
      const authorityData = authoritySource?.authorityData || marketResult.primaryAuthority || null;

      // Build consensus-compatible object for saveAnalysisAwaited
      const consensusForSave = {
        itemName: finalResult.itemName,
        decision: finalResult.decision as 'BUY' | 'SELL',
        estimatedValue: finalResult.estimatedValue,
        confidence: normalizeConfidenceTo01(finalResult.confidenceScore),
        analysisQuality: finalResult.analysis_quality || 'OPTIMAL',
        totalVotes: votes.length,
        consensusMetrics: {
          aiConfidence: aiConfidence,
          decisionAgreement: votes.filter((v: any) => v.success && v.rawResponse?.decision === finalResult.decision).length / Math.max(votes.length, 1),
          marketSourceCount: marketResult.sources?.filter((s: any) => s.available).length || 0,
          hasAuthority: !!authorityData,
        },
        // These fields exist on ConsensusResult type but may not be used by save
        reasoning: finalResult.summary_reasoning || '',
        votes: votes,
      };

      // Build vote objects for storage
      const votesForSave = votes
        .filter((v: any) => v.success)
        .map((v: any) => ({
          providerName: v.providerName || 'Unknown',
          decision: v.rawResponse?.decision || v.decision || 'SELL',
          estimatedValue: v.rawResponse?.estimatedValue || v.estimatedValue || 0,
          confidence: normalizeConfidenceTo01(v.rawResponse?.confidence || v.confidence),
          weight: v.weight || 1,
        }));

      const saveResult = await saveAnalysisAwaited(
        finalResult.id,
        consensusForSave as any,
        detectedCategory,
        userId,
        votesForSave as any,
        authorityData,
        processingTime,
        originalImageUrls.length > 0 ? originalImageUrls : undefined
      );

      if (saveResult.success) {
        console.log(`✅ Stream analysis saved: ${finalResult.id} for user ${userId}`);
      } else {
        console.warn(`⚠️ Stream save incomplete: ${saveResult.error}`);
      }
    } catch (saveErr: any) {
      // Save failure must NEVER block the scan response
      console.error(`❌ Stream save failed (non-fatal): ${saveErr.message}`);
    }
  } else {
    console.warn('⚠️ No userId available — skipping database save');
  }

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
  const votes: any[] = consensus.votes || consensus.allVotes || [];

  votes.forEach((vote: any) => {
    if (vote.success && vote.rawResponse?.category) {
      const cat = normalizeCategory(vote.rawResponse.category);
      categoryVotes.set(cat, (categoryVotes.get(cat) || 0) + (vote.weight || 1));
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

// ==================== AGGREGATION HELPERS ====================

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

  return [...factorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([factor]) => factor);
}

function aggregateSummaryReasoning(votes: any[]): string {
  const successfulVotes = votes
    .filter((v: any) => v.success && v.rawResponse?.summary_reasoning)
    .sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0));

  if (successfulVotes.length === 0) return 'Analysis complete';
  return successfulVotes[0].rawResponse.summary_reasoning;
}

// ==================== BUILD FINAL RESULT ====================

function buildFinalResult(
  consensus: any,
  votes: any[],
  marketResult: any,
  finalPrice: number,
  detectedCategory: string,
  requestedCategory: string,
  imageData: string,
  startTime: number
): any {
  const successfulVotes = votes.filter((v: any) => v.success);
  const respondedAIs = successfulVotes.map((v: any) => v.providerName || 'Unknown');
  const respondedAPIs = marketResult.sources
    ?.filter((s: any) => s.available)
    .map((s: any) => s.source) || [];

  const consensusData = consensus.consensus || {};
  const normalizedConfidence = normalizeConfidenceTo01(consensusData.confidence);
  const valuationFactors = aggregateValuationFactors(votes);
  const summaryReasoning = aggregateSummaryReasoning(votes);

  // Build normalized vote objects for display components
  const normalizedVotes = votes.map((v: any, i: number) => {
    const modelInfo = AI_MODELS[i % AI_MODELS.length];
    return {
      providerName: v.providerName || modelInfo.name,
      icon: modelInfo.icon,
      color: modelInfo.color,
      success: v.success ?? false,
      weight: v.weight ?? modelInfo.weight,
      responseTime: v.responseTime || Math.floor(Math.random() * 1500) + 500,
      estimatedValue: v.rawResponse?.estimatedValue ?? v.estimatedValue ?? 0,
      decision: v.rawResponse?.decision ?? v.decision ?? 'SELL',
      confidence: v.rawResponse?.confidence ?? v.confidence ?? 0.5,
      category: v.rawResponse?.category ?? detectedCategory,
      itemName: v.rawResponse?.itemName ?? consensusData.itemName ?? 'Unknown Item',
      rawResponse: v.rawResponse || null,
    };
  });

  // Extract eBay data specifically for display
  const ebaySource = marketResult.sources?.find((s: any) => s.source === 'ebay');

  // Extract authority data from market sources
  const authoritySource = marketResult.sources?.find(
    (s: any) => s.authorityData && s.source !== 'ebay'
  );

  return {
    id: consensus.analysisId || `hydra-stream-${Date.now()}`,
    itemName: consensusData.itemName || 'Unknown Item',
    estimatedValue: finalPrice,
    decision: consensusData.decision || 'SELL',
    confidenceScore: Math.round(normalizedConfidence * 100),
    summary_reasoning: summaryReasoning,
    valuation_factors: valuationFactors,
    analysis_quality: consensusData.analysisQuality || 'OPTIMAL',
    capturedAt: new Date().toISOString(),
    category: detectedCategory,
    requestedCategory: requestedCategory,
    imageUrl: imageData?.substring(0, 100) + '...',
    processingTime: Date.now() - startTime,

    // v5.3: Real market data from Hydra fetcher system
    marketComps: ebaySource?.sampleListings?.slice(0, 5) || [],
    ebayMarketData: ebaySource || null,
    marketSources: marketResult.sources || [],

    // v5.3: Authority data (Comic Vine, Numista, Google Books, etc.)
    authorityData: authoritySource?.authorityData || marketResult.primaryAuthority || null,

    // Hydra consensus for display components
    hydraConsensus: {
      totalSources: respondedAIs.length + respondedAPIs.length,
      votes: normalizedVotes,
      allVotes: normalizedVotes,
      aiModels: {
        responded: respondedAIs,
        weights: successfulVotes.reduce((acc: any, v: any) => {
          if (v.providerName) acc[v.providerName] = v.weight;
          return acc;
        }, {}),
      },
      apiSources: {
        responded: respondedAPIs,
        data: marketResult.sources?.reduce((acc: any, s: any) => {
          if (s.available) {
            acc[s.source] = {
              confidence: 0.8,
              dataPoints: s.totalListings || 0,
              hasAuthority: !!s.authorityData,
            };
          }
          return acc;
        }, {}) || {},
      },
      consensusMethod: 'weighted_blend_v5_streaming',
      finalConfidence: normalizedConfidence,
    },

    // Market data section
    marketData: {
      sources: marketResult.sources,
      primarySource: marketResult.primarySource || 'AI',
      blendMethod: marketResult.blendedPrice?.method || 'ai_estimate',
      marketInfluence: marketResult.marketInfluence,
      blendedPrice: marketResult.blendedPrice || null,
    },

    // Resale toolkit flags
    resale_toolkit: {
      listInArena: true,
      sellOnProPlatforms: true,
      linkToMyStore: true,
      shareToSocial: true,
    },

    tags: [detectedCategory, 'hydra-v5.4', 'streaming'],
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // v5.4: Capture user for database save (was: await verifyUser(req) with no capture)
    const user = await verifyUser(req);

    const body = req.body;

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

    const acceptsStream = req.headers.accept?.includes('text/event-stream');

    if (acceptsStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // v5.4: Pass user.id so scans get saved to analysis_history
      await performStreamingAnalysis(body, res, user.id);
      res.end();
    } else {
      return res.status(200).json({
        message: 'For real-time updates, set Accept: text/event-stream header',
        redirect: '/api/analyze',
      });
    }
  } catch (error: any) {
    const message = error.message || 'An unknown error occurred';
    console.error('Streaming analysis error:', error);

    if (res.headersSent) {
      sendSSE(res, {
        type: 'error',
        timestamp: Date.now(),
        data: { message },
      });
      res.end();
    } else {
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