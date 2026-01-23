// FORCE REDEPLOY v2.5 - eBay Market Data Integration (Fixed URL)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Node.js runtime configuration
export const config = {
  maxDuration: 45,
};

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Types (moved inline to avoid import issues)
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

interface EbayMarketData {
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
  ebayMarketData?: EbayMarketData;
  debug_info?: {
    reason: string;
    details: string;
  };
}

// Auth verification
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

// eBay Market Data Fetcher
async function fetchEbayMarketData(itemName: string): Promise<EbayMarketData> {
  // HARDCODE production URL - VERCEL_URL returns preview URLs which are auth-protected
  const baseUrl = 'https://tagnetiq-prod.vercel.app';
  
  try {
    console.log(`🛒 Fetching eBay market data for: ${itemName}`);
    
    // Clean up item name for search query
    const searchQuery = itemName
      .replace(/[^\w\s]/g, ' ')  // Remove special characters
      .replace(/\s+/g, ' ')       // Normalize spaces
      .trim()
      .substring(0, 100);         // Limit length
    
    const url = `${baseUrl}/api/ebay/price-check?q=${encodeURIComponent(searchQuery)}&limit=10`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ eBay API returned ${response.status}: ${errorText.substring(0, 200)}`);
      return {
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: `eBay API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    // Extract listing count from priceAnalysis.sampleSize
    const listingCount = data.priceAnalysis?.sampleSize || data.totalListings || 0;
    
    console.log(`✅ eBay data received: ${listingCount} listings found`);
    
    return {
      available: true,
      query: data.query || searchQuery,
      totalListings: listingCount,
      priceAnalysis: data.priceAnalysis ? {
        // Map the actual field names from the API response
        lowest: data.priceAnalysis.lowestPrice || data.priceAnalysis.lowest,
        highest: data.priceAnalysis.highestPrice || data.priceAnalysis.highest,
        average: data.priceAnalysis.averagePrice || data.priceAnalysis.average,
        median: data.priceAnalysis.medianPrice || data.priceAnalysis.median
      } : undefined,
      suggestedPrices: data.suggestedPrices ? {
        goodDeal: data.suggestedPrices.goodDeal,
        fairMarket: data.suggestedPrices.fairMarket,
        sellPrice: data.suggestedPrices.sellPrice
      } : undefined,
      sampleListings: data.sampleListings?.slice(0, 5).map((listing: any) => ({
        title: listing.title,
        price: listing.price,
        condition: listing.condition,
        url: listing.url
      }))
    };
    
  } catch (error: any) {
    console.warn(`⚠️ eBay fetch failed: ${error.message}`);
    return {
      available: false,
      query: itemName,
      totalListings: 0,
      error: error.message
    };
  }
}

// Blend AI consensus with eBay market data
function blendWithMarketData(
  aiEstimate: number, 
  aiConfidence: number,
  ebayData: EbayMarketData
): { adjustedValue: number; marketInfluence: string } {
  
  // If no eBay data, return AI estimate unchanged
  if (!ebayData.available || !ebayData.priceAnalysis || ebayData.totalListings < 3) {
    return { 
      adjustedValue: aiEstimate, 
      marketInfluence: 'none - insufficient market data' 
    };
  }
  
  const ebayMedian = ebayData.priceAnalysis.median;
  const ebayAverage = ebayData.priceAnalysis.average;
  
  // Calculate variance between AI and eBay
  const variance = Math.abs(aiEstimate - ebayMedian) / ebayMedian;
  
  // Weight eBay data based on listing count (more listings = more reliable)
  let ebayWeight = Math.min(ebayData.totalListings / 50, 0.4); // Max 40% weight
  
  // Reduce eBay weight if AI confidence is very high
  if (aiConfidence > 90) {
    ebayWeight *= 0.5;
  }
  
  // If variance is huge (>100%), trust AI less and eBay more
  if (variance > 1.0) {
    ebayWeight = Math.min(ebayWeight * 1.5, 0.5);
  }
  
  // Blend the values
  const aiWeight = 1 - ebayWeight;
  const adjustedValue = Math.round((aiEstimate * aiWeight + ebayMedian * ebayWeight) * 100) / 100;
  
  const marketInfluence = ebayWeight > 0.1 
    ? `eBay median ($${ebayMedian}) weighted ${Math.round(ebayWeight * 100)}%`
    : 'minimal - AI estimate prioritized';
  
  console.log(`💰 Price blend: AI $${aiEstimate} (${Math.round(aiWeight * 100)}%) + eBay $${ebayMedian} (${Math.round(ebayWeight * 100)}%) = $${adjustedValue}`);
  
  return { adjustedValue, marketInfluence };
}

