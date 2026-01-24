// FILE: src/lib/ai-providers/perplexity-provider.ts
// Perplexity Provider - Real-time market search with custom parsing

import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse, ParsedAnalysis } from '@/types/hydra';

export class PerplexityProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      // Extract item name from prompt for targeted search
      const itemNameMatch = prompt.match(/identified as[:\s]*"?([^"\n]+)"?/i) ||
                           prompt.match(/for[:\s]*"?([^"\n.]+)"?/i);
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

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{
            role: 'system',
            content: 'You are a market price research API. Output ONLY valid JSON matching the exact schema requested. Never include markdown formatting, citations, or explanatory text outside the JSON object.'
          }, {
            role: 'user',
            content: structuredPrompt
          }],
          temperature: 0.1,
          max_tokens: 1200
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity API error:', response.status, errorText);
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      
      // Use custom parser for Perplexity responses
      const parsed = this.parsePerplexityResponse(content, searchItem);
      
      if (parsed) {
        console.log(`✅ Perplexity: Market data found - $${parsed.estimatedValue}`);
      }
      
      return {
        response: parsed,
        confidence: parsed ? 0.85 : 0,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Perplexity analysis error:`, error);
      throw error;
    }
  }
  
  /**
   * Custom parser for Perplexity's market search responses
   * More lenient than the base parser, extracts price data from various formats
   */
  private parsePerplexityResponse(content: string | null, fallbackItemName: string): ParsedAnalysis | null {
    if (!content) return null;
    
    try {
      let cleanedContent = content;
      
      // Remove markdown code blocks
      cleanedContent = cleanedContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      
      // Remove citation markers like [1], [2], etc.
      cleanedContent = cleanedContent.replace(/\[\d+\]/g, '');
      
      // Remove any text before the first {
      const firstBrace = cleanedContent.indexOf('{');
      if (firstBrace > 0) {
        cleanedContent = cleanedContent.substring(firstBrace);
      }
      
      // Remove any text after the last }
      const lastBrace = cleanedContent.lastIndexOf('}');
      if (lastBrace > -1) {
        cleanedContent = cleanedContent.substring(0, lastBrace + 1);
      }
      
      // Try to parse
      const parsed = JSON.parse(cleanedContent.trim());
      
      // Log raw response for debugging
      console.log(`🔍 Perplexity raw response:`, cleanedContent.substring(0, 200) + '...');
      
      // Extract and normalize fields with fallbacks
      const result: ParsedAnalysis = {
        itemName: parsed.itemName || parsed.item_name || parsed.product || fallbackItemName,
        estimatedValue: this.extractPrice(parsed),
        decision: this.normalizeDecision(parsed.decision || parsed.recommendation),
        valuation_factors: this.extractFactors(parsed),
        summary_reasoning: parsed.summary_reasoning || parsed.summary || parsed.reasoning || 
                          parsed.analysis || 'Market data retrieved from online sources.',
        confidence: 0.85
      };
      
      // Validate we got meaningful data
      if (result.estimatedValue <= 0) {
        // Try to extract price from text content
        const priceFromText = this.extractPriceFromText(content);
        if (priceFromText > 0) {
          result.estimatedValue = priceFromText;
        } else {
          console.warn('Perplexity: Could not extract valid price');
          return null;
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('Perplexity parsing error:', error);
      console.error('Raw content sample:', content?.substring(0, 300));
      
      // Last resort: try to extract any price from the text
      const emergencyPrice = this.extractPriceFromText(content || '');
      if (emergencyPrice > 0) {
        console.log(`🔄 Perplexity: Extracted price from text: $${emergencyPrice}`);
        return {
          itemName: fallbackItemName,
          estimatedValue: emergencyPrice,
          decision: 'BUY',
          valuation_factors: [
            'Price extracted from market search',
            'Based on recent listings',
            'Market data partially parsed',
            'Condition affects value',
            'Verify before purchasing'
          ],
          summary_reasoning: 'Price extracted from Perplexity market search results.',
          confidence: 0.6
        };
      }
      
      return null;
    }
  }
  
  /**
   * Extract price from various field formats
   */
  private extractPrice(parsed: any): number {
    // Try various field names
    const priceFields = [
      'estimatedValue', 'estimated_value', 'price', 'value',
      'average_price', 'averagePrice', 'market_price', 'marketPrice',
      'sold_price', 'soldPrice'
    ];
    
    for (const field of priceFields) {
      if (parsed[field] !== undefined) {
        const price = parseFloat(String(parsed[field]).replace(/[$,]/g, ''));
        if (!isNaN(price) && price > 0) {
          return price;
        }
      }
    }
    
    // Try price_range
    if (parsed.price_range) {
      const low = parseFloat(String(parsed.price_range.low || 0).replace(/[$,]/g, ''));
      const high = parseFloat(String(parsed.price_range.high || 0).replace(/[$,]/g, ''));
      if (low > 0 && high > 0) {
        return (low + high) / 2;
      }
    }
    
    return 0;
  }
  
  /**
   * Extract price from unstructured text as last resort
   */
  private extractPriceFromText(text: string): number {
    // Match patterns like $XX.XX, $XXX, sold for $XX, price: $XX, etc.
    const pricePatterns = [
      /sold\s+(?:for\s+)?\$?([\d,]+(?:\.\d{2})?)/gi,
      /price[:\s]+\$?([\d,]+(?:\.\d{2})?)/gi,
      /\$\s*([\d,]+(?:\.\d{2})?)/g,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|dollars?)/gi
    ];
    
    const prices: number[] = [];
    
    for (const pattern of pricePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(price) && price > 0 && price < 1000000) { // Sanity check
          prices.push(price);
        }
      }
    }
    
    if (prices.length > 0) {
      // Return median price to avoid outliers
      prices.sort((a, b) => a - b);
      const mid = Math.floor(prices.length / 2);
      return prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
    }
    
    return 0;
  }
  
  /**
   * Normalize decision field
   */
  private normalizeDecision(decision: string | undefined): 'BUY' | 'SELL' {
    if (!decision) return 'BUY'; // Default for market search
    
    const upper = decision.toUpperCase();
    if (upper.includes('SELL') || upper.includes('PASS') || upper.includes('SKIP') || upper.includes('OVERPRICED')) {
      return 'SELL';
    }
    return 'BUY';
  }
  
  /**
   * Extract valuation factors from various formats
   */
  private extractFactors(parsed: any): string[] {
    const factorFields = ['valuation_factors', 'factors', 'reasons', 'key_factors', 'market_data'];
    
    for (const field of factorFields) {
      if (Array.isArray(parsed[field]) && parsed[field].length > 0) {
        return parsed[field].slice(0, 5);
      }
    }
    
    // Build factors from available data
    const factors: string[] = [];
    
    if (parsed.price_range) {
      factors.push(`Price range: $${parsed.price_range.low} - $${parsed.price_range.high}`);
    }
    if (parsed.market_sources) {
      factors.push(`Sources: ${parsed.market_sources.join(', ')}`);
    }
    if (parsed.market_trend) {
      factors.push(`Market trend: ${parsed.market_trend}`);
    }
    
    // Pad to 5 factors
    while (factors.length < 5) {
      factors.push(`Market factor ${factors.length + 1}`);
    }
    
    return factors.slice(0, 5);
  }
}