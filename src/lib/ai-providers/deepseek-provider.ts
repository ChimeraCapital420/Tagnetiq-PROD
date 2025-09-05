import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra.js';

export class DeepSeekProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      // DeepSeek uses OpenAI-compatible API
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.provider.model || 'deepseek-chat',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...images.map(img => ({
                type: 'image_url',
                image_url: { 
                  url: img,
                  detail: 'high'
                }
              }))
            ]
          }],
          temperature: 0.1,
          max_tokens: 800,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      const parsed = this.parseAnalysisResult(content);
      
      return {
        response: parsed,
        confidence: parsed?.confidence || 0.82,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`DeepSeek analysis error:`, error);
      throw error;
    }
  }
}