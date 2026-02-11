// FILE: src/lib/hydra/pipeline/prompts/validate-prompt.ts
// HYDRA v9.0 - Stage 4 Prompt: VALIDATE
// Groq speed-check — flag issues, don't price

/**
 * Build validation prompt for Groq
 * This is NOT a pricing prompt — it's a quality gate
 * Groq checks if the analysis makes sense, not what the price should be
 */
export function buildValidatePrompt(context: {
  itemName: string;
  category: string;
  marketMedian: number | null;
  marketListings: number;
  authoritySource: string | null;
  authorityPrice: number | null;
  aiConsensusPrice: number;
  aiDecision: string;
  aiConfidence: number;
  webPriceRange: { low: number; high: number } | null;
}): string {
  const {
    itemName, category,
    marketMedian, marketListings,
    authoritySource, authorityPrice,
    aiConsensusPrice, aiDecision, aiConfidence,
    webPriceRange,
  } = context;
  
  const dataPoints: string[] = [];
  
  if (marketMedian && marketMedian > 0) {
    dataPoints.push(`eBay median: $${marketMedian.toFixed(2)} (${marketListings} listings)`);
  }
  if (authoritySource && authorityPrice && authorityPrice > 0) {
    dataPoints.push(`${authoritySource} authority: $${authorityPrice.toFixed(2)}`);
  }
  if (webPriceRange) {
    dataPoints.push(`Web search range: $${webPriceRange.low.toFixed(2)} - $${webPriceRange.high.toFixed(2)}`);
  }
  dataPoints.push(`AI consensus: $${aiConsensusPrice.toFixed(2)} (${aiDecision}, ${aiConfidence}% confident)`);
  
  return `Quick validation check. Flag any concerns about this analysis.

ITEM: "${itemName}" (${category})

DATA POINTS:
${dataPoints.map(d => `- ${d}`).join('\n')}

CHECK THESE:
1. Does the AI consensus price make sense for this category? (Y/N)
2. Is there a >50% gap between market data and AI consensus? (Y/N)
3. Does the decision (${aiDecision}) match the price? (Y/N)
4. Are there any red flags? (Y/N)

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "itemName": "${itemName}",
  "category": "${category}",
  "estimatedValue": ${aiConsensusPrice},
  "decision": "${aiDecision}",
  "confidence": ${aiConfidence / 100},
  "valid": true or false,
  "flags": [],
  "valuationFactors": [
    "Validation: <your assessment>"
  ]
}

If everything looks reasonable, set valid=true and flags=[].
If something is wrong, set valid=false and describe each flag.
Be brief. This is a speed check, not a full analysis.`;
}