// FILE: src/lib/hydra-engine.ts

import { createClient } from '@supabase/supabase-js';
import { AIProvider, ModelVote, HydraConsensus, ParsedAnalysis } from '@/types/hydra.js';
import { ProviderFactory } from './ai-providers/provider-factory.js';
import { BaseAIProvider } from './ai-providers/base-provider.js';
import { AuthorityManager } from './authorities/authority-manager.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ProviderStatus {
  name: string;
  isActive: boolean;
  hasApiKey: boolean;
  initialized: boolean;
  error?: string;
}

export class HydraEngine {
  private providers: BaseAIProvider[] = [];
  private analysisId: string;
  private authorityData?: any;
  private providerStatuses: ProviderStatus[] = [];
  
  constructor() {
    this.analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async initialize() {
    console.log('🔧 Initializing Hydra Engine...');
    
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
    
    console.log(`📋 Found ${providerConfigs?.length || 0} active providers in database`);
    
    // Initialize providers with API keys from environment
    this.providers = [];
    this.providerStatuses = [];
    
    for (const config of providerConfigs || []) {
      const status: ProviderStatus = {
        name: config.name,
        isActive: config.is_active,
        hasApiKey: false,
        initialized: false
      };
      
      const apiKey = this.getApiKey(config.name);
      
      if (!apiKey) {
        console.warn(`⚠️  No API key found for ${config.name} - Provider will be SKIPPED`);
        console.warn(`    Searched for keys: ${this.getSearchedKeys(config.name).join(', ')}`);
        status.error = 'Missing API key';
        this.providerStatuses.push(status);
        continue;
      }
      
      status.hasApiKey = true;
      console.log(`✅ Found API key for ${config.name}`);
      
      try {
        const provider = ProviderFactory.create({
          ...config,
          apiKey,
          baseWeight: parseFloat(config.base_weight)
        });
        
        this.providers.push(provider);
        status.initialized = true;
        console.log(`✅ Successfully initialized ${config.name}`);
      } catch (error) {
        console.error(`❌ Failed to create provider ${config.name}:`, error);
        status.error = error instanceof Error ? error.message : 'Unknown error';
      }
      
      this.providerStatuses.push(status);
    }
    
    console.log(`🚀 Hydra Engine initialized with ${this.providers.length}/${providerConfigs?.length || 0} providers`);
    
    if (this.providers.length === 0) {
      console.error('❌ CRITICAL: No providers were successfully initialized!');
      console.error('   Please check your environment variables for API keys');
    } else if (this.providers.length < 3) {
      console.warn(`⚠️  WARNING: Only ${this.providers.length} providers initialized - consensus quality will be degraded`);
    }
  }
  
  private getSearchedKeys(providerName: string): string[] {
    const keyMap = this.getKeyMap();
    return keyMap[providerName] || [];
  }
  
  private getKeyMap(): Record<string, string[]> {
    return {
      'OpenAI': [
        'OPENAI_API_KEY',
        'OPEN_AI_API_KEY',
        'OPENAI_TOKEN',
        'OPEN_AI_TOKEN',
        'OPENAI_SECRET',
        'OPEN_AI_SECRET',
        'OPENAI_KEY' // Generic fallback
      ],
      'Anthropic': [
        'ANTHROPIC_API_KEY',
        'ANTHROPIC_SECRET',
        'ANTHROPIC_TOKEN',
        'CLAUDE_API_KEY',
        'CLAUDE_SECRET',
        'ANTHROPIC_KEY' // Generic fallback
      ],
      'Google': [
        'GOOGLE_API_KEY',
        'GOOGLE_AI_TOKEN',
        'GOOGLE_AI_KEY',
        'GEMINI_API_KEY',
        'GEMINI_TOKEN',
        'GOOGLE_GEMINI_KEY',
        'GOOGLE_KEY' // Generic fallback
      ],
      'Mistral': [
        'MISTRAL_API_KEY',
        'MISTRAL_TOKEN',
        'MISTRAL_SECRET',
        'MISTRAL_AI_KEY',
        'MISTRAL_KEY' // Generic fallback
      ],
      'Groq': [
        'GROQ_API_KEY',
        'GROQ_TOKEN',
        'GROQ_SECRET',
        'GROQ_CLOUD_KEY',
        'GROQ_KEY' // Generic fallback
      ],
      'DeepSeek': [
        'DEEPSEEK_API_KEY',
        'DEEPSEEK_TOKEN',
        'DEEP_SEEK_API_KEY',
        'DEEP_SEEK_TOKEN',
        'DEEPSEEK_SECRET',
        'DEEPSEEK_KEY' // Generic fallback
      ],
      'xAI': [
        'XAI_API_KEY',
        'XAI_SECRET',
        'XAI_TOKEN',
        'X_AI_API_KEY',
        'X_AI_SECRET',
        'GROK_API_KEY',
        'XAI_KEY' // Generic fallback
      ],
      'Perplexity': [
        'PERPLEXITY_API_KEY',
        'PERPLEXITY_TOKEN',
        'PERPLEXITY_SECRET',
        'PPLX_API_KEY',
        'PPLX_TOKEN',
        'PERPLEXITY_KEY' // Generic fallback
      ],
      'Cohere': [
        'COHERE_API_KEY',
        'COHERE_TOKEN',
        'COHERE_SECRET',
        'CO_API_KEY',
        'COHERE_KEY' // Generic fallback
      ],
      'HuggingFace': [
        'HUGGINGFACE_API_KEY',
        'HUGGING_FACE_API_KEY',
        'HF_API_KEY',
        'HF_TOKEN',
        'HUGGINGFACE_TOKEN',
        'HUGGINGFACE_KEY' // Generic fallback
      ],
      'Replicate': [
        'REPLICATE_API_KEY',
        'REPLICATE_TOKEN',
        'REPLICATE_API_TOKEN',
        'REPLICATE_SECRET',
        'REPLICATE_KEY' // Generic fallback
      ],
      'Together': [
        'TOGETHER_API_KEY',
        'TOGETHER_AI_API_KEY',
        'TOGETHER_TOKEN',
        'TOGETHER_SECRET',
        'TOGETHER_KEY' // Generic fallback
      ]
    };
  }
  
  private getApiKey(providerName: string): string | undefined {
    const keyMap = this.getKeyMap();
    const keys = keyMap[providerName] || [];
    
    // Check each possible key name
    for (const keyName of keys) {
      const value = process.env[keyName];
      if (value && value.trim() !== '') {
        return value;
      }
    }
    
    return undefined;
  }
  
  // New method for health check
  getProviderStatuses(): ProviderStatus[] {
    return this.providerStatuses;
  }
  
  async analyze(images: string[], prompt: string): Promise<HydraConsensus> {
    const startTime = Date.now();
    
    if (this.providers.length === 0) {
      await this.initialize();
    }
    
    // Log which providers were successfully initialized
    console.log(`🚀 Active AI Providers: ${this.providers.map(p => p.getProvider().name).join(', ')}`);
    
    // Separate providers by capability
    const imageProviders = this.providers.filter(p => 
      ['OpenAI', 'Anthropic', 'Google', 'DeepSeek'].includes(p.getProvider().name)
    );
    
    const textOnlyProviders = this.providers.filter(p => 
      ['Mistral', 'Groq', 'xAI', 'Cohere', 'Together'].includes(p.getProvider().name)
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
          rawResponse: analysis,
          success: true
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
          rawResponse: analysis,
          success: true
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
            rawResponse: analysis,
            success: true
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
      processingTime: Date.now() - startTime,
      authorityData: this.authorityData
    };
  }
  
  async analyzeWithAuthority(images: string[], prompt: string, category?: string): Promise<HydraConsensus> {
    // Run standard multi-AI analysis first
    const consensus = await this.analyze(images, prompt);
    
    // Check if it's a book category or if the item name suggests it's a book
    const isBook = category === 'books' || 
                   category === 'media' || 
                   consensus.consensus.itemName.toLowerCase().includes('book') ||
                   consensus.consensus.itemName.toLowerCase().includes('isbn');
    
    if (isBook) {
      console.log('📚 Detected book item, running authority validation...');
      
      const authorityManager = new AuthorityManager();
      
      // Extract text from the best AI description for ISBN detection
      let combinedText = consensus.consensus.itemName;
      if (consensus.votes.length > 0) {
        const bestVote = consensus.votes.reduce((best, vote) => 
          vote.weight > best.weight ? vote : best, consensus.votes[0]
        );
        if (bestVote.rawResponse?.summary_reasoning) {
          combinedText += ' ' + bestVote.rawResponse.summary_reasoning;
        }
      }
      
      const bookData = await authorityManager.validateBook(
        consensus.consensus.itemName,
        combinedText
      );
      
      if (bookData && bookData.verified) {
        // Store authority data for consensus calculation
        this.authorityData = bookData;
        
        // Enhance consensus with authority data
        consensus.authorityData = bookData;
        
        // Recalculate consensus with authority boost
        const enhancedConsensus = this.calculateConsensus(consensus.votes, 
          consensus.votes.map(v => v.rawResponse).filter(Boolean));
        
        // Update consensus values
        consensus.consensus = enhancedConsensus;
        
        // Use authority price data if available and reasonable
        if (bookData.marketValue) {
          const aiValue = consensus.consensus.estimatedValue;
          const authorityValue = bookData.marketValue.good;
          
          // If authority value is within reasonable range of AI estimate, use weighted average
          if (authorityValue > 0 && authorityValue < aiValue * 3 && authorityValue > aiValue * 0.3) {
            consensus.consensus.estimatedValue = parseFloat(
              ((aiValue * 0.6) + (authorityValue * 0.4)).toFixed(2)
            );
          }
        }
        
        console.log(`✅ Book verified by ${bookData.source}`);
        console.log(`   Final Confidence: ${consensus.consensus.confidence}%`);
        console.log(`   ISBN: ${bookData.isbn || 'Not found'}`);
      } else {
        console.log('❌ Could not verify book through authority sources');
      }
    }
    
    return consensus;
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
        analysisQuality: 'FALLBACK' as const,
        consensusMetrics: {
          avgAIConfidence: 0,
          decisionAgreement: 0,
          valueAgreement: 0,
          participationRate: 0,
          authorityVerified: false
        }
      };
    }
    
