import { createClient } from '@supabase/supabase-js';
import { AIProvider, ModelVote, HydraConsensus, ParsedAnalysis } from '@/types/hydra.js';
import { ProviderFactory } from './ai-providers/provider-factory.js';
import { BaseAIProvider } from './ai-providers/base-provider.js';

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
      'Groq': process.env.GROQ_API_KEY,
      'DeepSeek': process.env.DEEPSEEK_API_KEY,
      'xAI': process.env.XAI_API_KEY,
      'Perplexity': process.env.PERPLEXITY_API_KEY
    };
    
    return keyMap[providerName];
  }
  
  async analyze(images: string[], prompt: string): Promise<HydraConsensus> {
    const startTime = Date.now();
    
    if (this.providers.length === 0) {
      await this.initialize();
    }
    
    // Separate providers by capability
    const imageProviders = this.providers.filter(p => 
      ['OpenAI', 'Anthropic', 'Google', 'DeepSeek'].includes(p.getProvider().name)
    );
    
    const textOnlyProviders = this.providers.filter(p => 
      ['Mistral', 'Groq', 'xAI'].includes(p.getProvider().name)
    );
    
    const searchProviders = this.providers.filter(p => 
      ['Perplexity'].includes(p.getProvider().name)
    );
    
    console.log(`🔍 Stage 1: Running ${imageProviders.length} image-capable AIs...`);
    
    // STAGE 1: Get descriptions from image-capable AIs
    let bestDescription = '';
    let itemName = '';
    const imageAnalysisPromises = imageProviders.map(async (provider) => {
      try {
        const result = await provider.analyze(images, prompt);
        return { provider: provider.getProvider(), result };
      } catch (error) {
        console.error(`${provider.getProvider().name} image analysis failed:`, error);
        return null;
      }
    });
    
    const imageResults = await Promise.allSettled(imageAnalysisPromises);
    
    // Extract best description from image AI results
    const imageVotes: ModelVote[] = [];
    const imageAnalyses: ParsedAnalysis[] = [];
    
    for (const result of imageResults) {
      if (result.status === 'fulfilled' && result.value?.result?.response) {
        const { provider, result: aiResult } = result.value;
        const analysis = aiResult.response as ParsedAnalysis;
        
        // Capture the best description for text-only AIs
        if (!bestDescription && analysis.itemName && analysis.summary_reasoning) {
          bestDescription = `${analysis.itemName}: ${analysis.summary_reasoning}`;
          itemName = analysis.itemName;
        }
        
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
        
        imageVotes.push(vote);
        imageAnalyses.push(analysis);
        
        // Save vote to database
        await this.saveVote(vote);
      }
    }
    
    console.log(`✅ Stage 1 complete: ${imageVotes.length} image AIs voted`);
    
    // STAGE 2: Enhanced prompt for text-only AIs with description
    const enhancedPrompt = bestDescription 
      ? `${prompt}\n\nBased on expert visual analysis by multiple AI systems, this item has been identified as: "${bestDescription}"\n\nPlease provide your valuation analysis for this ${itemName}.`
      : prompt;
    
    console.log(`🔍 Stage 2: Running ${textOnlyProviders.length} text analysis AIs with context...`);
    
    // Run text-only providers with enhanced context
    const textAnalysisPromises = textOnlyProviders.map(async (provider) => {
      try {
        // Text-only providers get empty image array but enhanced prompt
        const result = await provider.analyze([], enhancedPrompt);
        return { provider: provider.getProvider(), result };
      } catch (error) {
        console.error(`${provider.getProvider().name} text analysis failed:`, error);
        return null;
      }
    });
    
    const textResults = await Promise.allSettled(textAnalysisPromises);
    
    // Process text-only results
    const textVotes: ModelVote[] = [];
    const textAnalyses: ParsedAnalysis[] = [];
    
    for (const result of textResults) {
      if (result.status === 'fulfilled' && result.value?.result?.response) {
        const { provider, result: aiResult } = result.value;
        const analysis = aiResult.response as ParsedAnalysis;
        
        const vote: ModelVote = {
          providerId: provider.id,
          providerName: provider.name,
          itemName: analysis.itemName || itemName, // Use identified name if text AI doesn't provide one
          estimatedValue: parseFloat(analysis.estimatedValue.toString()),
          decision: analysis.decision,
          confidence: aiResult.confidence,
          responseTime: aiResult.responseTime,
          weight: this.calculateWeight(provider, aiResult.confidence),
          rawResponse: analysis
        };
        
        textVotes.push(vote);
        textAnalyses.push(analysis);
        
        // Save vote to database
        await this.saveVote(vote);
      }
    }
    
    console.log(`✅ Stage 2 complete: ${textVotes.length} text AIs voted`);
    
    // STAGE 3: Real-time market search (if Perplexity is available)
    const searchVotes: ModelVote[] = [];
    const searchAnalyses: ParsedAnalysis[] = [];
    
    if (searchProviders.length > 0 && itemName) {
      console.log(`🔍 Stage 3: Running ${searchProviders.length} real-time market search...`);
      
      const marketPrompt = `${prompt}\n\nIMPORTANT: Search for recent eBay sold listings, Amazon prices, and current market values for: "${itemName}". Include specific sold prices from the last 30 days with dates and conditions.`;
      
      const searchPromises = searchProviders.map(async (provider) => {
        try {
          const result = await provider.analyze([], marketPrompt);
          return { provider: provider.getProvider(), result };
        } catch (error) {
          console.error(`${provider.getProvider().name} market search failed:`, error);
          return null;
        }
      });
      
      const searchResults = await Promise.allSettled(searchPromises);
      
      for (const result of searchResults) {
        if (result.status === 'fulfilled' && result.value?.result?.response) {
          const { provider, result: aiResult } = result.value;
          const analysis = aiResult.response as ParsedAnalysis;
          
          const vote: ModelVote = {
            providerId: provider.id,
            providerName: provider.name,
            itemName: analysis.itemName || itemName,
            estimatedValue: parseFloat(analysis.estimatedValue.toString()),
            decision: analysis.decision,
            confidence: aiResult.confidence,
            responseTime: aiResult.responseTime,
            weight: this.calculateWeight(provider, aiResult.confidence) * 1.2, // Boost weight for real-time data
            rawResponse: analysis
          };
          
          searchVotes.push(vote);
          searchAnalyses.push(analysis);
          
          // Save vote to database
          await this.saveVote(vote);
        }
      }
      
      console.log(`✅ Stage 3 complete: ${searchVotes.length} market search results`);
    }
    
    // Combine all votes
    const allVotes = [...imageVotes, ...textVotes, ...searchVotes];
    const allAnalyses = [...imageAnalyses, ...textAnalyses, ...searchAnalyses];
    
    console.log(`🎯 Total votes collected: ${allVotes.length} from ${this.providers.length} AI providers`);
    
    // Calculate consensus
    const consensus = this.calculateConsensus(allVotes, allAnalyses);
    
    // Save consensus to database
    await this.saveConsensus(consensus);
    
    return {
      analysisId: this.analysisId,
      votes: allVotes,
      consensus,
      processingTime: Date.now() - startTime
    };
  }
  
  private calculateWeight(provider: AIProvider, confidence: number): number {
    // Dynamic weight calculation based on base weight and confidence
    const baseWeight = provider.baseWeight * confidence;
    
    // Apply specialty bonuses
    if (provider.specialty === 'pricing' && provider.name === 'Perplexity') {
      return baseWeight * 1.3; // 30% bonus for real-time pricing
    }
    
    return baseWeight;
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
    const sellWeight = votes.filter(v => v.decision === 'SELL').reduce((sum, v) => sum + v.weight, 0);
    const decision = buyWeight > sellWeight ? 'BUY' : 'SELL';
    
    // Consensus confidence calculation
    const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
    const agreementRatio = Math.abs(buyWeight / totalWeight - 0.5) * 2;
    const voteDiversity = Math.min(1, votes.length / 7); // Bonus for more AI participation
    const confidence = Math.round((avgConfidence * 0.6 + agreementRatio * 0.3 + voteDiversity * 0.1) * 100);
    
    // Analysis quality based on participating AIs and stages
    let analysisQuality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
    const hasImageAI = votes.some(v => ['OpenAI', 'Anthropic', 'Google', 'DeepSeek'].includes(v.providerName));
    const hasTextAI = votes.some(v => ['Mistral', 'Groq', 'xAI'].includes(v.providerName));
    const hasSearchAI = votes.some(v => ['Perplexity'].includes(v.providerName));
    
    if (votes.length >= 6 && hasImageAI && hasTextAI) {
      analysisQuality = 'OPTIMAL';
    } else if (votes.length >= 3 && hasImageAI) {
      analysisQuality = 'DEGRADED';
    } else {
      analysisQuality = 'FALLBACK';
    }
    
    // Most common item name (weighted by confidence)
    const nameVotes = votes.reduce((acc, v) => {
      const name = v.itemName || 'Unknown Item';
      acc[name] = (acc[name] || 0) + (v.weight * v.confidence);
      return acc;
    }, {} as Record<string, number>);
    
    const sortedNames = Object.entries(nameVotes).sort((a, b) => b[1] - a[1]);
    const itemName = sortedNames.length > 0 ? sortedNames[0][0] : 'Unknown Item';
    
    // Log consensus details for debugging
    console.log(`📊 Consensus: ${itemName} @ $${weightedValue.toFixed(2)} - ${decision} (${confidence}% confidence)`);
    console.log(`   Buy weight: ${buyWeight.toFixed(2)}, Sell weight: ${sellWeight.toFixed(2)}`);
    console.log(`   Quality: ${analysisQuality} with ${votes.length} votes`);
    
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
  
  // Utility method to get provider statistics
  async getProviderStats() {
    const { data, error } = await supabase
      .from('ai_votes')
      .select('provider_id, confidence_score, response_time_ms')
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (error) {
      console.error('Failed to get provider stats:', error);
      return null;
    }
    
    // Calculate average confidence and response time per provider
    const stats = data.reduce((acc, vote) => {
      if (!acc[vote.provider_id]) {
        acc[vote.provider_id] = {
          totalConfidence: 0,
          totalTime: 0,
          count: 0
        };
      }
      
      acc[vote.provider_id].totalConfidence += vote.confidence_score;
      acc[vote.provider_id].totalTime += vote.response_time_ms;
      acc[vote.provider_id].count += 1;
      
      return acc;
    }, {} as Record<string, any>);
    
    // Calculate averages
    Object.keys(stats).forEach(providerId => {
      const s = stats[providerId];
      stats[providerId] = {
        avgConfidence: s.totalConfidence / s.count,
        avgResponseTime: s.totalTime / s.count,
        totalVotes: s.count
      };
    });
    
    return stats;
  }
}