import { AIProvider, AIAnalysisResponse, ParsedAnalysis } from '@/types/hydra.js';

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
      // Enhanced parsing with multiple strategies
      let cleanedResult = rawResult;
      
      // Strategy 1: Clean up common formatting issues
      if (typeof rawResult === 'string') {
        // Remove markdown code blocks
        cleanedResult = cleanedResult.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
        
        // Remove any "Here is the JSON:" type prefixes
        cleanedResult = cleanedResult.replace(/^[^{]*?(?={)/i, '');
        
        // Remove any trailing text after the last }
        const lastBrace = cleanedResult.lastIndexOf('}');
        if (lastBrace > -1) {
          cleanedResult = cleanedResult.substring(0, lastBrace + 1);
        }
        
        // Trim whitespace
        cleanedResult = cleanedResult.trim();
      }
      
      // Strategy 2: Extract JSON from mixed content
      const jsonMatch = cleanedResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResult = jsonMatch[0];
      }
      
      // Strategy 3: Try to parse
      const parsed = JSON.parse(cleanedResult);
      
      // Validate the parsed result has required fields
      if (!this.isValidAnalysis(parsed)) {
        console.warn(`${this.provider.name}: Parsed JSON missing required fields`);
        return null;
      }
      
      // Ensure numeric types
      if (typeof parsed.estimatedValue === 'string') {
        parsed.estimatedValue = parseFloat(parsed.estimatedValue);
      }
      
      // Ensure decision is uppercase
      if (parsed.decision) {
        parsed.decision = parsed.decision.toUpperCase();
      }
      
      // Ensure valuation_factors is an array
      if (!Array.isArray(parsed.valuation_factors)) {
        parsed.valuation_factors = [];
      }
      
      // Add confidence if missing
      if (typeof parsed.confidence !== 'number') {
        parsed.confidence = this.calculateConfidence(parsed);
      }
      
      return parsed;
      
    } catch (error) {
      // Log detailed parsing error for debugging
      console.error(`${this.provider.name} parsing error:`, error);
      console.error(`Raw result sample (first 200 chars): ${rawResult?.substring(0, 200)}...`);
      
      // Try to extract error message if it's an error JSON
      try {
        const errorJson = JSON.parse(rawResult || '{}');
        if (errorJson.error) {
          console.warn(`${this.provider.name} returned error: ${errorJson.error}`);
        }
      } catch (e) {
        // Not an error JSON, ignore
      }
    }
    
    return null;
  }
  
  private isValidAnalysis(obj: any): boolean {
    // Check for required fields
    return (
      obj &&
      typeof obj === 'object' &&
      'itemName' in obj &&
      'estimatedValue' in obj &&
      'decision' in obj &&
      'valuation_factors' in obj &&
      'summary_reasoning' in obj
    );
  }
  
  private calculateConfidence(analysis: any): number {
    // Base confidence calculation
    let confidence = 0.5;
    
    // Increase confidence based on completeness
    if (analysis.itemName && analysis.itemName.length > 3) confidence += 0.1;
    if (analysis.estimatedValue && analysis.estimatedValue > 0) confidence += 0.15;
    if (analysis.valuation_factors?.length >= 3) confidence += 0.15;
    if (analysis.summary_reasoning?.length > 50) confidence += 0.1;
    
    // Check decision validity
    if (['BUY', 'SELL'].includes(analysis.decision?.toUpperCase())) confidence += 0.05;
    
    return Math.min(confidence, 0.95);
  }
  
  getProvider(): AIProvider {
    return this.provider;
  }
  
  // New utility method to help debug provider issues
  protected logProviderStatus(success: boolean, responseTime?: number, error?: any) {
    const status = success ? '✅' : '❌';
    const timeStr = responseTime ? `${responseTime}ms` : 'N/A';
    
    if (success) {
      console.log(`${status} ${this.provider.name} responded in ${timeStr}`);
    } else {
      console.error(`${status} ${this.provider.name} failed:`, error?.message || 'Unknown error');
    }
  }
}