    // Check for critically low participation
    const criticallyLowVotes = votes.length < 3;
    
    // Weighted average for value
    const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
    const weightedValue = votes.reduce((sum, v) => sum + (v.estimatedValue * v.weight), 0) / totalWeight;
    
    // Weighted decision
    const buyWeight = votes.filter(v => v.decision === 'BUY').reduce((sum, v) => sum + v.weight, 0);
    const sellWeight = votes.filter(v => v.decision === 'SELL').reduce((sum, v) => sum + v.weight, 0);
    const decision = buyWeight > sellWeight ? 'BUY' : 'SELL';
    
    // ENHANCED CONFIDENCE CALCULATION FOR 97%+ TARGET
    const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
    
    // Agreement ratio: How strongly AIs agree (0-1 scale)
    const decisionAgreement = Math.max(buyWeight, sellWeight) / totalWeight;
    
    // Value consensus: How closely values align (using coefficient of variation)
    const values = votes.map(v => v.estimatedValue);
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
    const valueAgreement = Math.max(0, 1 - coefficientOfVariation);
    
    // Vote participation bonus (more AIs = higher confidence)
    const targetAICount = 10; // Updated target for 8 core AIs + authority sources
    const participationRate = Math.min(1, votes.length / targetAICount);
    
    // Authority boost (if authority data exists)
    const authorityBoost = this.authorityData ? 0.05 : 0;
    
