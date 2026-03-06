// FILE: src/lib/oracle/chat/refinement-bridge.ts
// ═══════════════════════════════════════════════════════════════════════
// Liberation 11: Refinement Bridge
// ═══════════════════════════════════════════════════════════════════════
//
// Calls the existing /api/refine-analysis endpoint with structured
// corrections extracted from Oracle's conversational response.
//
// The user already received Oracle's conversational confirmation
// ("Got it — updated to 4 Foot Green Bull Ladder").
// The bridge makes it official in the database — non-blocking.
//
// ZERO new endpoints. ZERO new DB tables.
// refine-analysis v3.6 already calls recordCorrection() → CI Engine.
// Liberation 11 feeds it richer data (correctedTitle, corrections[])
// instead of just value deltas. The CI loop completes automatically.
//
// Bridge failure is always non-fatal — user experience is unaffected.
// ═══════════════════════════════════════════════════════════════════════

import type { CorrectionInput } from './correction-extractor.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RefinementResult {
  success: boolean;
  /** Updated item name (corrected) */
  correctedItemName: string;
  /** Updated estimated value range */
  estimatedValue: string;
  /** Classification of what changed */
  changeType: string;
  /** Whether CI Engine recorded this correction */
  ciRecorded: boolean;
  /** The analysis record that was refined */
  analysisId?: string;
}

export interface BridgeInput {
  /** Structured corrections from AI JSON parse (Phase B extraction) */
  corrections: CorrectionInput;
  /** Original scan result — must contain analysisId or id */
  analysisContext: any;
  /** Auth token forwarded from the original Oracle chat request */
  authToken: string;
}

// =============================================================================
// BRIDGE
// =============================================================================

/**
 * Forward structured corrections to the existing refine-analysis endpoint.
 *
 * Runs server-side in api/oracle/chat.ts after Oracle's response is parsed.
 * 5-second timeout — if refine-analysis is slow, Oracle's response is
 * already on its way to the client. Nothing blocks the user.
 *
 * Returns RefinementResult, or null on any failure.
 */
export async function callRefinementBridge(
  input: BridgeInput
): Promise<RefinementResult | null> {
  const { corrections, analysisContext, authToken } = input;

  // Need an analysis record to refine
  const analysisId = analysisContext?.analysisId || analysisContext?.id;
  if (!analysisId) {
    console.warn('[L11] Bridge skipped: no analysisId in analysisContext');
    return null;
  }

  // Nothing useful to send
  if (!corrections.correctedTitle && corrections.corrections.length === 0) {
    console.warn('[L11] Bridge skipped: empty corrections');
    return null;
  }

  const payload = {
    analysisId,
    correctedTitle:     corrections.correctedTitle,
    corrections:        corrections.corrections,
    additionalContext:  corrections.additionalContext,
    changeType:         corrections.changeType,
    shouldReanalyze:    corrections.shouldReanalyze,
    // Tag this as conversational so refine-analysis can log the source
    source: 'oracle_conversational',
  };

  try {
    // Resolve base URL — works on Vercel (VERCEL_URL) and local dev
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.VITE_API_BASE_URL || 'http://localhost:5173';

    const response = await fetch(`${baseUrl}/api/refine-analysis`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': authToken,
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(5000), // Never block Oracle's response
    });

    if (!response.ok) {
      console.error(`[L11] Bridge HTTP ${response.status} — refine-analysis rejected`);
      return null;
    }

    const data = await response.json();

    return {
      success:           true,
      correctedItemName: data.itemName
        || corrections.correctedTitle
        || analysisContext?.itemName
        || '',
      estimatedValue:    data.estimatedValue || analysisContext?.estimatedValue || '',
      changeType:        corrections.changeType,
      ciRecorded:        data.ciRecorded ?? true,
      analysisId,
    };

  } catch (err: any) {
    // Timeout and network errors are both non-fatal
    if (err?.name === 'TimeoutError') {
      console.warn('[L11] Bridge timed out after 5s (non-fatal)');
    } else {
      console.error('[L11] Bridge error (non-fatal):', err?.message);
    }
    return null;
  }
}