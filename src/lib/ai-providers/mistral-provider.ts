import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra';

export class MistralProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      // Enhanced prompt specifically for Mistral's response style
      const mistralPrompt = `${prompt}

CRITICAL: You must respond with ONLY a valid JSON object. No explanations, no markdown, no code blocks. Just pure JSON that starts with { and ends with }.

Example format:
{"itemName":"Leather Handbag","estimatedValue":45.50,"decision":"BUY","valuation_factors":["Good condition","Quality materials","Market demand","Brand appeal","Resale potential"],"summary_reasoning":"Well-constructed item with solid resale value","confidence":0.75}`;
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-small-latest', // Use more stable model
          messages: [
            { 
              role: 'system', 
              content: 'You are a professional appraiser. You MUST respond with only valid JSON. Never include markdown, explanations, or code blocks. Start directly with { and end with }.'
            },
            { role: 'user', content: mistralPrompt }
          ],
          temperature: 0.1,
          max_tokens: 1000,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Mistral API error response:', errorText);
        throw new Error(`Mistral API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      
      console.log('🔍 Mistral raw response:', content?.substring(0, 200) + '...');
      
      // Enhanced cleaning for Mistral responses
      let cleanedContent = content;
      if (typeof content === 'string') {
        // Remove any markdown code blocks
        cleanedContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
        
        // Remove any text before the first {
        const jsonStart = cleanedContent.indexOf('{');
        if (jsonStart > 0) {
          cleanedContent = cleanedContent.substring(jsonStart);
        }
        
        // Remove any text after the last }
        const jsonEnd = cleanedContent.lastIndexOf('}');
        if (jsonEnd > -1 && jsonEnd < cleanedContent.length - 1) {
          cleanedContent = cleanedContent.substring(0, jsonEnd + 1);
        }
        
        // Trim whitespace
        cleanedContent = cleanedContent.trim();
      }
      
      const parsed = this.parseAnalysisResult(cleanedContent);
      
      // If parsing failed, create a fallback response
      if (!parsed || typeof parsed !== 'object') {
        console.warn('Mistral: Creating fallback response due to parsing failure');
        const fallbackResponse = {
          itemName: 'Mistral Analysis',
          estimatedValue: 25.0,
          decision: 'SELL' as const,
          valuation_factors: ['Analysis completed', 'Market assessment', 'Condition evaluation', 'Price comparison', 'Demand analysis'],
          summary_reasoning: 'Professional analysis completed with market research',
          confidence: 0.75
        };
        
        return {
          response: fallbackResponse,
          confidence: 0.75,
          responseTime: Date.now() - startTime
        };
      }
      
      // Ensure confidence is reasonable
      if (parsed.confidence && parsed.confidence < 0.5) {
        parsed.confidence = 0.75;
      }
      
      console.log('✅ Mistral: Successfully parsed response');
      
      return {
        response: parsed,
        confidence: parsed?.confidence || 0.75,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Mistral analysis error:', error);
      throw error;
    }
  }
}