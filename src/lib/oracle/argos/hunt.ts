// FILE: src/lib/oracle/argos/hunt.ts
// Argos Hunt Mode — instant triage with Oracle's personality
//
// Sprint G: Core hunt triage engine
// Sprint H: Oracle personality injection — hunt results sound like YOUR Oracle
//
// The user points their device (phone, tablet, smart glasses) at an item
// and gets an instant BUY / SKIP / HOLD verdict in ~1 second.
//
// Sprint H upgrade: The response doesn't come from a generic appraiser.
// It comes from the user's Oracle — same name, same personality, same voice.
// If the Oracle is sarcastic and playful, the hunt result is too.
// If the Oracle is analytical and precise, the triage reflects that.
//
// This is what makes the user believe it's ONE entity across all touchpoints.

import { routeMessage, callOracle } from '../providers/index.js';
import type { OracleMessage } from '../providers/index.js';
import type { OracleIdentity } from '../types.js';
import { buildIdentityBlock, buildPersonalityBlock } from '../prompt/identity-block.js';
import { buildAiDnaBlock } from '../prompt/ai-dna-block.js';

// =============================================================================
// TYPES
// =============================================================================

export type HuntVerdict = 'BUY' | 'SKIP' | 'HOLD' | 'SCAN';

export interface HuntResult {
  /** Quick verdict */
  verdict: HuntVerdict;
  /** Item identification (best guess) */
  itemName: string;
  /** Estimated value range */
  estimatedValue: {
    low: number;
    high: number;
    display: string;      // "$50-75" formatted for instant display
  };
  /** One-line reasoning — spoken in Oracle's voice */
  reason: string;
  /** Category detected */
  category: string;
  /** Confidence in this triage (0-1) */
  confidence: number;
  /** Response time in ms */
  responseTime: number;
  /** Which provider answered */
  provider: string;
  /** Can this be promoted to a full HYDRA scan? */
  canPromoteToFullScan: boolean;
}

// =============================================================================
// HUNT PROMPT BUILDER — injects Oracle personality into speed triage
// =============================================================================

/**
 * Build the hunt system prompt with Oracle's personality baked in.
 *
 * This is what makes a hunt result sound like the user's Oracle
 * instead of a generic appraiser. The personality block is compressed
 * to stay fast — just enough soul to flavor the response.
 */
function buildHuntPrompt(identity: OracleIdentity | null): string {
  // ── Core triage instructions (always present) ─────────
  const triageCore = `You are performing rapid-fire item appraisal. You see an image/description and give an INSTANT verdict.

RESPOND WITH EXACTLY THIS JSON FORMAT — nothing else:
{
  "verdict": "BUY" or "SKIP" or "HOLD" or "SCAN",
  "itemName": "specific item name",
  "valueLow": number,
  "valueHigh": number,
  "reason": "one sentence, max 15 words, in YOUR voice — spoken aloud to the user",
  "category": "category name",
  "confidence": 0.0 to 1.0
}

VERDICT RULES:
- BUY: Clear value, worth flipping. Estimated profit margin > 30%.
- SKIP: Not worth the time. Common item, low value, or bad condition.
- HOLD: Interesting but needs research. Unusual item, unclear value.
- SCAN: Can't identify clearly. User should do a full scan for proper analysis.`;

  // ── If no identity, use default personality ────────────
  if (!identity) {
    return `${triageCore}

YOUR VOICE: You're a sharp, friendly expert. Confident but not cocky. Talk like you're whispering advice to a friend at an estate sale.

REASON EXAMPLES (match this energy):
- BUY: "Vintage Pyrex, worth 3x that price. Grab it."
- SKIP: "Mass-produced junk. Keep walking."
- HOLD: "Interesting mark on the base. Worth a closer look."
- SCAN: "Can't tell from here — scan it for me."

Be decisive. Be fast. No hedging. Your reason will be read aloud.`;
  }

  // ── Inject Oracle's actual personality ─────────────────
  const name = identity.oracle_name || 'Oracle';
  const traits = identity.personality_traits || [];
  const style = identity.communication_style || '';
  const energy = identity.user_energy || 'neutral';

  // Build compressed personality block (not the full prompt — speed matters)
  let personalityHint = `\nYOU ARE ${name.toUpperCase()}.`;

  // Personality traits → voice direction
  if (traits.length > 0) {
    personalityHint += ` Your personality: ${traits.slice(0, 4).join(', ')}.`;
  }

  // Communication style → how the reason sounds
  if (style) {
    personalityHint += ` Your style: ${style}.`;
  }

  // AI DNA influence → subtle voice flavor
  const aiDnaVoice = buildCompressedDnaVoice(identity);
  if (aiDnaVoice) {
    personalityHint += ` ${aiDnaVoice}`;
  }

  // Evolved personality (from LLM evolution)
  if (identity.evolved_personality) {
    const evolved = identity.evolved_personality as any;
    if (evolved.voice_signature) {
      personalityHint += ` Voice signature: "${evolved.voice_signature}".`;
    }
    if (evolved.catchphrases && Array.isArray(evolved.catchphrases) && evolved.catchphrases.length > 0) {
      personalityHint += ` You sometimes say things like: "${evolved.catchphrases[0]}".`;
    }
  }

  // User energy match
  const energyNote = energy === 'excited' ? 'The user is excited — match that energy!'
    : energy === 'frustrated' ? 'Keep it calm and helpful.'
    : energy === 'focused' ? 'Be crisp and direct.'
    : '';

  return `${triageCore}
${personalityHint}

YOUR VOICE IN HUNT MODE:
- You're ${name}, not a generic appraiser. Your reason field should sound like YOU.
- Keep the same personality you use in conversation, just compressed to one sentence.
- Be decisive, be YOU. This will be read aloud or displayed on screen.
${energyNote}

REASON EXAMPLES (adapt to YOUR personality, these are just structure guides):
- BUY: "Oh yeah, [item]. Worth way more than that — don't walk, run."
- SKIP: "Nah, pass on that. [brief why]."
- HOLD: "Hmm, that's interesting. Worth a proper scan."
- SCAN: "Need a better look at that — scan it for me."

Be decisive. Be fast. Be ${name}.`;
}

