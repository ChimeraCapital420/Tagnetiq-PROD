// FILE: src/lib/ai-providers/provider-factory.ts
// v2.0: Added Llama 4 and Kimi K2.6

import { AIProvider } from '@/types/hydra';
import { BaseAIProvider } from './base-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { GoogleProvider } from './google-provider.js';
import { MistralProvider } from './mistral-provider.js';
import { GroqProvider } from './groq-provider.js';
import { DeepSeekProvider } from './deepseek-provider.js';
import { XAIProvider } from './xai-provider.js';
import { PerplexityProvider } from './perplexity-provider.js';
import { Llama4Provider } from './llama4-provider.js';
import { KimiProvider } from './kimi-provider.js';

export class ProviderFactory {
  static create(config: AIProvider): BaseAIProvider {
    switch (config.name.toLowerCase()) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'google':
        return new GoogleProvider(config);
      case 'mistral':
        return new MistralProvider(config);
      case 'groq':
        return new GroqProvider(config);
      case 'deepseek':
        return new DeepSeekProvider(config);
      case 'xai':
        return new XAIProvider(config);
      case 'perplexity':
        return new PerplexityProvider(config);
      case 'llama 4':
        return new Llama4Provider(config);
      case 'kimi':
        return new KimiProvider(config);
      default:
        throw new Error(`Unknown provider: ${config.name}`);
    }
  }
}