// FILE: src/lib/hydra/ai/xai.ts
// xAI Grok Provider for HYDRA
// Elon Musk's AI with real-time knowledge

import { BaseAIProvider, ProviderConfig } from './base-provider.js';
import type { AIAnalysisResponse } from '../types.js';
import { getApiKey, AI_PROVIDERS } from '../config/providers.js';
import { API_TIMEOUTS, AI_MODEL_WEIGHTS } from '../config/constants.js';

// =============================================================================
// XAI PROVIDER
// =============================================================================

export class XAIProvider extends BaseAIProvider {
  private static readonly API_ENDPOINT = 'https://api.x.ai/v1/chat/completions';

  constructor(config: ProviderConfig) {
    super(config);
    
    // Try multiple possible environment variable names
    this.apiKey = getApiKey('xAI') || config.apiKey;
    
    if (!this.apiKey) {
      console.warn('⚠️ xAI: No API key found');
      this.status.hasApiKey = false;
    }
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();

    try {
      if (!this.validateApiKey()) {
        throw new Error('xAI API key is missing');
      }

      // xAI Grok API - enforce JSON output
      const jsonEnforcedPrompt = `${prompt}

IMPORTANT: You must output ONLY a valid JSON object. No other text, no markdown, no code blocks. Just the JSON.`;

      const response = await this.fetchWithTimeout(
        XAIProvider.API_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.provider.model || AI_PROVIDERS.xai?.models?.[0] || 'grok-3',
            messages: [
              {
                role: 'system',
                content: 'You are a JSON-only response assistant. Never output anything except a valid JSON object.',
              },
              {
                role: 'user',
                content: jsonEnforcedPrompt,
              },
            ],
            temperature: 0.1,
            max_tokens: 800,
          }),
        },
        API_TIMEOUTS.xai || API_TIMEOUTS.default
      );

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

      const responseTime = Date.now() - startTime;
      this.logProviderStatus(true, responseTime);

      return {
        response: parsed,
        confidence: parsed?.confidence || AI_MODEL_WEIGHTS.xai || 0.80,
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
 * Quick analysis using xAI without instantiating provider class
 */
export async function analyzeWithXAI(
  images: string[],
  prompt: string,
  apiKey?: string
): Promise<AIAnalysisResponse> {
  const key = apiKey || getApiKey('xAI');
  if (!key) {
    throw new Error('xAI API key not found');
  }

  const provider = new XAIProvider({
    id: 'xai-standalone',
    name: 'xAI',
    model: AI_PROVIDERS.xai?.models?.[0] || 'grok-3',
    baseWeight: AI_MODEL_WEIGHTS.xai || 0.80,
    apiKey: key,
  });

  return provider.analyze(images, prompt);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default XAIProvider;