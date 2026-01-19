import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra';

export class AnthropicProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
    // Try multiple possible environment variable names
    this.apiKey = process.env.ANTHROPIC_SECRET || 
                  process.env.ANTHROPIC_API_KEY || 
                  config.apiKey;
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.apiKey || this.apiKey.length < 50) {
        throw new Error('Anthropic API key is missing or too short');
      }
      
      let messages;
      
      if (images.length > 0) {
        messages = [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: images[0].replace(/^data:image\/[a-z]+;base64,/, '')
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }];
      } else {
        messages = [{ role: 'user', content: prompt }];
      }
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', // FIXED: Current working Claude Sonnet 4
          max_tokens: 1024,
          messages,
          temperature: 0.1,
          system: 'You are a valuation expert. Always respond with valid JSON only.'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Anthropic API error details:', response.status, errorText);
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const responseText = data.content?.[0]?.text || '';
      const parsed = this.parseAnalysisResult(responseText);
      
      return {
        response: parsed,
        confidence: parsed?.confidence || 0.88,
        responseTime: Date.now() - startTime
      };
    } catch (error: any) {
      console.error('Anthropic analysis error:', error);
      throw error;
    }
  }
}