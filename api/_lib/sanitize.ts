// FILE: api/_lib/sanitize.ts
// ═══════════════════════════════════════════════════════════════════════════════
// INPUT SANITIZER — Prompt Injection Defense for HYDRA Pipeline
// ═══════════════════════════════════════════════════════════════════════════════
//
// Three-layer defense:
//   Layer 1: This file — strip injection patterns, enforce length limits
//   Layer 2: Prompt builders — structural delimiters around user input
//   Layer 3: Output validation — schema enforcement (already exists)
//
// Design principle: Strip dangerous patterns while preserving legitimate
// item descriptions. "System of a Down vinyl" must survive. "SYSTEM: ignore
// all previous instructions" must not.
//
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Injection patterns that should NEVER appear in user input to AI prompts.
 * Each pattern is tested case-insensitively against the input.
 * Matches are replaced with empty string (stripped silently).
 *
 * NOTE: These are phrase-level patterns, not single words.
 * "system" alone is NOT blocked — "System of a Down" is a valid item name.
 * "ignore" alone is NOT blocked — "ignore minor scratches" is valid context.
 */
const INJECTION_PATTERNS: RegExp[] = [
  // Direct instruction override attempts
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /ignore\s+(all\s+)?above\s+instructions?/gi,
  /ignore\s+the\s+above/gi,
  /disregard\s+(all\s+)?(previous|above|prior)\s+instructions?/gi,
  /forget\s+(all\s+)?(previous|above|prior)\s+instructions?/gi,
  /override\s+(all\s+)?(previous|above|prior)\s+instructions?/gi,
  /do\s+not\s+follow\s+(the\s+)?(previous|above|prior)\s+instructions?/gi,

  // Role injection / identity override
  /you\s+are\s+now\s+a/gi,
  /you\s+are\s+no\s+longer/gi,
  /pretend\s+(you\s+are|to\s+be)/gi,
  /act\s+as\s+(if\s+you\s+are|a|an)/gi,
  /from\s+now\s+on,?\s+you/gi,
  /switch\s+to\s+.{0,20}\s+mode/gi,

  // System prompt extraction
  /reveal\s+(your\s+)?system\s+prompt/gi,
  /show\s+(me\s+)?(your\s+)?system\s+(prompt|instructions)/gi,
  /what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions)/gi,
  /print\s+(your\s+)?system\s+prompt/gi,
  /output\s+(your\s+)?(system\s+)?prompt/gi,
  /repeat\s+(your\s+)?(system|initial)\s+(prompt|instructions)/gi,

  // Prompt structure manipulation
  /\[?\s*SYSTEM\s*\]?\s*:/gi,
  /\[?\s*ASSISTANT\s*\]?\s*:/gi,
  /\[?\s*USER\s*\]?\s*:/gi,
  /\[?\s*HUMAN\s*\]?\s*:/gi,
  /```\s*(system|prompt|instructions)/gi,
  /<\s*system\s*>/gi,
  /<\s*\/\s*system\s*>/gi,
  /<\s*instructions?\s*>/gi,

  // Output manipulation
  /respond\s+with\s+only/gi,
  /your\s+(only\s+)?response\s+(should|must|will)\s+be/gi,
  /new\s+instructions?\s*:/gi,
  /updated?\s+instructions?\s*:/gi,
  /instead,?\s+(respond|reply|answer|output|say)/gi,
  /set\s+(the\s+)?(value|price|newValue)\s+to\s+\d/gi,

  // Jailbreak / DAN patterns
  /\bDAN\b/g,
  /\bjailbreak/gi,
  /developer\s+mode/gi,
  /unrestricted\s+mode/gi,
];

/**
 * Characters that should never appear in user input to AI prompts.
 * Control characters, null bytes, and unicode exploits.
 */
const DANGEROUS_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\u2028-\u202F\uFEFF]/g;

/**
 * Collapse excessive whitespace that could be used for prompt stuffing.
 * More than 2 consecutive newlines → 2 newlines.
 * More than 3 consecutive spaces → 1 space.
 */
function collapseWhitespace(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {3,}/g, ' ')
    .replace(/\t+/g, ' ');
}

// ─── PUBLIC API ────────────────────────────────────────────────────────────────

/**
 * General-purpose sanitizer for any user-provided text before AI prompt injection.
 *
 * @param input - Raw user input
 * @param maxLength - Maximum allowed length (truncated, not rejected)
 * @returns Sanitized string safe for prompt inclusion
 */
export function sanitizeForPrompt(input: string, maxLength: number = 500): string {
  if (!input || typeof input !== 'string') return '';

  let clean = input;

  // 1. Strip dangerous characters
  clean = clean.replace(DANGEROUS_CHARS, '');

  // 2. Strip injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    clean = clean.replace(pattern, '');
  }

  // 3. Collapse excessive whitespace
  clean = collapseWhitespace(clean);

  // 4. Strip code fences (could confuse JSON parsing)
  clean = clean.replace(/```[\s\S]*?```/g, '');
  clean = clean.replace(/```/g, '');

  // 5. Enforce length limit
  clean = clean.trim();
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength).trim();
  }

  return clean;
}

/**
 * Sanitize an item name for AI analysis.
 * Preserves model numbers, ISBNs, VINs, dates, editions.
 * Strips injection patterns.
 *
 * @param name - Raw item name from user
 * @returns Sanitized item name
 */
export function sanitizeItemName(name: string): string {
  return sanitizeForPrompt(name, 300);
}

/**
 * Sanitize a category hint.
 * Should be a short category identifier, not prose.
 *
 * @param hint - Category hint from user
 * @returns Sanitized category hint
 */
export function sanitizeCategoryHint(hint: string): string {
  // Categories should be simple identifiers
  return sanitizeForPrompt(hint, 60);
}

/**
 * Sanitize a condition string.
 * Should be a single word or short phrase.
 *
 * @param condition - Condition from user
 * @returns Sanitized condition
 */
export function sanitizeCondition(condition: string): string {
  return sanitizeForPrompt(condition, 30);
}

/**
 * Sanitize refinement text (user's additional context for refine-analysis).
 * Longer input allowed since users describe condition details, provenance, etc.
 *
 * @param text - Refinement text from user
 * @returns Sanitized refinement text
 */
export function sanitizeRefinementText(text: string): string {
  return sanitizeForPrompt(text, 1500);
}

/**
 * Sanitize barcode/additional context.
 * Should be alphanumeric identifiers, not prose.
 *
 * @param context - Additional context string
 * @returns Sanitized context
 */
export function sanitizeAdditionalContext(context: string): string {
  return sanitizeForPrompt(context, 200);
}

/**
 * Check if input contains injection patterns WITHOUT stripping them.
 * Useful for logging/alerting on attempted injections.
 *
 * @param input - Text to check
 * @returns Object with detection result and matched patterns
 */
export function detectInjectionAttempt(input: string): {
  detected: boolean;
  patterns: string[];
} {
  if (!input || typeof input !== 'string') {
    return { detected: false, patterns: [] };
  }

  const matched: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    const match = pattern.exec(input);
    if (match) {
      matched.push(match[0]);
    }
  }

  return {
    detected: matched.length > 0,
    patterns: matched,
  };
}

/**
 * Wrap user-provided text in structural delimiters for prompt safety.
 * The AI model sees clear boundaries between instructions and user data.
 *
 * @param text - Sanitized user text
 * @param label - Label for the delimiter (e.g., "item_name", "user_context")
 * @returns Delimited text string
 */
export function wrapUserInput(text: string, label: string): string {
  return `<user_provided_${label}>${text}</user_provided_${label}>`;
}