// FILE: src/lib/hydra/pipeline/stages/reason.ts
// HYDRA v9.0 - Stage 3: REASON
// Evidence-based reasoning: Anthropic + DeepSeek + Mistral
// These models receive market data and reason FROM evidence, not blind

import { ProviderFactory } from '../../ai/provider-factory.js';
import { isProviderAvailable } from '../../config/providers.js';
import { AI_MODEL_WEIGHTS } from '../../config/constants.js';
import { createVote, calculateConsensus } from '../../consensus/voting.js';
import type { ModelVote } from '../../types.js';
import type { ReasonResult, EvidenceSummary } from '../types.js';
import { buildReasonPrompt } from '../prompts/reason-prompt.js';

// =============================================================================
// REASON STAGE
// =============================================================================

/**
 * Stage 3: Evidence-based reasoning
 * Runs Anthropic + DeepSeek + Mistral in parallel
 * Each model receives the full evidence summary from Stage 2
 * They reason FROM market data, not guess without it
 * 
 * This is the core innovation of v9.0:
 * v8.0: "What's this worth?" → 163% average error
 * v9.0: "Given eBay median $3.69, authority $0.49, what's this worth?" → target <20%
 */
export async function runReasonStage(
  itemName: string,
  category: string,
  condition: string,
  evidence: EvidenceSummary,
  dynamicWeights?: Record<string, number>,
  timeout: number = 8000
): Promise<ReasonResult> {
  const stageStart = Date.now();
  
  console.log(`\n  🧠 Stage 3 — REASON (evidence-based)`);
  
  // Reasoning providers — these models get market data context
  const reasonProviders = ['anthropic', 'deepseek', 'mistral'].filter(isProviderAvailable);
  
  if (reasonProviders.length === 0) {
    console.log(`    ⚠️ No reasoning providers available`);
    return buildFallbackReasonResult(evidence, stageStart);
  }
  
  console.log(`    Providers: ${reasonProviders.join(', ')}`);
  console.log(`    Evidence: ${evidence.formattedEvidence.split('\n').length - 1} data points`);
  
  // Build evidence-based prompt (includes market data)
  const prompt = buildReasonPrompt({
    itemName,
    category,
    condition,
    evidence: evidence.formattedEvidence,
    marketConfidence: evidence.marketConfidence,
  });
  
  // Run providers in parallel
  const results = await Promise.allSettled(
    reasonProviders.map(providerId =>
      runReasonProvider(providerId, prompt, dynamicWeights, timeout)
    )
  );
  
  // Collect successful votes
  const votes: ModelVote[] = results
    .filter((r): r is PromiseFulfilledResult<ModelVote | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((v): v is ModelVote => v !== null);
  
  console.log(`    ✅ ${votes.length}/${reasonProviders.length} reasoning models responded`);
  
  if (votes.length === 0) {
    return buildFallbackReasonResult(evidence, stageStart);
  }
  
  // Calculate consensus from evidence-based votes
  const authorityData = evidence.authority ? {
    source: evidence.authority.source,
    itemDetails: evidence.authority.details,
  } : null;
  
  const consensus = calculateConsensus(votes, authorityData);
  
  // Override consensus item name
  consensus.itemName = itemName;
  
  // Extract market assessment from best vote
  const bestVote = votes.reduce((a, b) => a.weight > b.weight ? a : b);
  const rawResponse = bestVote.rawResponse as any;
  
  const marketAssessment = {
    trend: rawResponse?.marketAssessment?.trend || rawResponse?.trend || 'unknown',
    demandLevel: rawResponse?.marketAssessment?.demandLevel || rawResponse?.demand || 'unknown',
  };
  
  const stageTime = Date.now() - stageStart;
  
  // Log reasoning results
  votes.forEach(v => {
    console.log(`    🧠 ${v.providerId}: $${v.estimatedValue.toFixed(2)} ${v.decision} (${(v.confidence * 100).toFixed(0)}%)`);
  });
  console.log(`    🎯 Consensus: ${consensus.decision} @ $${consensus.estimatedValue.toFixed(2)}`);
  console.log(`    📊 Confidence: ${consensus.confidence}% (${consensus.analysisQuality})`);
  console.log(`    ⏱️ Stage 3 complete: ${stageTime}ms`);
  
  return {
    votes,
    consensus: {
      estimatedValue: consensus.estimatedValue,
      decision: consensus.decision,
      confidence: consensus.confidence,
      reasoning: consensus.reasoning || '',
      analysisQuality: consensus.analysisQuality,
    },
    marketAssessment,
    stageTimeMs: stageTime,
  };
}

// =============================================================================
// SINGLE PROVIDER RUNNER
// =============================================================================

async function runReasonProvider(
  providerId: string,
  prompt: string,
  dynamicWeights?: Record<string, number>,
  timeout: number = 8000
): Promise<ModelVote | null> {
  const start = Date.now();
  
  try {
    // Apply dynamic weight from self-heal if available
    const baseWeight = dynamicWeights?.[providerId] 
      || AI_MODEL_WEIGHTS[providerId as keyof typeof AI_MODEL_WEIGHTS] 
      || 0.75;
    
    const provider = ProviderFactory.create({
      id: `${providerId}-reason`,
      name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
      model: undefined as any,
      baseWeight,
    });
    
    // No images — reasoning is text-only with evidence
    const result = await Promise.race([
      provider.analyze([], prompt),
      new Promise<null>((resolve) => setTimeout(() => {
        console.log(`    ⏱️ ${providerId} reasoning timed out (${timeout}ms)`);
        resolve(null);
      }, timeout))
    ]);
    
    if (!result || !result.response) {
      console.log(`    ✗ ${providerId}: No reasoning returned`);
      return null;
    }
    
    const responseTime = Date.now() - start;
    
    const vote = createVote(
      { id: providerId, name: providerId, baseWeight },
      result.response,
      result.confidence || 0.8,
      responseTime,
      {}
    );
    
    return vote;
    
  } catch (error: any) {
    console.log(`    ✗ ${providerId}: ${error.message}`);
    return null;
  }
}

// =============================================================================
// FALLBACK
// =============================================================================

function buildFallbackReasonResult(
  evidence: EvidenceSummary,
  stageStart: number
): ReasonResult {
  // Use market data directly if no AI reasoning available
  const marketPrice = evidence.ebay?.median 
    || evidence.authority?.price 
    || evidence.webPrices?.low
    || 0;
  
  return {
    votes: [],
    consensus: {
      estimatedValue: marketPrice,
      decision: marketPrice >= 2.0 ? 'BUY' : 'SELL',
      confidence: evidence.marketConfidence * 100,
      reasoning: 'Market data only — no AI reasoning providers available',
      analysisQuality: 'DEGRADED',
    },
    marketAssessment: {
      trend: 'unknown',
      demandLevel: 'unknown',
    },
    stageTimeMs: Date.now() - stageStart,
  };
}