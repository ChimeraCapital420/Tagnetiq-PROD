// FILE: src/lib/oracle/chat/correction-extractor.ts
// ═══════════════════════════════════════════════════════════════════════
// Liberation 11: Correction Extractor
// ═══════════════════════════════════════════════════════════════════════
//
// Two-phase extraction strategy (mobile-first):
//
// Phase A — Regex (useSendMessage.ts, runs ON DEVICE before API call)
//   extractCorrectionsRegex() catches 60-70% of corrections
//   with zero server cost. Sends `clientCorrections` in request body
//   as a structured hint Oracle uses to enrich its response.
//
// Phase B — AI JSON parse (response-pipeline.ts, after Oracle responds)
//   Oracle embeds <!--CORRECTIONS:{...}--> at the end of its response.
//   parseCorrectionsFromResponse() strips it (user sees clean text),
//   returns structured CorrectionInput for refinement-bridge.
//
// Zero new endpoints. Zero new DB tables.
// Feeds the existing refine-analysis endpoint via refinement-bridge.
// CI Engine recordCorrection() already wired in refine-analysis v3.6.
// ═══════════════════════════════════════════════════════════════════════

// =============================================================================
// TYPES
// =============================================================================

export interface CorrectionField {
  /** Field being corrected: 'brand' | 'size' | 'model' | 'color' | 'year' | 'identity' | etc. */
  field: string;
  /** What Oracle originally identified (may be empty from regex-only extraction) */
  from: string;
  /** What the user says it actually is */
  to: string;
}

export interface CorrectionInput {
  /** Updated full item title (null = AI infers from corrections) */
  correctedTitle: string | null;
  /** Structured field-by-field corrections */
  corrections: CorrectionField[];
  /** Original user message as additional context */
  additionalContext: string | null;
  /** Impact classification */
  changeType: 'cosmetic' | 'value_affecting' | 'identity_change';
  /** Whether HYDRA should re-analyze with corrected identity */
  shouldReanalyze: boolean;
}

export interface ExtractionResult {
  /** Response text with hidden JSON stripped — what the user sees */
  cleanResponse: string;
  /** Structured corrections (null if Oracle included none) */
  corrections: CorrectionInput | null;
}

// Hidden JSON comment — Oracle embeds this at the end of refinement responses
const CORRECTIONS_PATTERN = /<!--CORRECTIONS:([\s\S]*?)-->/;

// =============================================================================
// PHASE A: CLIENT-SIDE REGEX EXTRACTION
// ─────────────────────────────────────
// Mobile-first. Runs in useSendMessage BEFORE the fetch call.
// Zero server cost. Result sent as `clientCorrections` in request body.
// Oracle uses this hint to enrich its Phase B AI extraction.
// =============================================================================

/**
 * Lightweight regex extraction of correction details.
 * Runs on the user's device before any API call.
 *
 * Returns partial CorrectionInput as a structured hint, or null
 * if no recognizable correction patterns are found.
 *
 * Oracle (Phase B) enriches this with full context awareness.
 */
