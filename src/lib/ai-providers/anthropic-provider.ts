import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra.js';

export class AnthropicProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.provider.model,
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              ...images.map(img => ({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: img.replace(/^data:image\/[a-z]+;base64,/, '')
                }
              })),
              { type: 'text', text: prompt }
            ]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || null;
      const parsed = this.parseAnalysisResult(content);
      
      // Boost confidence for coins if specialty matches
      let confidence = parsed?.confidence || 0.88;
      if (this.provider.specialty === 'coins' && prompt.toLowerCase().includes('coin')) {
        confidence = Math.min(confidence * 1.1, 0.95);
      }
      
      return {
        response: parsed,
        confidence,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Anthropic analysis error:`, error);
      throw error;
    }
  }
}