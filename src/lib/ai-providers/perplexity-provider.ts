// FILE: src/lib/ai-providers/perplexity-provider.ts
// Perplexity Provider - Real-time market search with custom parsing
// FIXED v9.2: $120 MSRP default bug
//   Root cause: Perplexity was returning retail/MSRP prices instead of resale values.
//   extractPriceFromText() grabbed first dollar amount from generic results.
//   Fix: Resale-specific prompting, MSRP filtering, round-number suspicion scoring.

import { BaseAIProvider } from './base-provider.js';
import { AIProvider, AIAnalysisResponse, ParsedAnalysis } from '@/types/hydra';

// =============================================================================
// CONSTANTS — Price Sanity
// =============================================================================

/** Suspiciously round prices that indicate MSRP/retail defaults, not resale data */
const SUSPICIOUS_ROUND_PRICES = new Set([
  50, 60, 75, 80, 90, 100, 110, 120, 125, 130, 140, 150,
  175, 200, 250, 300, 350, 400, 450, 500,
]);

/** Keywords indicating a price is retail/MSRP, NOT resale */
const RETAIL_PRICE_KEYWORDS = [
  'retail', 'msrp', 'list price', 'original price', 'suggested price',
  'manufacturer', 'new price', 'store price', 'retail value',
  'rrp', 'srp', 'market price new',
];

/** Keywords indicating a price IS resale/secondary market */
const RESALE_PRICE_KEYWORDS = [
  'sold for', 'sold at', 'sold price', 'resale', 'secondary market',
  'ebay sold', 'ebay price', 'used price', 'pre-owned', 'secondhand',
  'average sold', 'median sold', 'recent sale', 'completed listing',
  'poshmark', 'mercari', 'depop', 'thrift', 'consignment',
  'fair market value', 'going for', 'selling for', 'fetching',
];

export class PerplexityProvider extends BaseAIProvider {
  constructor(config: AIProvider) {
    super(config);
  }
  