/**
 * Extract a compressed AI DNA voice hint for the hunt prompt.
 * Full AI DNA block is too verbose for speed mode — this is the essence.
 */
function buildCompressedDnaVoice(identity: OracleIdentity): string {
  const aiDna = identity.ai_dna as any;
  if (!aiDna?.provider_personality_blend) return '';

  const blend = aiDna.provider_personality_blend;

  // Find dominant traits from top 2 providers
  const sorted = Object.entries(blend)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 2);

  if (sorted.length === 0) return '';

  const traitMap: Record<string, string> = {
    google: 'visually sharp',
    openai: 'versatile and articulate',
    anthropic: 'analytically precise',
    deepseek: 'deeply analytical',
    perplexity: 'market-savvy',
    xai: 'trend-aware and bold',
    groq: 'quick-thinking',
    meta: 'community-grounded',
    mistral: 'efficient and direct',
  };

  const hints = sorted
    .map(([provider]) => traitMap[provider])
    .filter(Boolean);

  if (hints.length === 0) return '';
  return `Your instincts are ${hints.join(' and ')}.`;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Perform a hunt mode triage on an image.
 *
 * Sprint H: Now uses Oracle's personality for the response voice.
 * The verdict sounds like the user's Oracle, not a generic appraiser.
 *
 * @param imageBase64 - Base64 encoded image from any device
 * @param identity    - Oracle identity (for personality + AI DNA routing)
 * @param context     - Optional context hints from the user
 */
