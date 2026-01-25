/**
 * HYDRA v6.0 - Refinement Prompts
 * 
 * Prompts for refining/re-analyzing items with additional context.
 * Used when user provides more information or disputes initial analysis.
 * 
 * @module hydra/prompts/refinement
 */

import type { AnalysisResponse } from './analysis.js';

/**
 * System prompt for analysis refinement
 * 
 * Refinement is triggered when:
 * 1. User provides additional details about the item
 * 2. User disputes the initial category or value
 * 3. Authority data becomes available after initial analysis
 * 4. User requests re-analysis with specific focus
 */
export const REFINEMENT_SYSTEM_PROMPT = `You are a senior appraiser refining a previous analysis with new information. Your job is to update the assessment based on additional context while maintaining accuracy.

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY a valid JSON object
2. Consider the ORIGINAL analysis and NEW information together
3. Only change values if the new information justifies it
4. Explain what changed and why in your reasoning

Response format:
{
  "itemName": "refined item name if more specific",
  "category": "corrected_category_if_needed",
  "estimatedValue": 35.99,
  "decision": "BUY",
  "valuation_factors": ["Updated factor 1", "Updated factor 2", "New factor from context", "Original factor still valid", "Adjusted factor"],
  "summary_reasoning": "Explanation of refinements and why values changed",
  "confidence": 0.90,
  "refinementNotes": {
    "categoryChanged": false,
    "valueAdjustment": "+10.00",
    "adjustmentReason": "Authority data confirmed higher market value"
  }
}

REFINEMENT RULES:
- If new info CONFIRMS original → increase confidence
- If new info CONTRADICTS original → adjust values with explanation
- If new info ADDS DETAIL → refine item name and factors
- Authority data should significantly influence final value
- User corrections about category should be respected unless clearly wrong`;

/**
 * Refinement context structure
 */
export interface RefinementContext {
  /** Original analysis result */
  originalAnalysis: {
    itemName: string;
    category: string;
    estimatedValue: number;
    decision: 'BUY' | 'SELL';
    confidence: number;
    reasoning: string;
  };
  /** New information provided */
  newInformation?: {
    /** User-provided details */
    userContext?: string;
    /** User's category correction */
    categoryCorrection?: string;
    /** User's value estimate */
    userValueEstimate?: number;
    /** Specific condition details */
    conditionDetails?: string;
  };
  /** Authority data if available */
  authorityData?: {
    source: string;
    itemDetails: Record<string, unknown>;
    priceData?: {
      market?: number;
      retail?: number;
      conditions?: Array<{ condition: string; price: number }>;
    };
  };
  /** Market data if available */
  marketData?: {
    source: string;
    medianPrice?: number;
    totalListings?: number;
  };
}

/**
 * Refinement response structure
 */
export interface RefinementResponse extends AnalysisResponse {
  refinementNotes?: {
    categoryChanged: boolean;
    valueAdjustment: string;
    adjustmentReason: string;
    confidenceChange: string;
  };
}

/**
 * Build refinement prompt with context
 * 
 * @param context - Refinement context with original analysis and new info
 * @returns Complete prompt for refinement
 */
export function buildRefinementPrompt(context: RefinementContext): string {
  let prompt = REFINEMENT_SYSTEM_PROMPT;
  
  // Add original analysis
  prompt += `

=== ORIGINAL ANALYSIS ===
Item Name: ${context.originalAnalysis.itemName}
Category: ${context.originalAnalysis.category}
Estimated Value: $${context.originalAnalysis.estimatedValue.toFixed(2)}
Decision: ${context.originalAnalysis.decision}
Confidence: ${(context.originalAnalysis.confidence * 100).toFixed(0)}%
Reasoning: ${context.originalAnalysis.reasoning}
`;

  // Add new information if provided
  if (context.newInformation) {
    prompt += '\n=== NEW INFORMATION ===\n';
    
    if (context.newInformation.userContext) {
      prompt += `User provided context: "${context.newInformation.userContext}"\n`;
    }
    
    if (context.newInformation.categoryCorrection) {
      prompt += `User suggests category should be: ${context.newInformation.categoryCorrection}\n`;
    }
    
    if (context.newInformation.userValueEstimate) {
      prompt += `User believes value is around: $${context.newInformation.userValueEstimate.toFixed(2)}\n`;
    }
    
    if (context.newInformation.conditionDetails) {
      prompt += `Condition details: ${context.newInformation.conditionDetails}\n`;
    }
  }
  
  // Add authority data if available
  if (context.authorityData) {
    prompt += `
=== AUTHORITY DATA (${context.authorityData.source}) ===
Verified Item Details: ${JSON.stringify(context.authorityData.itemDetails, null, 2)}
`;
    if (context.authorityData.priceData) {
      prompt += `Price Data:
  - Market Price: ${context.authorityData.priceData.market ? '$' + context.authorityData.priceData.market.toFixed(2) : 'N/A'}
  - Retail Price: ${context.authorityData.priceData.retail ? '$' + context.authorityData.priceData.retail.toFixed(2) : 'N/A'}
`;
      if (context.authorityData.priceData.conditions) {
        prompt += '  - By Condition:\n';
        context.authorityData.priceData.conditions.forEach(c => {
          prompt += `    - ${c.condition}: $${c.price.toFixed(2)}\n`;
        });
      }
    }
  }
  
  // Add market data if available
  if (context.marketData) {
    prompt += `
=== MARKET DATA (${context.marketData.source}) ===
Median Price: ${context.marketData.medianPrice ? '$' + context.marketData.medianPrice.toFixed(2) : 'N/A'}
Total Listings: ${context.marketData.totalListings || 'N/A'}
`;
  }
  
  prompt += '\nProvide your refined analysis based on all available information:';
  
  return prompt;
}

