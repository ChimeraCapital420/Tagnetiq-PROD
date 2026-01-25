// FILE: api/analyze.ts
// HYDRA v6.0 - Slim Analysis Handler
// Orchestrates modular components for multi-AI consensus analysis
// Refactored from 2,300-line monolith to ~220 lines

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import from modular HYDRA architecture
import {
  // Category detection
  detectItemCategory,
  
  // AI providers
  ProviderFactory,
  getAvailableProviders,
  isProviderAvailable,
  
  // Consensus
  calculateConsensus,
  tallyVotes,
  shouldTriggerTiebreaker,
  createVote,
  
  // Pricing
  blendPrices,
  formatAnalysisResponse,
  formatAPIResponse,
  formatErrorResponse,
  
  // Storage
  saveAnalysisAsync,
  isSupabaseAvailable,
  
  // Types
  type ModelVote,
} from '../src/lib/hydra/index.js';

// Import fetchers
import { fetchMarketData } from '../src/lib/hydra/fetchers/index.js';

// =============================================================================
// CONFIG
// =============================================================================

export const config = {
  maxDuration: 60,
};

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

interface AnalyzeRequest {
  itemName: string;
  imageBase64?: string;
  userId?: string;
  analysisId?: string;
  categoryHint?: string;
  condition?: string;
}

function validateRequest(body: unknown): AnalyzeRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body');
  }
  
  const { itemName, imageBase64, userId, analysisId, categoryHint, condition } = body as Record<string, unknown>;
  
  if (!itemName || typeof itemName !== 'string' || itemName.trim().length === 0) {
    throw new Error('itemName is required');
  }
  
  return {
    itemName: itemName.trim(),
    imageBase64: typeof imageBase64 === 'string' ? imageBase64 : undefined,
    userId: typeof userId === 'string' ? userId : undefined,
    analysisId: typeof analysisId === 'string' ? analysisId : `analysis_${Date.now()}`,
    categoryHint: typeof categoryHint === 'string' ? categoryHint : undefined,
    condition: typeof condition === 'string' ? condition : 'good',
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  let analysisId = '';

  try {
    // 1. Validate request
    const request = validateRequest(req.body);
    analysisId = request.analysisId!;
    
    console.log(`\n🔥 === HYDRA v6.0 ANALYSIS START ===`);
    console.log(`📦 Item: "${request.itemName}"`);
    console.log(`🆔 ID: ${analysisId}`);
    console.log(`🖼️ Image: ${request.imageBase64 ? 'Yes' : 'No'}`);
    
    // 2. Detect category
    const categoryResult = detectItemCategory(request.itemName, request.categoryHint);
    console.log(`🏷️ Category: ${categoryResult.category} (${categoryResult.confidence}%)`);
    
    // 3. Run AI analysis and market data in parallel
    const [aiVotes, marketResult] = await Promise.all([
      runMultiAIAnalysis(request.itemName, request.imageBase64, categoryResult.category),
      fetchMarketData(request.itemName, categoryResult.category),
    ]);
    
    console.log(`📊 AI Votes: ${aiVotes.length}`);
    console.log(`📈 Market sources: ${marketResult.sources.length}`);
    
    // 4. Calculate consensus
    const authorityData = marketResult.primaryAuthority || null;
    const consensus = calculateConsensus(aiVotes, authorityData);
    
    console.log(`🎯 Decision: ${consensus.decision} @ $${consensus.estimatedValue}`);
    console.log(`📊 Confidence: ${consensus.confidence}% (${consensus.analysisQuality})`);
    
    // 5. Blend prices from all sources
    const marketPrices = marketResult.sources
      .filter(s => s.priceData && s.priceData.length > 0)
      .map(s => ({ source: s.source, prices: s.priceData! }));
    
    const blendedPrice = blendPrices(
      consensus.estimatedValue,
      authorityData,
      marketPrices,
      { condition: request.condition }
    );
    
    // 6. Format response
    const processingTime = Date.now() - startTime;
    const response = formatAnalysisResponse(
      analysisId,
      consensus,
      categoryResult.category,
      blendedPrice,
      authorityData,
      processingTime
    );
    
    // 7. Save to Supabase (non-blocking)
    if (isSupabaseAvailable()) {
      saveAnalysisAsync(analysisId, consensus, categoryResult.category, request.userId, aiVotes, authorityData, processingTime);
    }
    
    console.log(`✅ Complete in ${processingTime}ms\n`);
    
    return res.status(200).json(formatAPIResponse(response));
    
  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
    return res.status(500).json(formatErrorResponse(error, analysisId));
  }
}

