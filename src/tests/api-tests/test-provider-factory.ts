import { AIProvider } from '@/types/hydra';

// Minimal provider implementation that doesn't depend on other files
class SimpleProvider {
  private config: AIProvider;
  
  constructor(config: AIProvider) {
    this.config = config;
  }
  
  getProvider() {
    return this.config;
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
  static create(config: AIProvider): SimpleProvider {
    return new SimpleProvider(config);
  }
}