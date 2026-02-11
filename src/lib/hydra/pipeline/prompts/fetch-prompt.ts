// FILE: src/lib/hydra/pipeline/prompts/fetch-prompt.ts
// HYDRA v9.0 - Stage 2 Prompts: FETCH
// Web search prompts for Perplexity and xAI

import type { ItemCategory } from '../../types.js';

/**
 * Perplexity prompt — citation-heavy web search
 * Perplexity excels at finding specific price data with sources
 */
export function buildFetchPromptPerplexity(
  itemName: string,
  category: ItemCategory
): string {
  return `Find current market prices and recent sales data for this item. Return ONLY factual price data with sources.

ITEM: "${itemName}"
CATEGORY: ${category}

Search for:
1. Recent eBay SOLD listings (completed sales, not active listings)
2. Dealer/retailer prices (TCGPlayer, COMC, Amazon, specialized dealers)
3. Auction results from the past 90 days
4. Price guide values if available

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "itemName": "${itemName}",
  "category": "${category}",
  "estimatedValue": <median of all prices found>,
  "decision": "BUY" or "SELL",
  "confidence": <0.0-1.0>,
  "valuationFactors": [
    "eBay sold: $X.XX on [date]",
    "TCGPlayer market: $X.XX",
    "Price guide: $X.XX"
  ],
  "additionalDetails": {
    "recentSold": [<list of specific sold prices>],
    "medianPrice": <median>,
    "averagePrice": <average>,
    "priceRange": { "low": <min>, "high": <max> },
    "sources": ["url1", "url2"]
  }
}

RULES:
- ONLY include prices you actually found — do not fabricate data
- Distinguish between SOLD prices (completed) and LISTED prices (asking)
- Prefer sold prices over listed prices
- If no data found, set estimatedValue to 0 and confidence to 0.1`;
}

/**
 * xAI Grok prompt — real-time web verification
 * Grok has built-in web access — use it for cross-referencing
 */
export function buildFetchPromptXai(
  itemName: string,
  category: ItemCategory
): string {
  return `Using your web access, verify the current market value for this item. Cross-reference multiple sources.

ITEM: "${itemName}"
CATEGORY: ${category}

Check these sources:
1. eBay recently sold listings
2. Specialized marketplaces (TCGPlayer, Discogs, Numista, etc.)
3. Collector forums or price guides
4. Retail prices where applicable

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "itemName": "${itemName}",
  "category": "${category}",
  "estimatedValue": <your best estimate based on real data>,
  "decision": "BUY" or "SELL",
  "confidence": <0.0-1.0>,
  "valuationFactors": [
    "Source: price found",
    "Source: price found"
  ],
  "additionalDetails": {
    "recentSold": [<specific prices found>],
    "medianPrice": <median if multiple sources>,
    "priceRange": { "low": <min>, "high": <max> },
    "marketTrend": "rising" | "falling" | "stable",
    "demandLevel": "high" | "medium" | "low"
  }
}

RULES:
- Use real-time web data — do not rely on training data for prices
- Cross-reference at least 2 sources when possible
- Note the date of any price data found
- If market data is sparse, lower your confidence accordingly`;
}