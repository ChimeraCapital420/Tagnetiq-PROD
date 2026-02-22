// FILE: src/lib/spotlightTracking/scoring.ts
// ═══════════════════════════════════════════════════════════════════════
// ADAPTIVE SCORING ENGINE — Category scores, price learning, status
// ═══════════════════════════════════════════════════════════════════════

import { WEIGHTS, INTEREST_TO_CATEGORY_MAP, PERSONALIZATION_LEVELS } from './constants.js';
import { getPrefs, getDecayMultiplier } from './storage.js';
import type { CategoryScore, PersonalizationStatus } from './types.js';

// ============================================================================
// CATEGORY SCORING
// ============================================================================

export function calculateCategoryScores(): CategoryScore[] {
  const prefs = getPrefs();
  const scores: Record<string, { score: number; sources: string[] }> = {};

  const addScore = (category: string, points: number, source: string) => {
    const cat = category.toLowerCase();
    if (!scores[cat]) {
      scores[cat] = { score: 0, sources: [] };
    }
    scores[cat].score += points;
    if (!scores[cat].sources.includes(source)) {
      scores[cat].sources.push(source);
    }
  };

  // 1. Onboarding interests (low constant weight - just seeds)
  prefs.onboarding_interests.forEach(interest => {
    const mapped = INTEREST_TO_CATEGORY_MAP[interest] || [interest];
    mapped.forEach(cat => {
      addScore(cat, WEIGHTS.ONBOARDING_INTEREST, 'onboarding');
    });
  });

  // 2. Category interactions (with time decay)
  prefs.category_interactions.forEach(interaction => {
    const decay = getDecayMultiplier(interaction.timestamp);
    const count = interaction.count || 1;
    const points = WEIGHTS.CATEGORY_VIEW * decay * Math.min(count, 5);
    addScore(interaction.value, points, 'interactions');
  });

  // 3. Favorite categories (user explicitly chose)
  prefs.favorite_categories.forEach(cat => {
    addScore(cat, 30, 'favorites');
  });

  // 4. Purchase history categories (strongest signal)
  prefs.purchases.forEach(purchase => {
    const decay = getDecayMultiplier(purchase.timestamp);
    // Category stored with purchase would enable precise scoring
    // For now, contributes to overall confidence
  });

  // 5. Hidden categories (negative learning)
  prefs.hidden_categories.forEach(cat => {
    addScore(cat, WEIGHTS.HIDDEN_ITEM_CATEGORY, 'hidden');
  });

  // Convert to array and sort
  return Object.entries(scores)
    .map(([category, data]) => ({
      category,
      score: Math.round(data.score * 10) / 10,
      sources: data.sources,
    }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function getTopCategories(count: number = 5): string[] {
  const scores = calculateCategoryScores();
  return scores.slice(0, count).map(s => s.category);
}

// ============================================================================
// PRICE RANGE LEARNING
// ============================================================================

export function getPreferredPriceRange(): { min: number; max: number } | null {
  const prefs = getPrefs();

  if (prefs.price_history.length < 5) return null;

  const weightedPrices = prefs.price_history.map(p => ({
    price: p.price,
    weight: getDecayMultiplier(p.timestamp),
  }));

  const sorted = weightedPrices.sort((a, b) => a.price - b.price);

  const totalWeight = sorted.reduce((sum, p) => sum + p.weight, 0);
  let cumWeight = 0;
  let q1Price = sorted[0].price;
  let q3Price = sorted[sorted.length - 1].price;

  for (const p of sorted) {
    cumWeight += p.weight;
    if (cumWeight <= totalWeight * 0.25) q1Price = p.price;
    if (cumWeight <= totalWeight * 0.75) q3Price = p.price;
  }

  return {
    min: Math.max(0, Math.round(q1Price * 0.5)),
    max: Math.round(q3Price * 2),
  };
}

// ============================================================================
// PERSONALIZATION STATUS
// ============================================================================

export function getPersonalizationStatus(): PersonalizationStatus {
  const prefs = getPrefs();

  const dataPoints =
    prefs.category_interactions.length +
    prefs.item_clicks.length +
    prefs.purchases.length * 3 +
    prefs.searches.length +
    prefs.favorite_categories.length * 2;

  let level = PERSONALIZATION_LEVELS.LEARNING;
  if (dataPoints > PERSONALIZATION_LEVELS.EXPERT.min) {
    level = PERSONALIZATION_LEVELS.EXPERT;
  } else if (dataPoints > PERSONALIZATION_LEVELS.PERSONALIZED.min) {
    level = PERSONALIZATION_LEVELS.PERSONALIZED;
  } else if (dataPoints > PERSONALIZATION_LEVELS.GROWING.min) {
    level = PERSONALIZATION_LEVELS.GROWING;
  }

  const confidence = Math.min(100, Math.round((dataPoints / 50) * 100));

  return {
    level: level.label,
    icon: level.icon,
    label: level.label,
    description: level.description,
    dataPoints,
    confidence,
  };
}