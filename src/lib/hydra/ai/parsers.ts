// FILE: src/lib/hydra/ai/parsers.ts
// Centralized JSON parsing logic for AI provider responses
// Extracted from base-provider.ts for reusability and testing

import type { ParsedAnalysis } from '../types.js';
import { SUPPORTED_CATEGORIES } from '../prompts/analysis.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ParseResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  rawContent?: string;
  cleanedContent?: string;
}

export interface ParserOptions {
  /** Provider name for logging */
  providerName?: string;
  /** Whether to attempt field name fixes */
  attemptFieldFix?: boolean;
  /** Whether to log parsing details */
  verbose?: boolean;
  /** Fallback item name if parsing fails */
  fallbackItemName?: string;
}

// =============================================================================
// FIELD MAPPINGS
// =============================================================================

/**
 * Common field name variations across different AI providers
 * Maps non-standard names to our canonical field names
 */
export const FIELD_MAPPINGS: Record<string, string[]> = {
  itemName: ['item_name', 'item', 'name', 'product_name', 'productName', 'title', 'product'],
  estimatedValue: ['estimated_value', 'value', 'price', 'estimated_price', 'estimatedPrice', 'market_value', 'marketValue'],
  decision: ['recommendation', 'action', 'buy_sell', 'buySell', 'verdict', 'assessment'],
  valuation_factors: ['factors', 'reasons', 'valuation_reasons', 'valuationFactors', 'key_factors', 'keyFactors', 'pricing_factors'],
  summary_reasoning: ['summary', 'reasoning', 'explanation', 'analysis', 'summaryReasoning', 'description', 'rationale'],
  confidence: ['confidence_score', 'confidenceScore', 'certainty', 'accuracy'],
  category: ['item_category', 'itemCategory', 'type', 'product_category', 'productCategory'],
};

/**
 * Decision value normalization mappings
 */
export const DECISION_MAPPINGS: Record<string, 'BUY' | 'SELL'> = {
  'BUY': 'BUY',
  'BUY IT': 'BUY',
  'PURCHASE': 'BUY',
  'ACQUIRE': 'BUY',
  'YES': 'BUY',
  'GOOD DEAL': 'BUY',
  'RECOMMENDED': 'BUY',
  'SELL': 'SELL',
  'PASS': 'SELL',
  'SKIP': 'SELL',
  'AVOID': 'SELL',
  'NO': 'SELL',
  'OVERPRICED': 'SELL',
  'NOT RECOMMENDED': 'SELL',
};

// =============================================================================
// MAIN PARSER FUNCTIONS
// =============================================================================

/**
 * Parse raw AI response into structured analysis
 * Handles various response formats and common issues
 */
export function parseAnalysisResponse(
  rawResult: string | null,
  options: ParserOptions = {}
): ParseResult<ParsedAnalysis> {
  const { providerName = 'Unknown', attemptFieldFix = true, verbose = false } = options;

  if (!rawResult) {
    return {
      success: false,
      data: null,
      error: 'Empty response',
    };
  }

  try {
    // Step 1: Clean the raw response
    const cleanedContent = cleanJsonResponse(rawResult);
    
    if (verbose) {
      console.log(`🔍 ${providerName} cleaned content:`, cleanedContent.substring(0, 200) + '...');
    }

    // Step 2: Extract JSON from content
    const jsonContent = extractJson(cleanedContent);
    
    if (!jsonContent) {
      return {
        success: false,
        data: null,
        error: 'Could not extract JSON from response',
        rawContent: rawResult.substring(0, 500),
        cleanedContent: cleanedContent.substring(0, 500),
      };
    }

    // Step 3: Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (parseError) {
      // Try to fix common JSON issues
      const fixedJson = attemptJsonFix(jsonContent);
      if (fixedJson) {
        parsed = JSON.parse(fixedJson);
      } else {
        throw parseError;
      }
    }

    // Step 4: Validate required fields
    if (!isValidAnalysis(parsed)) {
      if (attemptFieldFix) {
        // Try to fix field names
        const fixed = attemptFieldNameFix(parsed);
        if (isValidAnalysis(fixed)) {
          const normalized = normalizeAnalysis(fixed, providerName);
          return {
            success: true,
            data: normalized,
            cleanedContent: jsonContent,
          };
        }
      }
      
      return {
        success: false,
        data: null,
        error: 'Response missing required fields',
        rawContent: rawResult.substring(0, 500),
      };
    }

    // Step 5: Normalize the analysis
    const normalized = normalizeAnalysis(parsed, providerName);
    
    return {
      success: true,
      data: normalized,
      cleanedContent: jsonContent,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
    
    if (verbose) {
      console.error(`❌ ${providerName} parsing error:`, error);
      console.error(`Raw result sample: ${rawResult?.substring(0, 200)}...`);
    }

    return {
      success: false,
      data: null,
      error: errorMessage,
      rawContent: rawResult.substring(0, 500),
    };
  }
}

/**
 * Parse Perplexity-specific responses (market search data)
 * More lenient parsing that extracts price data from various formats
 */
