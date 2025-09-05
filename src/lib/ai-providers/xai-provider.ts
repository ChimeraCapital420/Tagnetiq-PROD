import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra.js';

export class XAIProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      // xAI Grok API (requires special access)
      // Note: This is speculative as xAI hasn't released public API docs yet
      const textPrompt = `${prompt}\n\nNote: Analyze this item for resale value.`;
      
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.provider.model || 'grok-1',
          messages: [{ 
            role: 'user', 
            content: textPrompt 
          }],
          temperature: 0.1,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        throw new Error(`xAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      const parsed = this.parseAnalysisResult(content);
      
      return {
        response: parsed,
        confidence: parsed?.confidence || 0.80,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`xAI analysis error:`, error);
      throw error;
    }
  }
}