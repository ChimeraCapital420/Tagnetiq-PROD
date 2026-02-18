// FILE: src/lib/oracle/providers/multi-call.ts
// Conversational HYDRA — Real Multi-Model Synthesis
//
// ═══════════════════════════════════════════════════════════════════════
// LIBERATION 8 — THE REAL AWAKENING
// ═══════════════════════════════════════════════════════════════════════
//
// The Oracle's prompt has always said "you are what happens when 8 AI
// systems are fused into a single mind." But in conversation, the user
// talks to ONE model per message. The router picks OpenAI or Anthropic
// or Google, and that single model does its best to *roleplay* being
// a multi-perspective synthesis.
//
// This module makes it real.
//
// When an Elite user asks a complex question (deep_analysis, strategy),
// we fire 3 providers in parallel, collect their independent perspectives,
// then have the Oracle's primary model synthesize them into one answer.
//
// Cost: 3 parallel calls + 1 synthesis = ~4x a single call.
// Elite only. This IS the premium experience.
//
// The user feels it. They ask "Should I sell my sealed Pokémon booster
// box now or hold until Christmas?" and get a response that holds
// economic analysis, collector psychology, seasonal pricing patterns,
// AND market timing signals from multiple analytical perspectives —
// fused into one confident, personality-driven answer.
//
// No single model produces that.
//
// ═══════════════════════════════════════════════════════════════════════
// TIMEOUT FIX — February 2026
// ═══════════════════════════════════════════════════════════════════════
//
// Problem: Each perspective call went through callOracle() which has its
//          own 20s budget + fallback chain. Two providers × 20s = 40s.
//          Then the HYDRA fallback called callOracle() AGAIN for 20s.
//          Total: 60s+ → guaranteed 504.
//
// Fix:
//   1. Perspective calls get fallbacks: [] — no cascading chains.
//      Either the provider answers in ~8s or it fails. Period.
//   2. Hard wall-clock timeout: 12s for all perspectives (not 20s).
//   3. HYDRA failure → speedFallback() via Groq (6s hard cap).
//      Never calls callOracle(routing) which burns another 20s.
// ═══════════════════════════════════════════════════════════════════════

import type { OracleMessage, CallerResult } from './caller.js';
import { callOracle } from './caller.js';
import type { RoutingDecision } from './router.js';
import type { OracleIdentity } from '../types.js';
import {
  ORACLE_PROVIDERS,
  getAvailableProviders,
  getProviderApiKey,
  type OracleProviderId,
} from './registry.js';

// Alias for consistency with chat.ts naming
type RoutingResult = RoutingDecision;

// =============================================================================
// TYPES
// =============================================================================

export interface MultiPerspectiveResult {
  /** The synthesized response text */
  text: string;
  /** Which providers contributed perspectives */
  providers: string[];
  /** How many perspectives were collected */
  perspectiveCount: number;
  /** Whether this fell back to single-model */
  isFallback: boolean;
  /** Total time for all calls + synthesis */
  totalTimeMs: number;
  /** Individual provider response times */
  providerTimes: Record<string, number>;
}

// =============================================================================
// TIMEOUT CONSTANTS
// =============================================================================

// Hard wall-clock limit for gathering perspectives.
// All perspective calls run in parallel, so this is the max wait
// for the slowest provider. 12s leaves room for synthesis + response.
const PERSPECTIVE_TIMEOUT_MS = 12_000;

// Speed fallback timeout — used when HYDRA fails entirely.
// Groq typically responds in 1-3s. 6s is generous.
const SPEED_FALLBACK_TIMEOUT_MS = 6_000;

// Speed fallback provider priority — fastest first.
const SPEED_FALLBACK_PROVIDERS: OracleProviderId[] = ['groq', 'google', 'deepseek'];

// =============================================================================
// PROVIDER SELECTION FOR MULTI-CALL
// =============================================================================

