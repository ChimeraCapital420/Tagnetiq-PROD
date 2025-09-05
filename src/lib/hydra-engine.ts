import { createClient } from '@supabase/supabase-js';
import { AIProvider, ModelVote, HydraConsensus, ParsedAnalysis } from '@/types/hydra';
import { ProviderFactory } from './ai-providers/provider-factory';
import { BaseAIProvider } from './ai-providers/base-provider';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class HydraEngine {
  private providers: BaseAIProvider[] = [];
  private analysisId: string;
  
  constructor() {
    this.analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async initialize() {
    // Load active providers from database
    const { data: providerConfigs, error } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('is_active', true)
      .order('base_weight', { ascending: false });
    
    if (error) {
      console.error('Failed to load AI providers:', error);
      return;
    }
    
    // Initialize providers with API keys from environment
    this.providers = providerConfigs
      .map(config => {
        const apiKey = this.getApiKey(config.name);
        if (!apiKey) {
          console.warn(`No API key found for ${config.name}`);
          return null;
        }
        
        try {
          return ProviderFactory.create({
            ...config,
            apiKey,
            baseWeight: parseFloat(config.base_weight)
          });
        } catch (error) {
          console.error(`Failed to create provider ${config.name}:`, error);
          return null;
        }
      })
      .filter(Boolean) as BaseAIProvider[];
    
    console.log(`Hydra Engine initialized with ${this.providers.length} providers`);
  }
  
  private getApiKey(providerName: string): string | undefined {
    const keyMap: Record<string, string | undefined> = {
      'OpenAI': process.env.OPENAI_API_KEY || process.env.OPENAI_TOKEN,
      'Anthropic': process.env.ANTHROPIC_SECRET,
      'Google': process.env.GOOGLE_AI_TOKEN,
      'Mistral': process.env.MISTRAL_API_KEY,
      'Groq': process.env.GROQ_API_KEY
    };
    
    return keyMap[providerName];
  }
  
  async analyze(images: string[], prompt: string): Promise<HydraConsensus> {
    const startTime = Date.now();
    
    if (this.providers.length === 0) {
      await this.initialize();
    }
    
    // Execute all AI analyses in parallel
    const analysisPromises = this.providers.map(async (provider) => {
      try {
        const result = await provider.analyze(images, prompt);
        return { provider: provider.getProvider(), result };
      } catch (error) {
        console.error(`${provider.getProvider().name} failed:`, error);
        return null;
      }
    });
    
    // Use Promise.allSettled for fault tolerance
    const results = await Promise.allSettled(analysisPromises);
    
    const votes: ModelVote[] = [];
    const successfulAnalyses: any[] = [];
    
    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value && result.value.result.response) {
        const { provider, result: aiResult } = result.value;
        const analysis = aiResult.response as ParsedAnalysis;
        
        const vote: ModelVote = {
          providerId: provider.id,
          providerName: provider.name,
          itemName: analysis.itemName,
          estimatedValue: parseFloat(analysis.estimatedValue.toString()),
          decision: analysis.decision,
          confidence: aiResult.confidence,
          responseTime: aiResult.responseTime,
          weight: this.calculateWeight(provider, aiResult.confidence),
          rawResponse: analysis
        };
        
        votes.push(vote);
        successfulAnalyses.push(analysis);
        
        // Save vote to database
        this.saveVote(vote);
      }
    }
    
    // Calculate consensus
    const consensus = this.calculateConsensus(votes, successfulAnalyses);
    
    // Save consensus to database
    this.saveConsensus(consensus);
    
    return {
      analysisId: this.analysisId,
      votes,
      consensus,
      processingTime: Date.now() - startTime
    };
  }
  
  private calculateWeight(provider: AIProvider, confidence: number): number {
    // Dynamic weight calculation based on base weight and confidence
    return provider.baseWeight * confidence;
  }
  
  private calculateConsensus(votes: ModelVote[], analyses: ParsedAnalysis[]) {
    if (votes.length === 0) {
      return {
        itemName: 'Unknown Item',
        estimatedValue: 0,
        decision: 'SELL' as const,
        confidence: 0,
        totalVotes: 0,
        analysisQuality: 'FALLBACK' as const
      };
    }
    
    // Weighted average for value
    const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
    const weightedValue = votes.reduce((sum, v) => sum + (v.estimatedValue * v.weight), 0) / totalWeight;
    
    // Weighted decision
    const buyWeight = votes.filter(v => v.decision === 'BUY').reduce((sum, v) => sum + v.weight, 0);
    const decision = buyWeight > totalWeight / 2 ? 'BUY' : 'SELL';
    
    // Consensus confidence calculation
    const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
    const agreementRatio = Math.abs(buyWeight / totalWeight - 0.5) * 2;
    const confidence = Math.round((avgConfidence * 0.7 + agreementRatio * 0.3) * 100);
    
    // Analysis quality
    let analysisQuality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
    if (votes.length >= 4) analysisQuality = 'OPTIMAL';
    else if (votes.length >= 2) analysisQuality = 'DEGRADED';
    else analysisQuality = 'FALLBACK';
    
    // Most common item name
    const nameVotes = votes.reduce((acc, v) => {
      acc[v.itemName] = (acc[v.itemName] || 0) + v.weight;
      return acc;
    }, {} as Record<string, number>);
    const itemName = Object.entries(nameVotes).sort((a, b) => b[1] - a[1])[0][0];
    
    return {
      itemName,
      estimatedValue: parseFloat(weightedValue.toFixed(2)),
      decision: decision as 'BUY' | 'SELL',
      confidence,
      totalVotes: votes.length,
      analysisQuality
    };
  }
  
  private async saveVote(vote: ModelVote) {
    try {
      await supabase.from('ai_votes').insert({
        analysis_id: this.analysisId,
        provider_id: vote.providerId,
        item_name: vote.itemName,
        estimated_value: vote.estimatedValue,
        decision: vote.decision,
        confidence_score: vote.confidence * 100,
        response_time_ms: vote.responseTime,
        raw_response: vote.rawResponse
      });
    } catch (error) {
      console.error('Failed to save vote:', error);
    }
  }
  
  private async saveConsensus(consensus: any) {
    try {
      await supabase.from('consensus_results').insert({
        analysis_id: this.analysisId,
        final_item_name: consensus.itemName,
        final_value: consensus.estimatedValue,
        final_decision: consensus.decision,
        consensus_confidence: consensus.confidence,
        total_votes: consensus.totalVotes
      });
    } catch (error) {
      console.error('Failed to save consensus:', error);
    }
  }
}