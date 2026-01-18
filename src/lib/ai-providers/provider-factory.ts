import { AIProvider } from '@/types/hydra';
import { BaseAIProvider } from './base-provider';

// Simple provider implementations for now
class SimpleProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string) {
    return {
      response: {
        itemName: 'Test Item',
        estimatedValue: 100,
        decision: 'SELL' as const,
        valuation_factors: ['Factor 1', 'Factor 2', 'Factor 3', 'Factor 4', 'Factor 5'],
        summary_reasoning: 'This is a test analysis',
        confidence: 0.8
      },
      confidence: 0.8,
      responseTime: 1000
    };
  }
}

export class ProviderFactory {
  static create(config: AIProvider): BaseAIProvider {
    // For now, return the same simple provider for all types
    return new SimpleProvider(config);
  }
}