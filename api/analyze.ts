// FILE: api/analyze.ts
// HYDRA v6.0 - Slim Analysis Handler
// Orchestrates modular components for multi-AI consensus analysis

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import from modular HYDRA architecture
import {
  // Category detection
  detectItemCategory,
  
  // AI providers
  ProviderFactory,
  isProviderAvailable,
  
  // Consensus
  calculateConsensus,
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
  
  // Prompts
  buildAnalysisPrompt,
  buildUserMessage,
  
  // Types
  type ModelVote,
} from '../src/lib/hydra/index.js';

// Import fetchers
import { fetchMarketData } from '../src/lib/hydra/fetchers/index.js';

// Import provider config for creating providers
import { AI_PROVIDERS } from '../src/lib/hydra/config/providers.js';
import { AI_MODEL_WEIGHTS } from '../src/lib/hydra/config/constants.js';

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
  additionalImages?: string[];
  userId?: string;
  analysisId?: string;
  categoryHint?: string;
  condition?: string;
}

interface MultiModalItem {
  type: 'photo' | 'video' | 'document' | 'certificate';
  name: string;
  data: string;
  additionalFrames?: string[];
  metadata?: {
    documentType?: string;
    description?: string;
    extractedText?: string;
    barcodes?: string[];
  };
}

function validateRequest(body: unknown): AnalyzeRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body');
  }
  
  const rawBody = body as Record<string, unknown>;
  
  // ==========================================================================
  // HANDLE MULTI-MODAL FORMAT (from DualScanner)
  // ==========================================================================
  if (rawBody.items && Array.isArray(rawBody.items) && rawBody.items.length > 0) {
    const items = rawBody.items as MultiModalItem[];
    const primaryItem = items[0];
    
    // Extract image data from the primary item
    let imageBase64: string | undefined;
    if (primaryItem.data) {
      // Remove data URL prefix if present
      imageBase64 = primaryItem.data.includes('base64,') 
        ? primaryItem.data.split('base64,')[1] 
        : primaryItem.data;
    }
    
    // Collect additional images from other items and video frames
    const additionalImages: string[] = [];
    
    if (primaryItem.additionalFrames) {
      primaryItem.additionalFrames.forEach(frame => {
        const cleanFrame = frame.includes('base64,') ? frame.split('base64,')[1] : frame;
        additionalImages.push(cleanFrame);
      });
    }
    
    items.slice(1).forEach(item => {
      if (item.data) {
        const cleanData = item.data.includes('base64,') ? item.data.split('base64,')[1] : item.data;
        additionalImages.push(cleanData);
      }
    });
    
    // Generate item name - let AI identify from image
    let itemName = 'Identify this item from the image';
    
    if (primaryItem.name && !primaryItem.name.startsWith('Photo ') && !primaryItem.name.startsWith('Video ')) {
      itemName = primaryItem.name;
    } else if (primaryItem.metadata?.description) {
      itemName = primaryItem.metadata.description;
    } else if (primaryItem.metadata?.extractedText) {
      itemName = primaryItem.metadata.extractedText.substring(0, 50).trim() || 'Identify this item from the image';
    }
    
    const categoryHint = (rawBody.subcategory_id as string) || 
                         (rawBody.category_id as string) || 
                         undefined;
    
    return {
      itemName,
      imageBase64,
      additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
      userId: typeof rawBody.userId === 'string' ? rawBody.userId : undefined,
      analysisId: typeof rawBody.analysisId === 'string' ? rawBody.analysisId : `analysis_${Date.now()}`,
      categoryHint: categoryHint !== 'general' ? categoryHint : undefined,
      condition: typeof rawBody.condition === 'string' ? rawBody.condition : 'good',
    };
  }
  
  // ==========================================================================
  // HANDLE STANDARD FORMAT (direct itemName)
  // ==========================================================================
  const { itemName, imageBase64, userId, analysisId, categoryHint, condition } = rawBody;
  
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
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
    console.log(`🖼️ Primary Image: ${request.imageBase64 ? 'Yes' : 'No'}`);
    console.log(`🖼️ Additional Images: ${request.additionalImages?.length || 0}`);
    
    // 2. Detect category
    const categoryResult = detectItemCategory(request.itemName, request.categoryHint);
    console.log(`🏷️ Category: ${categoryResult.category} (${categoryResult.confidence}%)`);
    
    // 3. Build images array
    const images: string[] = [];
    if (request.imageBase64) {
      images.push(request.imageBase64);
    }
    if (request.additionalImages) {
      images.push(...request.additionalImages.slice(0, 3));
    }
    
    // 4. Run AI analysis and market data in parallel
    const [aiVotes, marketResult] = await Promise.all([
      runMultiAIAnalysis(request.itemName, images, categoryResult.category, request.categoryHint),
      fetchMarketData(request.itemName, categoryResult.category),
    ]);
    
    console.log(`📊 AI Votes: ${aiVotes.length}`);
    console.log(`📈 Market sources: ${marketResult.sources.length}`);
    
    // 5. Calculate consensus
    const authorityData = marketResult.primaryAuthority || null;
    const consensus = calculateConsensus(aiVotes, authorityData);
    
    console.log(`🎯 Decision: ${consensus.decision} @ $${consensus.estimatedValue}`);
    console.log(`📊 Confidence: ${consensus.confidence}% (${consensus.analysisQuality})`);
    
    // 6. Blend prices
    const marketPrices = marketResult.sources
      .filter(s => s.priceData && s.priceData.length > 0)
      .map(s => ({ source: s.source, prices: s.priceData! }));
    
    const blendedPrice = blendPrices(
      consensus.estimatedValue,
      authorityData,
      marketPrices,
      { condition: request.condition }
    );
    
    // 7. Format response
    const processingTime = Date.now() - startTime;
    const response = formatAnalysisResponse(
      analysisId,
      consensus,
      categoryResult.category,
      blendedPrice,
      authorityData,
      processingTime
    );
    
    // 8. Save to Supabase (non-blocking)
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
// HELPER: Create provider from string ID
// =============================================================================

