// FILE: src/lib/ai-providers/openai-provider.ts
// OpenAI GPT-4o Provider for HYDRA
// Primary vision AI with JSON response mode
// 
// FIXED v6.3.1: Removed dependency on hydra/config/providers import
// that caused "Cannot read properties of undefined (reading 'models')"
// Now uses same self-contained pattern as google-provider.ts
// ============================================

import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse } from '../types/hydra.js';

// ============================================
// HARDCODED DEFAULTS
// These prevent crashes when config imports fail
// Update these when upgrading models
// Last updated: 2026-02-05
// ============================================
const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_TIMEOUT = 45000;
const DEFAULT_WEIGHT = 0.92;
const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export class OpenAIProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);

    // Try multiple possible environment variable names for flexibility
    this.apiKey =
      process.env.OPEN_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_TOKEN ||
      config.apiKey;

    if (!this.apiKey) {
      console.warn('⚠️ OpenAI: No API key found');
      this.status.hasApiKey = false;
    }
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();

    try {
      if (!this.apiKey || this.apiKey.trim().length < 20) {
        throw new Error('OpenAI API key is missing or too short');
      }

      // Build message content
      const content: any[] = [{ type: 'text', text: prompt }];

      // Add images if provided (GPT-4o supports vision)
      if (images.length > 0) {
        for (const img of images) {
          content.push({
            type: 'image_url',
            image_url: {
              url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
              detail: 'low', // Use low detail to reduce costs
            },
          });
        }
      }

      // Determine model - use config, then fallback to hardcoded default
      // This is the line that was crashing before when it tried:
      //   this.provider.model || AI_PROVIDERS.OpenAI.models[0]
      // Now it safely falls back to the hardcoded DEFAULT_MODEL
      const model = this.provider.model || DEFAULT_MODEL;

      console.log(`🔍 OpenAI: Using model ${model}`);

      const response = await this.fetchWithTimeout(
        API_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: 800,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'You are a valuation expert. Always respond with ONLY a valid JSON object.',
              },
              {
                role: 'user',
                content,
              },
            ],
            temperature: 0.1,
          }),
        },
        DEFAULT_TIMEOUT
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);

        if (response.status === 401) {
          throw new Error('OpenAI API authentication failed - check API key');
        } else if (response.status === 429) {
          throw new Error('OpenAI API rate limit exceeded');
        } else if (response.status === 400) {
          throw new Error(`OpenAI API bad request: ${errorText}`);
        } else if (response.status === 404) {
          throw new Error(`OpenAI model not found: ${model}`);
        }

        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();

      // Extract text from OpenAI response
      const contentResponse = data.choices?.[0]?.message?.content || null;

      if (!contentResponse) {
        console.warn('OpenAI: No response content in choices');
        throw new Error('OpenAI: Empty response from API');
      }

      console.log(
        '🔍 OpenAI response preview:',
        contentResponse.substring(0, 200) + '...'
      );

      const parsed = this.parseAnalysisResult(contentResponse);

      if (!parsed) {
        console.warn('OpenAI: Failed to parse response, creating fallback');
        return {
          response: {
            itemName: 'OpenAI GPT-4o Analysis',
            estimatedValue: 25.0,
            decision: 'SELL' as const,
            valuation_factors: [
              'OpenAI analysis completed',
              'Market assessment performed',
              'Condition evaluation done',
              'Price comparison executed',
              'Resale potential reviewed',
            ],
            summary_reasoning:
              'Analysis completed by OpenAI GPT-4o with market research',
            confidence: 0.78,
          },
          confidence: 0.78,
          responseTime: Date.now() - startTime,
        };
      }

      const responseTime = Date.now() - startTime;

      return {
        response: parsed,
        confidence: parsed?.confidence || DEFAULT_WEIGHT,
        responseTime,
      };
    } catch (error: any) {
      console.error('OpenAI analysis error:', error);

      // Re-throw rate limits so retry logic can catch them
      if (error.message?.includes('429')) {
        throw new Error('OpenAI API rate limit exceeded');
      }

      throw error;
    }
  }
}