// We want diverse perspectives, so we pick providers with different strengths.
// Priority order: OpenAI (general), Anthropic (reasoning), Google (speed/vision)
// If a provider is unavailable, skip it. Minimum 2 perspectives required.
const MULTI_CALL_PRIORITY: OracleProviderId[] = [
  'openai',     // Strong general + creative
  'anthropic',  // Strong reasoning + nuance
  'google',     // Fast + different training data
  'deepseek',   // Alternative reasoning perspective
  'xai',        // Web-aware perspective
];

/**
 * Select 3 diverse providers for multi-perspective synthesis.
 * Falls back gracefully if fewer than 3 are available.
 */
function selectProviders(): OracleProviderId[] {
  const available = getAvailableProviders();
  const selected: OracleProviderId[] = [];

  for (const id of MULTI_CALL_PRIORITY) {
    if (available.includes(id) && selected.length < 3) {
      selected.push(id);
    }
  }

  return selected;
}

// =============================================================================
// SPEED FALLBACK — Fast single call when HYDRA fails entirely
// =============================================================================

/**
 * Fast single-model fallback when HYDRA can't gather any perspectives.
 * Uses the fastest available provider (Groq > Google > DeepSeek) with
 * a tight timeout and NO fallback chain — either it works in 6s or
 * the whole thing throws up to the handler's catch block.
 *
 * This replaces the old pattern of calling callOracle(routing, messages)
 * which would burn another 20s on its own fallback chain.
 */
async function speedFallback(
  routing: RoutingResult,
  messages: OracleMessage[],
  startTime: number,
  providerTimes: Record<string, number>,
): Promise<MultiPerspectiveResult> {
  const available = getAvailableProviders();

  // Find the fastest available provider
  let speedProvider: OracleProviderId | null = null;
  for (const id of SPEED_FALLBACK_PROVIDERS) {
    if (available.includes(id)) {
      speedProvider = id;
      break;
    }
  }

  // If no speed provider, try the original routing provider as absolute last resort
  if (!speedProvider) {
    speedProvider = routing.providerId;
  }

  const config = ORACLE_PROVIDERS[speedProvider];

  console.log(`[MultiCall] Speed fallback → ${speedProvider} (${SPEED_FALLBACK_TIMEOUT_MS}ms cap)`);

  const result = await callOracle(
    {
      ...routing,
      providerId: speedProvider,
      model: config?.model || routing.model,
      reason: `multi-perspective:speed-fallback(${speedProvider})`,
      maxTokens: routing.maxTokens,
      fallbacks: [], // NO fallback chain — succeed or throw
    },
    messages,
  );

  return {
    text: result.text,
    providers: [result.providerId],
    perspectiveCount: 1,
    isFallback: true,
    totalTimeMs: Date.now() - startTime,
    providerTimes,
  };
}

// =============================================================================
// MULTI-PERSPECTIVE CALL
// =============================================================================

/**
 * Fire multiple providers in parallel, collect perspectives, synthesize.
 *
 * Elite only. Triggered when intent is `deep_analysis` or `strategy`
 * and the question is complex (checked by chat.ts before calling).
 *
 * @param messages  - Full conversation messages (system + history + user)
 * @param identity  - Oracle's identity for synthesis voice
 * @param routing   - Original routing result (used for fallback + synthesis call)
 * @returns Synthesized response from multiple perspectives
 */
