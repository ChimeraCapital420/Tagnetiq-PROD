import { BaseAIProvider } from './base-provider';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra';

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
      
      const jsonEnforcedPrompt = `${enhancedPrompt}

CRITICAL: Output ONLY a valid JSON object with no additional text, markdown, or explanations.`;
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online', // Correct model name
          messages: [{
            role: 'system',
            content: 'You are a market research assistant that outputs ONLY valid JSON. Never include any text outside the JSON object. Always search for recent sold prices on eBay, current retail prices, and provide specific examples with dates. Focus on actual sold prices, not listing prices. The JSON must contain: itemName, estimatedValue (as a number), decision (BUY or SELL), valuation_factors (array of 5 factors), summary_reasoning, and confidence (0-1).'
          }, {
            role: 'user',
            content: jsonEnforcedPrompt
          }],
          temperature: 0.1,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity API error:', response.status, errorText);
        throw new Error(`Perplexity API error: ${response.status}`);
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
        cleanedContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
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
      
      this.logProviderStatus(true, Date.now() - startTime);
      
      return {
        response: parsed,
        confidence,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      this.logProviderStatus(false, Date.now() - startTime, error);
      throw error;
    }
  }
}