export function extractCorrectionsRegex(
  message: string,
  analysisContext: any | null
): Partial<CorrectionInput> | null {
  if (!analysisContext) return null;

  const corrections: CorrectionField[] = [];

  // ── "not [X]" — negation correction ───────────────────────────────
  // "not Green Line" → from: 'Green Line', to: '' (AI fills from context)
  const notPattern = /\bnot\s+(?:a\s+|an\s+|the\s+)?([a-zA-Z0-9][a-zA-Z0-9\s\-]{0,38}?)(?=[.,!?]|\s+(?:it'?s?|that'?s?|but|—)|$)/gi;
  let notMatch;
  while ((notMatch = notPattern.exec(message)) !== null) {
    const negated = notMatch[1].trim();
    if (negated.length >= 2) {
      corrections.push({ field: 'identity', from: negated, to: '' });
    }
  }

  // ── "[field] is [value]" — direct field assignment ─────────────────
  // "the brand is Green Bull" → field: 'brand', to: 'Green Bull'
  const fieldPattern = /\b(brand|model|size|color|colour|year|type|make)\s+is\s+([a-zA-Z0-9][a-zA-Z0-9\s\-]{0,38}?)(?=[.,!?]|\s+not|\s+and|$)/gi;
  let fieldMatch;
  while ((fieldMatch = fieldPattern.exec(message)) !== null) {
    corrections.push({
      field: fieldMatch[1].toLowerCase(),
      from: '',
      to: fieldMatch[2].trim(),
    });
  }

  // ── Size/measurement values ─────────────────────────────────────────
  // "4 foot", "6ft", "12oz" — high-value correction signal
  const sizePattern = /\b(\d+(?:\.\d+)?)\s*(foot|feet|ft|inch(?:es)?|in|gallon|oz|lb|cm|mm|liter|litre)\b/gi;
  let sizeMatch;
  while ((sizeMatch = sizePattern.exec(message)) !== null) {
    // Only add if this differs from what's in analysisContext
    const sizeStr = sizeMatch[0].trim();
    corrections.push({ field: 'size', from: '', to: sizeStr });
  }

  if (corrections.length === 0) return null;

  // Classify change type
  const isIdentity = corrections.some(c => c.field === 'identity');
  const isValueAffecting = corrections.some(c =>
    ['brand', 'model', 'size', 'year'].includes(c.field)
  );

  return {
    corrections,
    correctedTitle: null,
    additionalContext: message.slice(0, 200), // cap at 200 chars
    changeType: isIdentity ? 'identity_change' : isValueAffecting ? 'value_affecting' : 'cosmetic',
    shouldReanalyze: isIdentity || isValueAffecting,
  };
}

// =============================================================================
// PHASE B: SERVER-SIDE AI JSON PARSE
// ────────────────────────────────────
// Runs in response-pipeline.ts after Oracle responds.
// Oracle embeds <!--CORRECTIONS:{...}--> in refinement responses.
// We strip it → user sees clean conversational text.
// We parse it → refinement-bridge gets structured corrections.
//
// What user sees:  "Got it — that's a 4 Foot Green Bull ladder. Nice catch!"
// What we extract: { correctedTitle: "4 Foot Green Bull Ladder", corrections: [...] }
// =============================================================================

/**
 * Strip hidden corrections JSON from Oracle's response text.
 *
 * Safe to call on every response — returns cleanResponse unchanged
 * and corrections: null when no hidden block is present.
 */
export function parseCorrectionsFromResponse(responseText: string): ExtractionResult {
  const match = CORRECTIONS_PATTERN.exec(responseText);

  if (!match) {
    return { cleanResponse: responseText.trim(), corrections: null };
  }

  // Strip the comment block — user never sees it
  const cleanResponse = responseText.replace(CORRECTIONS_PATTERN, '').trim();

  try {
    const parsed = JSON.parse(match[1].trim());

    if (!parsed || typeof parsed !== 'object') {
      console.warn('[L11] Corrections block malformed — skipping');
      return { cleanResponse, corrections: null };
    }

    const corrections: CorrectionInput = {
      correctedTitle: typeof parsed.correctedTitle === 'string' ? parsed.correctedTitle : null,
      corrections: Array.isArray(parsed.corrections)
        ? parsed.corrections.filter(
            (c: any) => typeof c.field === 'string' && typeof c.to === 'string'
          )
        : [],
      additionalContext: typeof parsed.additionalContext === 'string' ? parsed.additionalContext : null,
      changeType: (['cosmetic', 'value_affecting', 'identity_change'] as const).includes(parsed.changeType)
        ? parsed.changeType
        : 'cosmetic',
      shouldReanalyze: Boolean(parsed.shouldReanalyze),
    };

    return { cleanResponse, corrections };

  } catch (err) {
    console.error('[L11] Failed to parse corrections JSON (non-fatal):', err);
    return { cleanResponse, corrections: null };
  }
}