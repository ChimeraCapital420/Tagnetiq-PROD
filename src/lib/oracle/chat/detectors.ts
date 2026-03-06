// FILE: src/lib/oracle/chat/detectors.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat — Intent & Feature Detectors
// ═══════════════════════════════════════════════════════════════════════
// Extracted from chat.ts monolith (Phase 1).
// Pure functions — no side effects, no DB calls.
//
// Contains:
//   - isRecallQuestion()          — visual memory recall detection
//   - isContentCreationRequest()  — listing/video/brag card detection
//   - isMarketQuery()             — Liberation 7 market query detection
//   - detectRefinementIntent()    — Liberation 11: correction intent
// ═══════════════════════════════════════════════════════════════════════

import type { ContentDetectionResult } from './types.js';

// =============================================================================
// RECALL DETECTION
// =============================================================================

/**
 * Detect if the user is asking a recall/memory question.
 * These trigger visual memory search (Oracle Eyes).
 *
 * Examples:
 *   "Where did I put my keys?" → true
 *   "What was on that receipt?" → true
 *   "How much is a 1964 penny worth?" → false
 */
export function isRecallQuestion(message: string): boolean {
  const lower = message.toLowerCase();

  const recallPatterns = [
    /where\s+(?:did|do|are|is|was|were)\s+(?:i|my|the)/,
    /where\s+(?:are|is)\s+my/,
    /where.*(?:put|leave|left|place|set|store)/,
    /what\s+(?:did|do)\s+(?:i|we)\s+(?:see|scan|capture|photograph|look at)/,
    /what\s+(?:was|were)\s+(?:in|on|at)\s+(?:the|my|that)/,
    /(?:find|seen|remember|recall)\s+my/,
    /have\s+you\s+seen/,
    /do\s+you\s+remember\s+(?:seeing|where|what|when)/,
    /what\s+(?:did|does|was)\s+(?:that|the)\s+(?:receipt|label|tag|document|paper|article|sign)/,
    /what(?:'s|\s+is)\s+in\s+(?:my|the)/,
    /show\s+me\s+(?:what|everything)\s+(?:you\s+)?(?:saw|see|remember)/,
  ];

  return recallPatterns.some(pattern => pattern.test(lower));
}

// =============================================================================
// CONTENT CREATION DETECTION
// =============================================================================

/**
 * Detect if the user is requesting content creation (listing, video, brag card).
 * Returns the detected mode and platform if applicable.
 *
 * Examples:
 *   "List this on eBay" → { isCreation: true, mode: 'listing', platform: 'ebay' }
 *   "Make me a video" → { isCreation: true, mode: 'video' }
 *   "Show me a brag card" → { isCreation: true, mode: 'brag_card' }
 *   "What's this worth?" → { isCreation: false }
 */
export function isContentCreationRequest(message: string): ContentDetectionResult {
  const lower = message.toLowerCase();

  // ── Listing patterns (with platform extraction) ───
  const listingPatterns = [
    /(?:list|sell|post)\s+(?:this|my|that|the)\s+(?:on|to)\s+(ebay|mercari|poshmark|facebook|amazon|whatnot)/i,
    /(?:write|create|make|generate)\s+(?:a|me|my)?\s*(?:listing|description)/i,
    /(?:help me )?list\s+(?:this|it|my)/i,
  ];

  for (const pattern of listingPatterns) {
    const match = message.match(pattern);
    if (match) {
      return {
        isCreation: true,
        mode: 'listing',
        platform: match[1]?.toLowerCase() || 'ebay',
      };
    }
  }

  // ── Video creation ────────────────────────────────
  if (/(?:make|create|generate)\s+(?:a|me)?\s*video/i.test(lower)) {
    return { isCreation: true, mode: 'video' };
  }

  // ── Brag card / flex ──────────────────────────────
  if (
    /(?:brag|flex)\s*card/i.test(lower) ||
    /(?:celebrate|show off)\s+(?:this|my)\s+(?:flip|sale|win)/i.test(lower)
  ) {
    return { isCreation: true, mode: 'brag_card' };
  }

  return { isCreation: false };
}

// =============================================================================
// MARKET QUERY DETECTION (Liberation 7)
// =============================================================================

/**
 * Detect if the user is asking a market/pricing question.
 * Used to trigger live market data fetch for Pro/Elite users.
 *
 * Checks both the client intent hint AND message patterns.
 * The intent hint from the client is checked first (zero cost).
 *
 * Examples:
 *   "What's it worth?" → true
 *   "Check the eBay price" → true
 *   "Tell me a joke" → false
 */
export function isMarketQuery(message: string, intent: string): boolean {
  // Client already detected it — trust the hint
  if (intent === 'market_query') return true;

  const lower = message.toLowerCase();

  const marketPatterns = [
    /(?:what(?:'s|\s+is|\s+are))\s+(?:it|they|those|this|that|these)\s+(?:worth|going for|selling for)/i,
    /(?:how much)\s+(?:is|are|does|do|could|should)/i,
    /(?:check|pull|look up|search)\s+(?:the\s+)?(?:price|market|ebay|value)/i,
    /(?:current|live|recent)\s+(?:price|value|market|listing)/i,
    /what(?:'s|\s+is)\s+(?:the\s+)?(?:market|going rate|average price)/i,
    /(?:price\s+check|comp\s+check)/i,
  ];

  return marketPatterns.some(p => p.test(lower));
}

// =============================================================================
// REFINEMENT INTENT DETECTION (Liberation 11)
// =============================================================================

export interface RefinementIntentResult {
  isRefinement: boolean;
  score: number;
  matchedPatterns: string[];
}

/**
 * Detect if the user is correcting a scan result conversationally.
 *
 * CRITICAL GUARD: Only fires when analysisContext is not null.
 * Without a scan in context, "it's actually a Rolex" is a general
 * question, NOT a refinement. This prevents false positives on every
 * message that contains "actually."
 *
 * Score >= 0.6 = refinement intent confirmed.
 *
 * Examples (with analysisContext present):
 *   "That's actually a 4ft Green Bull ladder, not Green Line" → ~0.9
 *   "The brand should be Pyrex not Anchor Hocking" → ~0.85
 *   "Wrong size — it's a 6 not 4 foot" → ~0.8
 *   "What's this worth?" → 0 (no correction patterns match)
 *
 * Examples (WITHOUT analysisContext):
 *   "It's actually a Rolex" → 0 (guard fires, skipped immediately)
 */
export function detectRefinementIntent(
  message: string,
  analysisContext: any | null
): RefinementIntentResult {
  // ── CRITICAL GUARD ─────────────────────────────────────────────────
  // No scan context = no refinement. Period.
  if (!analysisContext) {
    return { isRefinement: false, score: 0, matchedPatterns: [] };
  }

  const lower = message.toLowerCase();
  const matchedPatterns: string[] = [];
  let score = 0;

  const patterns: Array<{ pattern: RegExp; label: string; weight: number }> = [
    // "actually" — soft correction signal
    { pattern: /\bactually\b/i,                                            label: 'actually',             weight: 0.35 },
    // "not X" — negation of current value
    { pattern: /\bnot\s+(?:a\s+|an\s+|the\s+)?\w+/i,                     label: 'negation',             weight: 0.45 },
    // "it's X not Y" or "that's X not Y"
    { pattern: /(?:it'?s?|that'?s?)\s+.+?\bnot\b/i,                       label: 'its_not',              weight: 0.70 },
    // "wrong / incorrect / mistaken"
    { pattern: /\b(?:wrong|incorrect|mistaken|inaccurate)\b/i,             label: 'explicit_wrong',       weight: 0.65 },
    // "should be / supposed to be"
    { pattern: /\b(?:should\s+be|supposed\s+to\s+be)\b/i,                 label: 'should_be',            weight: 0.65 },
    // Numeric size correction (4 foot, 6ft, 12oz, etc.)
    { pattern: /\b\d+\s*(?:foot|feet|ft|inch(?:es)?|in|gallon|oz|lb|cm)\b/i, label: 'size_correction',  weight: 0.30 },
    // Explicit field update request
    { pattern: /\b(?:update|fix|correct|change)\s+(?:the\s+)?(?:title|name|brand|size|model|description|year|color|type)\b/i,
                                                                            label: 'explicit_update',      weight: 0.80 },
    // "the [field] is [value]" — direct assignment
    { pattern: /\bthe\s+(?:brand|make|model|size|color|type|year)\s+is\b/i, label: 'field_assignment',   weight: 0.60 },
    // Trailing "not [thing]" — common correction tail
    { pattern: /,?\s+not\s+(?:a\s+|an\s+|the\s+)?\w+(?:\s+\w+)?[.!]?\s*$/i, label: 'trailing_not',    weight: 0.55 },
  ];

  for (const { pattern, label, weight } of patterns) {
    if (pattern.test(lower)) {
      matchedPatterns.push(label);
      score = Math.min(1, score + weight);
    }
  }

  // Bonus: message references a word from the current scan item name
  if (analysisContext.itemName) {
    const contextWords = analysisContext.itemName
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 3);
    const hasContextRef = contextWords.some((w: string) => lower.includes(w));
    if (hasContextRef) {
      score = Math.min(1, score + 0.20);
      matchedPatterns.push('context_reference');
    }
  }

  return {
    isRefinement: score >= 0.6,
    score,
    matchedPatterns,
  };
}