export function parsePerplexityResponse(
  content: string | null,
  fallbackItemName: string,
  options: ParserOptions = {}
): ParseResult<ParsedAnalysis> {
  const { verbose = false } = options;

  if (!content) {
    return { success: false, data: null, error: 'Empty content' };
  }

  try {
    // Clean content
    let cleanedContent = content;
    
    // Remove markdown code blocks
    cleanedContent = cleanedContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    
    // Remove citation markers like [1], [2], etc.
    cleanedContent = cleanedContent.replace(/\[\d+\]/g, '');
    
    // Extract JSON
    const jsonContent = extractJson(cleanedContent);
    
    if (!jsonContent) {
      // Try to extract price from text as fallback
      const priceFromText = extractPriceFromText(content);
      if (priceFromText > 0) {
        return {
          success: true,
          data: {
            itemName: fallbackItemName,
            estimatedValue: priceFromText,
            decision: 'BUY',
            valuation_factors: [
              'Price extracted from market search',
              'Based on recent listings',
              'Market data partially parsed',
              'Condition affects value',
              'Verify before purchasing',
            ],
            summary_reasoning: 'Price extracted from Perplexity market search results.',
            confidence: 0.6,
          },
        };
      }
      
      return { success: false, data: null, error: 'Could not extract JSON or price' };
    }

    const parsed = JSON.parse(jsonContent);
    
    // Extract and normalize fields with Perplexity-specific handling
    const result: ParsedAnalysis = {
      itemName: parsed.itemName || parsed.item_name || parsed.product || fallbackItemName,
      estimatedValue: extractPrice(parsed),
      decision: normalizeDecision(parsed.decision || parsed.recommendation),
      valuation_factors: extractValuationFactors(parsed),
      summary_reasoning: parsed.summary_reasoning || parsed.summary || parsed.reasoning || 
                        parsed.analysis || 'Market data retrieved from online sources.',
      confidence: 0.85,
      category: parsed.category,
    };

    // Validate we got meaningful data
    if (result.estimatedValue <= 0) {
      const priceFromText = extractPriceFromText(content);
      if (priceFromText > 0) {
        result.estimatedValue = priceFromText;
      } else {
        return { success: false, data: null, error: 'Could not extract valid price' };
      }
    }

    return { success: true, data: result };

  } catch (error) {
    if (verbose) {
      console.error('Perplexity parsing error:', error);
      console.error('Raw content sample:', content?.substring(0, 300));
    }

    // Last resort: try to extract any price from the text
    const emergencyPrice = extractPriceFromText(content);
    if (emergencyPrice > 0) {
      return {
        success: true,
        data: {
          itemName: fallbackItemName,
          estimatedValue: emergencyPrice,
          decision: 'BUY',
          valuation_factors: [
            'Price extracted from market search',
            'Based on recent listings',
            'Market data partially parsed',
            'Condition affects value',
            'Verify before purchasing',
          ],
          summary_reasoning: 'Price extracted from Perplexity market search results.',
          confidence: 0.6,
        },
      };
    }

    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Clean raw JSON response from common formatting issues
 */
export function cleanJsonResponse(rawResult: string): string {
  let cleaned = rawResult;

  // Remove markdown code blocks
  cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

  // Remove any "Here is the JSON:" type prefixes
  cleaned = cleaned.replace(/^[^{]*?(?={)/i, '');

  // Remove any trailing text after the last }
  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace > -1) {
    cleaned = cleaned.substring(0, lastBrace + 1);
  }

  // Trim whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extract JSON object from mixed content
 */
export function extractJson(content: string): string | null {
  // Try to find JSON object
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  return null;
}

/**
 * Attempt to fix common JSON syntax errors
 */
export function attemptJsonFix(jsonString: string): string | null {
  let fixed = jsonString;

  try {
    // Fix trailing commas before closing brackets
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');

    // Fix missing quotes around property names
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // Fix single quotes to double quotes
    fixed = fixed.replace(/'/g, '"');

    // Test if it's valid
    JSON.parse(fixed);
    return fixed;
  } catch {
    return null;
  }
}

/**
 * Check if parsed object has all required analysis fields
 */
export function isValidAnalysis(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    'itemName' in obj &&
    'estimatedValue' in obj &&
    'decision' in obj &&
    'valuation_factors' in obj &&
    'summary_reasoning' in obj
  );
}

/**
 * Attempt to fix field names using known mappings
 */
export function attemptFieldNameFix(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const fixed = { ...obj };

  // Apply mappings
  for (const [standard, variations] of Object.entries(FIELD_MAPPINGS)) {
    if (fixed[standard] === undefined) {
      for (const variation of variations) {
        if (obj[variation] !== undefined) {
          fixed[standard] = obj[variation];
          break;
        }
      }
    }
  }

  return fixed;
}

/**
 * Normalize parsed analysis to ensure consistent types and values
 */
export function normalizeAnalysis(parsed: any, providerName?: string): ParsedAnalysis {
  const result: ParsedAnalysis = { ...parsed };

  // Ensure numeric estimatedValue
  if (typeof result.estimatedValue === 'string') {
    result.estimatedValue = parseFloat(result.estimatedValue.replace(/[$,]/g, ''));
  }
  if (isNaN(result.estimatedValue) || result.estimatedValue < 0) {
    result.estimatedValue = 0;
  }

  // Normalize decision
  result.decision = normalizeDecision(result.decision);

  // Ensure valuation_factors is an array of exactly 5 items
  if (!Array.isArray(result.valuation_factors)) {
    if (typeof result.valuation_factors === 'string') {
      result.valuation_factors = [result.valuation_factors];
    } else {
      result.valuation_factors = [];
    }
  }
  
  // Pad to 5 factors
  while (result.valuation_factors.length < 5) {
    result.valuation_factors.push(`Factor ${result.valuation_factors.length + 1}`);
  }
  // Trim to 5 factors
  if (result.valuation_factors.length > 5) {
    result.valuation_factors = result.valuation_factors.slice(0, 5);
  }

  // Ensure confidence is a number between 0 and 1
  if (typeof result.confidence !== 'number') {
    result.confidence = calculateConfidence(result);
  }
  result.confidence = Math.max(0, Math.min(1, result.confidence));

  // Normalize category if present
  if (result.category) {
    result.category = normalizeCategory(result.category);
  }

  return result;
}

/**
 * Normalize decision value to BUY or SELL
 */
export function normalizeDecision(decision: string | undefined): 'BUY' | 'SELL' {
  if (!decision) return 'SELL';

  const upper = decision.toUpperCase().trim();
  
  // Check direct mappings
  if (DECISION_MAPPINGS[upper]) {
    return DECISION_MAPPINGS[upper];
  }

  // Check partial matches
  for (const [key, value] of Object.entries(DECISION_MAPPINGS)) {
    if (upper.includes(key)) {
      return value;
    }
  }

  return 'SELL'; // Default to SELL if unknown
}

/**
 * Normalize category to supported values
 */
export function normalizeCategory(category: string): string {
  if (!category) return 'general';

  const lower = category.toLowerCase().trim().replace(/\s+/g, '_');
  
  // Check if it's a supported category
  if (SUPPORTED_CATEGORIES.includes(lower)) {
    return lower;
  }

  // Try partial matches
  for (const supported of SUPPORTED_CATEGORIES) {
    if (lower.includes(supported) || supported.includes(lower)) {
      return supported;
    }
  }

  return 'general';
}

/**
 * Calculate confidence score based on response completeness
 */
export function calculateConfidence(analysis: ParsedAnalysis): number {
  let confidence = 0.5;

  // Increase confidence based on completeness
  if (analysis.itemName && analysis.itemName.length > 3) confidence += 0.1;
  if (analysis.estimatedValue && analysis.estimatedValue > 0) confidence += 0.15;
  if (analysis.valuation_factors?.length >= 3) confidence += 0.15;
  if (analysis.summary_reasoning?.length > 50) confidence += 0.1;

  // Check decision validity
  if (['BUY', 'SELL'].includes(analysis.decision?.toUpperCase())) confidence += 0.05;

  return Math.min(confidence, 0.95);
}

/**
 * Extract price from various field formats (Perplexity-specific)
 */
export function extractPrice(parsed: any): number {
  const priceFields = [
    'estimatedValue', 'estimated_value', 'price', 'value',
    'average_price', 'averagePrice', 'market_price', 'marketPrice',
    'sold_price', 'soldPrice',
  ];

  for (const field of priceFields) {
    if (parsed[field] !== undefined) {
      const price = parseFloat(String(parsed[field]).replace(/[$,]/g, ''));
      if (!isNaN(price) && price > 0) {
        return price;
      }
    }
  }

  // Try price_range
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
 * Extract price from unstructured text as last resort
 */
export function extractPriceFromText(text: string): number {
  const pricePatterns = [
    /sold\s+(?:for\s+)?\$?([\d,]+(?:\.\d{2})?)/gi,
    /price[:\s]+\$?([\d,]+(?:\.\d{2})?)/gi,
    /\$\s*([\d,]+(?:\.\d{2})?)/g,
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|dollars?)/gi,
  ];

  const prices: number[] = [];

  for (const pattern of pricePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(price) && price > 0 && price < 1000000) {
        prices.push(price);
      }
    }
  }

  if (prices.length > 0) {
    // Return median price to avoid outliers
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  }

  return 0;
}

/**
 * Extract valuation factors from various formats
 */
export function extractValuationFactors(parsed: any): string[] {
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
    factors.push(`Sources: ${Array.isArray(parsed.market_sources) ? parsed.market_sources.join(', ') : parsed.market_sources}`);
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

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  parseAnalysisResponse,
  parsePerplexityResponse,
  cleanJsonResponse,
  extractJson,
  isValidAnalysis,
  normalizeAnalysis,
  normalizeDecision,
  calculateConfidence,
  extractPriceFromText,
};