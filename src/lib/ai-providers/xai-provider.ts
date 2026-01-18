import { BaseAIProvider } from './base-provider.js.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra';

export class XAIProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      // xAI Grok API - update to correct endpoint and model
      const jsonEnforcedPrompt = `${prompt}

IMPORTANT: You must output ONLY a valid JSON object. No other text, no markdown, no code blocks. Just the JSON.`;
      
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'grok-beta', // Updated model name
          messages: [{
            role: 'system',
            content: 'You are a JSON-only response assistant. Never output anything except a valid JSON object.'
          }, { 
            role: 'user', 
            content: jsonEnforcedPrompt 
          }],
          temperature: 0.1,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('xAI API error:', response.status, errorText);
        
        // If xAI is not available, fail gracefully
        if (response.status === 404) {
          console.warn('xAI API endpoint not found - provider may not be available yet');
        }
        
        throw new Error(`xAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      
      // Clean response if needed
      let cleanedContent = content;
      if (typeof content === 'string' && content.includes('```')) {
        cleanedContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      }
      
      const parsed = this.parseAnalysisResult(cleanedContent);
      
      this.logProviderStatus(true, Date.now() - startTime);
      
      return {
        response: parsed,
        confidence: parsed?.confidence || 0.80,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      this.logProviderStatus(false, Date.now() - startTime, error);
      throw error;
    }
  }
}