// FILE: src/lib/oracle/providers/router.ts
// Oracle Conversation Router — picks the best model for each message
//
// Sprint F:  Provider Registry + Hot-Loading
// Sprint N+: Intent-aware routing
//
// ═══════════════════════════════════════════════════════════════════════
// ROUTING PHILOSOPHY — LIBERATION 1: SAME ORACLE, ALL TIERS
// ═══════════════════════════════════════════════════════════════════════
//
// Every user gets the SAME routing. Same provider selection. Same model.
// Same token depth. Same AI DNA influence. The Oracle does not degrade.
//
// Cost control is through message caps (15/day free), NOT through
// cheaper providers or shorter responses.
//
// ═══════════════════════════════════════════════════════════════════════
// LIBERATION 2 — CLIENT-SIDE INTENT HINTS
// ═══════════════════════════════════════════════════════════════════════
//
// The client now runs the SAME intent detection logic on-device and
// sends the result as `intentHint`. If the hint is a valid MessageIntent,
// the server skips its own detectIntent() call (~50ms saved).
//
// The server always validates: if intentHint is garbage or missing,
// it falls back to server-side detection. Zero risk.
//
// ═══════════════════════════════════════════════════════════════════════
// LIBERATION 10 — HOW-TO INTENT + AUTHORITATIVE LINKS
// ═══════════════════════════════════════════════════════════════════════
//
// New intent: `how_to` — routes to web-capable providers (Perplexity,
// xAI) that return REAL URLs with citations. The Oracle teaches AND
// provides authoritative external resources (YouTube tutorials,
// manufacturer guides, Chilton/Haynes, specialist forums).
//
// Detected by: "how do I", "teach me", "walk me through", "diagnose",
// "troubleshoot", "repair", "technique for", etc.
//
// Routes to: `web` strength (Perplexity sonar → real search results)
// Token budget: 700 (enough for explanation + links)
// ═══════════════════════════════════════════════════════════════════════

import type { OracleIdentity, AiDnaProfile } from '../types.js';
import {
  type OracleProviderId,
  type ProviderStrength,
  ORACLE_PROVIDERS,
  isProviderAvailable,
  getProvidersByStrength,
  getBestForStrength,
  resolveModelForTier,
} from './registry.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RoutingDecision {
  /** Selected provider ID */
  providerId: OracleProviderId;
  /** The actual model string to use (always premium — all tiers) */
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
  | 'how_to'       // "how do I dry brush", "teach me", "walk me through"
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

// Valid intent values for hint validation
const VALID_INTENTS = new Set<MessageIntent>([
  'casual', 'quick_answer', 'deep_analysis', 'market_query', 'how_to',
  'vision', 'strategy', 'creative', 'speed',
]);

// =============================================================================
// INTENT → PROVIDER STRENGTH MAPPING
// =============================================================================