// Main analysis function using dynamic import
async function performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
  // ENHANCED ANTI-BRAGGING PROMPT: Focus strictly on physical item characteristics
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
❌ "Detailed analysis" ❌ "Comprehensive evaluation" ❌ "Professional presentation"
❌ "High-demand AI valuation services" ❌ "Advanced analytical capabilities"

REQUIRED - valuation_factors must ONLY describe the PHYSICAL ITEM:
✅ "Excellent physical condition" ✅ "High-quality leather construction" ✅ "Recognizable brand logo"
✅ "Strong market demand for this type" ✅ "Good resale potential" ✅ "Minimal wear visible"
✅ "Premium materials used" ✅ "Popular style/design" ✅ "Collectible appeal"

IMPORTANT RULES:
- ONLY identify brands you can CLEARLY see and verify from logos, tags, or distinctive features
- DO NOT guess or assume luxury brands like "Louis Vuitton" unless you see clear LV monogram or authentic markings
- If you cannot clearly identify the brand, use generic descriptions like "leather handbag" or "designer-style purse"
- Be specific about what you observe: "brown leather bag with gold hardware" not "Louis Vuitton bag"
- Focus on: condition, materials, craftsmanship, brand visibility, market appeal, rarity, functionality
- estimatedValue must be a realistic number based on what you can actually see
- decision must be exactly "BUY" or "SELL" (uppercase)
- confidence must be between 0 and 1
- Include exactly 5 valuation_factors focused on observable product features

