// FILE: src/lib/hydra/pipeline/stages/fetch-evidence.ts
// HYDRA v9.0 - Stage 2: FETCH EVIDENCE
// Parallel: Authority APIs + Perplexity search + xAI web verify
// Builds evidence summary for Stage 3 reasoning

import { fetchMarketData } from '../../fetchers/index.js';
import { ProviderFactory } from '../../ai/provider-factory.js';
import { isProviderAvailable } from '../../config/providers.js';
import { AI_MODEL_WEIGHTS } from '../../config/constants.js';
import { createVote } from '../../consensus/voting.js';
import type { ModelVote, ItemCategory } from '../../types.js';
import type { FetchResult, EvidenceSummary, WebSearchResult } from '../types.js';
import { buildFetchPromptPerplexity, buildFetchPromptXai } from '../prompts/fetch-prompt.js';

// =============================================================================
// FETCH EVIDENCE STAGE
// =============================================================================

/**
 * Stage 2: Fetch market evidence
 * Runs three tracks in parallel:
 * 1. Authority APIs (eBay, Pokemon TCG, Numista, etc.)
 * 2. Perplexity web search
 * 3. xAI Grok web verification
 * 
 * Returns combined evidence for Stage 3 reasoning
 */
export async function runFetchStage(
  itemName: string,
  category: ItemCategory,
  additionalContext?: string,
  timeout: number = 10000
): Promise<FetchResult> {
  const stageStart = Date.now();
  
  console.log(`\n  📡 Stage 2 — FETCH EVIDENCE`);
  console.log(`    Item: "${itemName}" | Category: ${category}`);
  
  // Run all three tracks in parallel
  const [marketData, perplexityData, xaiData] = await Promise.all([
    // Track 1: Authority APIs
    fetchMarketData(itemName, category, additionalContext).catch(err => {
      console.error(`    ❌ Market data fetch failed: ${err.message}`);
      return { sources: [], primaryAuthority: null, fetchTime: 0 } as any;
    }),
    
    // Track 2: Perplexity web search
    runWebSearch('perplexity', itemName, category, timeout),
    
    // Track 3: xAI web verification
    runWebSearch('xai', itemName, category, timeout),
  ]);
  
  // Collect votes from web search providers
  const votes: ModelVote[] = [];
  if (perplexityData?.vote) votes.push(perplexityData.vote);
  if (xaiData?.vote) votes.push(xaiData.vote);
  
  // Build evidence summary for Stage 3
  const evidenceSummary = buildEvidenceSummary(marketData, perplexityData, xaiData);
  
  const stageTime = Date.now() - stageStart;
  
  console.log(`    📊 Market sources: ${marketData.sources?.length || 0}`);
  console.log(`    🔍 Perplexity: ${perplexityData ? `${perplexityData.prices.length} prices found` : 'unavailable'}`);
  console.log(`    🔍 xAI: ${xaiData ? `${xaiData.prices.length} prices found` : 'unavailable'}`);
  console.log(`    ⏱️ Stage 2 complete: ${stageTime}ms`);
  
  return {
    marketData,
    perplexityData,
    xaiData,
    evidenceSummary,
    votes,
    stageTimeMs: stageTime,
  };
}

// =============================================================================
// WEB SEARCH RUNNER
// =============================================================================

async function runWebSearch(
  providerId: string,
  itemName: string,
  category: ItemCategory,
  timeout: number
): Promise<WebSearchResult | null> {
  if (!isProviderAvailable(providerId)) {
    return null;
  }
  
  const start = Date.now();
  
  try {
    const provider = ProviderFactory.create({
      id: `${providerId}-fetch`,
      name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
      model: undefined as any,
      baseWeight: AI_MODEL_WEIGHTS[providerId as keyof typeof AI_MODEL_WEIGHTS] || 0.8,
    });
    
    // Build role-specific prompt
    const prompt = providerId === 'perplexity'
      ? buildFetchPromptPerplexity(itemName, category)
      : buildFetchPromptXai(itemName, category);
    
    // Race against timeout
    const result = await Promise.race([
      provider.analyze([], prompt),
      new Promise<null>((resolve) => setTimeout(() => {
        console.log(`    ⏱️ ${providerId} web search timed out`);
        resolve(null);
      }, timeout))
    ]);
    
    if (!result || !result.response) return null;
    
    const responseTime = Date.now() - start;
    
    // Create vote for benchmark tracking
    const vote = createVote(
      { id: providerId, name: providerId, baseWeight: result.confidence || 0.8 },
      result.response,
      result.confidence || 0.8,
      responseTime,
      { isMarketSearch: true }
    );
    
    // Extract price data from the AI's response
    const prices = extractPricesFromResponse(result.response, providerId);
    
    return {
      provider: providerId,
      prices,
      vote,
    };
    
  } catch (error: any) {
    console.log(`    ✗ ${providerId} web search: ${error.message}`);
    return null;
  }
}

// =============================================================================
// PRICE EXTRACTION FROM AI RESPONSES
// =============================================================================