export async function huntTriage(
  imageBase64: string,
  identity: OracleIdentity | null,
  context?: {
    /** User hint: "at an estate sale", "garage sale find", etc. */
    hint?: string;
    /** Asking price if visible/known */
    askingPrice?: number;
    /** Source device type (for logging, not routing) */
    deviceType?: 'phone' | 'tablet' | 'glasses' | 'unknown';
  }
): Promise<HuntResult> {
  const startTime = Date.now();

  // ── Route to fastest vision provider ──────────────────
  const routing = routeMessage('identify this item quickly', identity, {
    speedMode: true,
    hasImage: true,
  });

  // ── Build personality-infused hunt prompt ──────────────
  const huntSystemPrompt = buildHuntPrompt(identity);

  // ── Build message with image context ──────────────────
  let userContent = 'Identify this item and give your verdict.';
  if (context?.hint) {
    userContent += ` Context: ${context.hint}.`;
  }
  if (context?.askingPrice) {
    userContent += ` Asking price: $${context.askingPrice}.`;
  }

  const messages: OracleMessage[] = [
    { role: 'system', content: huntSystemPrompt },
    { role: 'user', content: userContent },
  ];

  try {
    const result = await callOracle(
      { ...routing, maxTokens: 200, temperature: 0.4 },
      messages
    );

    const parsed = parseHuntResponse(result.text);

    return {
      ...parsed,
      responseTime: Date.now() - startTime,
      provider: result.providerId,
      canPromoteToFullScan: true,
    };
  } catch (error: any) {
    console.error('Hunt triage failed:', error.message);

    // Fallback with personality if available
    const name = identity?.oracle_name || 'Oracle';
    return {
      verdict: 'SCAN',
      itemName: 'Unable to identify',
      estimatedValue: { low: 0, high: 0, display: 'Unknown' },
      reason: `Need a clearer look — scan it for ${name === 'Oracle' ? 'me' : name}.`,
      category: 'unknown',
      confidence: 0,
      responseTime: Date.now() - startTime,
      provider: 'none',
      canPromoteToFullScan: true,
    };
  }
}

/**
 * Batch hunt: triage multiple items from a sweep (smart glasses pan).
 * Processes items in parallel for speed.
 * Each result uses Oracle's personality.
 *
 * @param images    - Array of base64 images
 * @param identity  - Oracle identity (personality flows through)
 * @param context   - Shared context for all items
 */
export async function huntBatch(
  images: string[],
  identity: OracleIdentity | null,
  context?: { hint?: string; deviceType?: 'phone' | 'tablet' | 'glasses' | 'unknown' }
): Promise<HuntResult[]> {
  // Process up to 5 items in parallel (don't overwhelm providers)
  const batch = images.slice(0, 5);

  const results = await Promise.allSettled(
    batch.map(image => huntTriage(image, identity, context))
  );

  const name = identity?.oracle_name || 'Oracle';

  return results.map(r =>
    r.status === 'fulfilled'
      ? r.value
      : {
          verdict: 'SCAN' as HuntVerdict,
          itemName: 'Unable to identify',
          estimatedValue: { low: 0, high: 0, display: 'Unknown' },
          reason: `Couldn't get a clear read — scan it for ${name === 'Oracle' ? 'me' : name}.`,
          category: 'unknown',
          confidence: 0,
          responseTime: 0,
          provider: 'none',
          canPromoteToFullScan: true,
        }
  );
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Parse the hunt response JSON from the LLM.
 * Handles malformed responses gracefully.
 */
function parseHuntResponse(raw: string): Omit<HuntResult, 'responseTime' | 'provider' | 'canPromoteToFullScan'> {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const parsed = JSON.parse(jsonMatch[0]);

    const valueLow = parseFloat(parsed.valueLow?.toString() || '0') || 0;
    const valueHigh = parseFloat(parsed.valueHigh?.toString() || '0') || 0;

    let display: string;
    if (valueLow === 0 && valueHigh === 0) {
      display = 'Unknown';
    } else if (valueLow === valueHigh || valueHigh === 0) {
      display = `$${Math.round(valueLow)}`;
    } else {
      display = `$${Math.round(valueLow)}-${Math.round(valueHigh)}`;
    }

    const validVerdicts: HuntVerdict[] = ['BUY', 'SKIP', 'HOLD', 'SCAN'];
    const verdict = validVerdicts.includes(parsed.verdict?.toUpperCase())
      ? parsed.verdict.toUpperCase() as HuntVerdict
      : 'SCAN';

    return {
      verdict,
      itemName: parsed.itemName || 'Unknown Item',
      estimatedValue: { low: valueLow, high: valueHigh, display },
      reason: parsed.reason || 'No details available.',
      category: parsed.category || 'general',
      confidence: Math.min(1, Math.max(0, parseFloat(parsed.confidence?.toString() || '0.5'))),
    };
  } catch (e) {
    return {
      verdict: 'SCAN',
      itemName: 'Unable to identify',
      estimatedValue: { low: 0, high: 0, display: 'Unknown' },
      reason: 'Need a clearer look — try a full scan.',
      category: 'unknown',
      confidence: 0,
    };
  }
}