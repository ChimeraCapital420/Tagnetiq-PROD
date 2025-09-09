// FILE: src/lib/ai-providers/perplexity-provider.ts

import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra.js';

export class PerplexityProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      // Perplexity specializes in real-time web search
      // Enhance the prompt to specifically search for market prices
      const enhancedPrompt = prompt.includes('eBay') || prompt.includes('market') 
        ? prompt 
        : `${prompt}\n\nIMPORTANT: Search for recent eBay sold listings, current Amazon prices, StockX prices, and other marketplace data for this exact item. Include specific prices from the last 30 days with dates. Look for completed/sold listings on eBay to determine actual market value, not just asking prices.`;
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online', // Updated to valid model
          messages: [{
            role: 'system',
            content: 'You are a market research assistant. Always search for recent sold prices on eBay, current retail prices, and provide specific examples with dates. Focus on actual sold prices, not listing prices. Respond with a JSON object containing: itemName, estimatedValue (as a number), decision (BUY or SELL), valuation_factors (array of 5 factors), summary_reasoning, and confidence (0-1).'
          }, {
            role: 'user',
            content: enhancedPrompt
          }],
          temperature: 0.1,
          max_tokens: 1000,
          return_citations: true,
          search_domain_filter: ['ebay.com', 'amazon.com', 'stockx.com', 'goat.com', 'mercari.com'],
          search_recency_filter: 'month' // Only recent results
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(`Perplexity API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      
      // Look for specific price patterns in the response
      let hasRealPrices = false;
      if (content) {
        // Check if Perplexity found actual sold prices
        const pricePatterns = [
          /sold for \$/i,
          /sold at \$/i,
          /final price.*\$/i,
          /winning bid.*\$/i,
          /completed.*\$/i,
          /\d+ sold.*\$/i
        ];
        hasRealPrices = pricePatterns.some(pattern => pattern.test(content));
      }
      
      // Clean the response before parsing
      let cleanedContent = content;
      if (typeof content === 'string') {
        // Remove any markdown code blocks
        cleanedContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        // Extract JSON if embedded in text
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanedContent = jsonMatch[0];
        }
      }
      
      const parsed = this.parseAnalysisResult(cleanedContent);
      
      // Boost confidence if real market data was found
      let confidence = parsed?.confidence || 0.85;
      if (hasRealPrices) {
        confidence = Math.min(confidence * 1.25, 0.95);
        console.log('💰 Perplexity found real market prices!');
      }
      
      // Log citations if available
      if (data.choices?.[0]?.citations) {
        console.log('📊 Market data sources:', data.choices[0].citations);
      }
      
      return {
        response: parsed,
        confidence,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Perplexity analysis error:`, error);
      throw error;
    }
  }
}