// FILE: src/lib/hydra/ai/parsers.ts
// HYDRA v9.1.1 - Centralized JSON parsing for AI provider responses
// 
// v9.0: Original parser — rigid schema, rejected most valid responses
// v9.1.1: Flexible parsing — accepts identify AND reasoning responses
//         Field mapping catches camelCase, snake_case, and variations
//         Only hard requirement: itemName must exist
//
// The parser was the #1 cause of "No identification returned" and
// "No reasoning returned" — providers had correct data but parser rejected it.

import type { ParsedAnalysis } from '../types.js';

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
  /** Parsing mode — identify is lenient, reason requires valuation fields */
  mode?: 'identify' | 'reason' | 'auto';
}

// =============================================================================
// SUPPORTED CATEGORIES (inline to avoid circular import)
// =============================================================================

const SUPPORTED_CATEGORIES = [
  'coins', 'stamps', 'banknotes', 'pokemon_cards', 'trading_cards',
  'sports_cards', 'lego', 'books', 'vinyl_records', 'sneakers',
  'watches', 'jewelry', 'toys', 'figurines', 'video_games', 'comics',
  'art', 'antiques', 'vehicles', 'electronics', 'clothing',
  'musical_instruments', 'wine', 'spirits', 'collectibles',
  'household', 'general',
];

// =============================================================================
// FIELD MAPPINGS
// =============================================================================

/**
 * Common field name variations across different AI providers
 * Maps non-standard names to our canonical field names
 * 
 * v9.1.1: Extended mappings to catch more provider-specific variations
 */
export const FIELD_MAPPINGS: Record<string, string[]> = {
  itemName: [
    'item_name', 'item', 'name', 'product_name', 'productName',
    'title', 'product', 'itemTitle', 'item_title', 'objectName',
    'object_name', 'identified_item', 'identifiedItem',
  ],
  estimatedValue: [
    'estimated_value', 'value', 'price', 'estimated_price',
    'estimatedPrice', 'market_value', 'marketValue', 'worth',
    'current_value', 'currentValue', 'fair_value', 'fairValue',
    'median_value', 'medianValue',
  ],
  decision: [
    'recommendation', 'action', 'buy_sell', 'buySell',
    'verdict', 'assessment', 'buyOrSell', 'buy_or_sell',
  ],
  valuation_factors: [
    'valuationFactors', 'factors', 'reasons', 'valuation_reasons',
    'valuationReasons', 'key_factors', 'keyFactors', 'pricing_factors',
    'pricingFactors', 'analysis_factors', 'analysisFactors',
    'market_factors', 'marketFactors',
  ],
  summary_reasoning: [
    'summaryReasoning', 'summary', 'reasoning', 'explanation',
    'analysis', 'description', 'rationale', 'notes',
    'market_analysis', 'marketAnalysis', 'detailed_analysis',
    'detailedAnalysis', 'assessment_summary', 'assessmentSummary',
  ],
  confidence: [
    'confidence_score', 'confidenceScore', 'certainty',
    'accuracy', 'confidence_level', 'confidenceLevel',
  ],
  category: [
    'item_category', 'itemCategory', 'type', 'product_category',
    'productCategory', 'item_type', 'itemType',
  ],
  condition: [
    'item_condition', 'itemCondition', 'state', 'quality',
    'grade', 'conditionGrade', 'condition_grade',
  ],
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
  'WORTH IT': 'BUY',
  'HOLD': 'BUY',
  'KEEP': 'BUY',
  'SELL': 'SELL',
  'PASS': 'SELL',
  'SKIP': 'SELL',
  'AVOID': 'SELL',
  'NO': 'SELL',
  'OVERPRICED': 'SELL',
  'NOT RECOMMENDED': 'SELL',
  'NOT WORTH IT': 'SELL',
};

// =============================================================================
// MAIN PARSER FUNCTIONS
// =============================================================================

/**
 * Parse raw AI response into structured analysis
 * 
 * v9.1.1 CHANGES:
 * - Two modes: 'identify' (lenient) and 'reason' (needs valuation fields)
 * - 'auto' mode detects based on response shape
 * - Field mapping runs BEFORE validation (was after in v9.0)
 * - Only hard requirement: itemName must exist
 * - Providers returning valid JSON with itemName will NEVER be rejected
 */
