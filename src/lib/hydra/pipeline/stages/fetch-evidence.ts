// FILE: src/lib/hydra/pipeline/stages/fetch-evidence.ts
// HYDRA v9.2 - Stage 2: FETCH EVIDENCE
// Parallel: Authority APIs + Perplexity search + xAI web verify
// Builds evidence summary for Stage 3 reasoning
//
// v9.0: Original
// v9.2: FIXED — Price sanity checks on web search results
//   Perplexity was returning ~$120 for everything (MSRP default).
//   Now: outlier detection, cross-source validation, confidence tagging.
//   Bad prices are flagged (not removed) so Stage 3 can weigh them properly.

import { fetchMarketData } from '../../fetchers/index.js';
import { ProviderFactory } from '../../ai/provider-factory.js';
import { isProviderAvailable } from '../../config/providers.js';
import { AI_MODEL_WEIGHTS } from '../../config/constants.js';
import { createVote } from '../../consensus/voting.js';
import type { ModelVote, ItemCategory } from '../../types.js';
import type { FetchResult, EvidenceSummary, WebSearchResult } from '../types.js';
import { buildFetchPromptPerplexity, buildFetchPromptXai } from '../prompts/fetch-prompt.js';

// =============================================================================
// PRICE SANITY CONSTANTS
// =============================================================================

/** Maximum ratio between web search price and eBay median before flagging */
const MAX_PRICE_DIVERGENCE_RATIO = 3.0;

/** Minimum ratio (web price can't be less than 1/3 of eBay) */
const MIN_PRICE_DIVERGENCE_RATIO = 0.33;

/** Round prices that are suspicious MSRP defaults */
const SUSPICIOUS_DEFAULTS = new Set([100, 110, 120, 125, 130, 150, 200]);

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
 * v9.2: Prices are sanity-checked before reaching Stage 3.
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
  
  // =========================================================================
  // v9.2: PRICE SANITY CHECK
  // Cross-validate web search prices against authority/eBay data.
  // Flag outliers so Stage 3 reasoning can weigh them properly.
  // =========================================================================
  const ebaySource = marketData.sources?.find((s: any) => s.source === 'ebay');
  const ebayMedian = ebaySource?.available ? (ebaySource.priceAnalysis?.median || 0) : 0;
  
  const sanitizedPerplexity = sanitizeWebPrices(perplexityData, 'perplexity', ebayMedian);
  const sanitizedXai = sanitizeWebPrices(xaiData, 'xai', ebayMedian);
  
  // Collect votes from web search providers
  const votes: ModelVote[] = [];
  if (sanitizedPerplexity?.vote) votes.push(sanitizedPerplexity.vote);
  if (sanitizedXai?.vote) votes.push(sanitizedXai.vote);
  
  // Build evidence summary for Stage 3
  const evidenceSummary = buildEvidenceSummary(marketData, sanitizedPerplexity, sanitizedXai);
  
  const stageTime = Date.now() - stageStart;
  
  console.log(`    📊 Market sources: ${marketData.sources?.length || 0}`);
  console.log(`    🔍 Perplexity: ${sanitizedPerplexity ? `${sanitizedPerplexity.prices.length} prices found` : 'unavailable'}`);
  console.log(`    🔍 xAI: ${sanitizedXai ? `${sanitizedXai.prices.length} prices found` : 'unavailable'}`);
  if (ebayMedian > 0) {
    console.log(`    📏 eBay anchor: $${ebayMedian.toFixed(2)} (used for sanity checks)`);
  }
  console.log(`    ⏱️ Stage 2 complete: ${stageTime}ms`);
  
  return {
    marketData,
    perplexityData: sanitizedPerplexity,
    xaiData: sanitizedXai,
    evidenceSummary,
    votes,
    stageTimeMs: stageTime,
  };
}

// =============================================================================
// PRICE SANITY — Cross-validate web search prices
// =============================================================================

/**
 * Check web search prices against eBay anchor data.
 * Flags or removes prices that look like MSRP defaults.
 * Does NOT remove prices — just adjusts confidence so Stage 3 can decide.
 */
