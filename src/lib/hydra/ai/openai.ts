// FILE: src/lib/hydra/ai/openai.ts
// OpenAI GPT-4o Provider for HYDRA
// Primary vision AI with JSON response mode

import { BaseAIProvider, ProviderConfig } from './base-provider.js';
import type { AIAnalysisResponse } from '../types.js';
import { getApiKey, AI_PROVIDERS } from '../config/providers.js';
import { API_TIMEOUTS, AI_MODEL_WEIGHTS } from '../config/constants.js';

// =============================================================================
// OPENAI PROVIDER
// =============================================================================

export class OpenAIProvider extends BaseAIProvider {
  private static readonly API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

  constructor(config: ProviderConfig) {
    super(config);
    
    // Try multiple possible environment variable names for flexibility
    this.apiKey = getApiKey('OpenAI') || config.apiKey;
    
    if (!this.apiKey) {
      console.warn('⚠️ OpenAI: No API key found');
      this.status.hasApiKey = false;
    }
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();

    try {
      // Validate API key
      if (!this.validateApiKey(30)) {
        throw new Error('OpenAI API key is missing or invalid');
      }

      // Build message content
      const content: any[] = [
        { type: 'text', text: prompt }
      ];

      // Add images if provided
      if (images.length > 0) {
        for (const img of images) {
          content.push({
            type: 'image_url',
            image_url: {
              url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
              detail: 'low', // Use low detail to reduce costs and rate limits
            },
          });
        }
      }

      // Make API request with retry logic for rate limits
      const response = await this.retryWithBackoff(async () => {
        return await this.fetchWithTimeout(
          OpenAIProvider.API_ENDPOINT,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              model: this.provider.model || AI_PROVIDERS.OpenAI.models[0], // gpt-4o
              max_tokens: 800,
              response_format: { type: 'json_object' }, // Force JSON response
              messages: [
                {
                  role: 'system',
                  content: 'You are a valuation expert. Always respond with ONLY a valid JSON object.',
                },
                {
                  role: 'user',
                  content,
                },
              ],
              temperature: 0.1,
            }),
          },
          API_TIMEOUTS.openai
        );
      }, 2, 1000);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        
        // Specific error handling
        if (response.status === 401) {
          throw new Error('OpenAI API authentication failed - check API key');
        } else if (response.status === 429) {
          throw new Error('OpenAI API rate limit exceeded');
        } else if (response.status === 400) {
          throw new Error(`OpenAI API bad request: ${errorText}`);
        }
        
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content_response = data.choices?.[0]?.message?.content || null;
      const parsed = this.parseAnalysisResult(content_response);

      const responseTime = Date.now() - startTime;
      this.logProviderStatus(true, responseTime);

      return {
        response: parsed,
        confidence: parsed?.confidence || AI_MODEL_WEIGHTS.openai,
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
 * Quick analysis using OpenAI without instantiating provider class
 */
export async function analyzeWithOpenAI(
  images: string[],
  prompt: string,
  apiKey?: string
): Promise<AIAnalysisResponse> {
  const key = apiKey || getApiKey('OpenAI');
  if (!key) {
    throw new Error('OpenAI API key not found');
  }

  const provider = new OpenAIProvider({
    id: 'openai-standalone',
    name: 'OpenAI',
    model: AI_PROVIDERS.OpenAI.models[0],
    baseWeight: AI_MODEL_WEIGHTS.openai,
    apiKey: key,
  });

  return provider.analyze(images, prompt);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default OpenAIProvider;