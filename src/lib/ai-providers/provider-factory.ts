import { AIProvider } from '@/types/hydra';
import { BaseAIProvider } from './base-provider';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GoogleProvider } from './google-provider';
import { MistralProvider } from './mistral-provider';
import { GroqProvider } from './groq-provider';
import { DeepSeekProvider } from './deepseek-provider';
import { XAIProvider } from './xai-provider';
import { PerplexityProvider } from './perplexity-provider';

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
      default:
        throw new Error(`Unknown provider: ${config.name}`);
    }
  }
}