// FILE: src/lib/oracle/chat/validators.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat — Validation & Sanitization
// ═══════════════════════════════════════════════════════════════════════
// Extracted from chat.ts monolith (Phase 1).
// Pure functions — no side effects, no DB calls.
//
// Contains:
//   - VALID_INTENTS / VALID_ENERGIES (Liberation 2 whitelists)
//   - validateIntent() / validateEnergy()
//   - generateTitle()
// ═══════════════════════════════════════════════════════════════════════

// =============================================================================
// LIBERATION 2 — CLIENT HINT WHITELISTS
// =============================================================================
// The client sends intent/energy hints to skip redundant server detection.
// These sets define what the server will trust. Anything outside → ignored.

export const VALID_INTENTS = new Set([
  'casual',
  'quick_answer',
  'deep_analysis',
  'market_query',
  'how_to',
  'vision',
  'strategy',
  'creative',
  'speed',
]);

export const VALID_ENERGIES = new Set([
  'neutral',
  'excited',
  'frustrated',
  'focused',
  'curious',
  'casual',
]);

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate a client-provided intent hint.
 * Returns the intent if valid, null otherwise.
 * Server uses its own detection when null.
 */
export function validateIntent(clientIntent?: string): string | null {
  if (clientIntent && VALID_INTENTS.has(clientIntent)) {
    return clientIntent;
  }
  return null;
}

/**
 * Validate a client-provided energy hint.
 * Returns the energy if valid, null otherwise.
 * Server falls back to its own detectEnergy() when null.
 */
export function validateEnergy(clientEnergy?: string): string | null {
  if (clientEnergy && VALID_ENERGIES.has(clientEnergy)) {
    return clientEnergy;
  }
  return null;
}

// =============================================================================
// TITLE GENERATOR
// =============================================================================

/**
 * Generate a conversation title from the first user message.
 * Truncates at 50 chars with ellipsis if needed.
 */
export function generateTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\n/g, ' ');
  if (clean.length <= 50) return clean;
  return clean.substring(0, 47) + '...';
}