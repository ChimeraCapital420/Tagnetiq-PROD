// FILE: src/lib/oracle/chat/detectors.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat — Intent & Feature Detectors
// ═══════════════════════════════════════════════════════════════════════
// Extracted from chat.ts monolith (Phase 1).
// Pure functions — no side effects, no DB calls.
//
// Contains:
//   - isRecallQuestion()      — visual memory recall detection
//   - isContentCreationRequest() — listing/video/brag card detection
//   - isMarketQuery()         — Liberation 7 market query detection
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