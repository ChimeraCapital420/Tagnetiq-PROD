import { BaseAIProvider } from './base-provider.js';
import { AIProvider } from '@/types/hydra';

export class AnthropicProvider extends BaseAIProvider {
  private anthropic: any;
  
  constructor(provider: AIProvider) {
    super(provider);
  }
  
  async initialize() {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    this.anthropic = new Anthropic({ 
      apiKey: this.apiKey, // Use this.apiKey directly
      timeout: 30000,
      maxRetries: 2
    });
  }
  
  async analyze(images: string[], prompt: string) {
    if (!this.anthropic) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    
    try {
      let messages = [];
      
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
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022', // Keep current model for now
        max_tokens: 1024,
        messages,
        temperature: 0.1,
        system: "You are a valuation expert. Always respond with valid JSON only."
      });
      
      const responseText = response.content[0]?.text || '';
      const parsed = this.parseAnalysisResult(responseText);
      
      return {
        response: parsed,
        confidence: parsed?.confidence || 0.88,
        responseTime: Date.now() - startTime
      };
    } catch (error: any) {
      console.error('Anthropic analysis error:', error);
      
      // Better error handling
      if (error.status === 401 || error.message?.includes('invalid')) {
        throw new Error('Anthropic API key is invalid or not properly set');
      }
      
      throw error;
    }
  }
}