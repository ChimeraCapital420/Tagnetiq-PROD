// FILE: src/lib/hydra/category-detection/utils/api-lookup.ts
// HYDRA v8.0 - API Lookup
// Given a category, returns the list of APIs to query.
// Supports direct match and partial/fuzzy matching.

import { CATEGORY_API_MAP } from '../data/api-map.js';

/**
 * Get the list of APIs that should be queried for a given category.
 * Falls back to ['ebay'] if no mapping found.
 */
export function getApisForCategory(category: string): string[] {
  const catLower = category.toLowerCase().trim();

  // Direct match (fast path)
  if (CATEGORY_API_MAP[catLower]) {
    return CATEGORY_API_MAP[catLower];
  }

  // Partial match (either direction)
  for (const [key, apis] of Object.entries(CATEGORY_API_MAP)) {
    if (catLower.includes(key) || key.includes(catLower)) {
      return apis;
    }
  }

  // Default fallback
  return ['ebay'];
}