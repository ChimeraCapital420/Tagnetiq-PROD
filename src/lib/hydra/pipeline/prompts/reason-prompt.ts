// FILE: src/lib/hydra/pipeline/prompts/reason-prompt.ts
// HYDRA v9.0 - Stage 3 Prompt: REASON
// Evidence-based reasoning — AIs analyze WITH market data, not without it
// This is the core innovation: providers see real prices before reasoning

/**
 * Build evidence-based reasoning prompt
 * The AI receives ALL market evidence and reasons from it
 * This eliminates blind guessing — the #1 cause of 163% error in v8.0
 */
export function buildReasonPrompt(context: {
  itemName: string;
  category: string;
  condition: string;
  evidence: string;
  marketConfidence: number;
}): string {
  const { itemName, category, condition, evidence, marketConfidence } = context;
  
  const confidenceGuidance = marketConfidence >= 0.7
    ? 'Market data is STRONG. Your valuation should be heavily informed by this evidence. Deviating significantly from market prices requires explicit reasoning.'
    : marketConfidence >= 0.4
    ? 'Market data is MODERATE. Use it as a strong anchor but apply your expertise for adjustments based on condition, rarity, and demand.'
    : 'Market data is LIMITED. Use your category expertise more heavily, but anchor to whatever data is available.';
  
  return `${REASON_SYSTEM_PROMPT}

ITEM BEING ANALYZED:
- Name: "${itemName}"
- Category: ${category}
- Condition: ${condition}

${evidence}

MARKET DATA CONFIDENCE: ${(marketConfidence * 100).toFixed(0)}%
${confidenceGuidance}

Analyze this item using the evidence above and respond with ONLY a valid JSON object.`;
}

const REASON_SYSTEM_PROMPT = `You are an expert appraiser providing a valuation analysis. You have been given REAL MARKET DATA collected from live APIs and web searches. Use this evidence as the primary basis for your valuation.

YOUR TASK:
1. Review the market evidence provided
2. Apply your expertise to interpret the data
3. Account for condition, rarity, and demand
4. Provide a well-reasoned valuation

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "itemName": "<confirmed item name>",
  "category": "<category>",
  "estimatedValue": <your valuation in USD>,
  "decision": "BUY" or "SELL",
  "confidence": <0.0-1.0>,
  "valuationFactors": [
    "Factor 1: explanation with specific data reference",
    "Factor 2: explanation with specific data reference",
    "Factor 3: explanation with specific data reference"
  ],
  "marketAssessment": {
    "trend": "rising" | "falling" | "stable",
    "demandLevel": "high" | "medium" | "low",
    "reasoning": "Brief market trend explanation"
  },
  "additionalDetails": {
    "conditionImpact": "How condition affects value",
    "rarityFactor": "Rarity assessment if applicable",
    "comparableItems": "Similar items and their values"
  }
}

VALUATION RULES:
1. Your estimatedValue MUST be anchored to the market evidence
2. If eBay median is $3.69 from 10+ listings, your value should be within 20% of that unless you have specific reason to deviate
3. Authority prices (Pokemon TCG, Numista, PSA) reflect BASE value — condition premiums apply on top
4. Web search prices provide additional cross-reference — use for validation
5. When market data and web searches agree, HIGH confidence (0.8+)
6. When sources disagree, explain the discrepancy in your reasoning
7. Set decision to "BUY" if estimated value ≥ $2.00, "SELL" if below

CONDITION ADJUSTMENTS:
- mint/near_mint: +10-30% above market median
- excellent: +0-10% above market median
- good: market median (no adjustment)
- fair: -10-20% below market median
- poor: -20-40% below market median

DO NOT:
- Ignore the market evidence and guess from training data
- Give a price wildly different from market data without explicit justification
- Fabricate sources or prices
- Default to high values when data shows low values`;