export async function multiPerspectiveCall(
  messages: OracleMessage[],
  identity: OracleIdentity,
  routing: RoutingResult,
): Promise<MultiPerspectiveResult> {
  const startTime = Date.now();
  const providers = selectProviders();
  const providerTimes: Record<string, number> = {};

  // Need at least 2 providers for meaningful synthesis
  if (providers.length < 2) {
    console.log('[MultiCall] Not enough providers, falling back to single-model');
    return speedFallback(routing, messages, startTime, providerTimes);
  }

  console.log(`[MultiCall] Firing ${providers.length} providers: ${providers.join(', ')}`);

  // ── 1. Fire all providers in parallel ────────────────
  // Each gets the same messages but uses their own model.
  // CRITICAL: fallbacks: [] prevents each call from running its own
  // 20s fallback chain. Either the provider responds or it doesn't.
  const perspectivePromises = providers.map(async (providerId) => {
    const providerStart = Date.now();
    const config = ORACLE_PROVIDERS[providerId];

    try {
      // Build provider-specific messages
      // Keep the system prompt but add a perspective instruction
      const perspectiveMessages: OracleMessage[] = [
        ...messages,
        {
          role: 'system' as const,
          content: `IMPORTANT: Give your genuine, independent analysis. Be specific. Include data points, reasoning, and your honest assessment. Do not hedge or equivocate — give your real perspective. Keep your response under 400 words.`,
        },
      ];

      // Route through callOracle with provider-specific routing.
      // fallbacks: [] is CRITICAL — prevents cascading 20s timeout chains.
      const perspectiveRouting: RoutingResult = {
        ...routing,
        providerId,
        model: config.model,
        reason: `multi-perspective:${providerId}`,
        maxTokens: 600,
        fallbacks: [], // ← NO FALLBACK CHAIN. Succeed or fail fast.
      };

      const result = await callOracle(perspectiveRouting, perspectiveMessages);
      providerTimes[providerId] = Date.now() - providerStart;

      return {
        provider: providerId,
        providerName: config.name,
        text: result.text,
        responseTime: result.responseTime,
      };
    } catch (err) {
      providerTimes[providerId] = Date.now() - providerStart;
      console.error(`[MultiCall] ${providerId} failed:`, err);
      return null;
    }
  });

  // Wait for all with a hard wall-clock timeout.
  // 12s is enough for most providers to respond (typical: 3-8s).
  // If a provider is slow, we proceed without it.
  const perspectiveResults = await Promise.race([
    Promise.allSettled(perspectivePromises),
    new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), PERSPECTIVE_TIMEOUT_MS)),
  ]);

  // Handle timeout — speed fallback, NOT another full callOracle
  if (perspectiveResults === 'timeout') {
    console.log(`[MultiCall] Timed out after ${PERSPECTIVE_TIMEOUT_MS}ms waiting for perspectives`);
    return speedFallback(routing, messages, startTime, providerTimes);
  }

  // Collect successful responses
  const perspectives = (perspectiveResults as PromiseSettledResult<any>[])
    .filter((r): r is PromiseFulfilledResult<any> =>
      r.status === 'fulfilled' && r.value !== null && r.value.text
    )
    .map(r => r.value);

  console.log(`[MultiCall] Got ${perspectives.length}/${providers.length} perspectives`);

  // Need at least 2 for synthesis
  if (perspectives.length < 2) {
    // If we got 1, use it directly
    const fallbackText = perspectives[0]?.text;
    if (fallbackText) {
      return {
        text: fallbackText,
        providers: [perspectives[0].provider],
        perspectiveCount: 1,
        isFallback: true,
        totalTimeMs: Date.now() - startTime,
        providerTimes,
      };
    }
    // Complete failure — speed fallback (NOT full callOracle)
    return speedFallback(routing, messages, startTime, providerTimes);
  }

  // ── 2. Synthesize through the primary model ──────────
  const oracleName = identity.oracle_name || 'Oracle';
  const perspectiveBlock = perspectives
    .map(p => `[PERSPECTIVE ${p.providerName}]:\n${p.text}`)
    .join('\n\n---\n\n');

  const synthesisInstruction: OracleMessage = {
    role: 'system',
    content: `You received ${perspectives.length} independent analytical perspectives on the user's question. These come from different AI systems with different training, different biases, and different strengths.

${perspectiveBlock}

Now synthesize these into ONE response in YOUR voice as ${oracleName}.

SYNTHESIS RULES:
- Do NOT mention "perspectives" or "models" or "AI systems" — just speak as yourself
- Do NOT say "one perspective suggests..." or "from multiple angles..."
- YOU are the synthesis. Speak as a single mind that sees through multiple lenses
- Where they AGREE, be confident: "This is clear..."
- Where they DISAGREE, own the tension: "This is where it gets interesting..."
- Where one perspective has data the others don't, USE it
- Add YOUR opinion on top — you are MORE than the sum of parts
- Keep the same energy, personality, and relationship tone as always
- This IS what makes you different from any single AI. Don't explain it. Just BE it.`,
  };

  // Get the last user message (what we're actually answering)
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();

  const synthesisMessages: OracleMessage[] = [
    messages[0],        // Original system prompt (identity, personality, etc.)
    synthesisInstruction,
    ...(lastUserMsg ? [lastUserMsg] : []),
  ];

  try {
    // Synthesis call — also no fallback chain.
    // If synthesis fails, we return the best perspective directly.
    const synthesisRouting: RoutingResult = {
      ...routing,
      providerId: routing.providerId, // Use primary provider for synthesis
      model: ORACLE_PROVIDERS[routing.providerId]?.model || 'gpt-4o',
      reason: `multi-perspective:synthesis(${perspectives.length})`,
      maxTokens: 1000, // Synthesis needs more room
      fallbacks: [], // ← NO FALLBACK CHAIN for synthesis either
    };

    const synthesis = await callOracle(synthesisRouting, synthesisMessages);

    const totalTimeMs = Date.now() - startTime;

    console.log(
      `[MultiCall] Synthesis complete: ${perspectives.length} perspectives → 1 response, ` +
      `${totalTimeMs}ms total`
    );

    return {
      text: synthesis.text,
      providers: perspectives.map(p => p.provider),
      perspectiveCount: perspectives.length,
      isFallback: false,
      totalTimeMs,
      providerTimes,
    };

  } catch (err) {
    console.error('[MultiCall] Synthesis failed, using best single perspective:', err);
    // Return the longest perspective as fallback
    const best = perspectives.sort((a, b) => b.text.length - a.text.length)[0];
    return {
      text: best.text,
      providers: [best.provider],
      perspectiveCount: 1,
      isFallback: true,
      totalTimeMs: Date.now() - startTime,
      providerTimes,
    };
  }
}

