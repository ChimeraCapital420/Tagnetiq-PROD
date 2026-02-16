// FILE: src/lib/oracle/providers/router.ts
// Oracle Conversation Router — picks the best model for each message
//
// Sprint F:  Provider Registry + Hot-Loading
// Sprint N+: Tier-aware routing — Pro/Elite/Admin get the full brain
//
// ROUTING PHILOSOPHY:
//   Free/Starter users → budget models (gpt-4o-mini, haiku, flash)
//   Pro users          → premium models (gpt-4o, claude-sonnet, gemini-pro)
//   Elite/Admin        → premium models + best provider for the intent
//
// The router analyzes the user's message + context + tier to select
// the optimal AI model. This is a fast, deterministic decision.

import type { OracleIdentity, AiDnaProfile } from '../types.js';
import {
  type OracleProviderId,
  type ProviderStrength,
  ORACLE_PROVIDERS,
  isProviderAvailable,
  getProvidersByStrength,
  getCheapestForStrength,
  getBestForStrength,
  resolveModelForTier,
} from './registry.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RoutingDecision {
  /** Selected provider ID */
  providerId: OracleProviderId;
  /** The actual model string to use (tier-resolved) */
  model: string;
  /** Why this provider was chosen (for logging) */
  reason: string;
  /** Ordered fallback providers if primary fails */
  fallbacks: OracleProviderId[];
  /** Detected message intent */
  intent: MessageIntent;
  /** Temperature override (if any) */
  temperature: number;
  /** Max tokens override (if any) */
  maxTokens: number;
}

export type MessageIntent =
  | 'casual'       // "hey what's up", small talk
  | 'quick_answer' // "what's this worth?", short factual
  | 'deep_analysis'// "break down the valuation factors for..."
  | 'market_query' // "what's trending", "price of X right now"
  | 'vision'       // References looking at something, image context
  | 'strategy'     // "should I sell or hold", portfolio advice
  | 'creative'     // Personality questions, humor, non-resale chat
  | 'speed';       // Live scanning, smart glasses, time-critical

// =============================================================================
// INTENT DETECTION SIGNALS
// =============================================================================

