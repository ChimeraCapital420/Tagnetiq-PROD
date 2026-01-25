// FILE: src/lib/hydra/ai/provider-factory.ts
// Factory for creating AI provider instances
// Uses centralized config for initialization

import type { AIProvider } from '../types.js';
import { BaseAIProvider, ProviderConfig } from './base-provider.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';
import { DeepSeekProvider } from './deepseek.js';
import { MistralProvider } from './mistral.js';
import { GroqProvider } from './groq.js';
import { XAIProvider } from './xai.js';
import { PerplexityProvider } from './perplexity.js';
import { getApiKey, AI_PROVIDERS, isProviderAvailable } from '../config/providers.js';
import { AI_MODEL_WEIGHTS } from '../config/constants.js';

// =============================================================================
// PROVIDER FACTORY
// =============================================================================

export class ProviderFactory {
  /**
   * Create a provider instance from config
   */
  static create(config: AIProvider): BaseAIProvider {
    const providerName = config.name.toLowerCase();
    
    // Ensure we have an API key
    const apiKey = config.apiKey || getApiKey(config.name);
    if (!apiKey) {
      throw new Error(`No API key found for provider: ${config.name}`);
    }

    const providerConfig: ProviderConfig = {
      ...config,
      apiKey,
    };

    switch (providerName) {
      case 'openai':
        return new OpenAIProvider(providerConfig);
      
      case 'anthropic':
        return new AnthropicProvider(providerConfig);
      
      case 'google':
        return new GoogleProvider(providerConfig);
      
      case 'deepseek':
        return new DeepSeekProvider(providerConfig);
      
      case 'mistral':
        return new MistralProvider(providerConfig);
      
      case 'groq':
        return new GroqProvider(providerConfig);
      
      case 'xai':
        return new XAIProvider(providerConfig);
      
      case 'perplexity':
        return new PerplexityProvider(providerConfig);
      
      default:
        throw new Error(`Unknown provider: ${config.name}`);
    }
  }

  /**
   * Create all available providers with API keys
   */
  static createAllAvailable(): BaseAIProvider[] {
    const providers: BaseAIProvider[] = [];

    for (const [name, config] of Object.entries(AI_PROVIDERS)) {
      if (!isProviderAvailable(name)) {
        console.warn(`⚠️ ${name}: No API key found, skipping`);
        continue;
      }

      try {
        const provider = this.create({
          id: `${name.toLowerCase()}-auto`,
          name,
          model: config.models[0],
          baseWeight: AI_MODEL_WEIGHTS[name.toLowerCase() as keyof typeof AI_MODEL_WEIGHTS] || 1.0,
        });
        providers.push(provider);
        console.log(`✅ ${name}: Provider initialized`);
      } catch (error) {
        console.error(`❌ ${name}: Failed to create provider:`, error);
      }
    }

    return providers;
  }

  /**
   * Create primary vision providers only (OpenAI, Anthropic, Google)
   */
  static createPrimaryVision(): BaseAIProvider[] {
    const primaryNames = ['OpenAI', 'Anthropic', 'Google'];
    const providers: BaseAIProvider[] = [];

    for (const name of primaryNames) {
      if (!isProviderAvailable(name)) {
        console.warn(`⚠️ ${name}: No API key found, skipping`);
        continue;
      }

      const config = AI_PROVIDERS[name];
      if (!config) continue;

      try {
        const provider = this.create({
          id: `${name.toLowerCase()}-primary`,
          name,
          model: config.models[0],
          baseWeight: AI_MODEL_WEIGHTS[name.toLowerCase() as keyof typeof AI_MODEL_WEIGHTS] || 1.0,
        });
        providers.push(provider);
      } catch (error) {
        console.error(`❌ ${name}: Failed to create primary provider:`, error);
      }
    }

    return providers;
  }

  /**
   * Create tiebreaker provider (DeepSeek)
   */
  static createTiebreaker(): BaseAIProvider | null {
    if (!isProviderAvailable('DeepSeek')) {
      console.warn('⚠️ DeepSeek: No API key found, tiebreaker unavailable');
      return null;
    }

    try {
      const config = AI_PROVIDERS.DeepSeek;
      return this.create({
        id: 'deepseek-tiebreaker',
        name: 'DeepSeek',
        model: config.models[0],
        baseWeight: AI_MODEL_WEIGHTS.deepseek,
      });
    } catch (error) {
      console.error('❌ DeepSeek: Failed to create tiebreaker provider:', error);
      return null;
    }
  }

  /**
   * Check if a provider type is supported
   */
  static isSupported(providerName: string): boolean {
    const supported = ['openai', 'anthropic', 'google', 'deepseek', 'mistral', 'groq', 'xai', 'perplexity'];
    return supported.includes(providerName.toLowerCase());
  }

  /**
   * Get list of all supported provider names
   */
  static getSupportedProviders(): string[] {
    return ['OpenAI', 'Anthropic', 'Google', 'DeepSeek', 'Mistral', 'Groq', 'xAI', 'Perplexity'];
  }

  /**
   * Get provider capabilities
   */
  static getCapabilities(providerName: string): {
    supportsVision: boolean;
    supportsSearch: boolean;
    isTiebreaker: boolean;
    isPrimary: boolean;
    isFastInference: boolean;
  } {
    const name = providerName.toLowerCase();
    
    return {
      supportsVision: ['openai', 'anthropic', 'google'].includes(name),
      supportsSearch: name === 'perplexity',
      isTiebreaker: name === 'deepseek',
      isPrimary: ['openai', 'anthropic', 'google'].includes(name),
      isFastInference: name === 'groq',
    };
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick helper to create a single provider by name
 */
export function createProvider(
  name: string,
  apiKey?: string,
  model?: string
): BaseAIProvider {
  const config = AI_PROVIDERS[name as keyof typeof AI_PROVIDERS];
  if (!config) {
    throw new Error(`Unknown provider: ${name}`);
  }

  return ProviderFactory.create({
    id: `${name.toLowerCase()}-quick`,
    name,
    model: model || config.models[0],
    baseWeight: AI_MODEL_WEIGHTS[name.toLowerCase() as keyof typeof AI_MODEL_WEIGHTS] || 1.0,
    apiKey,
  });
}

/**
 * Get status of all providers
 */
export function getProviderStatus(): Record<string, {
  available: boolean;
  hasApiKey: boolean;
  models: string[];
  supportsVision: boolean;
}> {
  const status: Record<string, any> = {};

  for (const [name, config] of Object.entries(AI_PROVIDERS)) {
    status[name] = {
      available: isProviderAvailable(name),
      hasApiKey: !!getApiKey(name),
      models: config.models,
      supportsVision: config.supportsVision,
    };
  }

  return status;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default ProviderFactory;