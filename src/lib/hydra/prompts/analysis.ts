/**
 * HYDRA v6.0 - Analysis Prompts
 * 
 * Main system prompts for item analysis.
 * Extracted from analyze.ts performAnalysis() function.
 * 
 * @module hydra/prompts/analysis
 */

/**
 * Main JSON analysis prompt for item identification and valuation
 * 
 * This prompt instructs AI models to:
 * 1. Analyze physical item characteristics
 * 2. Detect item category with high specificity
 * 3. Estimate market value
 * 4. Provide BUY/SELL decision
 * 5. List observable valuation factors
 * 
 * CRITICAL: AI must respond with ONLY valid JSON, no markdown or explanations
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are a professional appraiser analyzing an item for resale value. Focus ONLY on what you can actually observe about the PHYSICAL ITEM.

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY a valid JSON object - no other text, no markdown, no explanations
2. The JSON must have EXACTLY this structure:
{
  "itemName": "specific item name based on what you see",
  "category": "detected_category",
  "estimatedValue": 25.99,
  "decision": "BUY",
  "valuation_factors": ["Physical condition: excellent/good/fair/poor", "Material quality: leather/fabric/metal/etc", "Brand recognition: visible/none", "Market demand: high/medium/low", "Resale potential: strong/weak"],
  "summary_reasoning": "Brief explanation of why this specific item is worth the estimated value",
  "confidence": 0.85
}

CATEGORY DETECTION - YOU MUST CHOOSE THE MOST SPECIFIC CATEGORY:
- "pokemon_cards" - ANY Pokemon trading card (Pikachu, Charizard, Ampharos, etc.)
- "trading_cards" - Other TCG cards (MTG, Yu-Gi-Oh, sports cards)
- "coins" - ANY coin, currency, or banknote (Peace Dollar, Morgan, etc.)
- "lego" - LEGO sets and minifigures
- "video_games" - Video games and consoles
- "vinyl_records" - Vinyl records, LPs, music
- "comics" - Comic books, manga, graphic novels
- "books" - Books (non-comic)
- "sneakers" - Sneakers, shoes, streetwear
- "watches" - Watches and timepieces
- "jewelry" - Jewelry and gemstones
- "toys" - Toys and action figures
- "art" - Art and paintings
- "antiques" - Antiques and vintage items
- "electronics" - Electronics and gadgets
- "general" - ONLY if absolutely nothing else fits

IMPORTANT: Do NOT use "general" if you can identify the item type!
- If you see a Pokemon card → use "pokemon_cards"
- If you see a coin → use "coins"
- If you see a LEGO set → use "lego"

FORBIDDEN - NEVER mention these in valuation_factors:
❌ "AI analysis" ❌ "Professional analysis" ❌ "Machine learning" ❌ "Image recognition" 
❌ "Advanced algorithms" ❌ "Technical assessment" ❌ "AI-powered evaluation"

REQUIRED - valuation_factors must ONLY describe the PHYSICAL ITEM:
✅ "Excellent physical condition" ✅ "High-quality leather construction" ✅ "Recognizable brand logo"
✅ "Strong market demand for this type" ✅ "Good resale potential" ✅ "Minimal wear visible"

IMPORTANT RULES:
- ONLY identify brands you can CLEARLY see and verify from logos, tags, or distinctive features
- DO NOT guess or assume luxury brands unless you see clear authentic markings
- If you cannot clearly identify the brand, use generic descriptions
- Be specific about what you observe
- estimatedValue must be a realistic number based on what you can actually see
- decision must be exactly "BUY" or "SELL" (uppercase)
- confidence must be between 0 and 1
- Include exactly 5 valuation_factors focused on observable product features

Analyze this item for resale potential based on physical characteristics only:`;

/**
 * Supported categories for AI detection
 */
export const SUPPORTED_CATEGORIES = [
  'pokemon_cards',
  'trading_cards',
  'coins',
  'banknotes',
  'lego',
  'video_games',
  'vinyl_records',
  'comics',
  'books',
  'sneakers',
  'watches',
  'jewelry',
  'toys',
  'art',
  'antiques',
  'electronics',
  'general',
] as const;

export type SupportedCategory = typeof SUPPORTED_CATEGORIES[number];

/**
 * Expected JSON response structure from AI
 */
export interface AnalysisResponse {
  itemName: string;
  category: SupportedCategory;
  estimatedValue: number;
  decision: 'BUY' | 'SELL';
  valuation_factors: string[];
  summary_reasoning: string;
  confidence: number;
}

/**
 * Build the complete analysis prompt with optional context
 * 
 * @param context - Optional context to append to prompt
 * @returns Complete prompt string
 */
export function buildAnalysisPrompt(context?: {
  categoryHint?: string;
  itemNameHint?: string;
  additionalInstructions?: string;
}): string {
  let prompt = ANALYSIS_SYSTEM_PROMPT;
  
  if (context?.categoryHint) {
    prompt += `\n\nCategory hint from user: ${context.categoryHint}. Use this to guide your analysis but verify it matches what you see.`;
  }
  
  if (context?.itemNameHint) {
    prompt += `\n\nItem described as: "${context.itemNameHint}". Verify this matches the image.`;
  }
  
  if (context?.additionalInstructions) {
    prompt += `\n\n${context.additionalInstructions}`;
  }
  
  return prompt;
}

/**
 * Build user message for vision analysis
 * 
 * @param hasImage - Whether image is provided
 * @param itemDescription - Optional item description
 * @returns User message string
 */
export function buildUserMessage(hasImage: boolean, itemDescription?: string): string {
  if (hasImage) {
    return itemDescription 
      ? `Analyze this item: "${itemDescription}". Use the image provided to verify and provide accurate assessment.`
      : 'Analyze this item from the image provided. Identify it and assess its resale value.';
  }
  
  return itemDescription
    ? `Analyze this item based on description only: "${itemDescription}". Provide your best assessment without visual confirmation.`
    : 'Unable to analyze - no image or description provided.';
}

/**
 * Validate AI response matches expected schema
 * 
 * @param response - Parsed JSON response
 * @returns Validation result with errors if invalid
 */
export function validateAnalysisResponse(response: unknown): {
  valid: boolean;
  errors: string[];
  data?: AnalysisResponse;
} {
  const errors: string[] = [];
  
  if (!response || typeof response !== 'object') {
    return { valid: false, errors: ['Response is not an object'] };
  }
  
  const r = response as Record<string, unknown>;
  
  // Required fields
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
    errors.push('confidence must be a number between 0 and 1');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    errors: [],
    data: response as AnalysisResponse,
  };
}

/**
 * Forbidden phrases that should not appear in AI responses
 * Used to filter out self-referential AI language
 */
export const FORBIDDEN_PHRASES = [
  'AI analysis',
  'AI-powered',
  'machine learning',
  'image recognition',
  'advanced algorithms',
  'technical assessment',
  'professional analysis',
  'automated',
  'computer vision',
  'neural network',
] as const;

/**
 * Check if response contains forbidden AI-referential phrases
 * 
 * @param text - Text to check
 * @returns Array of found forbidden phrases
 */
export function findForbiddenPhrases(text: string): string[] {
  const textLower = text.toLowerCase();
  return FORBIDDEN_PHRASES.filter(phrase => 
    textLower.includes(phrase.toLowerCase())
  );
}

export default {
  ANALYSIS_SYSTEM_PROMPT,
  SUPPORTED_CATEGORIES,
  buildAnalysisPrompt,
  buildUserMessage,
  validateAnalysisResponse,
  FORBIDDEN_PHRASES,
  findForbiddenPhrases,
};