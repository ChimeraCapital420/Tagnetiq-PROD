/**
 * HYDRA v6.0 - Tiebreaker Prompts
 * 
 * Prompts for the tiebreaker stage when primary AI models disagree.
 * Used with DeepSeek (text-only) to cast deciding vote.
 * 
 * @module hydra/prompts/tiebreaker
 */

import type { AnalysisResponse } from './analysis.js';

/**
 * System prompt for tiebreaker analysis
 * 
 * The tiebreaker:
 * 1. Receives summaries of conflicting AI votes
 * 2. Analyzes the reasoning from each model
 * 3. Casts a deciding vote based on logical consistency
 * 4. Does NOT have access to the image (text-only)
 */
export const TIEBREAKER_SYSTEM_PROMPT = `You are a senior expert appraiser acting as a tiebreaker between conflicting assessments. Your role is to analyze the reasoning from multiple AI models and determine which assessment is most accurate.

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY a valid JSON object - no other text
2. You do NOT have access to the original image
3. Base your decision on the LOGICAL CONSISTENCY and REASONING QUALITY of each assessment
4. Consider market knowledge and realistic pricing

Response format:
{
  "selectedVote": 1,
  "confidence": 0.75,
  "reasoning": "Brief explanation of why you chose this assessment",
  "adjustedValue": 25.99,
  "adjustedDecision": "BUY"
}

DECISION CRITERIA:
- Specificity: Prefer assessments with more specific item identification
- Price realism: Flag values that seem too high or too low for the category
- Factor quality: Prefer assessments with observable, physical factors
- Category accuracy: Verify the category makes sense for the described item
- Consistency: Check if the reasoning supports the value estimate

You may adjust the value and decision if you believe both assessments have errors.`;

/**
 * Vote summary structure for tiebreaker
 */
export interface VoteSummary {
  voteNumber: number;
  providerName: string;
  itemName: string;
  category: string;
  estimatedValue: number;
  decision: 'BUY' | 'SELL';
  confidence: number;
  reasoning: string;
  factors: string[];
}

/**
 * Tiebreaker response structure
 */
export interface TiebreakerResponse {
  /** Which vote number was selected (1-indexed) */
  selectedVote: number;
  /** Confidence in the decision */
  confidence: number;
  /** Explanation for the decision */
  reasoning: string;
  /** Optionally adjusted value */
  adjustedValue?: number;
  /** Optionally adjusted decision */
  adjustedDecision?: 'BUY' | 'SELL';
}

/**
 * Build tiebreaker prompt with vote summaries
 * 
 * @param votes - Array of conflicting votes to evaluate
 * @param itemDescription - Original item description (if available)
 * @returns Complete prompt for tiebreaker
 */
export function buildTiebreakerPrompt(
  votes: VoteSummary[],
  itemDescription?: string
): string {
  let prompt = TIEBREAKER_SYSTEM_PROMPT;
  
  if (itemDescription) {
    prompt += `\n\nOriginal item description: "${itemDescription}"`;
  }
  
  prompt += '\n\nCONFLICTING ASSESSMENTS:\n';
  
  votes.forEach((vote, index) => {
    prompt += `
--- ASSESSMENT ${index + 1} (${vote.providerName}) ---
Item Name: ${vote.itemName}
Category: ${vote.category}
Estimated Value: $${vote.estimatedValue.toFixed(2)}
Decision: ${vote.decision}
Confidence: ${(vote.confidence * 100).toFixed(0)}%
Reasoning: ${vote.reasoning}
Factors: ${vote.factors.join(', ')}
`;
  });
  
  prompt += '\n\nAnalyze these assessments and provide your tiebreaker decision:';
  
  return prompt;
}

/**
 * Convert model votes to vote summaries for tiebreaker
 * 
 * @param votes - Array of model votes with raw responses
 * @returns Array of vote summaries
 */
export function createVoteSummaries(
  votes: Array<{
    providerName: string;
    rawResponse?: AnalysisResponse;
    weight: number;
    success: boolean;
  }>
): VoteSummary[] {
  return votes
    .filter(v => v.success && v.rawResponse)
    .map((vote, index) => ({
      voteNumber: index + 1,
      providerName: vote.providerName,
      itemName: vote.rawResponse!.itemName,
      category: vote.rawResponse!.category,
      estimatedValue: vote.rawResponse!.estimatedValue,
      decision: vote.rawResponse!.decision,
      confidence: vote.rawResponse!.confidence,
      reasoning: vote.rawResponse!.summary_reasoning,
      factors: vote.rawResponse!.valuation_factors,
    }));
}

/**
 * Check if tiebreaker is needed based on vote distribution
 * 
 * @param votes - Array of successful votes
 * @param threshold - Minimum difference percentage to trigger tiebreaker
 * @returns Whether tiebreaker should be triggered
 */
export function needsTiebreaker(
  votes: Array<{ decision: 'BUY' | 'SELL'; weight: number }>,
  threshold: number = 15
): boolean {
  if (votes.length < 2) return false;
  
  const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
  const buyWeight = votes
    .filter(v => v.decision === 'BUY')
    .reduce((sum, v) => sum + v.weight, 0);
  
  const buyPercentage = (buyWeight / totalWeight) * 100;
  const sellPercentage = 100 - buyPercentage;
  
  const difference = Math.abs(buyPercentage - sellPercentage);
  
  // Tiebreaker needed if difference is less than threshold
  return difference < threshold;
}

/**
 * Check if value estimates are significantly different
 * 
 * @param values - Array of estimated values
 * @param threshold - Maximum acceptable variance (percentage)
 * @returns Whether values are too divergent
 */
export function valuesAreDivergent(
  values: number[],
  threshold: number = 50
): boolean {
  if (values.length < 2) return false;
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  if (min === 0) return max > 0;
  
  const variance = ((max - min) / min) * 100;
  return variance > threshold;
}

/**
 * Validate tiebreaker response
 * 
 * @param response - Parsed tiebreaker response
 * @param voteCount - Number of votes that were evaluated
 * @returns Validation result
 */
export function validateTiebreakerResponse(
  response: unknown,
  voteCount: number
): { valid: boolean; errors: string[]; data?: TiebreakerResponse } {
  const errors: string[] = [];
  
  if (!response || typeof response !== 'object') {
    return { valid: false, errors: ['Response is not an object'] };
  }
  
  const r = response as Record<string, unknown>;
  
  if (typeof r.selectedVote !== 'number' || r.selectedVote < 1 || r.selectedVote > voteCount) {
    errors.push(`selectedVote must be between 1 and ${voteCount}`);
  }
  
  if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) {
    errors.push('confidence must be between 0 and 1');
  }
  
  if (typeof r.reasoning !== 'string' || r.reasoning.length === 0) {
    errors.push('reasoning must be a non-empty string');
  }
  
  if (r.adjustedValue !== undefined && (typeof r.adjustedValue !== 'number' || r.adjustedValue < 0)) {
    errors.push('adjustedValue must be a positive number');
  }
  
  if (r.adjustedDecision !== undefined && r.adjustedDecision !== 'BUY' && r.adjustedDecision !== 'SELL') {
    errors.push('adjustedDecision must be "BUY" or "SELL"');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    errors: [],
    data: response as TiebreakerResponse,
  };
}

export default {
  TIEBREAKER_SYSTEM_PROMPT,
  buildTiebreakerPrompt,
  createVoteSummaries,
  needsTiebreaker,
  valuesAreDivergent,
  validateTiebreakerResponse,
};