function createProviderFromId(providerId: string) {
  const id = providerId.toLowerCase();
  
  // Lookup config using lowercase key (matches AI_PROVIDERS keys)
  const config = AI_PROVIDERS[id];
  if (!config) {
    throw new Error(`No config for provider: ${providerId}`);
  }
  
  // Display name mapping for ProviderFactory
  const displayNameMap: Record<string, string> = {
    'openai': 'OpenAI',
    'anthropic': 'Anthropic',
    'google': 'Google',
    'deepseek': 'DeepSeek',
    'mistral': 'Mistral',
    'groq': 'Groq',
    'xai': 'xAI',
    'perplexity': 'Perplexity',
  };
  
  const displayName = displayNameMap[id] || config.name;
  
  return ProviderFactory.create({
    id: `${id}-analysis`,
    name: displayName,
    model: config.primaryModel || config.models[0],
    baseWeight: AI_MODEL_WEIGHTS[id as keyof typeof AI_MODEL_WEIGHTS] || config.weight || 1.0,
  });
}

// =============================================================================
// MULTI-AI ANALYSIS ORCHESTRATION
// =============================================================================

async function runMultiAIAnalysis(
  itemName: string,
  images: string[],
  category: string,
  categoryHint?: string
): Promise<ModelVote[]> {
  const votes: ModelVote[] = [];
  const hasImages = images.length > 0;
  
  // Build the analysis prompt
  const systemPrompt = buildAnalysisPrompt({
    categoryHint: categoryHint || category,
    itemNameHint: itemName !== 'Identify this item from the image' ? itemName : undefined,
  });
  
  const userMessage = buildUserMessage(hasImages, itemName);
  const fullPrompt = `${systemPrompt}\n\n${userMessage}`;
  
  // Stage 1: Primary vision models
  const visionProviders = ['openai', 'anthropic', 'google'].filter(isProviderAvailable);
  console.log(`  Stage 1 - Vision: ${visionProviders.join(', ') || 'none'}`);
  
  const visionVotes = await runProviderStage(visionProviders, images, fullPrompt);
  votes.push(...visionVotes);
  
  // Extract best context from vision results
  const bestContext = votes.length > 0
    ? votes.reduce((a, b) => a.weight > b.weight ? a : b).reasoning || itemName
    : itemName;
  
  // Build text-only prompt
  const textPrompt = buildAnalysisPrompt({
    categoryHint: categoryHint || category,
    itemNameHint: bestContext,
    additionalInstructions: 'Note: Analyze based on the provided description. No image available.',
  });
  
  // Stage 2: Text analysis models
  const textProviders = ['mistral', 'groq', 'xai'].filter(isProviderAvailable);
  console.log(`  Stage 2 - Text: ${textProviders.join(', ') || 'none'}`);
  
  const textVotes = await runProviderStage(textProviders, [], textPrompt);
  votes.push(...textVotes);
  
  // Stage 3: Market search (Perplexity)
  if (isProviderAvailable('perplexity')) {
    console.log(`  Stage 3 - Market: perplexity`);
    const marketPrompt = `Search for current market prices and recent sales for: "${bestContext}". Category: ${category}. Provide estimated value based on actual market data.`;
    const perplexityVotes = await runProviderStage(['perplexity'], [], marketPrompt, { isMarketSearch: true });
    votes.push(...perplexityVotes);
  }
  
  // Stage 4: Tiebreaker if needed
  if (votes.length >= 4 && isProviderAvailable('deepseek')) {
    const { shouldTrigger, reason } = shouldTriggerTiebreaker(votes);
    
    if (shouldTrigger) {
      console.log(`  Stage 4 - Tiebreaker: deepseek (${reason})`);
      const tiebreakerPrompt = buildAnalysisPrompt({
        categoryHint: category,
        itemNameHint: bestContext,
        additionalInstructions: 'Previous AI analyses show disagreement. Provide your independent assessment.',
      });
      const tiebreakerVotes = await runProviderStage(['deepseek'], [], tiebreakerPrompt, { isTiebreaker: true });
      votes.push(...tiebreakerVotes);
    }
  }
  
  return votes;
}

async function runProviderStage(
  providers: string[],
  images: string[],
  prompt: string,
  options?: {
    isTiebreaker?: boolean;
    isMarketSearch?: boolean;
  }
): Promise<ModelVote[]> {
  const results = await Promise.allSettled(
    providers.map(async (providerId) => {
      const start = Date.now();
      try {
        const provider = createProviderFromId(providerId);
        const result = await provider.analyze(images, prompt);
        const responseTime = Date.now() - start;
        
        // Get the parsed analysis from the result
        const analysis = result.response;
        
        // Handle case where analysis might be null
        if (!analysis) {
          console.log(`    ✗ ${providerId}: No analysis returned`);
          return null;
        }
        
        // Create provider info object for createVote
        const providerInfo = {
          id: providerId,
          name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
          baseWeight: result.confidence || 0.8,
        };
        
        // Create vote with correct signature: (provider, analysis, confidence, responseTime, options)
        const vote = createVote(
          providerInfo,
          analysis,
          result.confidence || 0.8,
          responseTime,
          options || {}
        );
        
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