const INTENT_SIGNALS: Record<MessageIntent, string[]> = {
  casual: [
    'hey', 'hi', 'hello', 'what\'s up', 'sup', 'yo', 'good morning',
    'how are you', 'what\'s good', 'howdy', 'how\'s it going',
  ],
  quick_answer: [
    'how much', 'what\'s it worth', 'worth anything', 'price check',
    'quick question', 'is this worth', 'value of', 'how many',
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
  vision: [
    'look at', 'see this', 'what is this', 'identify', 'can you see',
    'in the image', 'in the photo', 'this item', 'what do you see',
    'scan this', 'check this out',
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
  speed: [
    // Speed intent is detected by context flags, not keywords
  ],
};

// =============================================================================
// INTENT → PROVIDER STRENGTH MAPPING
// =============================================================================

const INTENT_TO_STRENGTH: Record<MessageIntent, ProviderStrength> = {
  casual:        'general',
  quick_answer:  'general',
  deep_analysis: 'reasoning',
  market_query:  'web',
  vision:        'vision',
  strategy:      'reasoning',
  creative:      'creative',
  speed:         'speed',
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Route a message to the best available provider.
 *
 * @param message      - The user's message text
 * @param identity     - Oracle identity (for AI DNA influence)
 * @param options      - Additional routing hints
 */
export function routeMessage(
  message: string,
  identity: OracleIdentity | null,
  options?: {
    /** Force a specific provider (for testing/override) */
    forceProvider?: OracleProviderId;
    /** Is this a speed-critical context (smart glasses, live scan)? */
    speedMode?: boolean;
    /** Does this message include an image? */
    hasImage?: boolean;
    /** Conversation length so far (longer = more complex) */
    conversationLength?: number;
    /** User's subscription tier — determines model quality */
    userTier?: string;
  }
): RoutingDecision {
  const tier = options?.userTier || 'free';
  const isPremium = ['pro', 'elite', 'admin', 'developer'].includes(tier);

  // ── Force override ────────────────────────────────────
  if (options?.forceProvider && isProviderAvailable(options.forceProvider)) {
    const model = resolveModelForTier(options.forceProvider, tier);
    const config = ORACLE_PROVIDERS[options.forceProvider];
    return {
      providerId: options.forceProvider,
      model,
      reason: `forced:${options.forceProvider} (${tier}→${model})`,
      fallbacks: buildFallbackChain(options.forceProvider),
      intent: 'casual',
      temperature: config.temperature,
      maxTokens: config.maxResponseTokens,
    };
  }

  // ── Detect intent ─────────────────────────────────────
  let intent = detectIntent(message);

  // Context overrides
  if (options?.speedMode) intent = 'speed';
  if (options?.hasImage) intent = 'vision';

  // ── Map intent to provider strength ───────────────────
  const targetStrength = INTENT_TO_STRENGTH[intent];

  // ── Select provider (tier-aware) ──────────────────────
  let providerId = selectProvider(targetStrength, identity?.ai_dna, intent, isPremium);

  // ── Vision check: if image present, provider must support it ──
  if (options?.hasImage && !ORACLE_PROVIDERS[providerId].supportsVision) {
    const visionProviders = getProvidersByStrength('vision')
      .filter(id => ORACLE_PROVIDERS[id].supportsVision);
    if (visionProviders.length > 0) {
      providerId = visionProviders[0];
    }
  }

  // ── Resolve actual model for this tier ────────────────
  const model = resolveModelForTier(providerId, tier);
  const config = ORACLE_PROVIDERS[providerId];

  // ── Adjust params by intent ───────────────────────────
  let maxTokens = config.maxResponseTokens;
  let temperature = config.temperature;

  // Deep analysis gets more room
  if (intent === 'deep_analysis' || intent === 'strategy') {
    maxTokens = isPremium ? 1000 : 600;
  }

  // Casual chat — premium users get more room for personality
  if (intent === 'casual') {
    maxTokens = isPremium ? 400 : 250;
  }

  // Quick answers — concise for everyone
  if (intent === 'quick_answer') {
    maxTokens = isPremium ? 500 : 300;
  }

  // Speed mode: tight limits regardless of tier
  if (intent === 'speed') {
    maxTokens = 250;
    temperature = 0.5;
  }

  // Creative gets more freedom
  if (intent === 'creative') {
    temperature = 0.8;
    maxTokens = isPremium ? 600 : 400;
  }

  return {
    providerId,
    model,
    reason: `intent:${intent} → strength:${targetStrength} → ${providerId}/${model} (tier:${tier})`,
    fallbacks: buildFallbackChain(providerId),
    intent,
    temperature,
    maxTokens,
  };
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Detect message intent from keywords.
 * Simple, fast, deterministic — no LLM needed.
 */
function detectIntent(message: string): MessageIntent {
  const msgLower = message.toLowerCase().trim();

  // Check each intent's signals (order matters — more specific first)
  const intentPriority: MessageIntent[] = [
    'vision',        // Most specific: references images
    'deep_analysis', // "break down", "analyze" → clearly wants depth
    'market_query',  // "trending", "market" → wants live data
    'strategy',      // "should I sell" → wants advice
    'creative',      // Personality, opinions, fun
    'quick_answer',  // "how much", "worth" → wants a number
    'casual',        // Greetings, small talk
  ];

  for (const intent of intentPriority) {
    const signals = INTENT_SIGNALS[intent];
    for (const signal of signals) {
      if (msgLower.includes(signal)) return intent;
    }
  }

  // Long messages (>100 chars) suggest complexity
  if (msgLower.length > 100) return 'deep_analysis';

  // Short messages with ? suggest quick answers
  if (msgLower.includes('?') && msgLower.length < 50) return 'quick_answer';

  // Default: for premium users, default to general (gets full brain)
  // For free users, still general (gets budget brain via resolveModelForTier)
  return 'casual';
}

/**
 * Select the best provider for a given strength, with AI DNA influence.
 * Premium users get the BEST provider. Free users get the CHEAPEST.
 */
function selectProvider(
  strength: ProviderStrength,
  aiDna: AiDnaProfile | null | undefined,
  intent: MessageIntent,
  isPremium: boolean,
): OracleProviderId {
  const candidates = getProvidersByStrength(strength);

  // No candidates for this strength? Fall back
  if (candidates.length === 0) {
    return isPremium ? getBestForStrength('general') : getCheapestForStrength('general');
  }

  // Single candidate? Use it
  if (candidates.length === 1) {
    return candidates[0];
  }

  // ── AI DNA influence (premium users only) ─────────────
  // If the user's Oracle has provider affinity, prefer that provider
  // This is what makes each Oracle genuinely unique
  if (isPremium && aiDna?.provider_personality_blend) {
    const blend = aiDna.provider_personality_blend;

    let bestCandidate = candidates[0];
    let bestAffinity = 0;

    for (const candidate of candidates) {
      const affinity = blend[candidate] || 0;
      if (affinity > bestAffinity) {
        bestAffinity = affinity;
        bestCandidate = candidate;
      }
    }

    // Only use DNA preference if it's meaningful (>15% affinity)
    if (bestAffinity > 0.15) {
      return bestCandidate;
    }
  }

  // ── Tier-based selection ──────────────────────────────
  if (isPremium) {
    return getBestForStrength(strength);
  }

  return getCheapestForStrength(strength);
}

/**
 * Build ordered fallback chain for a provider.
 */
function buildFallbackChain(primaryId: OracleProviderId): OracleProviderId[] {
  const fallbacks: OracleProviderId[] = [];

  const primaryConfig = ORACLE_PROVIDERS[primaryId];
  const sameStrength = getProvidersByStrength(primaryConfig.primaryStrength)
    .filter(id => id !== primaryId);

  fallbacks.push(...sameStrength);

  if (!fallbacks.includes('openai') && primaryId !== 'openai') {
    fallbacks.push('openai');
  }

  if (!fallbacks.includes('groq') && primaryId !== 'groq' && isProviderAvailable('groq')) {
    fallbacks.push('groq');
  }

  return fallbacks.slice(0, 3);
}
