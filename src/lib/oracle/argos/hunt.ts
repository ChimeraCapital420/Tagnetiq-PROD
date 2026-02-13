// FILE: src/lib/oracle/argos/hunt.ts
// Argos Hunt Mode — instant triage for live scanning
//
// Sprint G: Active scanning from ANY device
//
// The user points their device (phone camera, tablet, smart glasses) at
// an item and gets an instant BUY / SKIP / HOLD verdict in ~1 second.
//
// This is NOT a full HYDRA analysis. It's a speed-optimized triage:
//   1. Send image to fastest available vision provider (Groq → Gemini → GPT-4o-mini)
//   2. Get: item name, estimated value, BUY/SKIP/HOLD, one-line reason
//   3. Return to client for display (screen overlay, voice readback, HUD)
//
// For full analysis, the user can "promote" a hunt result to a full HYDRA scan.
//
// Hardware-agnostic: Input is always base64 image + optional text.
// Output is always the same HuntResult structure.
// Client decides how to render: screen card, voice via glasses, HUD overlay.

import { routeMessage, callOracle } from '../providers/index.js';
import type { OracleMessage } from '../providers/index.js';
import type { OracleIdentity } from '../types.js';

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
  /** One-line reasoning — must be speakable for voice/glasses */
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
// HUNT PROMPT — optimized for speed and brevity
// =============================================================================

const HUNT_SYSTEM_PROMPT = `You are a rapid-fire item appraiser. You see an image and give an INSTANT verdict.

RESPOND WITH EXACTLY THIS JSON FORMAT — nothing else:
{
  "verdict": "BUY" or "SKIP" or "HOLD" or "SCAN",
  "itemName": "specific item name",
  "valueLow": number,
  "valueHigh": number,
  "reason": "one sentence why, max 15 words, must sound natural spoken aloud",
  "category": "category name",
  "confidence": 0.0 to 1.0
}

VERDICT RULES:
- BUY: Clear value, worth flipping. Estimated profit margin > 30%.
- SKIP: Not worth the time. Common item, low value, or bad condition.
- HOLD: Interesting but needs research. Unusual item, unclear value.
- SCAN: Can't identify clearly. User should do a full scan for proper analysis.

CRITICAL: Your "reason" field will be read aloud to the user — keep it natural and conversational.
Good: "Vintage Pyrex, worth 3x that price tag. Grab it."
Bad: "This item appears to be a vintage Pyrex mixing bowl with estimated resale value."

Be decisive. Be fast. No hedging.`;

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Perform a hunt mode triage on an image.
 *
 * Optimized for speed: uses the fastest available provider,
 * minimal prompt, structured JSON response.
 *
 * @param imageBase64 - Base64 encoded image from any device
 * @param identity    - Oracle identity (for AI DNA routing influence)
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

  // ── Build message with image context ──────────────────
  let userContent = 'Identify this item and give your verdict.';
  if (context?.hint) {
    userContent += ` Context: ${context.hint}.`;
  }
  if (context?.askingPrice) {
    userContent += ` Asking price: $${context.askingPrice}.`;
  }

  const messages: OracleMessage[] = [
    { role: 'system', content: HUNT_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];

  // ── Call provider ─────────────────────────────────────
  // Note: For providers that support vision, the image would need
  // to be passed through the caller. For now, we embed image context
  // in the message and the caller handles the API format.
  // Full vision support in caller.ts is Sprint G.1.
  // For MVP, we send the image description / base64 reference.

  try {
    const result = await callOracle(
      { ...routing, maxTokens: 200, temperature: 0.3 },
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

    // Return a safe fallback — tell user to do a full scan
    return {
      verdict: 'SCAN',
      itemName: 'Unable to identify',
      estimatedValue: { low: 0, high: 0, display: 'Unknown' },
      reason: 'Need a clearer look — try a full scan.',
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
 *
 * @param images    - Array of base64 images
 * @param identity  - Oracle identity
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

  return results.map(r =>
    r.status === 'fulfilled'
      ? r.value
      : {
          verdict: 'SCAN' as HuntVerdict,
          itemName: 'Unable to identify',
          estimatedValue: { low: 0, high: 0, display: 'Unknown' },
          reason: 'Need a clearer look.',
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
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const parsed = JSON.parse(jsonMatch[0]);

    const valueLow = parseFloat(parsed.valueLow?.toString() || '0') || 0;
    const valueHigh = parseFloat(parsed.valueHigh?.toString() || '0') || 0;

    // Format display price
    let display: string;
    if (valueLow === 0 && valueHigh === 0) {
      display = 'Unknown';
    } else if (valueLow === valueHigh || valueHigh === 0) {
      display = `$${Math.round(valueLow)}`;
    } else {
      display = `$${Math.round(valueLow)}-${Math.round(valueHigh)}`;
    }

    // Validate verdict
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
    // Couldn't parse — return safe fallback
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