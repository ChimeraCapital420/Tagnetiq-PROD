// FILE: src/lib/oracle/client/energy-detector.ts
// ═══════════════════════════════════════════════════════════════════════
// Client-Side Energy Detection (Liberation 2)
// ═══════════════════════════════════════════════════════════════════════
// Extracted from useOracleChat.ts monolith (Phase 1).
// Pure function — runs entirely on device, zero server cost.
//
// Detects the user's emotional energy from their message text.
// Sent to server so the Oracle can match tone (excited → excited,
// frustrated → empathetic, etc.).
// ═══════════════════════════════════════════════════════════════════════

import type { EnergyLevel } from '../../components/oracle/types';

// Word lists for sentiment detection
const POSITIVE_WORDS = [
  'awesome', 'amazing', 'love', 'wow', 'great',
  'found', 'score', 'deal', 'nice', 'perfect',
];

const NEGATIVE_WORDS = [
  'wrong', 'broken', 'stuck', 'frustrated',
  'confused', 'hate', 'sucks', 'terrible',
];

/**
 * Detect the user's emotional energy from their message text.
 * Runs entirely on-device — zero server cost.
 *
 * Signals analyzed:
 *   - Exclamation marks (excitement)
 *   - CAPS ratio (intensity)
 *   - Positive/negative word presence
 *   - Question marks + brevity (focused)
 *   - Curiosity keywords
 *
 * @param message - Raw user message text
 * @returns Detected energy level
 */
export function detectClientEnergy(message: string): EnergyLevel {
  const lower = message.toLowerCase();
  const exclamations = (message.match(/!/g) || []).length;
  const questions = (message.match(/\?/g) || []).length;

  // Calculate caps ratio (skip short messages to avoid false positives)
  const alphaOnly = message.replace(/[^a-zA-Z]/g, '');
  const capsRatio = alphaOnly.length > 3
    ? message.replace(/[^A-Z]/g, '').length / alphaOnly.length
    : 0;

  const hasPositive = POSITIVE_WORDS.some(w => lower.includes(w));
  const hasNegative = NEGATIVE_WORDS.some(w => lower.includes(w));

  // ── Detection rules (priority order) ──────────────
  if (exclamations > 1 && hasPositive) return 'excited';
  if (capsRatio > 0.5 && message.length > 10) return hasNegative ? 'frustrated' : 'excited';
  if (hasNegative) return 'frustrated';
  if (message.length < 50 && questions > 0) return 'focused';
  if (lower.includes('wondering') || lower.includes('curious') || lower.includes('how does')) {
    return 'curious';
  }

  return 'neutral';
}