const INTENT_TO_STRENGTH: Record<MessageIntent, ProviderStrength> = {
  casual:        'general',
  quick_answer:  'general',
  deep_analysis: 'reasoning',
  market_query:  'web',
  how_to:        'web',        // Routes to Perplexity/xAI — they return REAL URLs
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
 * All tiers get the same routing — best provider for the intent,
 * influenced by AI DNA if available.
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
    /** User's subscription tier — logged in reason string, does not affect routing */
    userTier?: string;
    /** Liberation 2: Client-side intent hint (validated before use) */
    intentHint?: string;
  }
): RoutingDecision {
  const tier = options?.userTier || 'free';

  // ── Force override ────────────────────────────────────
  if (options?.forceProvider && isProviderAvailable(options.forceProvider)) {
    const model = resolveModelForTier(options.forceProvider, tier);
    const config = ORACLE_PROVIDERS[options.forceProvider];
    return {
      providerId: options.forceProvider,
      model,
      reason: `forced:${options.forceProvider} → ${model}`,
      fallbacks: buildFallbackChain(options.forceProvider),
      intent: 'casual',
      temperature: config.temperature,
      maxTokens: config.maxResponseTokens,
    };
  }

  // ══════════════════════════════════════════════════════
  // LIBERATION 2: Use client intent hint if valid
  // ══════════════════════════════════════════════════════
  // Client mirrors the same detectIntent logic on-device.
  // If the hint is a valid MessageIntent, skip server detection.
  // Context flags (speedMode, hasImage) still override.

  let intent: MessageIntent;

  if (options?.intentHint && VALID_INTENTS.has(options.intentHint as MessageIntent)) {
    intent = options.intentHint as MessageIntent;
  } else {
    intent = detectIntent(message);
  }

  // Context overrides (always take priority over client hint)
  if (options?.speedMode) intent = 'speed';
  if (options?.hasImage) intent = 'vision';

  // ── Map intent to provider strength ───────────────────
  const targetStrength = INTENT_TO_STRENGTH[intent];

  // ── Select provider (same for all tiers) ──────────────
  let providerId = selectProvider(targetStrength, identity?.ai_dna, intent);

  // ── Vision check: if image present, provider must support it ──
  if (options?.hasImage && !ORACLE_PROVIDERS[providerId].supportsVision) {
    const visionProviders = getProvidersByStrength('vision')
      .filter(id => ORACLE_PROVIDERS[id].supportsVision);
    if (visionProviders.length > 0) {
      providerId = visionProviders[0];
    }
  }

  // ── Resolve actual model (always premium) ─────────────
  const model = resolveModelForTier(providerId, tier);
  const config = ORACLE_PROVIDERS[providerId];

  // ── Adjust params by intent (universal — no tier split) ─
  let maxTokens = config.maxResponseTokens;
  let temperature = config.temperature;

  // Deep analysis / strategy gets more room
  if (intent === 'deep_analysis' || intent === 'strategy') {
    maxTokens = 800;
  }

  // Casual chat — enough room for personality to shine
  if (intent === 'casual') {
    maxTokens = 400;
  }

  // Quick answers — concise but complete
  if (intent === 'quick_answer') {
    maxTokens = 400;
  }

  // Market queries — data + interpretation
  if (intent === 'market_query') {
    maxTokens = 600;
  }

  // How-to / learning — needs room for explanation + links
  if (intent === 'how_to') {
    maxTokens = 700;
    temperature = 0.6; // Slightly lower — accuracy matters for tutorials
  }

  // Speed mode: tight limits regardless
  if (intent === 'speed') {
    maxTokens = 250;
    temperature = 0.5;
  }

  // Creative gets more freedom
  if (intent === 'creative') {
    temperature = 0.8;
    maxTokens = 500;
  }

  // Build reason string — note if client hint was used
  const intentSource = (options?.intentHint && VALID_INTENTS.has(options.intentHint as MessageIntent))
    ? 'client'
    : 'server';

  return {
    providerId,
    model,
    reason: `intent:${intent}(${intentSource}) → strength:${targetStrength} → ${providerId}/${model} (tier:${tier})`,
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
 * Liberation 2: This only runs when client doesn't provide a valid hint.
 */
function detectIntent(message: string): MessageIntent {
  const msgLower = message.toLowerCase().trim();

  // Check each intent's signals (order matters — more specific first)
  const intentPriority: MessageIntent[] = [
    'vision',        // Most specific: references images
    'deep_analysis', // "break down", "analyze" → clearly wants depth
    'market_query',  // "trending", "market" → wants live data
    'how_to',        // "how do I", "teach me", "troubleshoot" → wants learning + links
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

  return 'casual';
}

/**
 * Select the best provider for a given strength, with AI DNA influence.
 * Same selection for ALL tiers — everyone gets the best available.
 * AI DNA applies to everyone — it's part of Oracle personality, not a paywall.
 */
function selectProvider(
  strength: ProviderStrength,
  aiDna: AiDnaProfile | null | undefined,
  intent: MessageIntent,
): OracleProviderId {
  const candidates = getProvidersByStrength(strength);

  // No candidates for this strength? Fall back to best general
  if (candidates.length === 0) {
    return getBestForStrength('general');
  }

  // Single candidate? Use it
  if (candidates.length === 1) {
    return candidates[0];
  }

  // ── AI DNA influence (all tiers) ──────────────────────
  if (aiDna?.provider_personality_blend) {
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

  // ── Best available for this strength ──────────────────
  return getBestForStrength(strength);
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