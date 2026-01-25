// FILE: src/lib/hydra/ai/base-provider.ts
// Abstract base class for AI providers
// Updated to use centralized config and parsers

import type { AIProvider, AIAnalysisResponse, ParsedAnalysis } from '../types.js';
import { parseAnalysisResponse } from './parsers.js';
import { API_TIMEOUTS, FEATURE_FLAGS } from '../config/constants.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ProviderConfig extends AIProvider {
  apiKey: string;
}

export interface ProviderStatus {
  name: string;
  isActive: boolean;
  hasApiKey: boolean;
  initialized: boolean;
  error?: string;
  lastResponseTime?: number;
  lastSuccess?: boolean;
}

// =============================================================================
// BASE PROVIDER CLASS
// =============================================================================

export abstract class BaseAIProvider {
  protected provider: AIProvider;
  protected apiKey: string;
  protected status: ProviderStatus;

  constructor(config: ProviderConfig) {
    this.provider = config;
    this.apiKey = config.apiKey;
    this.status = {
      name: config.name,
      isActive: true,
      hasApiKey: !!config.apiKey,
      initialized: true,
    };
  }

  /**
   * Main analysis method - must be implemented by each provider
   * @param images - Array of base64 image strings
   * @param prompt - The analysis prompt
   * @returns Structured analysis response
   */
  abstract analyze(images: string[], prompt: string): Promise<AIAnalysisResponse>;

  /**
   * Parse raw AI response into structured analysis
   * Uses centralized parser from parsers.ts
   */
  protected parseAnalysisResult(rawResult: string | null): ParsedAnalysis | null {
    const result = parseAnalysisResponse(rawResult, {
      providerName: this.provider.name,
      attemptFieldFix: true,
      verbose: FEATURE_FLAGS.debug_mode,
    });

    if (result.success && result.data) {
      return result.data;
    }

    if (FEATURE_FLAGS.debug_mode && result.error) {
      console.warn(`${this.provider.name} parsing failed: ${result.error}`);
    }

    return null;
  }

  /**
   * Get the provider configuration
   */
  getProvider(): AIProvider {
    return this.provider;
  }

  /**
   * Get current provider status
   */
  getStatus(): ProviderStatus {
    return { ...this.status };
  }

  /**
   * Get timeout for this provider's API calls
   */
  protected getTimeout(): number {
    // Check for provider-specific timeout
    const providerKey = this.provider.name.toLowerCase() as keyof typeof API_TIMEOUTS;
    if (API_TIMEOUTS[providerKey]) {
      return API_TIMEOUTS[providerKey];
    }
    return API_TIMEOUTS.default;
  }

  /**
   * Log provider status for debugging
   */
  protected logProviderStatus(success: boolean, responseTime?: number, error?: any): void {
    const status = success ? '✅' : '❌';
    const timeStr = responseTime ? `${responseTime}ms` : 'N/A';

    // Update internal status
    this.status.lastResponseTime = responseTime;
    this.status.lastSuccess = success;

    if (success) {
      console.log(`${status} ${this.provider.name} responded in ${timeStr}`);
    } else {
      console.error(`${status} ${this.provider.name} failed:`, error?.message || 'Unknown error');
      this.status.error = error?.message || 'Unknown error';
    }
  }

  /**
   * Create a fetch request with timeout
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout?: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = timeout || this.getTimeout();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${this.provider.name} request timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  /**
   * Retry request with exponential backoff
   * Useful for rate-limited APIs (Google, OpenAI)
   */
  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Only retry on rate limit errors
        if (error.message?.includes('429') && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * initialDelayMs;
          console.log(`⏳ ${this.provider.name} rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await this.sleep(delay);
          continue;
        }
        
        throw error;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Sleep helper for retry delays
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate API key format
   */
  protected validateApiKey(minLength: number = 20): boolean {
    if (!this.apiKey || this.apiKey.trim().length < minLength) {
      this.status.hasApiKey = false;
      this.status.error = 'API key missing or too short';
      return false;
    }
    return true;
  }

  /**
   * Clean base64 image data (remove data URI prefix if present)
   */
  protected cleanBase64Image(imageData: string): string {
    return imageData.replace(/^data:image\/[a-z]+;base64,/, '');
  }

  /**
   * Build standard error response for fallback scenarios
   */
  protected buildFallbackResponse(
    itemName: string = 'Analysis Unavailable',
    errorContext: string = 'Provider error'
  ): AIAnalysisResponse {
    return {
      response: {
        itemName,
        estimatedValue: 0,
        decision: 'SELL',
        valuation_factors: [
          `Error: ${errorContext}`,
          'Manual review recommended',
          'Try again later',
          'Check provider status',
          'Contact support if persistent',
        ],
        summary_reasoning: `Analysis could not be completed due to: ${errorContext}`,
        confidence: 0,
      },
      confidence: 0,
      responseTime: 0,
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default BaseAIProvider;