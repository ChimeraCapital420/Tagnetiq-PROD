// FILE: src/lib/hydra/category-detection/detectors/keyword-scoring.ts
// HYDRA v8.0 - Keyword-Based Category Scoring
// Scores item name against all keyword arrays.
// Longer matching phrases score higher. Returns the best-scoring category.

import { CATEGORY_KEYWORDS } from '../data/keywords.js';
import type { ItemCategory } from '../types.js';

interface KeywordResult {
  category: ItemCategory;
  confidence: number;
  keywords: string[];
}

/**
 * Score item name against all keyword categories.
 * Returns the best-matching category with confidence and matched keywords.
 */
export function detectCategoryByKeywords(nameLower: string): KeywordResult {
  const scores: Record<string, { score: number; matches: string[] }> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[category] = { score: 0, matches: [] };
    for (const kw of keywords) {
      if (nameLower.includes(kw)) {
        // Longer phrases score higher (multi-word = more specific)
        scores[category].score += kw.split(' ').length;
        scores[category].matches.push(kw);
      }
    }
  }

  // Sort by score descending, then by category name length (more specific wins)
  const sortedScores = Object.entries(scores)
    .filter(([_, data]) => data.score > 0)
    .sort((a, b) => {
      if (b[1].score !== a[1].score) return b[1].score - a[1].score;
      return b[0].length - a[0].length;
    });

  if (sortedScores.length === 0) {
    return { category: 'general', confidence: 0.3, keywords: [] };
  }

  const [bestCategory, bestData] = sortedScores[0];
  const confidence = Math.min(0.5 + (bestData.score * 0.1), 0.95);

  // Debug logging
  if (sortedScores.length > 0) {
    console.log(`🔑 Top 3 keyword matches:`);
    sortedScores.slice(0, 3).forEach(([cat, data]) => {
      console.log(`   - ${cat}: score ${data.score} (${data.matches.join(', ')})`);
    });
  }

  return {
    category: bestCategory as ItemCategory,
    confidence,
    keywords: bestData.matches,
  };
}