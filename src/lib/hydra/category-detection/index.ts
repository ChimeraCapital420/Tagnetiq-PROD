// FILE: src/lib/hydra/category-detection/index.ts
// HYDRA v8.0 - Category Detection Orchestrator
// Thin orchestrator (~80 lines) that runs the detection pipeline.
// All data lives in data/, all logic in detectors/ and utils/.
//
// Detection priority:
//   0. Name pattern overrides (highest confidence, catches AI misclassifications)
//   1. AI detected category (if valid and non-generic)
//   2. Category hint from request params
//   3. Name-based pattern detection
//   4. Keyword scoring (fallback)
//   5. Default: 'general'

// Re-export everything consumers need
export type { ItemCategory, CategoryDetection, CategorySource, NamePatternOverride } from './types.js';
export { CATEGORY_API_MAP } from './data/api-map.js';
export { CATEGORY_KEYWORDS } from './data/keywords.js';
export { NAME_PATTERN_OVERRIDES } from './data/overrides.js';
export { getApisForCategory } from './utils/api-lookup.js';
export { normalizeCategory } from './utils/normalize.js';
export { detectCategoryFromName } from './detectors/name-patterns.js';
export { detectCategoryByKeywords } from './detectors/keyword-scoring.js';
export { checkNamePatternOverrides } from './detectors/override-check.js';

// Imports for internal use
import type { ItemCategory, CategoryDetection } from './types.js';
import { checkNamePatternOverrides } from './detectors/override-check.js';
import { detectCategoryFromName } from './detectors/name-patterns.js';
import { detectCategoryByKeywords } from './detectors/keyword-scoring.js';
import { normalizeCategory } from './utils/normalize.js';

// =============================================================================
// MAIN DETECTION FUNCTION
// =============================================================================

export function detectItemCategory(
  itemName: string,
  categoryId?: string,
  aiDetectedCategory?: string
): CategoryDetection {
  const nameLower = itemName.toLowerCase();

  console.log(`\n🔍 === CATEGORY DETECTION v8.0 ===`);
  console.log(`📝 Item: "${itemName}"`);
  console.log(`🤖 AI: ${aiDetectedCategory || 'none'} | 💡 Hint: ${categoryId || 'none'}`);

  // Priority 0 - Name pattern overrides
  const override = checkNamePatternOverrides(nameLower);
  if (override) {
    if (aiDetectedCategory && normalizeCategory(aiDetectedCategory) !== override.category) {
      console.log(`⚠️ AI voted "${aiDetectedCategory}" but override "${override.pattern}" → ${override.category}`);
    }
    console.log(`🚨 OVERRIDE: "${override.pattern}" → ${override.category}`);
    return { category: override.category as ItemCategory, confidence: 0.98, keywords: [override.pattern], source: 'name_override' };
  }

  // Priority 1 - AI detected category
  if (aiDetectedCategory && aiDetectedCategory !== 'general' && aiDetectedCategory !== 'unknown') {
    const normalized = normalizeCategory(aiDetectedCategory);
    if (normalized !== 'general') {
      console.log(`🤖 AI VOTE: ${normalized}`);
      return { category: normalized as ItemCategory, confidence: 0.95, keywords: ['ai_detection'], source: 'ai_vote' };
    }
  }

  // Priority 2 - Category hint
  if (categoryId && categoryId !== 'general') {
    const normalized = normalizeCategory(categoryId);
    if (normalized !== 'general') {
      console.log(`💡 HINT: ${normalized}`);
      return { category: normalized as ItemCategory, confidence: 0.9, keywords: ['category_hint'], source: 'category_hint' };
    }
  }

  // Priority 3 - Name-based detection
  const nameResult = detectCategoryFromName(nameLower);
  if (nameResult && nameResult !== 'general') {
    console.log(`🎯 NAME: ${nameResult}`);
    return { category: nameResult as ItemCategory, confidence: 0.92, keywords: ['name_parsing'], source: 'name_parsing' };
  }

  // Priority 4 - Keyword scoring
  const kwResult = detectCategoryByKeywords(nameLower);
  console.log(`🔑 KEYWORDS: ${kwResult.category} (${kwResult.confidence.toFixed(2)})`);
  if (kwResult.category !== 'general') {
    return { ...kwResult, source: 'keyword_detection' };
  }

  // Priority 5 - Default
  console.log(`⚠️ Defaulting to general`);
  return { category: 'general', confidence: 0.5, keywords: [], source: 'default' };
}