// =============================================================================
// MULTI-AI ANALYSIS ORCHESTRATION
// =============================================================================

async function runMultiAIAnalysis(
  itemName: string,
  imageBase64: string | undefined,
  category: string
): Promise<ModelVote[]> {
  const votes: ModelVote[] = [];
  const hasImage = !!imageBase64;
  
  // Stage 1: Primary vision models (OpenAI, Anthropic, Google)
  const visionProviders = ['openai', 'anthropic', 'google'].filter(isProviderAvailable);
  console.log(`  Stage 1 - Vision: ${visionProviders.join(', ') || 'none'}`);
  
  const visionVotes = await runProviderStage(visionProviders, itemName, imageBase64, category);
  votes.push(...visionVotes);
  
  // Extract best context from vision results
  const bestContext = votes.length > 0
    ? votes.reduce((a, b) => a.weight > b.weight ? a : b).reasoning || itemName
    : itemName;
  
  // Stage 2: Text analysis models (Mistral, Groq, xAI)
  const textProviders = ['mistral', 'groq', 'xai'].filter(isProviderAvailable);
  console.log(`  Stage 2 - Text: ${textProviders.join(', ') || 'none'}`);
  
  const textVotes = await runProviderStage(textProviders, bestContext, undefined, category);
  votes.push(...textVotes);
  
  // Stage 3: Market search (Perplexity) - gets weight boost
  if (isProviderAvailable('perplexity')) {
    console.log(`  Stage 3 - Market: perplexity`);
    const perplexityVotes = await runProviderStage(['perplexity'], bestContext, undefined, category);
    perplexityVotes.forEach(v => v.weight *= 1.2); // Market search bonus
    votes.push(...perplexityVotes);
  }
  
  // Stage 4: Tiebreaker if needed (DeepSeek)
  if (votes.length >= 4 && isProviderAvailable('deepseek')) {
    const { shouldTrigger, reason } = shouldTriggerTiebreaker(votes);
    
    if (shouldTrigger) {
      console.log(`  Stage 4 - Tiebreaker: deepseek (${reason})`);
      const tiebreakerVotes = await runProviderStage(['deepseek'], bestContext, undefined, category);
      tiebreakerVotes.forEach(v => v.weight *= 0.6); // Tiebreaker weight reduction
      votes.push(...tiebreakerVotes);
    }
  }
  
  return votes;
}

async function runProviderStage(
  providers: string[],
  itemName: string,
  imageBase64: string | undefined,
  category: string
): Promise<ModelVote[]> {
  const results = await Promise.allSettled(
    providers.map(async (providerId) => {
      const start = Date.now();
      try {
        const provider = ProviderFactory.create(providerId);
        const result = await provider.analyze(itemName, imageBase64, { category });
        const vote = createVote(providerId, result, { responseTime: Date.now() - start });
        console.log(`    ✓ ${providerId}: ${vote.decision} @ $${vote.estimatedValue.toFixed(2)}`);
        return vote;
      } catch (error: any) {
        console.log(`    ✗ ${providerId}: ${error.message}`);
        return null;
      }
    })
  );
  
  return results
    .filter((r): r is PromiseFulfilledResult<ModelVote | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((v): v is ModelVote => v !== null);
}