function extractPricesFromResponse(
  response: any,
  provider: string
): WebSearchResult['prices'] {
  const prices: WebSearchResult['prices'] = [];
  
  // Extract the estimated value as a price point
  if (response.estimatedValue && response.estimatedValue > 0) {
    prices.push({
      value: response.estimatedValue,
      source: provider,
      type: 'estimate',
    });
  }
  
  // Check for structured price data in additionalDetails
  if (response.additionalDetails) {
    const details = response.additionalDetails;
    
    // Common price fields from web search responses
    if (details.averagePrice) prices.push({ value: details.averagePrice, source: `${provider}/average`, type: 'estimate' });
    if (details.medianPrice) prices.push({ value: details.medianPrice, source: `${provider}/median`, type: 'sold' });
    if (details.recentSold) {
      const soldPrices = Array.isArray(details.recentSold) ? details.recentSold : [details.recentSold];
      soldPrices.forEach((p: any) => {
        const val = typeof p === 'number' ? p : p?.price;
        if (val > 0) prices.push({ value: val, source: `${provider}/sold`, type: 'sold' });
      });
    }
  }
  
  // Parse from valuation factors (Perplexity often includes specific prices)
  if (response.valuationFactors && Array.isArray(response.valuationFactors)) {
    response.valuationFactors.forEach((factor: string) => {
      const priceMatch = factor.match(/\$(\d+(?:\.\d{2})?)/g);
      if (priceMatch) {
        priceMatch.forEach(match => {
          const val = parseFloat(match.replace('$', ''));
          if (val > 0 && !prices.some(p => p.value === val)) {
            prices.push({ value: val, source: `${provider}/factor`, type: 'estimate' });
          }
        });
      }
    });
  }
  
  return prices;
}

// =============================================================================
// EVIDENCE SUMMARY BUILDER
// =============================================================================

function buildEvidenceSummary(
  marketData: any,
  perplexityData: WebSearchResult | null,
  xaiData: WebSearchResult | null
): EvidenceSummary {
  // eBay data
  const ebaySource = marketData.sources?.find((s: any) => s.source === 'ebay');
  const ebay = ebaySource?.available ? {
    median: ebaySource.priceAnalysis?.median || 0,
    listings: ebaySource.totalListings || 0,
    available: true,
  } : null;
  
  // Authority data
  const authoritySource = marketData.sources?.find((s: any) => s.authorityData && s.source !== 'ebay');
  const authority = authoritySource?.authorityData ? {
    source: authoritySource.source,
    price: authoritySource.priceAnalysis?.median || 0,
    details: authoritySource.authorityData.itemDetails || {},
  } : null;
  
  // Web search prices
  const allWebPrices: number[] = [];
  const webSources: string[] = [];
  
  if (perplexityData) {
    perplexityData.prices.forEach(p => { allWebPrices.push(p.value); webSources.push(p.source); });
  }
  if (xaiData) {
    xaiData.prices.forEach(p => { allWebPrices.push(p.value); webSources.push(p.source); });
  }
  
  const webPrices = allWebPrices.length > 0 ? {
    low: Math.min(...allWebPrices),
    high: Math.max(...allWebPrices),
    sources: [...new Set(webSources)],
  } : null;
  
  // Build formatted evidence string for AI prompts
  const evidenceLines: string[] = [];
  
  if (ebay && ebay.median > 0) {
    evidenceLines.push(`- eBay: median $${ebay.median.toFixed(2)} from ${ebay.listings} sold listings`);
  }
  if (authority) {
    evidenceLines.push(`- ${authority.source} authority: $${authority.price.toFixed(2)}`);
    // Add key details
    const details = authority.details;
    if (details.rarity) evidenceLines.push(`  Rarity: ${details.rarity}`);
    if (details.setName) evidenceLines.push(`  Set: ${details.setName}`);
    if (details.year || details.releaseDate) evidenceLines.push(`  Year: ${details.year || details.releaseDate}`);
  }
  if (perplexityData && perplexityData.prices.length > 0) {
    const pPrices = perplexityData.prices.map(p => `$${p.value.toFixed(2)}`).join(', ');
    evidenceLines.push(`- Perplexity web search: ${pPrices}`);
  }
  if (xaiData && xaiData.prices.length > 0) {
    const xPrices = xaiData.prices.map(p => `$${p.value.toFixed(2)}`).join(', ');
    evidenceLines.push(`- xAI web verification: ${xPrices}`);
  }
  if (marketData.blendedPrice?.value > 0) {
    evidenceLines.push(`- HYDRA blended market price: $${marketData.blendedPrice.value.toFixed(2)} (${marketData.blendedPrice.method})`);
  }
  
  const formattedEvidence = evidenceLines.length > 0
    ? `MARKET EVIDENCE:\n${evidenceLines.join('\n')}`
    : 'MARKET EVIDENCE:\n- No market data available. Use your best judgment based on category and condition.';
  
  // Calculate market confidence
  let marketConfidence = 0;
  if (ebay && ebay.listings >= 10) marketConfidence += 0.4;
  else if (ebay && ebay.listings >= 3) marketConfidence += 0.2;
  if (authority) marketConfidence += 0.3;
  if (webPrices) marketConfidence += 0.2;
  if (marketData.blendedPrice?.value > 0) marketConfidence += 0.1;
  
  return {
    ebay,
    authority,
    webPrices,
    formattedEvidence,
    marketConfidence: Math.min(marketConfidence, 1.0),
  };
}