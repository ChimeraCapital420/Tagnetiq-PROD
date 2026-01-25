// FILE: src/lib/hydra/ai/groq.ts
// Groq Provider for HYDRA
// Ultra-fast inference with Llama models

import { BaseAIProvider, ProviderConfig } from './base-provider.js';
import type { AIAnalysisResponse } from '../types.js';
import { getApiKey, AI_PROVIDERS } from '../config/providers.js';
import { API_TIMEOUTS, AI_MODEL_WEIGHTS } from '../config/constants.js';

// =============================================================================
// GROQ PROVIDER
// =============================================================================

export class GroqProvider extends BaseAIProvider {
  private static readonly API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(config: ProviderConfig) {
    super(config);
    
    // Try multiple possible environment variable names
    this.apiKey = getApiKey('Groq') || config.apiKey;
    
    if (!this.apiKey) {
      console.warn('⚠️ Groq: No API key found');
      this.status.hasApiKey = false;
    }
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();

    try {
      if (!this.validateApiKey()) {
        throw new Error('Groq API key is missing');
      }

      // Clean prompt and enforce JSON output
      const cleanPrompt = prompt.replace(/\n+/g, ' ').trim();
      const jsonEnforcedPrompt = `${cleanPrompt}

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. Do not include ANY other text, markdown formatting, code blocks, or explanations. The response must be parseable JSON and nothing else.`;

      const response = await this.fetchWithTimeout(
        GroqProvider.API_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.provider.model || AI_PROVIDERS.Groq?.models?.[0] || 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: 'You are a valuation expert that outputs ONLY valid JSON. Never include any text outside the JSON object. Never use markdown formatting. Just output the raw JSON object.',
              },
              {
                role: 'user',
                content: jsonEnforcedPrompt,
              },
            ],
            temperature: 0.1,
            max_tokens: 800,
            stream: false,
          }),
        },
        API_TIMEOUTS.groq || API_TIMEOUTS.default
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq API error response:', errorText);
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;

      // Clean content
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

      const responseTime = Date.now() - startTime;
      this.logProviderStatus(true, responseTime);

      return {
        response: parsed,
        confidence: parsed?.confidence || AI_MODEL_WEIGHTS.groq || 0.75,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.logProviderStatus(false, responseTime, error);
      throw error;
    }
  }
}

// =============================================================================
// STANDALONE FUNCTION
// =============================================================================

/**
 * Quick analysis using Groq without instantiating provider class
 */
export async function analyzeWithGroq(
  images: string[],
  prompt: string,
  apiKey?: string
): Promise<AIAnalysisResponse> {
  const key = apiKey || getApiKey('Groq');
  if (!key) {
    throw new Error('Groq API key not found');
  }

  const provider = new GroqProvider({
    id: 'groq-standalone',
    name: 'Groq',
    model: AI_PROVIDERS.Groq?.models?.[0] || 'llama-3.1-8b-instant',
    baseWeight: AI_MODEL_WEIGHTS.groq || 0.75,
    apiKey: key,
  });

  return provider.analyze(images, prompt);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default GroqProvider;