// FILE: src/lib/hydra/ai/google.ts
// Google Gemini Provider for HYDRA
// Primary vision AI with multimodal capabilities
//
// v9.1.1: Removed fake fallback name — parsing failure = throw, not fake data

import { BaseAIProvider, ProviderConfig } from './base-provider.js';
import type { AIAnalysisResponse } from '../types.js';
import { getApiKey, AI_PROVIDERS } from '../config/providers.js';
import { API_TIMEOUTS, AI_MODEL_WEIGHTS } from '../config/constants.js';

// =============================================================================
// GOOGLE PROVIDER
// =============================================================================

export class GoogleProvider extends BaseAIProvider {
  private static readonly API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(config: ProviderConfig) {
    super(config);
    
    // Try multiple possible environment variable names
    this.apiKey = getApiKey('Google') || config.apiKey;
    
    if (!this.apiKey) {
      console.warn('⚠️ Google: No API key found');
      this.status.hasApiKey = false;
    }
  }

  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();

    try {
      // Validate API key
      if (!this.validateApiKey(20)) {
        throw new Error('Google API key is missing or too short');
      }

      // Build request body
      const requestBody: any = {
        contents: [{
          parts: [],
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      };

      // Add images (support multiple)
      if (images.length > 0) {
        for (const img of images.slice(0, 4)) {
          const imageData = this.cleanBase64Image(img);
          requestBody.contents[0].parts.push({
            inline_data: {
              mime_type: 'image/jpeg',
              data: imageData,
            },
          });
        }
      }

      // Add text prompt
      requestBody.contents[0].parts.push({
        text: prompt + '\n\nRespond with ONLY valid JSON. No markdown, no backticks, no explanation.',
      });

      // Get model from config
      const model = this.provider.model || AI_PROVIDERS.google.primaryModel || 'gemini-2.0-flash';
      const endpoint = `${GoogleProvider.API_BASE}/${model}:generateContent?key=${this.apiKey}`;

      console.log(`    🔍 Google: Using ${model} model`);

      // Make API request with retry logic for rate limits
      const response = await this.retryWithBackoff(async () => {
        return await this.fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          },
          API_TIMEOUTS.google
        );
      }, 3, 2000); // 3 retries with 2s initial delay

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google API error details:', response.status, errorText);
        
        if (response.status === 429) {
          throw new Error('Gemini API error: 429 - Rate limit exceeded');
        } else if (response.status === 400) {
          throw new Error(`Gemini API error: 400 - ${errorText}`);
        } else if (response.status === 403) {
          throw new Error('Gemini API error: 403 - API key may be invalid or quota exceeded');
        } else if (response.status === 404) {
          throw new Error('Gemini API error: 404 - Model not found');
        }
        
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Extract text from Gemini response
      let responseText = '';
      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          responseText = candidate.content.parts[0].text || '';
        }
        
        // Check for safety blocks
        if (candidate.finishReason === 'SAFETY') {
          console.warn('Google: Response blocked by safety filters');
          throw new Error('Google: Response blocked by safety filters');
        }
      }

      if (!responseText) {
        throw new Error('Google: No valid response received from Gemini API');
      }

      // Clean and parse response
      let cleanedResponse = responseText.trim();
      cleanedResponse = cleanedResponse.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      const parsed = this.parseAnalysisResult(cleanedResponse);

      // v9.1.1: NO MORE FAKE FALLBACK
      // If parsing failed, throw — don't return garbage like "Google Gemini Analysis"
      // The first-responder in identify.ts will handle the failure gracefully
      if (!parsed) {
        console.warn('Google: Failed to parse response, throwing (no fake fallback)');
        console.warn('Google raw (first 200 chars):', cleanedResponse.substring(0, 200));
        throw new Error('Google: Response parsing failed');
      }

      const responseTime = Date.now() - startTime;
      this.logProviderStatus(true, responseTime);

      return {
        response: parsed,
        confidence: parsed?.confidence || AI_MODEL_WEIGHTS.google,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.logProviderStatus(false, responseTime, error);
      
      // Re-throw rate limit errors for retry handling upstream
      if (error.message?.includes('429')) {
        throw new Error('Gemini API error: 429');
      }
      
      throw error;
    }
  }
}

// =============================================================================
// STANDALONE FUNCTION
// =============================================================================

/**
 * Quick analysis using Google Gemini without instantiating provider class
 */
export async function analyzeWithGoogle(
  images: string[],
  prompt: string,
  apiKey?: string
): Promise<AIAnalysisResponse> {
  const key = apiKey || getApiKey('Google');
  if (!key) {
    throw new Error('Google API key not found');
  }

  const provider = new GoogleProvider({
    id: 'google-standalone',
    name: 'Google',
    model: AI_PROVIDERS.google.primaryModel || 'gemini-2.0-flash',
    baseWeight: AI_MODEL_WEIGHTS.google,
    apiKey: key,
  });

  return provider.analyze(images, prompt);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default GoogleProvider;