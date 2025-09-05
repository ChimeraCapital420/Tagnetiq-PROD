import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra.js';

export class GoogleProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.provider.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                ...images.map(img => ({
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: img.replace(/^data:image\/[a-z]+;base64,/, '')
                  }
                }))
              ]
            }],
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.1
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
      const parsed = this.parseAnalysisResult(content);
      
      return {
        response: parsed,
        confidence: parsed?.confidence || 0.84,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Google analysis error:`, error);
      throw error;
    }
  }
}