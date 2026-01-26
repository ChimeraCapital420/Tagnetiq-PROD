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
    let itemName = '';
    
    if (primaryItem.name && !primaryItem.name.startsWith('Photo ') && !primaryItem.name.startsWith('Video ')) {
      itemName = primaryItem.name;
    } else if (primaryItem.metadata?.description) {
      itemName = primaryItem.metadata.description;
    } else if (primaryItem.metadata?.extractedText) {
      itemName = primaryItem.metadata.extractedText.substring(0, 50).trim();
    }
    // If no name, leave empty - AI will identify it
    
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
  
  // itemName can be empty if we have an image - AI will identify it
  return {
    itemName: typeof itemName === 'string' ? itemName.trim() : '',
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
    
    const hasImage = !!request.imageBase64;
    const hasItemName = request.itemName.length > 0;
    
    // Must have either image or item name
    if (!hasImage && !hasItemName) {
      throw new Error('Either an image or item name is required');
    }
    
    console.log(`\n🔥 === HYDRA v6.0 ANALYSIS START ===`);
    console.log(`📦 Item: "${request.itemName || '(will identify from image)'}"`);
    console.log(`🆔 ID: ${analysisId}`);
    console.log(`🖼️ Primary Image: ${hasImage ? 'Yes' : 'No'}`);
    console.log(`🖼️ Additional Images: ${request.additionalImages?.length || 0}`);
    
    // 2. Build images array
    const images: string[] = [];
    if (request.imageBase64) {
      images.push(request.imageBase64);
    }
    if (request.additionalImages) {
      images.push(...request.additionalImages.slice(0, 3));
    }
    
    // ==========================================================================
    // STAGE 1: Primary Vision Analysis (MUST RUN FIRST to identify item)
    // ==========================================================================
    const visionProviders = ['openai', 'anthropic', 'google'].filter(isProviderAvailable);
    console.log(`\n  Stage 1 - Vision: ${visionProviders.join(', ') || 'none'}`);
    
    // Build initial prompt
    const initialPrompt = buildAnalysisPrompt({
      categoryHint: request.categoryHint,
      itemNameHint: hasItemName ? request.itemName : undefined,
    });
    const userMessage = buildUserMessage(hasImage, request.itemName || 'Identify this item');
    const fullPrompt = `${initialPrompt}\n\n${userMessage}`;
    
    const visionVotes = await runProviderStage(visionProviders, images, fullPrompt);
    
    // ==========================================================================
    // EXTRACT IDENTIFIED ITEM NAME FROM VISION RESULTS
    // ==========================================================================
    let identifiedItemName = request.itemName;
    let identifiedCategory = 'general';
    
    if (visionVotes.length > 0) {
      // Get the best vote (highest weight/confidence)
      const bestVote = visionVotes.reduce((a, b) => a.weight > b.weight ? a : b);
      
      // Use the AI-identified item name
      if (bestVote.itemName && bestVote.itemName !== 'Unknown Item') {
        identifiedItemName = bestVote.itemName;
        console.log(`\n  🎯 AI Identified: "${identifiedItemName}"`);
      }
      
      // Check if AI detected a category
      const rawResponse = bestVote.rawResponse as any;
      if (rawResponse?.category && rawResponse.category !== 'general') {
        identifiedCategory = rawResponse.category;
        console.log(`  🏷️ AI Category: ${identifiedCategory}`);
      }
    }
    
    // Fallback if still no name
    if (!identifiedItemName) {
      identifiedItemName = 'Unidentified Item';
    }
    
    // ==========================================================================
    // STAGE 2: Category Detection (using AI-identified item name)
    // ==========================================================================
    const categoryResult = detectItemCategory(identifiedItemName, request.categoryHint || identifiedCategory);
    const finalCategory = categoryResult.category;
    console.log(`\n  🏷️ Final Category: ${finalCategory} (${categoryResult.confidence}%)`);
    
    // ==========================================================================
    // STAGE 3: Parallel - Market Data + Text AI Analysis
    // ==========================================================================
    console.log(`\n  Stage 2 - Market Data + Text Analysis (parallel)`);
    
    // Start market data fetch with IDENTIFIED item name
    const marketPromise = fetchMarketData(identifiedItemName, finalCategory);
    
    // Text analysis models
    const textProviders = ['mistral', 'groq', 'xai'].filter(isProviderAvailable);
    console.log(`    Text providers: ${textProviders.join(', ') || 'none'}`);
    
    // Build text prompt with identified item context
    const textPrompt = buildAnalysisPrompt({
      categoryHint: finalCategory,
      itemNameHint: identifiedItemName,
      additionalInstructions: `The item has been visually identified as: "${identifiedItemName}". Provide your valuation analysis.`,
    });
    
    const textVotesPromise = runProviderStage(textProviders, [], textPrompt);
    
    // Wait for both
    const [marketResult, textVotes] = await Promise.all([marketPromise, textVotesPromise]);
    
    console.log(`    📈 Market sources: ${marketResult.sources.length}`);
    
    // Combine all votes
    const allVotes: ModelVote[] = [...visionVotes, ...textVotes];
    
    // ==========================================================================
    // STAGE 4: Market Search (Perplexity)
    // ==========================================================================
    if (isProviderAvailable('perplexity')) {
      console.log(`\n  Stage 3 - Market Search: perplexity`);
      const marketSearchPrompt = `Find current market prices and recent sales for: "${identifiedItemName}". Category: ${finalCategory}. Provide specific price data from eBay sold listings, auction results, or dealer prices.`;
      const perplexityVotes = await runProviderStage(['perplexity'], [], marketSearchPrompt, { isMarketSearch: true });
      allVotes.push(...perplexityVotes);
    }
    
    // ==========================================================================
    // STAGE 5: Tiebreaker if needed
    // ==========================================================================
    if (allVotes.length >= 4 && isProviderAvailable('deepseek')) {
      const { shouldTrigger, reason } = shouldTriggerTiebreaker(allVotes);
      
      if (shouldTrigger) {
        console.log(`\n  Stage 4 - Tiebreaker: deepseek (${reason})`);
        const tiebreakerPrompt = buildAnalysisPrompt({
          categoryHint: finalCategory,
          itemNameHint: identifiedItemName,
          additionalInstructions: 'Previous AI analyses show disagreement. Provide your independent assessment to help reach consensus.',
        });
        const tiebreakerVotes = await runProviderStage(['deepseek'], [], tiebreakerPrompt, { isTiebreaker: true });
        allVotes.push(...tiebreakerVotes);
      }
    }
    
    console.log(`\n  📊 Total AI Votes: ${allVotes.length}`);
    
    // ==========================================================================
    // STAGE 6: Calculate Consensus
    // ==========================================================================
    const authorityData = marketResult.primaryAuthority || null;
    const consensus = calculateConsensus(allVotes, authorityData);
    
    // Override consensus item name with our identified name
    consensus.itemName = identifiedItemName;
    
    console.log(`  🎯 Decision: ${consensus.decision} @ $${consensus.estimatedValue}`);
    console.log(`  📊 Confidence: ${consensus.confidence}% (${consensus.analysisQuality})`);
    
    // ==========================================================================
    // STAGE 7: Blend Prices
    // ==========================================================================
    const marketPrices = marketResult.sources
      .filter(s => s.priceData && s.priceData.length > 0)
      .map(s => ({ source: s.source, prices: s.priceData! }));
    
    const blendedPrice = blendPrices(
      consensus.estimatedValue,
      authorityData,
      marketPrices,
      { condition: request.condition }
    );
    
    // ==========================================================================
    // STAGE 8: Format Response
    // ==========================================================================
    const processingTime = Date.now() - startTime;
    const response = formatAnalysisResponse(
      analysisId,
      consensus,
      finalCategory,
      blendedPrice,
      authorityData,
      processingTime
    );
    
    // Save to Supabase (non-blocking)
    if (isSupabaseAvailable()) {
      saveAnalysisAsync(analysisId, consensus, finalCategory, request.userId, allVotes, authorityData, processingTime);
    }
    
    console.log(`\n  ✅ Complete in ${processingTime}ms\n`);
    
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
// PROVIDER STAGE RUNNER
// =============================================================================

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
        
        // Create vote with correct signature
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