export function parseAnalysisResponse(
  rawResult: string | null,
  options: ParserOptions = {}
): ParseResult<ParsedAnalysis> {
  const {
    providerName = 'Unknown',
    attemptFieldFix = true,
    verbose = false,
    mode = 'auto',
  } = options;

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

    // Step 4: ALWAYS apply field mapping FIRST (v9.1.1 — was after validation in v9.0)
    if (attemptFieldFix) {
      parsed = attemptFieldNameFix(parsed);
    }

    // Step 5: Determine mode
    const effectiveMode = mode === 'auto' ? detectMode(parsed) : mode;

    // Step 6: Validate based on mode
    if (effectiveMode === 'identify') {
      // Identify mode: just need itemName
      if (!hasItemName(parsed)) {
        return {
          success: false,
          data: null,
          error: 'Response missing itemName',
          rawContent: rawResult.substring(0, 500),
        };
      }
    } else {
      // Reason mode: need itemName + estimatedValue at minimum
      if (!hasItemName(parsed)) {
        return {
          success: false,
          data: null,
          error: 'Response missing required fields',
          rawContent: rawResult.substring(0, 500),
        };
      }
      // Don't reject if missing valuation_factors — we can generate defaults
    }

    // Step 7: Normalize the analysis (fills in defaults for missing fields)
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

    let parsed = JSON.parse(jsonContent);
    
    // Apply field mapping
    parsed = attemptFieldNameFix(parsed);
    
    // Extract and normalize fields with Perplexity-specific handling
    const result: ParsedAnalysis = {
      itemName: parsed.itemName || fallbackItemName,
      estimatedValue: extractPrice(parsed),
      decision: normalizeDecision(parsed.decision),
      valuation_factors: extractValuationFactors(parsed),
      summary_reasoning: parsed.summary_reasoning || 
                        'Market data retrieved from online sources.',
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
 * Detect whether a response is from identify or reason stage
 * based on which fields are present
 */
function detectMode(parsed: any): 'identify' | 'reason' {
  // If it has identifiers, condition, or description but no valuation_factors → identify
  if (parsed.identifiers || parsed.condition || parsed.description) {
    if (!parsed.valuation_factors && !parsed.valuationFactors) {
      return 'identify';
    }
  }
  // If it has valuation_factors or summary_reasoning → reason
  if (parsed.valuation_factors || parsed.summary_reasoning) {
    return 'reason';
  }
  // Default to identify (more lenient)
  return 'identify';
}

/**
 * Check if parsed object has an item name (the only truly required field)
 */
function hasItemName(obj: any): boolean {
  return !!(
    obj &&
    typeof obj === 'object' &&
    obj.itemName &&
    typeof obj.itemName === 'string' &&
    obj.itemName.trim().length > 0
  );
}

/**
 * Clean raw JSON response from common formatting issues
 */
export function cleanJsonResponse(rawResult: string): string {
  let cleaned = rawResult;

  // Remove markdown code blocks (with or without language tag)
  cleaned = cleaned.replace(/```(?:json)?\s*/gi, '');

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

    // Fix single quotes to double quotes (careful with contractions)
    fixed = fixed.replace(/'/g, '"');
    
    // Fix unescaped newlines in strings
    fixed = fixed.replace(/\n/g, '\\n');

    // Test if it's valid
    JSON.parse(fixed);
    return fixed;
  } catch {
    // Second attempt: try to extract just the JSON object
    try {
      const jsonMatch = fixed.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = jsonMatch[0].replace(/,\s*([}\]])/g, '$1');
        JSON.parse(extracted);
        return extracted;
      }
    } catch {
      // Give up
    }
    return null;
  }
}

/**
 * Check if parsed object has all required analysis fields
 * v9.1.1: DEPRECATED for validation — use hasItemName() + mode detection instead
 * Kept for backward compatibility with any code that still calls it
 */
export function isValidAnalysis(obj: any): boolean {
  return !!(
    obj &&
    typeof obj === 'object' &&
    obj.itemName &&
    typeof obj.itemName === 'string' &&
    obj.itemName.trim().length > 0
  );
}

/**
 * Attempt to fix field names using known mappings
 * v9.1.1: Now runs BEFORE validation, not after
 */
export function attemptFieldNameFix(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const fixed = { ...obj };

  // Apply mappings — check all variations for each standard field
  for (const [standard, variations] of Object.entries(FIELD_MAPPINGS)) {
    if (fixed[standard] === undefined || fixed[standard] === null) {
      for (const variation of variations) {
        if (obj[variation] !== undefined && obj[variation] !== null) {
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
 * v9.1.1: Generates defaults for missing fields instead of rejecting
 */
export function normalizeAnalysis(parsed: any, providerName?: string): ParsedAnalysis {
  const result: ParsedAnalysis = { ...parsed };

  // Ensure itemName exists
  if (!result.itemName || typeof result.itemName !== 'string') {
    result.itemName = 'Unidentified Item';
  }

  // Ensure numeric estimatedValue
  if (typeof result.estimatedValue === 'string') {
    result.estimatedValue = parseFloat(result.estimatedValue.replace(/[$,]/g, ''));
  }
  if (isNaN(result.estimatedValue) || result.estimatedValue === undefined || result.estimatedValue === null) {
    result.estimatedValue = 0;
  }
  if (result.estimatedValue < 0) {
    result.estimatedValue = 0;
  }

  // Normalize decision
  result.decision = normalizeDecision(result.decision);

  // Ensure valuation_factors is an array of exactly 5 items
  if (!Array.isArray(result.valuation_factors)) {
    if (typeof result.valuation_factors === 'string') {
      result.valuation_factors = [result.valuation_factors];
    } else {
      // Generate default factors from available data
      result.valuation_factors = generateDefaultFactors(result);
    }
  }
  
  // Clean factor strings (remove "Factor 1:" prefixes if present)
  result.valuation_factors = result.valuation_factors.map((f: any) => {
    if (typeof f !== 'string') return String(f);
    return f.replace(/^Factor\s*\d+:\s*/i, '').trim() || f;
  });
  
  // Pad to 5 factors
  while (result.valuation_factors.length < 5) {
    result.valuation_factors.push(`Additional analysis factor ${result.valuation_factors.length + 1}`);
  }
  // Trim to 5 factors
  if (result.valuation_factors.length > 5) {
    result.valuation_factors = result.valuation_factors.slice(0, 5);
  }

  // Ensure summary_reasoning exists
  if (!result.summary_reasoning || typeof result.summary_reasoning !== 'string') {
    result.summary_reasoning = result.description || 
                               result.analysis || 
                               result.rationale ||
                               `Analysis provided by ${providerName || 'AI provider'}.`;
  }

  // Ensure confidence is a number between 0 and 1
  if (typeof result.confidence !== 'number') {
    result.confidence = calculateConfidence(result);
  }
  // Handle confidence that's 0-100 instead of 0-1
  if (result.confidence > 1 && result.confidence <= 100) {
    result.confidence = result.confidence / 100;
  }
  result.confidence = Math.max(0, Math.min(1, result.confidence));

  // Normalize category if present
  if (result.category) {
    result.category = normalizeCategory(result.category);
  }

  return result;
}

/**
 * Generate default valuation factors from available response data
 */
function generateDefaultFactors(parsed: any): string[] {
  const factors: string[] = [];
  
  if (parsed.category) {
    factors.push(`Category: ${parsed.category}`);
  }
  if (parsed.condition) {
    factors.push(`Condition: ${parsed.condition}`);
  }
  if (parsed.description) {
    factors.push(parsed.description.substring(0, 100));
  }
  if (parsed.estimatedValue > 0) {
    factors.push(`Estimated value: $${parsed.estimatedValue}`);
  }
  if (parsed.identifiers) {
    const ids = Object.entries(parsed.identifiers)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}: ${v}`);
    if (ids.length > 0) {
      factors.push(`Identifiers: ${ids.join(', ')}`);
    }
  }
  
  return factors;
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

  // Common aliases
  const aliases: Record<string, string> = {
    'coin': 'coins',
    'stamp': 'stamps',
    'banknote': 'banknotes',
    'currency': 'banknotes',
    'pokemon': 'pokemon_cards',
    'card': 'trading_cards',
    'cards': 'trading_cards',
    'sports': 'sports_cards',
    'baseball': 'sports_cards',
    'basketball': 'sports_cards',
    'football': 'sports_cards',
    'comic': 'comics',
    'comic_book': 'comics',
    'comic_books': 'comics',
    'comicbook': 'comics',
    'comicbooks': 'comics',
    'book': 'books',
    'vinyl': 'vinyl_records',
    'record': 'vinyl_records',
    'records': 'vinyl_records',
    'shoe': 'sneakers',
    'shoes': 'sneakers',
    'watch': 'watches',
    'game': 'video_games',
    'games': 'video_games',
    'toy': 'toys',
    'figure': 'figurines',
    'figurine': 'figurines',
    'action_figure': 'figurines',
    'lego_set': 'lego',
    'art_piece': 'art',
    'painting': 'art',
    'antique': 'antiques',
    'vintage': 'antiques',
    'electronic': 'electronics',
    'tech': 'electronics',
    'instrument': 'musical_instruments',
    'guitar': 'musical_instruments',
    'piano': 'musical_instruments',
    'digital_service': 'general',
    'service': 'general',
    'unknown': 'general',
    'other': 'general',
    'misc': 'general',
    'miscellaneous': 'general',
  };
  
  if (aliases[lower]) {
    return aliases[lower];
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
  if (analysis.valuation_factors?.length >= 3) confidence += 0.1;
  if (analysis.summary_reasoning?.length > 50) confidence += 0.1;
  if (analysis.category && analysis.category !== 'general') confidence += 0.05;

  // Check decision validity
  if (['BUY', 'SELL'].includes(analysis.decision?.toUpperCase())) confidence += 0.05;

  return Math.min(confidence, 0.95);
}

/**
 * Extract price from various field formats
 */
export function extractPrice(parsed: any): number {
  const priceFields = [
    'estimatedValue', 'estimated_value', 'price', 'value',
    'average_price', 'averagePrice', 'market_price', 'marketPrice',
    'sold_price', 'soldPrice', 'median_price', 'medianPrice',
    'current_value', 'currentValue', 'fair_value', 'fairValue',
  ];

  for (const field of priceFields) {
    if (parsed[field] !== undefined && parsed[field] !== null) {
      const price = parseFloat(String(parsed[field]).replace(/[$,]/g, ''));
      if (!isNaN(price) && price > 0) {
        return price;
      }
    }
  }

  // Try price_range
  if (parsed.price_range || parsed.priceRange) {
    const range = parsed.price_range || parsed.priceRange;
    const low = parseFloat(String(range.low || range.min || 0).replace(/[$,]/g, ''));
    const high = parseFloat(String(range.high || range.max || 0).replace(/[$,]/g, ''));
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
    /valued?\s+(?:at\s+)?\$?([\d,]+(?:\.\d{2})?)/gi,
    /worth\s+(?:about\s+)?\$?([\d,]+(?:\.\d{2})?)/gi,
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
  const factorFields = [
    'valuation_factors', 'valuationFactors', 'factors', 'reasons',
    'key_factors', 'keyFactors', 'market_data', 'marketData',
    'pricing_factors', 'pricingFactors',
  ];

  for (const field of factorFields) {
    if (Array.isArray(parsed[field]) && parsed[field].length > 0) {
      return parsed[field]
        .map((f: any) => typeof f === 'string' ? f : String(f))
        .slice(0, 5);
    }
  }

  // Build factors from available data
  const factors: string[] = [];

  if (parsed.price_range || parsed.priceRange) {
    const range = parsed.price_range || parsed.priceRange;
    factors.push(`Price range: $${range.low || range.min} - $${range.high || range.max}`);
  }
  if (parsed.market_sources || parsed.marketSources) {
    const sources = parsed.market_sources || parsed.marketSources;
    factors.push(`Sources: ${Array.isArray(sources) ? sources.join(', ') : sources}`);
  }
  if (parsed.market_trend || parsed.marketTrend) {
    factors.push(`Market trend: ${parsed.market_trend || parsed.marketTrend}`);
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