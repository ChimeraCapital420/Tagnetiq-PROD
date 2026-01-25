// FILE: src/lib/hydra/ai/anthropic.ts
// Anthropic Claude Provider for HYDRA
// Primary vision AI with strong reasoning capabilities

import { BaseAIProvider, ProviderConfig } from './base-provider.js';
import type { AIAnalysisResponse } from '../types.js';
import { getApiKey, AI_PROVIDERS } from '../config/providers.js';
import { API_TIMEOUTS, AI_MODEL_WEIGHTS } from '../config/constants.js';

// =============================================================================
// ANTHROPIC PROVIDER
// =============================================================================

export class AnthropicProvider extends BaseAIProvider {
  private static readonly API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
  private static readonly API_VERSION = '2023-06-01';

  constructor(config: ProviderConfig) {
    super(config);
    
    // Try multiple possible environment variable names
    this.apiKey = getApiKey('Anthropic') || config.apiKey;
    
    if (!this.apiKey) {
      console.warn('⚠️ Anthropic: No API key found');
      this.status.hasApiKey = false;
    }
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();

    try {
      // Validate API key (Anthropic keys are typically longer)
      if (!this.validateApiKey(50)) {
        throw new Error('Anthropic API key is missing or too short');
      }

      // Build message content based on whether we have images
      let messages: any[];

      if (images.length > 0) {
        // Vision request with image
        messages = [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: this.cleanBase64Image(images[0]),
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        }];
      } else {
        // Text-only request
        messages = [{ role: 'user', content: prompt }];
      }

      // Make API request
      const response = await this.fetchWithTimeout(
        AnthropicProvider.API_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': AnthropicProvider.API_VERSION,
          },
          body: JSON.stringify({
            model: this.provider.model || AI_PROVIDERS.Anthropic.models[0], // claude-sonnet-4-20250514
            max_tokens: 1024,
            messages,
            temperature: 0.1,
            system: 'You are a valuation expert. Always respond with valid JSON only.',
          }),
        },
        API_TIMEOUTS.anthropic
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Anthropic API error details:', response.status, errorText);
        
        // Specific error handling
        if (response.status === 401) {
          throw new Error('Anthropic API authentication failed - check API key');
        } else if (response.status === 429) {
          throw new Error('Anthropic API rate limit exceeded');
        } else if (response.status === 400) {
          throw new Error(`Anthropic API bad request: ${errorText}`);
        }
        
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const responseText = data.content?.[0]?.text || '';
      const parsed = this.parseAnalysisResult(responseText);

      const responseTime = Date.now() - startTime;
      this.logProviderStatus(true, responseTime);

      return {
        response: parsed,
        confidence: parsed?.confidence || AI_MODEL_WEIGHTS.anthropic,
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
 * Quick analysis using Anthropic without instantiating provider class
 */
export async function analyzeWithAnthropic(
  images: string[],
  prompt: string,
  apiKey?: string
): Promise<AIAnalysisResponse> {
  const key = apiKey || getApiKey('Anthropic');
  if (!key) {
    throw new Error('Anthropic API key not found');
  }

  const provider = new AnthropicProvider({
    id: 'anthropic-standalone',
    name: 'Anthropic',
    model: AI_PROVIDERS.Anthropic.models[0],
    baseWeight: AI_MODEL_WEIGHTS.anthropic,
    apiKey: key,
  });

  return provider.analyze(images, prompt);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default AnthropicProvider;