Analyze this item for resale potential based on physical characteristics only:`;
  
  let imageData = '';
  
  // Handle different scan types
  if (request.scanType === 'multi-modal' && request.items?.length) {
    imageData = request.items[0].data;
  } else if (request.data) {
    imageData = request.data;
  }
  
  // Dynamic import of HydraEngine
  console.log('🚀 Initializing Hydra Consensus Engine...');
  const { HydraEngine } = await import('../src/lib/hydra-engine.js');
  const hydra = new HydraEngine();
  await hydra.initialize();
  
  // Run multi-AI consensus analysis WITH authority validation
  const consensus = await hydra.analyzeWithAuthority([imageData], jsonPrompt, request.category_id);
  
  console.log(`✅ Hydra consensus complete: ${consensus.votes.length} AI models voted`);
  
  // Build valuation factors from all votes with weighted importance
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
  
  // Get the best summary reasoning from highest weighted vote
  const bestVote = consensus.votes.reduce((best, vote) => 
    vote.weight > best.weight ? vote : best, consensus.votes[0]);
  
  let summaryReasoning = bestVote?.rawResponse?.summary_reasoning || 
    `Consensus reached by ${consensus.consensus.totalVotes} AI models with ${consensus.consensus.confidence}% agreement.`;
  
  // Build enhanced source tracking data
  const respondedAIs = consensus.votes
    .filter(vote => vote.success)
    .map(vote => vote.providerName);
  
  const aiWeights: Record<string, number> = {};
  consensus.votes.forEach(vote => {
    if (vote.success && vote.providerName) {
      aiWeights[vote.providerName] = vote.weight;
    }
  });
  
  // Extract API sources from authority data if available
  const apiSources = consensus.authorityData ? {
    responded: Object.keys(consensus.authorityData),
    data: Object.entries(consensus.authorityData).reduce((acc, [source, data]: [string, any]) => {
      acc[source] = {
        confidence: data.confidence || 0.95,
        dataPoints: Array.isArray(data) ? data.length : 1
      };
      return acc;
    }, {} as Record<string, { confidence: number; dataPoints: number }>)
  } : {
    responded: [],
    data: {}
  };
  
  // ===== EBAY MARKET DATA INTEGRATION =====
  console.log('🛒 Fetching eBay market data...');
  const ebayData = await fetchEbayMarketData(consensus.consensus.itemName);
  
  // Add eBay to API sources if available
  if (ebayData.available) {
    apiSources.responded.push('eBay');
    apiSources.data['eBay'] = {
      confidence: ebayData.totalListings >= 10 ? 0.9 : 0.7,
      dataPoints: ebayData.totalListings
    };
  }
  
  // Blend AI estimate with eBay market data
  const { adjustedValue, marketInfluence } = blendWithMarketData(
    consensus.consensus.estimatedValue,
    consensus.consensus.confidence,
    ebayData
  );
  
  // Update summary reasoning with market context
  if (ebayData.available && ebayData.priceAnalysis) {
    summaryReasoning += ` Market validation: ${ebayData.totalListings} active eBay listings found with median price $${ebayData.priceAnalysis.median}.`;
  }
  
  // Build market comps from eBay listings
  const marketComps = ebayData.sampleListings?.map(listing => ({
    source: 'eBay',
    title: listing.title,
    price: listing.price,
    condition: listing.condition,
    url: listing.url
  })) || [];
  
  const totalSources = respondedAIs.length + apiSources.responded.length;
  
  const fullResult: AnalysisResult = {
    id: consensus.analysisId,
    itemName: consensus.consensus.itemName,
    estimatedValue: adjustedValue, // Use market-adjusted value
    decision: consensus.consensus.decision,
    confidenceScore: consensus.consensus.confidence,
    summary_reasoning: summaryReasoning,
    valuation_factors: topFactors,
    analysis_quality: consensus.consensus.analysisQuality,
    capturedAt: new Date().toISOString(),
    category: request.category_id,
    subCategory: request.subcategory_id,
    imageUrl: imageData,
    marketComps: marketComps,
    resale_toolkit: {
      listInArena: true,
      sellOnProPlatforms: true,
      linkToMyStore: false,
      shareToSocial: true
    },
    tags: [request.category_id],
    hydraConsensus: {
      ...consensus,
      totalSources,
      aiModels: {
        responded: respondedAIs,
        weights: aiWeights
      },
      apiSources,
      consensusMethod: 'weighted_average_with_market_data',
      finalConfidence: consensus.consensus.confidence / 100
    },
    authorityData: consensus.authorityData,
    ebayMarketData: ebayData
  };
  
  // Add debug info if analysis quality is FALLBACK
  if (consensus.consensus.analysisQuality === 'FALLBACK') {
    fullResult.debug_info = {
      reason: 'Multi-AI consensus degraded',
      details: `Only ${consensus.votes.length} AI model(s) responded. A minimum of 3 models is required for reliable consensus. Check API keys and provider initialization.`
    };
  }
  
  // Log market influence for debugging
  console.log(`📊 Final value: $${adjustedValue} (Market influence: ${marketInfluence})`);
  
  return fullResult;
}

// Main API handler
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
        return res.status(400).json({ error: 'Multi-modal analysis requires items array with at least one item.' });
      }
    } else {
      if (!body.scanType || !body.data || !body.category_id) {
        return res.status(400).json({ error: 'Missing required fields in analysis request.' });
      }
    }
    
    if (!body.category_id) {
      return res.status(400).json({ error: 'category_id is required for all analysis types.' });
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