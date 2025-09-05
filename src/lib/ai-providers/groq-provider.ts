import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra.js';

export class GroqProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      // Groq doesn't support images directly yet
      const textPrompt = `${prompt}\n\nNote: Performing analysis based on description.`;
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages: [{ role: 'user', content: textPrompt }],
          temperature: 0.1,
          max_tokens: 800,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      const parsed = this.parseAnalysisResult(content);
      
      return {
        response: parsed,
        confidence: parsed?.confidence || 0.75, // Lower confidence without images
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Groq analysis error:`, error);
      throw error;
    }
  }
}