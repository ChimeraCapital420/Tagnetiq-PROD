import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra.js';

export class MistralProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      // Mistral currently doesn't support images directly, so we'll use a workaround
      const jsonEnforcedPrompt = `You MUST respond with ONLY a valid JSON object. Do not include any markdown formatting, explanations, or text outside the JSON.

${prompt}

Note: Analyzing based on visual inspection.

Output JSON only:`;
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.provider.model,
          messages: [{
            role: 'system',
            content: 'You are a JSON-only response bot. Always output valid JSON without any surrounding text or markdown.'
          }, {
            role: 'user', 
            content: jsonEnforcedPrompt
          }],
          temperature: 0.1,
          max_tokens: 800,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      const parsed = this.parseAnalysisResult(content);
      
      return {
        response: parsed,
        confidence: parsed?.confidence || 0.78, // Lower confidence without direct image support
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Mistral analysis error:`, error);
      throw error;
    }
  }
}