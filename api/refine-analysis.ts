// FILE: api/refine-analysis.ts
// HYDRA Refinement Endpoint v3.0 — Modular Refactor
//
// WHAT CHANGED (v3.0):
//   - Deleted ~400 lines of duplicated API fetch functions
//     (searchNumistaCoins, searchBricksetLego, searchPokemonTCG, etc.)
//     These already exist in src/lib/hydra/fetchers/
//   - Uses fetchMarketData() orchestrator for category-routed API calls
//   - Uses getApiKey() from hydra config instead of inline key getters
//   - Uses buildRefinementPrompt() from hydra prompts module
//   - Perplexity search kept as local utility (not yet a fetcher)
//   - Multi-AI consensus pattern preserved (Anthropic + OpenAI + Google)
//
// ARCHITECTURE:
//   Request → fetchMarketData(itemName, category) → buildPrompt → parallel AI → average → respond

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AnalysisResult } from '../src/types';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── HYDRA Module Imports (the whole point of this refactor) ──
import { getApiKey } from '../src/lib/hydra/config/providers.js';
import { fetchMarketData } from '../src/lib/hydra/fetchers/index.js';
import {
  buildRefinementPrompt,
  calculateValueAdjustment,
} from '../src/lib/hydra/prompts/refinement.js';

// =============================================================================
// AI CLIENT INITIALIZATION (uses existing provider config)
// =============================================================================

const anthropicKey = getApiKey('anthropic');
const openaiKey = getApiKey('openai');
const googleKey = getApiKey('google');

const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;
const genAI = googleKey ? new GoogleGenerativeAI(googleKey) : null;
const googleModel = genAI ? genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' }) : null;

// =============================================================================
// PERPLEXITY (not yet in fetchers — kept local until formalized)
// =============================================================================

