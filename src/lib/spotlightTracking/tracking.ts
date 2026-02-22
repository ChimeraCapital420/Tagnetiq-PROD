// FILE: src/lib/spotlightTracking/tracking.ts
// ═══════════════════════════════════════════════════════════════════════
// BEHAVIORAL TRACKING — Clicks, views, purchases, searches
// HIDE/SHOW — Negative learning signals
// CATEGORY FILTERS — User-controlled filter state
// ═══════════════════════════════════════════════════════════════════════

import { DECAY } from './constants.js';
import { getPrefs, savePrefs, getDecayMultiplier, addTimestampedAction } from './storage.js';

// ============================================================================
// TRACKING FUNCTIONS
// ============================================================================

export function trackItemClick(
  itemId: string,
  listingId: string,
  category?: string,
  price?: number
): void {
  const prefs = getPrefs();
  const now = new Date().toISOString();

  // Track click
  prefs.item_clicks = addTimestampedAction(prefs.item_clicks, listingId, 200);

  // Track category interaction (high signal)
  if (category && category !== 'all') {
    prefs.category_interactions = addTimestampedAction(
      prefs.category_interactions,
      category.toLowerCase(),
      50
    );
  }

  // Track price for range learning
  if (price && price > 0) {
    prefs.price_history = [
      { price, timestamp: now },
      ...prefs.price_history
    ].slice(0, 100);
  }

  // Increment total interactions
  prefs.total_interactions = (prefs.total_interactions || 0) + 1;
  if (!prefs.first_interaction) {
    prefs.first_interaction = now;
  }

  savePrefs(prefs);
}

export function trackItemView(listingId: string, category?: string): void {
  const prefs = getPrefs();

  // Track view (lower signal than click)
  prefs.item_views = addTimestampedAction(prefs.item_views, listingId, 300);

  // Light category signal for views
  if (category && category !== 'all') {
    // Only add if not already recently interacted
    const recentInteraction = prefs.category_interactions.find(
      c => c.value === category.toLowerCase() &&
      getDecayMultiplier(c.timestamp) === DECAY.RECENT
    );

    if (!recentInteraction) {
      prefs.category_interactions = addTimestampedAction(
        prefs.category_interactions,
        category.toLowerCase(),
        50
      );
    }
  }

  prefs.total_interactions = (prefs.total_interactions || 0) + 1;
  savePrefs(prefs);
}

export function trackPurchase(listingId: string, category?: string, price?: number): void {
  const prefs = getPrefs();
  const now = new Date().toISOString();

  // Purchases are the strongest signal
  prefs.purchases = addTimestampedAction(prefs.purchases, listingId, 100);

  // Strong category signal
  if (category) {
    // Add multiple times to increase weight
    prefs.category_interactions = addTimestampedAction(
      prefs.category_interactions,
      category.toLowerCase(),
      50
    );
    prefs.category_interactions = addTimestampedAction(
      prefs.category_interactions,
      category.toLowerCase(),
      50
    );
  }

  if (price && price > 0) {
    prefs.price_history = [
      { price, timestamp: now },
      ...prefs.price_history
    ].slice(0, 100);
  }

  prefs.total_interactions = (prefs.total_interactions || 0) + 5; // Purchases count more
  savePrefs(prefs);
}

export function trackSearch(searchTerm: string): void {
  if (!searchTerm || searchTerm.length < 2) return;

  const prefs = getPrefs();
  const normalized = searchTerm.toLowerCase().trim();

  prefs.searches = addTimestampedAction(prefs.searches, normalized, 50);
  prefs.total_interactions = (prefs.total_interactions || 0) + 1;

  savePrefs(prefs);
}

// ============================================================================
// HIDE/SHOW (Negative Learning)
// ============================================================================

export function hideItem(listingId: string, category?: string): void {
  const prefs = getPrefs();

  if (!prefs.hidden_item_ids.includes(listingId)) {
    prefs.hidden_item_ids = [listingId, ...prefs.hidden_item_ids].slice(0, 200);
  }

  // Learn from hiding - slight negative for this category
  if (category) {
    const catLower = category.toLowerCase();
    if (!prefs.hidden_categories.includes(catLower)) {
      const hiddenInCategory = prefs.hidden_item_ids.filter(id => {
        return true;
      }).length;

      // If user hides 3+ items in same category, add to hidden_categories
      if (hiddenInCategory >= 3) {
        prefs.hidden_categories = [...prefs.hidden_categories, catLower].slice(0, 20);
      }
    }
  }

  savePrefs(prefs);
}

export function unhideItem(listingId: string): void {
  const prefs = getPrefs();
  prefs.hidden_item_ids = prefs.hidden_item_ids.filter(id => id !== listingId);
  savePrefs(prefs);
}

export function getHiddenItems(): string[] {
  return getPrefs().hidden_item_ids;
}

export function clearHiddenItems(): void {
  const prefs = getPrefs();
  prefs.hidden_item_ids = [];
  prefs.hidden_categories = [];
  savePrefs(prefs);
}

// ============================================================================
// CATEGORY FILTER
// ============================================================================

export function setActiveFilter(category: string): void {
  const prefs = getPrefs();
  prefs.active_filter = category === 'all' ? undefined : category;
  savePrefs(prefs);
}

export function getActiveFilter(): string {
  return getPrefs().active_filter || 'all';
}

export function toggleFavoriteCategory(category: string): void {
  const prefs = getPrefs();

  if (prefs.favorite_categories.includes(category)) {
    prefs.favorite_categories = prefs.favorite_categories.filter(c => c !== category);
  } else {
    prefs.favorite_categories = [category, ...prefs.favorite_categories].slice(0, 10);
  }

  savePrefs(prefs);
}

// ============================================================================
// ONBOARDING (Seeds Only)
// ============================================================================

export function setOnboardingInterests(interests: string[]): void {
  const prefs = getPrefs();
  prefs.onboarding_interests = interests;

  if (!prefs.first_interaction) {
    prefs.first_interaction = new Date().toISOString();
  }

  savePrefs(prefs);

  console.log('[Spotlight] Onboarding interests seeded:', interests);
}

export function getOnboardingInterests(): string[] {
  return getPrefs().onboarding_interests || [];
}