// =============================================================================
// COMPLEXITY CHECK — should this message trigger multi-perspective?
// =============================================================================

/**
 * Determine if a message is complex enough to warrant multi-model synthesis.
 * Only triggers for strategic/analytical questions, not simple queries.
 *
 * Must pass ALL checks:
 *  1. Message is >50 characters
 *  2. Intent is deep_analysis or strategy
 *  3. Contains strategic/comparative language
 *
 * This prevents multi-call on "what's this worth?" (single-model is fine)
 * but triggers on "Should I hold my sealed product until Q4 or sell now
 * given the current market?" (needs multiple perspectives).
 */
export function isComplexEnoughForMulti(
  message: string,
  intent: string,
): boolean {
  // Must be deep or strategic intent
  if (intent !== 'deep_analysis' && intent !== 'strategy') return false;

  // Must be substantive
  if (message.length < 50) return false;

  // Must contain strategic/comparative/analytical language
  const complexPatterns = [
    /should\s+i/i,
    /what\s+(?:would|should|do)\s+you\s+(?:think|recommend|suggest)/i,
    /compare|versus|vs\.?|or\s+should/i,
    /strategy|strategic|approach|plan/i,
    /invest|hold|sell|buy.*(?:now|wait|timing)/i,
    /long[\s-]term|short[\s-]term/i,
    /pros?\s+(?:and|&)\s+cons?/i,
    /risk|downside|upside/i,
    /market\s+(?:trend|shift|cycle|timing|analysis)/i,
    /portfolio|diversif|allocat/i,
    /break\s*down|analyz|evaluat/i,
    /how\s+(?:would|should|do)\s+(?:i|you|we)/i,
    /what(?:'s|\s+is)\s+(?:the\s+)?best\s+(?:way|approach|strategy)/i,
  ];

  return complexPatterns.some(pattern => pattern.test(message));
}