    // Calculate base confidence
    const baseConfidence = (
      avgConfidence * 0.35 +           // 35% weight on average AI confidence
      decisionAgreement * 0.25 +       // 25% weight on decision consensus
      valueAgreement * 0.25 +          // 25% weight on value consensus
      participationRate * 0.15         // 15% weight on AI participation
    );
    
    // Apply authority boost
    const boostedConfidence = baseConfidence + authorityBoost;
    
    // Cap confidence if critically low votes
    let confidence = Math.min(99, Math.round(boostedConfidence * 100));
    if (criticallyLowVotes) {
      confidence = Math.min(confidence, 75);
    }
    
    // Analysis quality based on confidence achieved and vote count
    let analysisQuality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
    if (criticallyLowVotes) {
      analysisQuality = 'FALLBACK';
    } else if (confidence >= 97) {
      analysisQuality = 'OPTIMAL';
    } else if (confidence >= 90) {
      analysisQuality = 'DEGRADED';
    } else {
      analysisQuality = 'FALLBACK';
    }
    
    // Detailed logging for 97%+ tracking
    console.log(`📊 Consensus Metrics:`);
    console.log(`   Average AI Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`   Decision Agreement: ${(decisionAgreement * 100).toFixed(1)}%`);
    console.log(`   Value Agreement: ${(valueAgreement * 100).toFixed(1)}%`);
    console.log(`   AI Participation: ${votes.length}/${targetAICount} (${(participationRate * 100).toFixed(1)}%)`);
    if (this.authorityData) {
      console.log(`   Authority Verification: ✅ +5% boost`);
    }
    console.log(`   Final Confidence: ${confidence}% (Target: 97%+)`);
    
    // Detailed diagnostics if below 97% threshold
    if (confidence < 97) {
      console.warn(`⚠️  Confidence below 97% threshold - refinement recommended`);
      console.warn(`   Root causes:`);
      
      if (criticallyLowVotes) {
        console.error(`   ❌ CRITICAL: Low AI Participation: ${votes.length}/10 - Only ${votes.length} AI(s) responded!`);
      } else if (participationRate < 0.8) {
        console.warn(`   - Low AI Participation: ${votes.length}/10 (${(participationRate * 100).toFixed(1)}%)`);
      }
      
      if (valueAgreement < 0.8) {
        console.warn(`   - High Value Variance: ${(valueAgreement * 100).toFixed(1)}% agreement (CV: ${coefficientOfVariation.toFixed(2)})`);
      }
      
      if (decisionAgreement < 0.8) {
        console.warn(`   - Low Decision Agreement: ${(decisionAgreement * 100).toFixed(1)}% (${Math.round(buyWeight / totalWeight * 100)}% BUY vs ${Math.round(sellWeight / totalWeight * 100)}% SELL)`);
      }
      
      if (avgConfidence < 0.85) {
        console.warn(`   - Low Average AI Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      }
      