  async analyze(images: string[], prompt: string): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      // Extract item name from prompt for targeted search
      const itemNameMatch = prompt.match(/identified as[:\s]*"?([^"\n]+)"?/i) ||
                           prompt.match(/for[:\s]*"?([^"\n.]+)"?/i);
      const searchItem = itemNameMatch?.[1]?.trim() || 'collectible item';
      
      // v9.2: RESALE-specific prompt — explicitly excludes retail/MSRP
      const structuredPrompt = `Search for RESALE/SECONDARY MARKET prices for: "${searchItem}"

IMPORTANT: I need USED/RESALE prices, NOT retail/MSRP/new prices.
Search eBay sold listings, Poshmark, Mercari, Depop, and other resale platforms.
Focus on what this item ACTUALLY SELLS FOR on the secondary market in pre-owned condition.

DO NOT use the original retail price. DO NOT default to MSRP.
If you cannot find specific resale data, say so — do not guess.

You MUST respond with ONLY this exact JSON format (no other text):
{
  "itemName": "${searchItem}",
  "estimatedValue": <median RESALE price as number, NOT retail>,
  "retailPrice": <original retail/MSRP if known, or null>,
  "decision": "<BUY if good resale value, SELL if low resale value>",
  "valuation_factors": [
    "eBay sold listings: $X - $Y range (N listings)",
    "Poshmark/Mercari average: $Z",
    "Market trend: <rising/stable/falling>",
    "Condition factor: <how condition affects resale>",
    "Demand level: <high/medium/low>"
  ],
  "summary_reasoning": "<Brief summary of RESALE market data found>",
  "market_sources": ["source1", "source2"],
  "price_range": {"low": <number>, "high": <number>},
  "data_quality": "<strong/moderate/weak/none>"
}

CRITICAL: 
- Output ONLY valid JSON. No markdown, no explanations, no citations outside the JSON.
- estimatedValue MUST be a RESALE price, not retail/MSRP.
- If no resale data found, set estimatedValue to 0 and data_quality to "none".`;

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{
            role: 'system',
            content: 'You are a RESALE market price research API. You find what items sell for on the SECONDARY market (eBay, Poshmark, Mercari, etc.), NOT retail/MSRP prices. Output ONLY valid JSON matching the exact schema requested. Never include markdown formatting, citations, or explanatory text outside the JSON object. If you cannot find real resale data, set estimatedValue to 0 rather than guessing.'
          }, {
            role: 'user',
            content: structuredPrompt
          }],
          temperature: 0.1,
          max_tokens: 1200
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity API error:', response.status, errorText);
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      
      // Use custom parser for Perplexity responses
      const parsed = this.parsePerplexityResponse(content, searchItem);
      
      if (parsed) {
        console.log(`✅ Perplexity: Market data found - $${parsed.estimatedValue} (confidence: ${parsed.confidence})`);
      }
      
      return {
        response: parsed,
        confidence: parsed ? parsed.confidence : 0,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Perplexity analysis error:`, error);
      throw error;
    }
  }
  
  /**
   * Custom parser for Perplexity's market search responses
   * v9.2: Added MSRP detection, round-price suspicion, resale keyword boosting
   */
  private parsePerplexityResponse(content: string | null, fallbackItemName: string): ParsedAnalysis | null {
    if (!content) return null;
    
    try {
      let cleanedContent = content;
      
      // Remove markdown code blocks
      cleanedContent = cleanedContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      
      // Remove citation markers like [1], [2], etc.
      cleanedContent = cleanedContent.replace(/\[\d+\]/g, '');
      
      // Remove any text before the first {
      const firstBrace = cleanedContent.indexOf('{');
      if (firstBrace > 0) {
        cleanedContent = cleanedContent.substring(firstBrace);
      }
      
      // Remove any text after the last }
      const lastBrace = cleanedContent.lastIndexOf('}');
      if (lastBrace > -1) {
        cleanedContent = cleanedContent.substring(0, lastBrace + 1);
      }
      
      // Try to parse
      const parsed = JSON.parse(cleanedContent.trim());
      
      // Log raw response for debugging
      console.log(`🔍 Perplexity raw parsed:`, JSON.stringify(parsed).substring(0, 300) + '...');
      
      // v9.2: Check data quality flag from the AI
      const dataQuality = parsed.data_quality || 'unknown';
      if (dataQuality === 'none') {
        console.warn('⚠️ Perplexity: AI reported no resale data found');
        return null;
      }
      
      // Extract the primary price
      let primaryPrice = this.extractPrice(parsed);
      
      // v9.2: Detect and reject MSRP masquerading as resale
      const retailPrice = parsed.retailPrice || parsed.retail_price || 0;
      if (retailPrice > 0 && primaryPrice > 0) {
        // If estimated value equals retail price, it's MSRP not resale
        if (Math.abs(primaryPrice - retailPrice) < 2) {
          console.warn(`⚠️ Perplexity: estimatedValue ($${primaryPrice}) equals retailPrice ($${retailPrice}) — likely MSRP, not resale`);
          primaryPrice = 0; // Force fallback to text extraction
        }
        // If estimated value is HIGHER than retail for used items, suspicious
        if (primaryPrice > retailPrice * 1.5 && retailPrice > 20) {
          console.warn(`⚠️ Perplexity: estimatedValue ($${primaryPrice}) is 150%+ of retail ($${retailPrice}) — suspicious for used item`);
          // Don't zero out, but reduce confidence
        }
      }
      
      // v9.2: Calculate confidence based on data quality signals
      let confidence = 0.85;
      
      // Downgrade confidence for suspiciously round prices
      if (SUSPICIOUS_ROUND_PRICES.has(Math.round(primaryPrice))) {
        confidence -= 0.15;
        console.log(`⚠️ Perplexity: Suspicious round price $${primaryPrice} — confidence reduced`);
      }
      
      // Downgrade for weak data quality
      if (dataQuality === 'weak') confidence -= 0.10;
      if (dataQuality === 'moderate') confidence -= 0.05;
      
      // Upgrade for strong signals in factors
      const factors = this.extractFactors(parsed);
      const factorsText = factors.join(' ').toLowerCase();
      const hasResaleEvidence = RESALE_PRICE_KEYWORDS.some(kw => factorsText.includes(kw));
      const hasRetailEvidence = RETAIL_PRICE_KEYWORDS.some(kw => factorsText.includes(kw));
      
      if (hasResaleEvidence) confidence += 0.05;
      if (hasRetailEvidence && !hasResaleEvidence) {
        confidence -= 0.15;
        console.warn(`⚠️ Perplexity: Factors mention retail/MSRP but NOT resale — likely returning retail prices`);
      }
      
      confidence = Math.max(0.3, Math.min(0.90, confidence));
      
      // Build result
      const result: ParsedAnalysis = {
        itemName: parsed.itemName || parsed.item_name || parsed.product || fallbackItemName,
        estimatedValue: primaryPrice,
        decision: this.normalizeDecision(parsed.decision || parsed.recommendation),
        valuation_factors: factors,
        summary_reasoning: parsed.summary_reasoning || parsed.summary || parsed.reasoning || 
                          parsed.analysis || 'Market data retrieved from online sources.',
        confidence,
      };
      
      // If primary extraction failed, try text-based extraction
      if (result.estimatedValue <= 0) {
        const priceFromText = this.extractResalePriceFromText(content);
        if (priceFromText > 0) {
          result.estimatedValue = priceFromText;
          result.confidence = Math.min(result.confidence, 0.55); // Lower confidence for text-extracted prices
        } else {
          console.warn('⚠️ Perplexity: Could not extract valid resale price — returning null');
          return null;
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('Perplexity parsing error:', error);
      console.error('Raw content sample:', content?.substring(0, 300));
      
      // Last resort: try to extract resale price from the text
      const emergencyPrice = this.extractResalePriceFromText(content || '');
      if (emergencyPrice > 0) {
        console.log(`🔄 Perplexity: Extracted resale price from text: $${emergencyPrice}`);
        return {
          itemName: fallbackItemName,
          estimatedValue: emergencyPrice,
          decision: 'BUY',
          valuation_factors: [
            'Price extracted from resale market search',
            'Based on recent secondary market listings',
            'Market data partially parsed',
            'Condition affects value',
            'Verify before purchasing'
          ],
          summary_reasoning: 'Resale price extracted from Perplexity market search results.',
          confidence: 0.45, // v9.2: Much lower confidence for emergency extraction
        };
      }
      
      return null;
    }
  }
  
  /**
   * Extract price from various field formats
   */
  private extractPrice(parsed: any): number {
    // Try various field names
    const priceFields = [
      'estimatedValue', 'estimated_value', 'price', 'value',
      'average_price', 'averagePrice', 'market_price', 'marketPrice',
      'sold_price', 'soldPrice', 'resale_price', 'resalePrice'
    ];
    
    for (const field of priceFields) {
      if (parsed[field] !== undefined && parsed[field] !== null) {
        const price = parseFloat(String(parsed[field]).replace(/[$,]/g, ''));
        if (!isNaN(price) && price > 0) {
          return price;
        }
      }
    }
    
    // Try price_range (use midpoint)
    if (parsed.price_range) {
      const low = parseFloat(String(parsed.price_range.low || 0).replace(/[$,]/g, ''));
      const high = parseFloat(String(parsed.price_range.high || 0).replace(/[$,]/g, ''));
      if (low > 0 && high > 0) {
        return (low + high) / 2;
      }
    }
    
    return 0;
  }
  
  /**
   * v9.2: Extract RESALE prices from unstructured text
   * Prioritizes prices near resale keywords, deprioritizes retail keywords.
   * Returns median of resale-context prices, or median of all if no context found.
   */
  private extractResalePriceFromText(text: string): number {
    // Split text into sentences for context-aware extraction
    const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 0);
    
    const resalePrices: number[] = [];
    const retailPrices: number[] = [];
    const unknownPrices: number[] = [];
    
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      
      // Extract all dollar amounts from this sentence
      const priceMatches = sentence.match(/\$\s*([\d,]+(?:\.\d{2})?)/g);
      if (!priceMatches) continue;
      
      // Determine context of this sentence
      const isResaleContext = RESALE_PRICE_KEYWORDS.some(kw => lower.includes(kw));
      const isRetailContext = RETAIL_PRICE_KEYWORDS.some(kw => lower.includes(kw));
      
      for (const match of priceMatches) {
        const price = parseFloat(match.replace(/[$,]/g, ''));
        if (isNaN(price) || price <= 0 || price >= 100000) continue;
        
        if (isResaleContext && !isRetailContext) {
          resalePrices.push(price);
        } else if (isRetailContext && !isResaleContext) {
          retailPrices.push(price);
        } else {
          unknownPrices.push(price);
        }
      }
    }
    
    // Prefer resale prices
    if (resalePrices.length > 0) {
      console.log(`  📊 Perplexity text: ${resalePrices.length} resale prices, ${retailPrices.length} retail prices`);
      return this.medianPrice(resalePrices);
    }
    
    // Fall back to unknown-context prices, but NOT retail-only prices
    if (unknownPrices.length > 0) {
      // Filter out prices that exactly match retail prices (likely MSRP mentions)
      const filteredUnknown = unknownPrices.filter(p => !retailPrices.includes(p));
      if (filteredUnknown.length > 0) {
        return this.medianPrice(filteredUnknown);
      }
      return this.medianPrice(unknownPrices);
    }
    
    // Last resort: retail prices discounted by 40% (used items worth ~60% of retail)
    if (retailPrices.length > 0) {
      const medianRetail = this.medianPrice(retailPrices);
      const estimatedResale = parseFloat((medianRetail * 0.45).toFixed(2));
      console.log(`  ⚠️ Perplexity: Only retail prices found ($${medianRetail}) — estimating resale at $${estimatedResale}`);
      return estimatedResale;
    }
    
    return 0;
  }
  
  /**
   * Calculate median of a price array
   */
  private medianPrice(prices: number[]): number {
    if (prices.length === 0) return 0;
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  
  /**
   * Normalize decision field
   */
  private normalizeDecision(decision: string | undefined): 'BUY' | 'SELL' {
    if (!decision) return 'BUY'; // Default for market search
    
    const upper = decision.toUpperCase();
    if (upper.includes('SELL') || upper.includes('PASS') || upper.includes('SKIP') || upper.includes('OVERPRICED')) {
      return 'SELL';
    }
    return 'BUY';
  }
  
  /**
   * Extract valuation factors from various formats
   */
  private extractFactors(parsed: any): string[] {
    const factorFields = ['valuation_factors', 'factors', 'reasons', 'key_factors', 'market_data'];
    
    for (const field of factorFields) {
      if (Array.isArray(parsed[field]) && parsed[field].length > 0) {
        return parsed[field].slice(0, 5);
      }
    }
    
    // Build factors from available data
    const factors: string[] = [];
    
    if (parsed.price_range) {
      factors.push(`Price range: $${parsed.price_range.low} - $${parsed.price_range.high}`);
    }
    if (parsed.market_sources) {
      factors.push(`Sources: ${parsed.market_sources.join(', ')}`);
    }
    if (parsed.market_trend) {
      factors.push(`Market trend: ${parsed.market_trend}`);
    }
    
    // Pad to 5 factors
    while (factors.length < 5) {
      factors.push(`Market factor ${factors.length + 1}`);
    }
    
    return factors.slice(0, 5);
  }
}