// FILE: src/lib/hydra/ai/perplexity.ts
// Perplexity Provider for HYDRA
// Real-time market search with web knowledge
// Specialized for finding current market prices

import { BaseAIProvider, ProviderConfig } from './base-provider.js';
import type { AIAnalysisResponse, ParsedAnalysis } from '../types.js';
import { getApiKey, AI_PROVIDERS } from '../config/providers.js';
import { API_TIMEOUTS, AI_MODEL_WEIGHTS } from '../config/constants.js';
import { 
  parsePerplexityResponse, 
  extractPriceFromText,
  normalizeDecision,
  extractValuationFactors 
} from './parsers.js';

// =============================================================================
// PERPLEXITY PROVIDER
// =============================================================================

export class PerplexityProvider extends BaseAIProvider {
  private static readonly API_ENDPOINT = 'https://api.perplexity.ai/chat/completions';

  constructor(config: ProviderConfig) {
    super(config);
    
    // Try multiple possible environment variable names
    this.apiKey = getApiKey('Perplexity') || config.apiKey;
    
    if (!this.apiKey) {
      console.warn('⚠️ Perplexity: No API key found');
      this.status.hasApiKey = false;
    }
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();

    try {
      if (!this.validateApiKey()) {
        throw new Error('Perplexity API key is missing');
      }

      // Extract item name from prompt for targeted search
      const itemNameMatch = prompt.match(/identified as[:\s]*"?([^"\n]+)"?/i) ||
                           prompt.match(/for[:\s]*"?([^"\n.]+)"?/i) ||
                           prompt.match(/analyze[:\s]*"?([^"\n.]+)"?/i);
      const searchItem = itemNameMatch?.[1]?.trim() || 'collectible item';

      // Structured prompt that explicitly requests our JSON format
      const structuredPrompt = `Search for current market prices and recent sales data for: "${searchItem}"

Find real sold prices from eBay, Amazon, StockX, or other marketplaces within the last 30-90 days.

You MUST respond with ONLY this exact JSON format (no other text):
{
  "itemName": "${searchItem}",
  "estimatedValue": <average sold price as number>,
  "decision": "<BUY if good deal, SELL if overpriced>",
  "valuation_factors": [
    "Recent eBay sold: $X - $Y range",
    "Amazon price: $Z",
    "Market trend: <rising/stable/falling>",
    "Condition factor: <how condition affects price>",
    "Demand level: <high/medium/low>"
  ],
  "summary_reasoning": "<Brief summary of market data found and price justification>",
  "market_sources": ["source1", "source2"],
  "price_range": {"low": <number>, "high": <number>}
}

CRITICAL: Output ONLY valid JSON. No markdown, no explanations, no citations outside the JSON.`;

      const response = await this.fetchWithTimeout(
        PerplexityProvider.API_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.provider.model || AI_PROVIDERS.perplexity?.models?.[0] || 'sonar',
            messages: [
              {
                role: 'system',
                content: 'You are a market price research API. Output ONLY valid JSON matching the exact schema requested. Never include markdown formatting, citations, or explanatory text outside the JSON object.',
              },
              {
                role: 'user',
                content: structuredPrompt,
              },
            ],
            temperature: 0.1,
            max_tokens: 1200,
          }),
        },
        API_TIMEOUTS.perplexity || API_TIMEOUTS.default
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity API error:', response.status, errorText);
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;

      // Use specialized Perplexity parser from parsers.ts
      const parseResult = parsePerplexityResponse(content, searchItem, {
        providerName: 'Perplexity',
        verbose: true,
      });

      if (parseResult.success && parseResult.data) {
        console.log(`✅ Perplexity: Market data found - $${parseResult.data.estimatedValue}`);
      }

      const responseTime = Date.now() - startTime;
      this.logProviderStatus(parseResult.success, responseTime);

      return {
        response: parseResult.data,
        confidence: parseResult.data ? 0.85 : 0,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.logProviderStatus(false, responseTime, error);
      throw error;
    }
  }

  /**
   * Specialized market search for pricing data
   * More focused than general analysis
   */
  async searchMarketPrices(
    itemName: string,
    category?: string
  ): Promise<{
    averagePrice: number;
    priceRange: { low: number; high: number };
    sources: string[];
    confidence: number;
  } | null> {
    const startTime = Date.now();

    try {
      if (!this.validateApiKey()) {
        return null;
      }

      const categoryContext = category ? ` (category: ${category})` : '';
      const searchPrompt = `Find current market prices for: "${itemName}"${categoryContext}

Search eBay sold listings, Amazon, and other marketplaces. Return ONLY JSON:
{
  "averagePrice": <number>,
  "priceRange": {"low": <number>, "high": <number>},
  "sources": ["eBay", "Amazon"],
  "recentSales": <number of sales found>,
  "marketTrend": "rising|stable|falling"
}`;

      const response = await this.fetchWithTimeout(
        PerplexityProvider.API_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              {
                role: 'system',
                content: 'You are a market price API. Return only valid JSON with no other text.',
              },
              {
                role: 'user',
                content: searchPrompt,
              },
            ],
            temperature: 0.1,
            max_tokens: 500,
          }),
        },
        API_TIMEOUTS.perplexity || 15000
      );

      if (!response.ok) {
        console.warn('Perplexity market search failed:', response.status);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // Parse response
      let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      cleaned = cleaned.replace(/\[\d+\]/g, ''); // Remove citations

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Try to extract price from text
        const price = extractPriceFromText(content);
        if (price > 0) {
          return {
            averagePrice: price,
            priceRange: { low: price * 0.8, high: price * 1.2 },
            sources: ['Perplexity search'],
            confidence: 0.6,
          };
        }
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        averagePrice: parsed.averagePrice || 0,
        priceRange: parsed.priceRange || { low: 0, high: 0 },
        sources: parsed.sources || ['Perplexity'],
        confidence: 0.85,
      };
    } catch (error) {
      console.error('Perplexity market search error:', error);
      return null;
    }
  }
}

// =============================================================================
// STANDALONE FUNCTIONS
// =============================================================================

/**
 * Quick analysis using Perplexity without instantiating provider class
 */
export async function analyzeWithPerplexity(
  images: string[],
  prompt: string,
  apiKey?: string
): Promise<AIAnalysisResponse> {
  const key = apiKey || getApiKey('Perplexity');
  if (!key) {
    throw new Error('Perplexity API key not found');
  }

  const provider = new PerplexityProvider({
    id: 'perplexity-standalone',
    name: 'Perplexity',
    model: AI_PROVIDERS.perplexity?.models?.[0] || 'sonar',
    baseWeight: AI_MODEL_WEIGHTS.perplexity || 0.85,
    apiKey: key,
  });

  return provider.analyze(images, prompt);
}

/**
 * Quick market price search
 */
export async function searchMarketWithPerplexity(
  itemName: string,
  category?: string,
  apiKey?: string
): Promise<{
  averagePrice: number;
  priceRange: { low: number; high: number };
  sources: string[];
  confidence: number;
} | null> {
  const key = apiKey || getApiKey('Perplexity');
  if (!key) {
    return null;
  }

  const provider = new PerplexityProvider({
    id: 'perplexity-market',
    name: 'Perplexity',
    model: 'sonar',
    baseWeight: 0.85,
    apiKey: key,
  });

  return provider.searchMarketPrices(itemName, category);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default PerplexityProvider;