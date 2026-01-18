// FORCE REDEPLOY v2.1 - Updated AI providers
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

// Main analysis function using dynamic import
async function performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
  // IMPROVED PROMPT: Focus on product, not AI capabilities
  const jsonPrompt = `You are a professional appraiser analyzing an item for resale value. Focus ONLY on the item itself.

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY a valid JSON object - no other text, no markdown, no explanations
2. The JSON must have EXACTLY this structure:
{
  "itemName": "specific item name based on what you see",
  "estimatedValue": 25.99,
  "decision": "BUY",
  "valuation_factors": ["Market demand for this item", "Physical condition observed", "Brand reputation and value", "Rarity or collectibility", "Current market price trends"],
  "summary_reasoning": "Brief explanation of why this specific item is worth the estimated value",
  "confidence": 0.85
}

IMPORTANT RULES:
- Focus on the ITEM being analyzed, not on AI capabilities or analysis methods
- valuation_factors should describe the ITEM'S characteristics (condition, rarity, market demand, brand value, etc.)
- Do NOT mention "AI analysis", "machine learning", "image recognition", or similar technical terms
- Base your analysis on what you observe about the actual product
- Give specific, product-focused factors like "excellent condition", "high brand recognition", "strong resale demand"
- estimatedValue must be a number (not a string)
- decision must be exactly "BUY" or "SELL" (uppercase)
- confidence must be between 0 and 1
- Include exactly 5 valuation_factors focused on the product

Analyze this item for resale potential:`;
  
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
  
  const summaryReasoning = bestVote?.rawResponse?.summary_reasoning || 
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
  
  const totalSources = respondedAIs.length + apiSources.responded.length;
  
  const fullResult: AnalysisResult = {
    id: consensus.analysisId,
    itemName: consensus.consensus.itemName,
    estimatedValue: consensus.consensus.estimatedValue,
    decision: consensus.consensus.decision,
    confidenceScore: consensus.consensus.confidence,
    summary_reasoning: summaryReasoning,
    valuation_factors: topFactors,
    analysis_quality: consensus.consensus.analysisQuality,
    capturedAt: new Date().toISOString(),
    category: request.category_id,
    subCategory: request.subcategory_id,
    imageUrl: imageData,
    marketComps: [],
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
      consensusMethod: 'weighted_average',
      finalConfidence: consensus.consensus.confidence / 100
    },
    authorityData: consensus.authorityData
  };
  
  // Add debug info if analysis quality is FALLBACK
  if (consensus.consensus.analysisQuality === 'FALLBACK') {
    fullResult.debug_info = {
      reason: 'Multi-AI consensus degraded',
      details: `Only ${consensus.votes.length} AI model(s) responded. A minimum of 3 models is required for reliable consensus. Check API keys and provider initialization.`
    };
  }
  
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