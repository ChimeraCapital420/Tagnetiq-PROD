import { BaseAIProvider } from './base-provider.js.js';
import { AIProvider, AIAnalysisResponse } from '@/types/hydra';

export class MistralProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      // Mistral API doesn't support images directly
      // Use text-only prompt
      const cleanPrompt = prompt.replace(/\n+/g, ' ').trim();
      const systemPrompt = `You are a valuation expert that outputs ONLY valid JSON. Never include any text outside the JSON object. Never use markdown formatting. Just output the raw JSON object.`;
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-medium-latest',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: cleanPrompt }
          ],
          temperature: 0.1,
          max_tokens: 800,
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
      
      const parsed = this.parseResponse(content);
      
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

  protected parseResponse(response: string): any {
    try {
      const cleaned = response.replace(/```json\n?/g, '')
                            .replace(/```\n?/g, '')
                            .trim();
      
      const parsed = JSON.parse(cleaned);
      
      // Validate required fields
      const required = ['itemName', 'estimatedValue', 'decision', 'valuation_factors', 'summary_reasoning'];
      const missing = required.filter(field => !parsed[field]);
      
      if (missing.length > 0) {
        console.warn('Mistral: Parsed JSON missing required fields:', missing);
        
        // Attempt to fix common issues
        if (!parsed.itemName && parsed.item_name) parsed.itemName = parsed.item_name;
        if (!parsed.estimatedValue && parsed.estimated_value) parsed.estimatedValue = parsed.estimated_value;
        if (!parsed.valuation_factors && parsed.factors) parsed.valuation_factors = parsed.factors;
        if (!parsed.summary_reasoning && parsed.summary) parsed.summary_reasoning = parsed.summary;
        
        // Set defaults for still-missing fields
        parsed.itemName = parsed.itemName || 'Unknown Item';
        parsed.estimatedValue = parsed.estimatedValue || 0;
        parsed.decision = parsed.decision || 'SELL';
        parsed.valuation_factors = parsed.valuation_factors || ['Unable to analyze'];
        parsed.summary_reasoning = parsed.summary_reasoning || 'Analysis incomplete';
        parsed.confidence = parsed.confidence || 0.1;
      }
      
      return parsed;
    } catch (error) {
      console.error('Mistral JSON parse error:', error);
      console.error('Raw response:', response);
      
      // Return minimal valid structure
      return {
        itemName: 'Parse Error',
        estimatedValue: 0,
        decision: 'SELL',
        valuation_factors: ['Parsing failed'],
        summary_reasoning: 'Failed to parse Mistral response',
        confidence: 0.1,
        error: true
      };
    }
  }
}