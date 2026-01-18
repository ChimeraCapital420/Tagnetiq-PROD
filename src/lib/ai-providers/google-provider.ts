import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra';

export class GoogleProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      // Enhanced prompt with strict JSON enforcement
      const jsonEnforcedPrompt = `IMPORTANT: You must respond with ONLY a valid JSON object. Do not include any markdown formatting, code blocks, or text outside the JSON structure.

${prompt}

Remember: Output ONLY the JSON object, nothing else.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: jsonEnforcedPrompt },
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
              temperature: 0.1,
              candidateCount: 1
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE"
              }
            ]
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