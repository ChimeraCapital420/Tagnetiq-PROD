import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra';

export class GroqProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      const cleanPrompt = prompt.replace(/\n+/g, ' ').trim();
      const jsonEnforcedPrompt = `${cleanPrompt}

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. Do not include ANY other text, markdown formatting, code blocks, or explanations. The response must be parseable JSON and nothing else.`;
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // Try this current model
          messages: [{
            role: 'system',
            content: 'You are a valuation expert that outputs ONLY valid JSON. Never include any text outside the JSON object. Never use markdown formatting. Just output the raw JSON object.'
          }, {
            role: 'user',
            content: jsonEnforcedPrompt
          }],
          temperature: 0.1,
          max_tokens: 800,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq API error response:', errorText);
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      
      let cleanedContent = content;
      if (typeof content === 'string') {
        cleanedContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const jsonStart = cleanedContent.indexOf('{');
        if (jsonStart > 0) {
          cleanedContent = cleanedContent.substring(jsonStart);
        }
        const jsonEnd = cleanedContent.lastIndexOf('}');
        if (jsonEnd > -1 && jsonEnd < cleanedContent.length - 1) {
          cleanedContent = cleanedContent.substring(0, jsonEnd + 1);
        }
      }
      
      const parsed = this.parseAnalysisResult(cleanedContent);
      
      this.logProviderStatus(true, Date.now() - startTime);
      
      return {
        response: parsed,
        confidence: parsed?.confidence || 0.75,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      this.logProviderStatus(false, Date.now() - startTime, error);
      throw error;
    }
  }
}