/**
 * Calculate value adjustment description
 * 
 * @param originalValue - Original estimated value
 * @param newValue - New estimated value
 * @returns Formatted adjustment string
 */
export function calculateValueAdjustment(originalValue: number, newValue: number): string {
  const diff = newValue - originalValue;
  const percentage = ((diff / originalValue) * 100).toFixed(1);
  
  if (diff > 0) {
    return `+$${diff.toFixed(2)} (+${percentage}%)`;
  } else if (diff < 0) {
    return `-$${Math.abs(diff).toFixed(2)} (${percentage}%)`;
  }
  return 'No change';
}

/**
 * Calculate confidence change description
 * 
 * @param originalConfidence - Original confidence (0-1)
 * @param newConfidence - New confidence (0-1)
 * @returns Formatted change string
 */
export function calculateConfidenceChange(originalConfidence: number, newConfidence: number): string {
  const diff = (newConfidence - originalConfidence) * 100;
  
  if (diff > 5) {
    return `Increased by ${diff.toFixed(0)}%`;
  } else if (diff < -5) {
    return `Decreased by ${Math.abs(diff).toFixed(0)}%`;
  }
  return 'Stable';
}

/**
 * Validate refinement response
 * 
 * @param response - Parsed refinement response
 * @returns Validation result
 */
export function validateRefinementResponse(
  response: unknown
): { valid: boolean; errors: string[]; data?: RefinementResponse } {
  const errors: string[] = [];
  
  if (!response || typeof response !== 'object') {
    return { valid: false, errors: ['Response is not an object'] };
  }
  
  const r = response as Record<string, unknown>;
  
  // Standard analysis fields
  if (typeof r.itemName !== 'string' || r.itemName.length === 0) {
    errors.push('itemName must be a non-empty string');
  }
  
  if (typeof r.category !== 'string') {
    errors.push('category must be a string');
  }
  
  if (typeof r.estimatedValue !== 'number' || r.estimatedValue < 0) {
    errors.push('estimatedValue must be a positive number');
  }
  
  if (r.decision !== 'BUY' && r.decision !== 'SELL') {
    errors.push('decision must be "BUY" or "SELL"');
  }
  
  if (!Array.isArray(r.valuation_factors)) {
    errors.push('valuation_factors must be an array');
  }
  
  if (typeof r.summary_reasoning !== 'string') {
    errors.push('summary_reasoning must be a string');
  }
  
  if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) {
    errors.push('confidence must be between 0 and 1');
  }
  
  // Refinement notes are optional but if present, validate structure
  if (r.refinementNotes !== undefined) {
    if (typeof r.refinementNotes !== 'object') {
      errors.push('refinementNotes must be an object');
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    errors: [],
    data: response as RefinementResponse,
  };
}

/**
 * Determine refinement type based on context
 * 
 * @param context - Refinement context
 * @returns Type of refinement being performed
 */
export function getRefinementType(context: RefinementContext): 
  'user_correction' | 'authority_update' | 'market_update' | 'detail_addition' {
  
  if (context.newInformation?.categoryCorrection || context.newInformation?.userValueEstimate) {
    return 'user_correction';
  }
  
  if (context.authorityData?.priceData) {
    return 'authority_update';
  }
  
  if (context.marketData?.medianPrice) {
    return 'market_update';
  }
  
  return 'detail_addition';
}

export default {
  REFINEMENT_SYSTEM_PROMPT,
  buildRefinementPrompt,
  calculateValueAdjustment,
  calculateConfidenceChange,
  validateRefinementResponse,
  getRefinementType,
};