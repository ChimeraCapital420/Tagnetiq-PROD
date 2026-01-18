import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra';

export class PerplexityProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      const enhancedPrompt = prompt.includes('eBay') || prompt.includes('market') 
        ? prompt 
        : `${prompt}\n\nIMPORTANT: Search for recent eBay sold listings, current Amazon prices, StockX prices, and other marketplace data for this exact item.`;
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'sonar', // Try the simplest model name
          messages: [{
            role: 'system',
            content: 'You are a market research assistant that outputs ONLY valid JSON. Search for real market prices.'
          }, {
            role: 'user',
            content: enhancedPrompt
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
      const parsed = this.parseAnalysisResult(content);
      
      return {
        response: parsed,
        confidence: parsed?.confidence || 0.85,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Perplexity analysis error:`, error);
      throw error;
    }
  }
}