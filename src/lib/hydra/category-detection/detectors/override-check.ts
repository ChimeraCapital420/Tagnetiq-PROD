// FILE: src/lib/hydra/category-detection/detectors/override-check.ts
// HYDRA v8.4 - Name Pattern Override Checker
// Checks item name against high-confidence pattern overrides.
// These override AI votes when obvious keywords are found.
//
// FIXED v8.4: Added word-boundary pattern support
//   Patterns prefixed with "\\b" are treated as regex word-boundary patterns.
//   This prevents "lp" from matching inside "dlp", "help", "alps", etc.
//   Regular patterns still use simple substring includes().

import { NAME_PATTERN_OVERRIDES } from '../data/overrides.js';

interface OverrideResult {
  category: string;
  pattern: string;
  priority: number;
}

/**
 * Check item name against all pattern overrides.
 * Returns the highest-priority match, or null if no match.
 * 
 * Supports two pattern types:
 * - Regular strings: matched via `nameLower.includes(pattern)` 
 * - Word-boundary strings (prefixed with \\b): matched via regex `\bword\b`
 *   Use this for short patterns that cause false positives (e.g., "lp" in "dlp")
 */
export function checkNamePatternOverrides(nameLower: string): OverrideResult | null {
  // Sort by priority descending (highest first)
  const sortedOverrides = [...NAME_PATTERN_OVERRIDES].sort(
    (a, b) => b.priority - a.priority
  );

  for (const override of sortedOverrides) {
    for (const pattern of override.patterns) {
      if (matchesPattern(nameLower, pattern)) {
        return {
          category: override.category,
          pattern,
          priority: override.priority,
        };
      }
    }
  }

  return null;
}

/**
 * Match a pattern against text.
 * - If pattern starts with "\\b", use regex word boundary matching
 * - Otherwise, use simple substring includes
 */
function matchesPattern(text: string, pattern: string): boolean {
  if (pattern.startsWith('\\b')) {
    // Word-boundary pattern: "\\blp\\b" → regex /\blp\b/i
    // Strip the \\b markers and build a proper regex
    const word = pattern.replace(/\\b/g, '').trim();
    if (!word) return false;
    try {
      const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
      return regex.test(text);
    } catch {
      // If regex fails, fall back to includes
      return text.includes(word);
    }
  }
  
  // Standard substring match
  return text.includes(pattern);
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}