// FILE: src/lib/hydra/category-detection/detectors/override-check.ts
// HYDRA v8.0 - Name Pattern Override Checker
// Checks item name against high-confidence pattern overrides.
// These override AI votes when obvious keywords are found.

import { NAME_PATTERN_OVERRIDES } from '../data/overrides.js';

interface OverrideResult {
  category: string;
  pattern: string;
  priority: number;
}

/**
 * Check item name against all pattern overrides.
 * Returns the highest-priority match, or null if no match.
 */
export function checkNamePatternOverrides(nameLower: string): OverrideResult | null {
  // Sort by priority descending (highest first)
  const sortedOverrides = [...NAME_PATTERN_OVERRIDES].sort(
    (a, b) => b.priority - a.priority
  );

  for (const override of sortedOverrides) {
    for (const pattern of override.patterns) {
      if (nameLower.includes(pattern)) {
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