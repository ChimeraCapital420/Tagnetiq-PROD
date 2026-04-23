// FILE: src/lib/hydra-engine.ts
// Hydra Engine - Multi-AI Consensus System for Item Valuation
// 
// v2.0: Added Llama 4 + Kimi K2.6 to full pipeline
//   - Both added to ai_providers DB (run SQL in Supabase)
//   - Both receive actual image data in Stage 1 (vision-capable)
//   - xAI Grok now gets real-time market search prompt (has live web access)
//   - getKeyMap() updated for all 10 providers
//   - primaryImageProviders now includes all 5 vision providers
//
// This file runs SERVER-SIDE (in API routes) so uses process.env directly

import { createClient } from '@supabase/supabase-js';
import { AIProvider, ModelVote, HydraConsensus, ParsedAnalysis } from '../types/hydra.js';
import { ProviderFactory } from './ai-providers/provider-factory.js';
import { BaseAIProvider } from './ai-providers/base-provider.js';
import { AuthorityManager } from './authorities/authority-manager.js';

const supabaseUrl = 
  process.env.SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL || 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  '';

const supabaseServiceKey = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SERVICE_SECRET ||
  '';

if (!supabaseUrl) {
  console.error('❌ HYDRA ENGINE: Missing SUPABASE_URL environment variable');
}
if (!supabaseServiceKey) {
  console.error('❌ HYDRA ENGINE: Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  private userId?: string;
  private userTier: string = 'FREE';
  private maxProviders: number = 10; // v2.0: updated from 8 to 10
  private authorityData?: any;
  private providerStatuses: ProviderStatus[] = [];
  
  constructor(userId?: string, userTier: string = 'FREE') {
    this.userId = userId;
    this.userTier = userTier;
    this.analysisId = `analysis_${userId || 'anon'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async initialize() {
    console.log('🔧 Initializing Hydra Engine...');
    console.log(`👤 User tier: ${this.userTier} (max ${this.maxProviders} AI providers)`);
    
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
        'OPEN_AI_API_KEY',
        'OPEN_AI_TOKEN',
        'OPENAI_API_KEY',
        'OPENAI_TOKEN',
        'OPENAI_SECRET',
        'OPEN_AI_SECRET'
      ],
      'Anthropic': [
        'ANTHROPIC_SECRET',
        'ANTHROPIC_API_KEY',
        'ANTHROPIC_TOKEN',
        'CLAUDE_API_KEY',
        'CLAUDE_SECRET'
      ],
      'Google': [
        'GOOGLE_AI_TOKEN',
        'GOOGLE_API_KEY',
        'GOOGLE_AI_KEY',
        'GEMINI_API_KEY',
        'GEMINI_TOKEN',
        'GOOGLE_GEMINI_KEY'
      ],
      'Mistral': [
        'MISTRAL_API_KEY',
        'MISTRAL_TOKEN',
        'MISTRAL_SECRET',
        'MISTRAL_AI_KEY'
      ],
      'Groq': [
        'GROQ_API_KEY',
        'GROQ_TOKEN',
        'GROQ_SECRET',
        'GROQ_CLOUD_KEY'
      ],
      'DeepSeek': [
        'DEEPSEEK_TOKEN',
        'DEEPSEEK_API_KEY',
        'DEEP_SEEK_API_KEY',
        'DEEP_SEEK_TOKEN',
        'DEEPSEEK_SECRET'
      ],
      'xAI': [
        'XAI_SECRET',
        'XAI_API_KEY',
        'XAI_TOKEN',
        'X_AI_API_KEY',
        'X_AI_SECRET',
        'GROK_API_KEY'
      ],
      'Perplexity': [
        'PERPLEXITY_API_KEY',
        'PERPLEXITY_TOKEN',
        'PERPLEXITY_SECRET',
        'PPLX_API_KEY',
        'PPLX_TOKEN'
      ],
      // v2.0: Added Llama 4 + Kimi
      'Llama 4': [
        'GROQ_API_KEY',       // Llama 4 runs on Groq infrastructure
        'GROQ_TOKEN',
        'GROQ_SECRET'
      ],
      'Kimi': [
        'AI_GATEWAY_API_KEY', // Routes through Vercel AI Gateway — no geo-restriction
        'MOONSHOT_API_KEY',
        'KIMI_API_KEY'
      ],
    };
  }
  
  private getApiKey(providerName: string): string | undefined {
    const keyMap = this.getKeyMap();
    const keys = keyMap[providerName] || [];
    
    for (const keyName of keys) {
      const value = process.env[keyName];
      if (value && value.trim() !== '') {
        return value;
      }
    }
    
    return undefined;
  }
  
  getProviderStatuses(): ProviderStatus[] {
    return this.providerStatuses;
  }
  
  async analyze(images: string[], prompt: string): Promise<HydraConsensus> {
    const startTime = Date.now();
    
    if (this.providers.length === 0) {
      await this.initialize();
    }
    
    const providerFailures: Record<string, string> = {};
    
    if (this.providers.length < 2) {
      console.warn('⚠️  Less than 2 providers available - using fallback mode');
      return await this.emergencyFallback(images, prompt);
    }
    
    console.log(`🚀 Active AI Providers: ${this.providers.map(p => p.getProvider().name).join(', ')}`);
    
    // v2.0: All 5 vision-capable providers receive the actual image
    // Llama 4 and Kimi added to Stage 1 — they vote on the real item
    const primaryImageProviders = this.providers.filter(p => 
      ['OpenAI', 'Anthropic', 'Google', 'Llama 4', 'Kimi'].includes(p.getProvider().name)
    );
    
    const tiebreakerImageProvider = this.providers.filter(p => 
      ['DeepSeek'].includes(p.getProvider().name)
    );
    
    const textOnlyProviders = this.providers.filter(p => 
      ['Mistral', 'Groq'].includes(p.getProvider().name)
    );

    // v2.0: xAI Grok has real-time web search — treat it like Perplexity
    // Separated from textOnly so it gets a market search prompt
    const realTimeProviders = this.providers.filter(p =>
      ['xAI', 'Perplexity'].includes(p.getProvider().name)
    );
    
    console.log(`🔍 Stage 1: Running ${primaryImageProviders.length} PRIMARY vision AIs (with image)...`);
    
    // CRITICAL DEBUG LOGGING FOR IMAGE PIPELINE
    console.log('🔍 Image data debug info:', {
      imageCount: images.length,
      firstImageExists: !!images[0],
      firstImageLength: images[0]?.length || 0,
      firstImagePrefix: images[0]?.substring(0, 100) + '...',
      hasDataPrefix: images[0]?.startsWith('data:image/') || false,
      isBase64: images[0]?.includes('base64') || false,
      imageType: images[0]?.substring(0, 30) || 'No image data'
    });
    
    // STAGE 1: All vision providers receive the image in parallel
    let bestDescription = '';
    let itemName = '';
    const primaryImageAnalysisPromises = primaryImageProviders.map(async (provider) => {
      try {
        console.log(`📸 PRIMARY ${provider.getProvider().name}: Processing image data (${images[0]?.length || 0} chars)`);
        
        // Google gets retry with backoff — others call directly
        let result;
        if (provider.getProvider().name === 'Google') {
          result = await this.retryWithBackoff(provider, images, prompt, 3);
        } else {
          result = await provider.analyze(images, prompt);
        }
        
        console.log(`✅ PRIMARY ${provider.getProvider().name} responded in ${result.responseTime}ms`);
        return { provider: provider.getProvider(), result };
      } catch (error: any) {
        const errorMsg = error.message || 'Unknown error';
        providerFailures[provider.getProvider().name] = errorMsg;
        console.error(`❌ PRIMARY ${provider.getProvider().name} failed:`, error);
        
        if (errorMsg.includes('401') || errorMsg.includes('authentication')) {
          console.error(`❌ ${provider.getProvider().name}: Authentication failed - check API key`);
        } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          console.error(`⚠️ ${provider.getProvider().name}: Rate limit hit`);
        } else if (errorMsg.includes('404')) {
          console.error(`❌ ${provider.getProvider().name}: Endpoint not found - check API URL`);
        } else if (errorMsg.includes('400')) {
          console.error(`❌ ${provider.getProvider().name}: Bad request - check model or parameters`);
        }
        
        return null;
      }
    });
    
    const primaryResults = await Promise.allSettled(primaryImageAnalysisPromises);
    
    const primaryImageVotes: ModelVote[] = [];
    const primaryImageAnalyses: ParsedAnalysis[] = [];
    
    for (const result of primaryResults) {
      if (result.status === 'fulfilled' && result.value?.result?.response) {
        const { provider, result: aiResult } = result.value;
        const analysis = aiResult.response as ParsedAnalysis;
        
        console.log(`🎯 PRIMARY ${provider.name} identified: "${analysis.itemName}" (confidence: ${aiResult.confidence})`);
        
        if (!bestDescription && analysis.itemName && analysis.summary_reasoning) {
          bestDescription = `${analysis.itemName}: ${analysis.summary_reasoning}`;
          itemName = analysis.itemName;
        }
        
        const safeEstimatedValue = analysis.estimatedValue != null 
          ? parseFloat(analysis.estimatedValue.toString()) 
          : 0;
        
        const vote: ModelVote = {
          providerId: provider.id,
          providerName: provider.name,
          itemName: analysis.itemName || 'Unknown Item',
          estimatedValue: isNaN(safeEstimatedValue) ? 0 : safeEstimatedValue,
          decision: analysis.decision || 'SELL',
          confidence: aiResult.confidence,
          responseTime: aiResult.responseTime,
          weight: this.calculateWeight(provider, aiResult.confidence),
          rawResponse: analysis,
          success: true
        };
        
        primaryImageVotes.push(vote);
        primaryImageAnalyses.push(analysis);
        
        await this.saveVote(vote);
      }
    }
    
    console.log(`✅ Stage 1 complete: ${primaryImageVotes.length} PRIMARY vision AIs voted`);
    
    // STAGE 2: Text-only providers with enhanced context
    const enhancedPrompt = bestDescription 
      ? `${prompt}\n\nBased on expert visual analysis by multiple AI systems, this item has been identified as: "${bestDescription}"\n\nPlease provide your valuation analysis for this ${itemName}.`
      : prompt;
    
    console.log(`🔍 Stage 2: Running ${textOnlyProviders.length} text analysis AIs with context...`);
    
    const textAnalysisPromises = textOnlyProviders.map(async (provider) => {
      try {
        const result = await provider.analyze([], enhancedPrompt);
        console.log(`✅ ${provider.getProvider().name} responded in ${result.responseTime}ms`);
        return { provider: provider.getProvider(), result };
      } catch (error: any) {
        const errorMsg = error.message || 'Unknown error';
        providerFailures[provider.getProvider().name] = errorMsg;
        console.error(`${provider.getProvider().name} text analysis failed:`, error);
        return null;
      }
    });
    
    const textResults = await Promise.allSettled(textAnalysisPromises);
    
    const textVotes: ModelVote[] = [];
    const textAnalyses: ParsedAnalysis[] = [];
    
    for (const result of textResults) {
      if (result.status === 'fulfilled' && result.value?.result?.response) {
        const { provider, result: aiResult } = result.value;
        const analysis = aiResult.response as ParsedAnalysis;
        
        console.log(`🎯 ${provider.name} analyzed: "${analysis.itemName}" (confidence: ${aiResult.confidence})`);
        
        const safeEstimatedValue = analysis.estimatedValue != null 
          ? parseFloat(analysis.estimatedValue.toString()) 
          : 0;
        
        const vote: ModelVote = {
          providerId: provider.id,
          providerName: provider.name,
          itemName: analysis.itemName || itemName || 'Unknown Item',
          estimatedValue: isNaN(safeEstimatedValue) ? 0 : safeEstimatedValue,
          decision: analysis.decision || 'SELL',
          confidence: aiResult.confidence,
          responseTime: aiResult.responseTime,
          weight: this.calculateWeight(provider, aiResult.confidence),
          rawResponse: analysis,
          success: true
        };
        
        textVotes.push(vote);
        textAnalyses.push(analysis);
        
        await this.saveVote(vote);
      }
    }
    
    console.log(`✅ Stage 2 complete: ${textVotes.length} text AIs voted`);
    
    // STAGE 3: Real-time market search — Perplexity AND xAI Grok
    // v2.0: xAI Grok has live web access — explicitly ask for current market prices
    const searchVotes: ModelVote[] = [];
    const searchAnalyses: ParsedAnalysis[] = [];
    
    if (realTimeProviders.length > 0 && itemName) {
      console.log(`🔍 Stage 3: Running ${realTimeProviders.length} real-time market search providers...`);
      
      const perplexityPrompt = `${prompt}\n\nIMPORTANT: Search for recent eBay sold listings, Amazon prices, and current market values for: "${itemName}". Include specific sold prices from the last 30 days with dates and conditions.`;

      // v2.0: xAI Grok prompt — leverages its real-time web search capability
      const xaiMarketPrompt = `${prompt}\n\nIMPORTANT: Use your real-time web search to find current market prices for: "${itemName}". Search eBay sold listings, StockX, Poshmark, Mercari, and Amazon for recent sales in the last 30 days. Report specific prices, dates, and conditions found.`;
      
      const searchPromises = realTimeProviders.map(async (provider) => {
        try {
          // Give each real-time provider its optimal prompt
          const searchPrompt = provider.getProvider().name === 'xAI' 
            ? xaiMarketPrompt 
            : perplexityPrompt;
          
          const result = await provider.analyze([], searchPrompt);
          console.log(`✅ ${provider.getProvider().name} market search responded in ${result.responseTime}ms`);
          return { provider: provider.getProvider(), result };
        } catch (error: any) {
          const errorMsg = error.message || 'Unknown error';
          providerFailures[provider.getProvider().name] = errorMsg;
          console.error(`${provider.getProvider().name} market search failed:`, error);
          return null;
        }
      });
      
      const searchResults = await Promise.allSettled(searchPromises);
      
      for (const result of searchResults) {
        if (result.status === 'fulfilled' && result.value?.result?.response) {
          const { provider, result: aiResult } = result.value;
          const analysis = aiResult.response as ParsedAnalysis;
          
          const safeEstimatedValue = analysis.estimatedValue != null 
            ? parseFloat(analysis.estimatedValue.toString()) 
            : 0;
          
          const vote: ModelVote = {
            providerId: provider.id,
            providerName: provider.name,
            itemName: analysis.itemName || itemName || 'Unknown Item',
            estimatedValue: isNaN(safeEstimatedValue) ? 0 : safeEstimatedValue,
            decision: analysis.decision || 'SELL',
            confidence: aiResult.confidence,
            responseTime: aiResult.responseTime,
            weight: this.calculateWeight(provider, aiResult.confidence) * 1.2, // Boost weight for real-time data
            rawResponse: analysis,
            success: true
          };
          
          searchVotes.push(vote);
          searchAnalyses.push(analysis);
          
          await this.saveVote(vote);
        }
      }
      
      console.log(`✅ Stage 3 complete: ${searchVotes.length} real-time market search results`);
    }
    
    const primaryVotes = [...primaryImageVotes, ...textVotes, ...searchVotes];
    
    console.log(`🎯 Primary consensus: ${primaryVotes.length} votes collected`);
    
    // STAGE 4: TIEBREAKER LOGIC
    let tiebreakerVotes: ModelVote[] = [];
    let tiebreakerAnalyses: ParsedAnalysis[] = [];
    
    if (primaryVotes.length >= 4 && tiebreakerImageProvider.length > 0) {
      const buyWeight = primaryVotes.filter(v => v.decision === 'BUY').reduce((sum, v) => sum + v.weight, 0);
      const sellWeight = primaryVotes.filter(v => v.decision === 'SELL').reduce((sum, v) => sum + v.weight, 0);
      const totalWeight = buyWeight + sellWeight;
      
      const weightDifference = Math.abs(buyWeight - sellWeight) / totalWeight;
      
      console.log(`🤔 Consensus check: BUY(${buyWeight.toFixed(2)}) vs SELL(${sellWeight.toFixed(2)}) - difference: ${(weightDifference * 100).toFixed(1)}%`);
      
      if (weightDifference < 0.15) {
        console.log('🔄 CLOSE VOTE DETECTED! Running DeepSeek tiebreaker...');
        
        const tiebreakerProvider = tiebreakerImageProvider[0];
        try {
          console.log(`🎯 TIEBREAKER ${tiebreakerProvider.getProvider().name}: Processing tiebreaker vote`);
          const result = await tiebreakerProvider.analyze(images, prompt);
          console.log(`✅ TIEBREAKER ${tiebreakerProvider.getProvider().name} responded in ${result.responseTime}ms`);
          
          if (result.response) {
            const analysis = result.response as ParsedAnalysis;
            console.log(`🎯 TIEBREAKER ${tiebreakerProvider.getProvider().name} decided: "${analysis.decision}" (confidence: ${result.confidence})`);
            
            const safeEstimatedValue = analysis.estimatedValue != null 
              ? parseFloat(analysis.estimatedValue.toString()) 
              : 0;
            
            const vote: ModelVote = {
              providerId: tiebreakerProvider.getProvider().id,
              providerName: tiebreakerProvider.getProvider().name + ' (TIEBREAKER)',
              itemName: analysis.itemName || itemName || 'Unknown Item',
              estimatedValue: isNaN(safeEstimatedValue) ? 0 : safeEstimatedValue,
              decision: analysis.decision || 'SELL',
              confidence: result.confidence * 0.8,
              responseTime: result.responseTime,
              weight: this.calculateWeight(tiebreakerProvider.getProvider(), result.confidence) * 0.6,
              rawResponse: analysis,
              success: true
            };
            
            tiebreakerVotes.push(vote);
            tiebreakerAnalyses.push(analysis);
            
            await this.saveVote(vote);
            console.log(`✅ Stage 4 complete: Tiebreaker vote added`);
          }
        } catch (error: any) {
          console.error(`❌ TIEBREAKER failed:`, error);
        }
      } else {
        console.log('✅ Clear consensus achieved, tiebreaker not needed');
      }
    }
    
    const allVotes = [...primaryVotes, ...tiebreakerVotes];
    const allAnalyses = [...primaryImageAnalyses, ...textAnalyses, ...searchAnalyses, ...tiebreakerAnalyses];
    
    console.log(`🎯 Total votes collected: ${allVotes.length} AIs (${primaryVotes.length} primary + ${tiebreakerVotes.length} tiebreaker)`);
    console.log(`   └── Primary vision (with image): ${primaryImageVotes.length}`);
    console.log(`   └── Text analysis: ${textVotes.length}`);
    console.log(`   └── Real-time market search: ${searchVotes.length}`);
    console.log(`   └── Tiebreaker: ${tiebreakerVotes.length}`);
    
    if (Object.keys(providerFailures).length > 0) {
      console.warn('⚠️ Provider Failure Report:', providerFailures);
    }
    
    if (allVotes.length === 0) {
      console.error('❌ No AI providers successfully responded. Using emergency fallback...');
      return await this.emergencyFallback(images, prompt);
    }
    
    const consensus = this.calculateConsensus(allVotes, allAnalyses);
    
    await this.saveConsensus(consensus);
    
    return {
      analysisId: this.analysisId,
      votes: allVotes,
      consensus,
      processingTime: Date.now() - startTime,
      authorityData: this.authorityData,
      providerFailures
    };
  }
  
  private async retryWithBackoff(provider: BaseAIProvider, images: string[], prompt: string, maxRetries: number): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await provider.analyze(images, prompt);
      } catch (error: any) {
        if (error.message?.includes('429') && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ ${provider.getProvider().name} rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }
  
  private async emergencyFallback(images: string[], prompt: string): Promise<HydraConsensus> {
    console.warn('⚠️ EMERGENCY FALLBACK MODE - Attempting single-provider analysis');
    
    for (const provider of this.providers) {
      try {
        console.log(`🔄 Trying fallback with ${provider.getProvider().name}...`);
        const result = await provider.analyze(images, prompt);
        
        if (result.response) {
          const safeEstimatedValue = result.response.estimatedValue != null 
            ? parseFloat(result.response.estimatedValue.toString()) 
            : 0;
          
          const vote: ModelVote = {
            providerId: provider.getProvider().id,
            providerName: provider.getProvider().name + ' (EMERGENCY)',
            itemName: result.response.itemName || 'Unknown Item',
            estimatedValue: isNaN(safeEstimatedValue) ? 0 : safeEstimatedValue,
            decision: result.response.decision || 'SELL',
            confidence: result.confidence * 0.5,
            responseTime: result.responseTime,
            weight: 1,
            rawResponse: result.response,
            success: true
          };
          
          await this.saveVote(vote);
          
          const consensus = {
            itemName: vote.itemName,
            estimatedValue: vote.estimatedValue,
            decision: vote.decision,
            confidence: Math.min(50, Math.round(vote.confidence * 100)),
            totalVotes: 1,
            analysisQuality: 'FALLBACK' as const,
            consensusMetrics: {
              avgAIConfidence: vote.confidence,
              decisionAgreement: 1,
              valueAgreement: 1,
              participationRate: 1 / this.providers.length,
              authorityVerified: false
            }
          };
          
          await this.saveConsensus(consensus);
          
          console.log(`✅ Fallback successful with ${provider.getProvider().name}`);
          
          return {
            analysisId: this.analysisId,
            votes: [vote],
            consensus,
            processingTime: Date.now(),
            authorityData: undefined
          };
        }
      } catch (error) {
        console.error(`❌ Fallback failed with ${provider.getProvider().name}:`, error);
        continue;
      }
    }
    
    throw new Error('All AI providers failed - cannot perform analysis. Please check API keys and provider status.');
  }
  
  async analyzeWithAuthority(images: string[], prompt: string, category?: string): Promise<HydraConsensus> {
    const consensus = await this.analyze(images, prompt);
    
    const isBook = category === 'books' || 
                   category === 'media' || 
                   consensus.consensus.itemName.toLowerCase().includes('book') ||
                   consensus.consensus.itemName.toLowerCase().includes('isbn');
    
    if (isBook) {
      console.log('📚 Detected book item, running authority validation...');
      
      const authorityManager = new AuthorityManager();
      
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
        this.authorityData = bookData;
        consensus.authorityData = bookData;
        
        const enhancedConsensus = this.calculateConsensus(consensus.votes, 
          consensus.votes.map(v => v.rawResponse).filter(Boolean));
        
        consensus.consensus = enhancedConsensus;
        
        if (bookData.marketValue) {
          const aiValue = consensus.consensus.estimatedValue;
          const authorityValue = bookData.marketValue.good;
          
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
    const baseWeight = provider.baseWeight * confidence;
    
    if (provider.specialty === 'pricing' && provider.name === 'Perplexity') {
      return baseWeight * 1.3;
    }
    
    // v2.0: Boost xAI for real-time market search
    if (provider.name === 'xAI') {
      return baseWeight * 1.2;
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
    
    const criticallyLowVotes = votes.length < 3;
    
    const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
    const weightedValue = votes.reduce((sum, v) => sum + (v.estimatedValue * v.weight), 0) / totalWeight;
    
    const buyWeight = votes.filter(v => v.decision === 'BUY').reduce((sum, v) => sum + v.weight, 0);
    const sellWeight = votes.filter(v => v.decision === 'SELL').reduce((sum, v) => sum + v.weight, 0);
    const decision = buyWeight > sellWeight ? 'BUY' : 'SELL';
    
    const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
    
    const decisionAgreement = Math.max(buyWeight, sellWeight) / totalWeight;
    
    const values = votes.map(v => v.estimatedValue);
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
    const valueAgreement = Math.max(0, 1 - coefficientOfVariation);
    
    const targetAICount = 10; // All 10 providers
    const participationRate = Math.min(1, votes.length / targetAICount);
    
    const authorityBoost = this.authorityData ? 0.05 : 0;
    
    const baseConfidence = (
      avgConfidence * 0.35 +
      decisionAgreement * 0.25 +
      valueAgreement * 0.25 +
      participationRate * 0.15
    );
    
    const boostedConfidence = baseConfidence + authorityBoost;
    
    let confidence = Math.min(99, Math.round(boostedConfidence * 100));
    if (criticallyLowVotes) {
      confidence = Math.min(confidence, 75);
    }
    
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
    
    console.log(`📊 Consensus Metrics:`);
    console.log(`   Average AI Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`   Decision Agreement: ${(decisionAgreement * 100).toFixed(1)}%`);
    console.log(`   Value Agreement: ${(valueAgreement * 100).toFixed(1)}%`);
    console.log(`   AI Participation: ${votes.length}/${targetAICount} (${(participationRate * 100).toFixed(1)}%)`);
    if (this.authorityData) {
      console.log(`   Authority Verification: ✅ +5% boost`);
    }
    console.log(`   Final Confidence: ${confidence}% (Target: 97%+)`);
    
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