      if (!this.authorityData) {
        console.warn(`   - No Authority Verification: Could add +5% with Numista/PCGS/etc`);
      }
    } else {
      console.log(`✅ Achieved ${confidence}% confidence - meets 97% target!`);
    }
    
    // Most common item name (weighted by confidence)
    const nameVotes = votes.reduce((acc, v) => {
      const name = v.itemName || 'Unknown Item';
      acc[name] = (acc[name] || 0) + (v.weight * v.confidence);
      return acc;
    }, {} as Record<string, number>);
    
    const sortedNames = Object.entries(nameVotes).sort((a, b) => b[1] - a[1]);
    const itemName = sortedNames.length > 0 ? sortedNames[0][0] : 'Unknown Item';
    
    return {
      itemName,
      estimatedValue: parseFloat(weightedValue.toFixed(2)),
      decision: decision as 'BUY' | 'SELL',
      confidence,
      totalVotes: votes.length,
      analysisQuality,
      consensusMetrics: {
        avgAIConfidence: avgConfidence,
        decisionAgreement,
        valueAgreement,
        participationRate,
        authorityVerified: !!this.authorityData
      }
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
        total_votes: consensus.totalVotes,
        consensus_metrics: consensus.consensusMetrics,
        authority_verified: !!this.authorityData
      });
    } catch (error) {
      console.error('Failed to save consensus:', error);
    }
  }
  
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