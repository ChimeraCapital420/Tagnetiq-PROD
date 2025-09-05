// AI Provider configuration
export interface AIProvider {
  id: string;
  name: string;
  model: string;
  baseWeight: number;
  specialty?: string;
  apiKey: string;
  isActive: boolean;
}

// Individual AI model vote
export interface ModelVote {
  providerId: string;
  providerName: string;
  itemName: string;
  estimatedValue: number;
  decision: 'BUY' | 'SELL';
  confidence: number;
  responseTime: number;
  weight: number;
  rawResponse?: any;
}

// Consensus result from Hydra
export interface HydraConsensus {
  analysisId: string;
  votes: ModelVote[];
  consensus: {
    itemName: string;
    estimatedValue: number;
    decision: 'BUY' | 'SELL';
    confidence: number;
    totalVotes: number;
    analysisQuality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
  };
  processingTime: number;
  authorityData?: any; // THIS LINE WAS MISSING
}

// Analysis request/response types
export interface AIAnalysisResponse {
  response: any;
  confidence: number;
  responseTime: number;
}

export interface ParsedAnalysis {
  itemName: string;
  estimatedValue: string | number;
  decision: 'BUY' | 'SELL';
  valuation_factors: string[];
  summary_reasoning: string;
  confidence?: number;
}