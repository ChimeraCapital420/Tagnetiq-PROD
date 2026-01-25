// FILE: src/lib/hydra/ai/index.ts
// Main export file for HYDRA AI module
// Re-exports all AI provider components

// =============================================================================
// PARSERS
// =============================================================================
export {
  // Main parser functions
  parseAnalysisResponse,
  parsePerplexityResponse,
  
  // Helper functions
  cleanJsonResponse,
  extractJson,
  isValidAnalysis,
  attemptFieldNameFix,
  normalizeAnalysis,
  normalizeDecision,
  normalizeCategory,
  calculateConfidence,
  extractPrice,
  extractPriceFromText,
  extractValuationFactors,
  attemptJsonFix,
  
  // Constants
  FIELD_MAPPINGS,
  DECISION_MAPPINGS,
  
  // Types
  type ParseResult,
  type ParserOptions,
} from './parsers.js';

// =============================================================================
// BASE PROVIDER
// =============================================================================
export {
  BaseAIProvider,
  type ProviderConfig,
  type ProviderStatus,
} from './base-provider.js';

// =============================================================================
// PROVIDER FACTORY
// =============================================================================
export {
  ProviderFactory,
  createProvider,
  getProviderStatus,
} from './provider-factory.js';

// =============================================================================
// INDIVIDUAL PROVIDERS
// =============================================================================

// OpenAI
export {
  OpenAIProvider,
  analyzeWithOpenAI,
} from './openai.js';

// Anthropic
export {
  AnthropicProvider,
  analyzeWithAnthropic,
} from './anthropic.js';

// Google
export {
  GoogleProvider,
  analyzeWithGoogle,
} from './google.js';

// DeepSeek (Tiebreaker)
export {
  DeepSeekProvider,
  analyzeWithDeepSeek,
  runDeepSeekTiebreaker,
} from './deepseek.js';

// Mistral
export {
  MistralProvider,
  analyzeWithMistral,
} from './mistral.js';

// Groq (Fast Inference)
export {
  GroqProvider,
  analyzeWithGroq,
} from './groq.js';

// xAI (Grok)
export {
  XAIProvider,
  analyzeWithXAI,
} from './xai.js';

// Perplexity (Market Search)
export {
  PerplexityProvider,
  analyzeWithPerplexity,
  searchMarketWithPerplexity,
} from './perplexity.js';

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Run analysis with all available primary vision providers in parallel
 */
export async function runPrimaryAnalysis(
  images: string[],
  prompt: string
): Promise<{
  results: Array<{
    provider: string;
    response: any;
    confidence: number;
    responseTime: number;
    error?: string;
  }>;
  successCount: number;
  failureCount: number;
}> {
  const { ProviderFactory } = await import('./provider-factory.js');
  
  const providers = ProviderFactory.createPrimaryVision();
  
  if (providers.length === 0) {
    throw new Error('No primary vision providers available');
  }

  console.log(`🔍 Running primary analysis with ${providers.length} providers`);

  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      try {
        const result = await provider.analyze(images, prompt);
        return {
          provider: provider.getProvider().name,
          response: result.response,
          confidence: result.confidence,
          responseTime: result.responseTime,
        };
      } catch (error: any) {
        return {
          provider: provider.getProvider().name,
          response: null,
          confidence: 0,
          responseTime: 0,
          error: error.message || 'Unknown error',
        };
      }
    })
  );

  const processedResults = results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      provider: 'Unknown',
      response: null,
      confidence: 0,
      responseTime: 0,
      error: result.reason?.message || 'Promise rejected',
    };
  });

  const successCount = processedResults.filter(r => r.response !== null).length;
  const failureCount = processedResults.filter(r => r.response === null).length;

  return {
    results: processedResults,
    successCount,
    failureCount,
  };
}

/**
 * Quick single-provider analysis with automatic provider selection
 */
export async function quickAnalysis(
  images: string[],
  prompt: string,
  preferredProvider?: string
): Promise<{
  provider: string;
  response: any;
  confidence: number;
  responseTime: number;
}> {
  const { ProviderFactory } = await import('./provider-factory.js');
  const { isProviderAvailable } = await import('../config/providers.js');

  // Try preferred provider first
  if (preferredProvider && isProviderAvailable(preferredProvider)) {
    try {
      const providers = ProviderFactory.createPrimaryVision();
      const provider = providers.find(p => 
        p.getProvider().name.toLowerCase() === preferredProvider.toLowerCase()
      );
      
      if (provider) {
        const result = await provider.analyze(images, prompt);
        return {
          provider: provider.getProvider().name,
          response: result.response,
          confidence: result.confidence,
          responseTime: result.responseTime,
        };
      }
    } catch (error) {
      console.warn(`Preferred provider ${preferredProvider} failed, trying others`);
    }
  }

  // Fall back to first available
  const providers = ProviderFactory.createPrimaryVision();
  
  if (providers.length === 0) {
    throw new Error('No AI providers available');
  }

  for (const provider of providers) {
    try {
      const result = await provider.analyze(images, prompt);
      return {
        provider: provider.getProvider().name,
        response: result.response,
        confidence: result.confidence,
        responseTime: result.responseTime,
      };
    } catch (error) {
      console.warn(`Provider ${provider.getProvider().name} failed:`, error);
      continue;
    }
  }

  throw new Error('All providers failed');
}

// =============================================================================
// MODULE INFO
// =============================================================================

export const AI_MODULE_VERSION = '2.0.0';
export const AI_MODULE_PROVIDERS = [
  'OpenAI',
  'Anthropic', 
  'Google',
  'DeepSeek',
  'Mistral',
  'Groq',
  'xAI',
  'Perplexity',
] as const;

export type SupportedProvider = typeof AI_MODULE_PROVIDERS[number];