function sanitizeWebPrices(
  result: WebSearchResult | null,
  provider: string,
  ebayMedian: number
): WebSearchResult | null {
  if (!result || result.prices.length === 0) return result;
  
  const sanitized = { ...result, prices: [...result.prices] };
  
  for (let i = 0; i < sanitized.prices.length; i++) {
    const price = sanitized.prices[i];
    let flagged = false;
    const flags: string[] = [];
    
    // Check 1: Suspicious round-number default
    if (SUSPICIOUS_DEFAULTS.has(Math.round(price.value))) {
      flags.push('suspicious_round_number');
      flagged = true;
    }
    
    // Check 2: Divergence from eBay anchor (if we have one)
    if (ebayMedian > 0 && price.value > 0) {
      const ratio = price.value / ebayMedian;
      
      if (ratio > MAX_PRICE_DIVERGENCE_RATIO) {
        flags.push(`${(ratio).toFixed(1)}x_above_ebay`);
        flagged = true;
      } else if (ratio < MIN_PRICE_DIVERGENCE_RATIO) {
        flags.push(`${(ratio).toFixed(1)}x_below_ebay`);
        flagged = true;
      }
    }
    
    if (flagged) {
      console.log(`    ⚠️ ${provider} price $${price.value.toFixed(2)} flagged: [${flags.join(', ')}]`);
      // Demote to 'suspect' type so evidence summary can note it
      sanitized.prices[i] = {
        ...price,
        type: 'suspect' as any,
        flags,
      };
    }
  }
  
  // If ALL prices from this provider are flagged, reduce vote confidence
  const allFlagged = sanitized.prices.every((p: any) => p.type === 'suspect');
  if (allFlagged && sanitized.vote) {
    const originalConfidence = sanitized.vote.confidence;
    sanitized.vote = {
      ...sanitized.vote,
      confidence: Math.max(0.3, originalConfidence * 0.5),
    };
    console.log(`    ⚠️ ${provider}: ALL prices flagged — vote confidence reduced from ${originalConfidence.toFixed(2)} to ${sanitized.vote.confidence.toFixed(2)}`);
  }
  
  return sanitized;
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
  
  // Web search prices — v9.2: separate clean vs suspect prices
  const cleanWebPrices: number[] = [];
  const suspectWebPrices: number[] = [];
  const webSources: string[] = [];
  
  if (perplexityData) {
    perplexityData.prices.forEach(p => {
      if ((p as any).type === 'suspect') {
        suspectWebPrices.push(p.value);
      } else {
        cleanWebPrices.push(p.value);
      }
      webSources.push(p.source);
    });
  }
  if (xaiData) {
    xaiData.prices.forEach(p => {
      if ((p as any).type === 'suspect') {
        suspectWebPrices.push(p.value);
      } else {
        cleanWebPrices.push(p.value);
      }
      webSources.push(p.source);
    });
  }
  
  // Only use clean prices for the evidence summary webPrices range
  const allCleanPrices = cleanWebPrices.length > 0 ? cleanWebPrices : [];
  
  const webPrices = allCleanPrices.length > 0 ? {
    low: Math.min(...allCleanPrices),
    high: Math.max(...allCleanPrices),
    sources: [...new Set(webSources)],
  } : null;
  
  // Build formatted evidence string for AI prompts
  const evidenceLines: string[] = [];
  
  if (ebay && ebay.median > 0) {
    evidenceLines.push(`- eBay: median $${ebay.median.toFixed(2)} from ${ebay.listings} sold listings`);
  }
  if (authority) {
    evidenceLines.push(`- ${authority.source} authority: $${authority.price.toFixed(2)}`);
    const details = authority.details;
    if (details.rarity) evidenceLines.push(`  Rarity: ${details.rarity}`);
    if (details.setName) evidenceLines.push(`  Set: ${details.setName}`);
    if (details.year || details.releaseDate) evidenceLines.push(`  Year: ${details.year || details.releaseDate}`);
  }
  
  // v9.2: Only include CLEAN web prices in the evidence summary for reasoning
  // Suspect prices are excluded so they don't pollute Stage 3 analysis
  if (perplexityData && perplexityData.prices.length > 0) {
    const cleanPrices = perplexityData.prices.filter((p: any) => p.type !== 'suspect');
    const suspectPrices = perplexityData.prices.filter((p: any) => p.type === 'suspect');
    
    if (cleanPrices.length > 0) {
      const pPrices = cleanPrices.map(p => `$${p.value.toFixed(2)}`).join(', ');
      evidenceLines.push(`- Perplexity web search: ${pPrices}`);
    }
    if (suspectPrices.length > 0 && cleanPrices.length === 0) {
      // All prices are suspect — note it so AI knows data quality is low
      evidenceLines.push(`- Perplexity web search: prices found but flagged as potentially unreliable (may be retail/MSRP, not resale)`);
    }
  }
  
  if (xaiData && xaiData.prices.length > 0) {
    const cleanPrices = xaiData.prices.filter((p: any) => p.type !== 'suspect');
    
    if (cleanPrices.length > 0) {
      const xPrices = cleanPrices.map(p => `$${p.value.toFixed(2)}`).join(', ');
      evidenceLines.push(`- xAI web verification: ${xPrices}`);
    }
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
  
  // v9.2: Reduce confidence if all web prices were suspect
  if (suspectWebPrices.length > 0 && cleanWebPrices.length === 0) {
    marketConfidence -= 0.1;
  }
  
  return {
    ebay,
    authority,
    webPrices,
    formattedEvidence,
    marketConfidence: Math.min(Math.max(marketConfidence, 0), 1.0),
  };
}