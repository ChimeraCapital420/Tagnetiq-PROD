// FILE: src/lib/oracle/client/intent-detector.ts
// ═══════════════════════════════════════════════════════════════════════
// Client-Side Intent Detection (Liberation 2)
// ═══════════════════════════════════════════════════════════════════════
// Extracted from useOracleChat.ts monolith (Phase 1).
// Pure function — runs entirely on device, zero server cost.
//
// Mirrors server-side router.ts intent logic. If the client gets it
// right, the server skips its own detection. If wrong, server overrides.
//
// Liberation 10: how_to intent added for authoritative teaching links.
// ═══════════════════════════════════════════════════════════════════════

export type ClientIntent =
  | 'casual'
  | 'quick_answer'
  | 'deep_analysis'
  | 'market_query'
  | 'how_to'
  | 'vision'
  | 'strategy'
  | 'creative';

// =============================================================================
// INTENT SIGNALS — keyword maps for each intent type
// =============================================================================

export const INTENT_SIGNALS: Record<ClientIntent, string[]> = {
  vision: [
    'look at', 'see this', 'what is this', 'identify', 'can you see',
    'in the image', 'in the photo', 'this item', 'what do you see',
    'scan this', 'check this out',
  ],
  deep_analysis: [
    'break down', 'analyze', 'explain why', 'valuation factors',
    'deep dive', 'tell me everything', 'comprehensive', 'detailed',
    'compare', 'versus', 'pros and cons', 'full analysis',
  ],
  market_query: [
    'trending', 'market', 'what\'s hot', 'price trend', 'going up',
    'going down', 'selling for', 'recent sales', 'comps', 'ebay price',
    'what are people paying', 'current price', 'market value',
  ],
  how_to: [
    // Learning / teaching signals
    'how do i', 'how to', 'how can i', 'teach me', 'show me how',
    'walk me through', 'explain how', 'what\'s the best way to',
    'step by step', 'step-by-step', 'guide me', 'tutorial',
    'instructions for', 'learn to', 'learn how', 'where can i learn',
    // Repair / troubleshooting signals
    'diagnose', 'troubleshoot', 'fix my', 'repair', 'maintain',
    'what\'s wrong with', 'not working', 'won\'t start',
    // Technique / skill signals
    'technique for', 'method for', 'practice', 'improve at',
    'tips for', 'best practice', 'proper way to',
    // Resource signals
    'resources for', 'recommend a video', 'youtube', 'good video',
    'where to find', 'any guides', 'reference material',
    'chilton', 'haynes', 'manual for',
  ],
  strategy: [
    'should i sell', 'should i hold', 'should i buy', 'flip',
    'investment', 'portfolio', 'best strategy', 'when to sell',
    'where to sell', 'listing strategy', 'pricing strategy',
    'what should i do with', 'my collection',
  ],
  creative: [
    'tell me a joke', 'what do you think about', 'your opinion',
    'favorite', 'fun fact', 'story', 'interesting', 'what\'s your name',
    'who are you', 'personality',
  ],
  quick_answer: [
    'how much', 'what\'s it worth', 'worth anything', 'price check',
    'quick question', 'is this worth', 'value of', 'how many',
  ],
  casual: [
    'hey', 'hi', 'hello', 'what\'s up', 'sup', 'yo', 'good morning',
    'how are you', 'what\'s good', 'howdy', 'how\'s it going',
  ],
};

// =============================================================================
// PRIORITY ORDER — more specific intents checked first
// =============================================================================
// how_to BEFORE quick_answer so "how do I fix" doesn't match "how" in quick_answer

const INTENT_PRIORITY: ClientIntent[] = [
  'vision', 'deep_analysis', 'market_query', 'how_to',
  'strategy', 'creative', 'quick_answer', 'casual',
];

// =============================================================================
// DETECTION
// =============================================================================

/**
 * Detect the user's intent from their message text.
 * Runs entirely on-device — zero server cost, ~0ms.
 *
 * Priority order ensures specific intents win over generic ones.
 * Falls back to heuristics for messages that don't match any signal.
 *
 * @param message - Raw user message text
 * @returns Detected intent string
 */
export function detectClientIntent(message: string): ClientIntent {
  const lower = message.toLowerCase().trim();

  // Signal-based detection (priority order)
  for (const intent of INTENT_PRIORITY) {
    const signals = INTENT_SIGNALS[intent];
    for (const signal of signals) {
      if (lower.includes(signal)) return intent;
    }
  }

  // Heuristic fallbacks
  if (lower.length > 100) return 'deep_analysis';
  if (lower.includes('?') && lower.length < 50) return 'quick_answer';

  return 'casual';
}