async function searchPerplexity(query: string, category: string): Promise<string | null> {
  const apiKey = getApiKey('perplexity') ||
    process.env.PERPLEXITY_API_KEY ||
    process.env.PERPLEXITY_TOKEN ||
    process.env.PPLX_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'pplx-7b-online',
        messages: [
          {
            role: 'system',
            content: 'You are a collectibles valuation expert. Provide current market data and pricing information.',
          },
          {
            role: 'user',
            content: `Find current market prices and recent sales data for: ${query} in the ${category} category. Focus on: recent eBay sold listings, auction results, current retail prices, and condition-based pricing variations.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function safeJsonParse(jsonString: string): any | null {
  try {
    return JSON.parse(jsonString.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch {
    console.error('JSON parsing failed for refinement response');
    return null;
  }
}

// =============================================================================
// REFINEMENT PROMPT (bridges HYDRA market data into AI prompt)
// =============================================================================

function buildRefinePrompt(
  analysis: AnalysisResult,
  refinementText: string,
  marketSources: any[],
  perplexityData: string | null,
  category?: string,
  subcategory?: string,
): string {
  // Use the HYDRA prompt builder for structured context
  const hydraPrompt = buildRefinementPrompt({
    originalAnalysis: {
      itemName: analysis.itemName || '',
      category: category || analysis.category || 'general',
      estimatedValue: analysis.estimatedValue || 0,
      decision: 'BUY',
      confidence: (analysis.confidenceScore || 70) / 100,
      reasoning: analysis.summary_reasoning || '',
    },
    newInformation: {
      userContext: refinementText,
    },
    marketData: marketSources.length > 0
      ? {
          source: marketSources.map(s => s.source).join(', '),
          medianPrice: marketSources[0]?.priceAnalysis?.median,
          totalListings: marketSources[0]?.priceAnalysis?.sampleSize,
        }
      : undefined,
    authorityData: marketSources.find(s => s.authorityData)?.authorityData
      ? {
          source: marketSources.find(s => s.authorityData)!.source,
          itemDetails: marketSources.find(s => s.authorityData)!.authorityData,
          priceData: marketSources.find(s => s.authorityData)?.priceAnalysis
            ? {
                market: marketSources.find(s => s.authorityData)!.priceAnalysis!.median,
              }
            : undefined,
        }
      : undefined,
  });

  // Append raw market data + Perplexity for maximum context
  let fullPrompt = hydraPrompt;

  if (marketSources.length > 0) {
    const sourceSummary = marketSources
      .filter(s => s.available)
      .map(s => ({
        source: s.source,
        priceRange: s.priceAnalysis
          ? `$${s.priceAnalysis.low?.toFixed(2)} – $${s.priceAnalysis.high?.toFixed(2)}`
          : 'N/A',
        median: s.priceAnalysis?.median ? `$${s.priceAnalysis.median.toFixed(2)}` : 'N/A',
        sampleSize: s.priceAnalysis?.sampleSize || 0,
      }));
    fullPrompt += `\n\n=== HYDRA MARKET DATA ===\n${JSON.stringify(sourceSummary, null, 2)}`;
  }

  if (perplexityData) {
    fullPrompt += `\n\n=== CURRENT MARKET INTELLIGENCE ===\n${perplexityData}`;
  }

  // Append output format instructions
  fullPrompt += `

Your Task:
1. Analyze how the new information and market data impact the item's value.
2. For graded items: Grade dramatically affects value (PSA 10 vs 9 = 5-10x for cards, MS67 vs MS65 = 10x+ for coins).
3. Consider market trends from authority data.
4. Factor in rarity and population/census data.
5. Determine a new estimated value as a single number.
6. Create top 5 key valuation factors incorporating market data.
7. Generate a new summary reflecting refinement and market data.

Respond ONLY with valid JSON:
{
  "newValue": <number>,
  "newFactors": ["<factor 1>", "<factor 2>", "<factor 3>", "<factor 4>", "<factor 5>"],
  "newSummary": "<string>"
}`;

  return fullPrompt;
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { original_analysis, refinement_text, category, subcategory } = req.body;

    if (!original_analysis || !refinement_text) {
      return res.status(400).json({ error: 'Missing original_analysis or refinement_text' });
    }

    const analysis: AnalysisResult = original_analysis;
    const searchQuery = analysis.itemName || refinement_text;
    const effectiveCategory = category || analysis.category || 'general';

    console.log(`🔍 Refining: "${searchQuery}" | Category: ${effectiveCategory}/${subcategory || 'none'}`);

    // ── Parallel: HYDRA market data + Perplexity ──────────────────────
    // fetchMarketData handles ALL category routing automatically via
    // CATEGORY_API_MAP → getApisForCategory → individual fetchers
    // This replaces the 400 lines of inline API functions.
    const [marketResult, perplexityData] = await Promise.all([
      fetchMarketData(searchQuery, effectiveCategory).catch(err => {
        console.error('Market data fetch error:', err);
        return { sources: [], primaryAuthority: null };
      }),
      searchPerplexity(searchQuery, effectiveCategory),
    ]);

    const availableSources = marketResult.sources?.filter((s: any) => s.available) || [];
    console.log(`📊 Market data: ${availableSources.length} sources (${availableSources.map((s: any) => s.source).join(', ') || 'none'})`);

    // ── Build prompt using HYDRA prompt builder ──────────────────────
    const prompt = buildRefinePrompt(
      analysis, refinement_text, availableSources, perplexityData, effectiveCategory, subcategory
    );

    // ── Parallel AI consensus ────────────────────────────────────────
    const aiPromises: Promise<any>[] = [];

    if (anthropic) {
      aiPromises.push(
        anthropic.messages
          .create({
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
          })
          .then(r => {
            const text = r.content[0];
            return safeJsonParse('type' in text && text.type === 'text' ? text.text : '');
          })
          .catch(() => null)
      );
    }

    if (openai) {
      aiPromises.push(
        openai.chat.completions
          .create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
          })
          .then(r => safeJsonParse(r.choices[0].message.content!))
          .catch(() => null)
      );
    }

    if (googleModel) {
      aiPromises.push(
        googleModel
          .generateContent(prompt)
          .then(r => safeJsonParse(r.response.text()))
          .catch(() => null)
      );
    }

    if (aiPromises.length === 0) {
      throw new Error('No AI services available. Check API key configuration.');
    }

    const results = await Promise.allSettled(aiPromises);
    const successfulResponses = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value != null)
      .map(r => r.value);

    if (successfulResponses.length === 0) {
      console.error('All AI calls failed:', results);
      throw new Error('Unable to get a valid response from any AI model.');
    }

    // ── Aggregate consensus ──────────────────────────────────────────
    const totalValue = successfulResponses.reduce((acc, curr) => acc + (curr.newValue || 0), 0);
    const averageValue = totalValue / successfulResponses.length;
    const uniqueFactors = [...new Set(successfulResponses.flatMap(r => r.newFactors || []))];
    const newSummary = successfulResponses[0].newSummary ||
      `Value adjusted based on user feedback. ${analysis.summary_reasoning}`;

    const adjustment = calculateValueAdjustment(analysis.estimatedValue || 0, averageValue);
    console.log(`✅ Refinement: $${(analysis.estimatedValue || 0).toFixed(2)} → $${averageValue.toFixed(2)} (${adjustment})`);

    // ── Return updated analysis ──────────────────────────────────────
    return res.status(200).json({
      ...analysis,
      estimatedValue: averageValue,
      valuation_factors: uniqueFactors.slice(0, 5),
      summary_reasoning: newSummary,
    } satisfies AnalysisResult);

  } catch (error) {
    console.error('Error in /api/refine-analysis:', error);
    const msg = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(500).json({ error: 'Internal Server Error', details: msg });
  }
}