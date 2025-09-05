// NEW FILE: src/lib/ai-providers/perplexity-provider.ts

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
      const enhancedPrompt = `${prompt}\n\nIMPORTANT: Search for recent eBay sold listings and current market prices for this exact item. Include specific sold prices from the last 30 days.`;
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.provider.model || 'llama-3.1-sonar-large-128k-online',
          messages: [{
            role: 'user',
            content: enhancedPrompt
          }],
          temperature: 0.1,
          max_tokens: 800,
          return_citations: true,
          search_recency_filter: 'month' // Recent results only
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      
      // Extract pricing data from Perplexity's response
      const parsed = this.parseAnalysisResult(content);
      
      // Boost confidence if real prices were found
      let confidence = parsed?.confidence || 0.90;
      if (content && content.includes('sold for $')) {
        confidence = Math.min(confidence * 1.15, 0.95);
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