import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra.js';

export class OpenAIProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      // Enhanced prompt with JSON enforcement
      const jsonEnforcedPrompt = `You are a JSON-only response assistant. ${prompt}`;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.provider.model,
          max_tokens: 800,
          response_format: { type: "json_object" },
          messages: [{
            role: 'system',
            content: 'You are a valuation expert. Always respond with ONLY a valid JSON object. Never include markdown formatting or any text outside the JSON structure.'
          }, {
            role: 'user',
            content: [
              { type: 'text', text: jsonEnforcedPrompt },
              ...images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
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
      console.error(`OpenAI analysis error:`, error);
      throw error;
    }
  }
}