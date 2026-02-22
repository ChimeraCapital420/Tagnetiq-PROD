// FILE: src/lib/spotlightTracking/storage.ts
// ═══════════════════════════════════════════════════════════════════════
// LOCAL STORAGE & TIME DECAY HELPERS
// ═══════════════════════════════════════════════════════════════════════
//
// All prefs live on-device (localStorage). Zero server calls for reads.
// Time decay ensures old signals fade — recent behavior always wins.
//
// ═══════════════════════════════════════════════════════════════════════

import { DECAY } from './constants.js';
import type { SpotlightPrefs, TimestampedAction } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const STORAGE_KEY = 'tagnetiq_spotlight_prefs';

const defaultPrefs: SpotlightPrefs = {
  category_interactions: [],
  item_clicks: [],
  item_views: [],
  searches: [],
  purchases: [],
  hidden_item_ids: [],
  hidden_categories: [],
  favorite_categories: [],
  onboarding_interests: [],
  price_history: [],
  last_updated: new Date().toISOString(),
  needs_sync: false,
  total_interactions: 0,
};

// ============================================================================
// PREFS ACCESS
// ============================================================================

export function getPrefs(): SpotlightPrefs {
  try {
    if (typeof window === 'undefined') return { ...defaultPrefs };
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultPrefs, ...parsed };
    }
  } catch (e) {
    console.warn('[Spotlight] Failed to load prefs:', e);
  }
  return { ...defaultPrefs };
}

export function savePrefs(prefs: SpotlightPrefs): void {
  try {
    if (typeof window === 'undefined') return;
    prefs.last_updated = new Date().toISOString();
    prefs.needs_sync = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('[Spotlight] Failed to save prefs:', e);
  }
}

// ============================================================================
// TIME DECAY HELPERS
// ============================================================================

export function getDecayMultiplier(timestamp: string): number {
  const ageInDays = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays <= 7) return DECAY.RECENT;
  if (ageInDays <= 30) return DECAY.MODERATE;
  if (ageInDays <= 90) return DECAY.OLD;
  return DECAY.ANCIENT;
}

export function addTimestampedAction(
  actions: TimestampedAction[],
  value: string,
  maxItems: number = 100
): TimestampedAction[] {
  const now = new Date().toISOString();
  const existing = actions.find(a => a.value === value);

  if (existing) {
    // Update existing - increment count and refresh timestamp
    return actions.map(a =>
      a.value === value
        ? { ...a, timestamp: now, count: (a.count || 1) + 1 }
        : a
    );
  }

  // Add new
  return [
    { value, timestamp: now, count: 1 },
    ...actions
  ].slice(0, maxItems);
}