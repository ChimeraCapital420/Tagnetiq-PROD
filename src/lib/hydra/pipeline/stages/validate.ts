// FILE: src/lib/hydra/pipeline/stages/validate.ts
// HYDRA v9.0 - Stage 4: VALIDATE
// Groq speed-check — 332ms sanity validation
// Not a price vote — a quality gate

import { ProviderFactory } from '../../ai/provider-factory.js';
import { isProviderAvailable } from '../../config/providers.js';
import { AI_MODEL_WEIGHTS } from '../../config/constants.js';
import { createVote } from '../../consensus/voting.js';
import type { ModelVote } from '../../types.js';
import type { ValidateResult, ValidationFlag, EvidenceSummary } from '../types.js';
import { buildValidatePrompt } from '../prompts/validate-prompt.js';

// =============================================================================
// VALIDATE STAGE
// =============================================================================

/**
 * Stage 4: Fast validation
 * Uses Groq (332ms) as a rapid sanity check
 * NOT a price vote — flags potential issues
 * 
 * If Groq isn't available, validation passes automatically
 * (we don't block the response for optional validation)
 */
export async function runValidateStage(
  itemName: string,
  category: string,
  evidence: EvidenceSummary,
  reasoningConsensus: {
    estimatedValue: number;
    decision: string;
    confidence: number;
  },
  timeout: number = 2000
): Promise<ValidateResult> {
  const stageStart = Date.now();
  
  console.log(`\n  ✅ Stage 4 — VALIDATE`);
  
  if (!isProviderAvailable('groq')) {
    console.log(`    ⚠️ Groq not available, auto-passing validation`);
    return { valid: true, flags: [], responseTimeMs: 0, vote: null };
  }
  
  try {
    const provider = ProviderFactory.create({
      id: 'groq-validate',
      name: 'Groq',
      model: undefined as any,
      baseWeight: AI_MODEL_WEIGHTS.groq || 0.75,
    });
    
    const prompt = buildValidatePrompt({
      itemName,
      category,
      marketMedian: evidence.ebay?.median || null,
      marketListings: evidence.ebay?.listings || 0,
      authoritySource: evidence.authority?.source || null,
      authorityPrice: evidence.authority?.price || null,
      aiConsensusPrice: reasoningConsensus.estimatedValue,
      aiDecision: reasoningConsensus.decision,
      aiConfidence: reasoningConsensus.confidence,
      webPriceRange: evidence.webPrices,
    });
    
    // Race against tight timeout (Groq is fast, don't wait long)
    const result = await Promise.race([
      provider.analyze([], prompt),
      new Promise<null>((resolve) => setTimeout(() => {
        console.log(`    ⏱️ Groq validation timed out (${timeout}ms)`);
        resolve(null);
      }, timeout))
    ]);
    
    const responseTime = Date.now() - stageStart;
    
    if (!result || !result.response) {
      console.log(`    ⚠️ Groq returned no validation, auto-passing`);
      return { valid: true, flags: [], responseTimeMs: responseTime, vote: null };
    }
    
    // Create vote for benchmark tracking
    const vote = createVote(
      { id: 'groq', name: 'Groq', baseWeight: AI_MODEL_WEIGHTS.groq || 0.75 },
      result.response,
      result.confidence || 0.7,
      responseTime,
      {}
    );
    
    // Parse validation response
    const rawResponse = result.response as any;
    const flags = parseValidationFlags(rawResponse);
    const valid = flags.filter(f => f.severity === 'error').length === 0;
    
    if (valid) {
      console.log(`    ✅ Validation passed (${responseTime}ms)`);
    } else {
      console.log(`    ⚠️ Validation flags: ${flags.length} (${responseTime}ms)`);
      flags.forEach(f => console.log(`      ${f.severity}: ${f.message}`));
    }
    
    return { valid, flags, responseTimeMs: responseTime, vote };
    
  } catch (error: any) {
    console.log(`    ⚠️ Validation error (non-fatal): ${error.message}`);
    return { valid: true, flags: [], responseTimeMs: Date.now() - stageStart, vote: null };
  }
}

// =============================================================================
// FLAG PARSING
// =============================================================================

function parseValidationFlags(response: any): ValidationFlag[] {
  const flags: ValidationFlag[] = [];
  
  // Check if response explicitly says valid
  if (response.valid === true || response.decision === 'VALID') {
    return flags;
  }
  
  // Check structured flags
  if (response.flags && Array.isArray(response.flags)) {
    response.flags.forEach((flag: any) => {
      if (typeof flag === 'string') {
        flags.push({
          type: 'price_mismatch',
          severity: 'warning',
          message: flag,
        });
      } else if (flag.type) {
        flags.push({
          type: flag.type || 'price_mismatch',
          severity: flag.severity || 'warning',
          message: flag.message || flag.description || 'Unknown flag',
          adjustment: flag.adjustment,
        });
      }
    });
  }
  
  // Check for implicit flags in valuation factors
  if (response.valuationFactors && Array.isArray(response.valuationFactors)) {
    response.valuationFactors.forEach((factor: string) => {
      const lower = factor.toLowerCase();
      if (lower.includes('concern') || lower.includes('mismatch') || lower.includes('discrepancy')) {
        flags.push({
          type: 'price_mismatch',
          severity: 'warning',
          message: factor,
        });
      }
    });
  }
  
  // Check for large price discrepancy in the response itself
  if (response.estimatedValue && response.estimatedValue > 0) {
    // If Groq's own estimate differs hugely, that's a flag
    // (but we don't use Groq's price — just note the discrepancy)
  }
  
  return flags;
}