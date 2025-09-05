import { AIProvider, AIAnalysisResponse, ParsedAnalysis } from '@/types/hydra';

export abstract class BaseAIProvider {
  protected provider: AIProvider;
  protected apiKey: string;
  
  constructor(config: AIProvider) {
    this.provider = config;
    this.apiKey = config.apiKey;
  }
  
  abstract analyze(images: string[], prompt: string): Promise<AIAnalysisResponse>;
  
  protected parseAnalysisResult(rawResult: string | null): ParsedAnalysis | null {
    if (!rawResult) return null;
    
    try {
      const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.valuation_factors && Array.isArray(parsed.valuation_factors) && parsed.summary_reasoning) {
          return {
            ...parsed,
            confidence: parsed.confidence || this.calculateConfidence(parsed)
          };
        }
      }
    } catch (error) {
      console.error(`${this.provider.name} parsing error:`, error);
    }
    
    return null;
  }
  
  private calculateConfidence(analysis: any): number {
    // Base confidence calculation
    let confidence = 0.5;
    
    // Increase confidence based on completeness
    if (analysis.itemName) confidence += 0.1;
    if (analysis.estimatedValue && analysis.estimatedValue > 0) confidence += 0.15;
    if (analysis.valuation_factors?.length >= 3) confidence += 0.15;
    if (analysis.summary_reasoning?.length > 50) confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }
  
  getProvider(): AIProvider {
    return this.provider;
  }
}