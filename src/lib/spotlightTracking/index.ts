// FILE: src/lib/spotlightTracking/index.ts
// ═══════════════════════════════════════════════════════════════════════
// ADAPTIVE SPOTLIGHT TRACKING — BARREL EXPORTS
// ═══════════════════════════════════════════════════════════════════════
//
// REFACTORED from single ~600-line monolith into modular files:
//
//   types.ts      → All TypeScript interfaces
//   constants.ts  → Weights, decay, maps, chips, levels
//   storage.ts    → localStorage prefs, time decay helpers
//   tracking.ts   → Behavioral signals, hide/show, filters, onboarding
//   scoring.ts    → Category scoring, price range, personalization
//   location.ts   → Geolocation with user-gesture guard
//   sync.ts       → Profile sync, query builder, watchlist, init, debug
//
// IMPORT CONTRACT: Existing imports remain unchanged:
//
//   import { trackItemClick, getPrefs } from '@/lib/spotlightTracking';
//   import type { SpotlightPrefs } from '@/lib/spotlightTracking';
//
// ═══════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────
export type {
  SpotlightPrefs,
  WatchlistItem,
  PersonalizationStatus,
} from './types.js';

// ── Constants ────────────────────────────────────────────
export {
  WEIGHTS,
  DECAY,
  PERSONALIZATION_LEVELS,
  INTEREST_TO_CATEGORY_MAP,
  CATEGORY_CHIPS,
} from './constants.js';

// ── Storage ──────────────────────────────────────────────
export {
  getPrefs,
  savePrefs,
} from './storage.js';

// ── Tracking & Filters ───────────────────────────────────
export {
  trackItemClick,
  trackItemView,
  trackPurchase,
  trackSearch,
  hideItem,
  unhideItem,
  getHiddenItems,
  clearHiddenItems,
  setActiveFilter,
  getActiveFilter,
  toggleFavoriteCategory,
  setOnboardingInterests,
  getOnboardingInterests,
} from './tracking.js';

// ── Scoring ──────────────────────────────────────────────
export {
  calculateCategoryScores,
  getTopCategories,
  getPreferredPriceRange,
  getPersonalizationStatus,
} from './scoring.js';

// ── Location ─────────────────────────────────────────────
export {
  requestLocation,
  getLocation,
} from './location.js';

// ── Sync, Query, Watchlist, Init ─────────────────────────
export {
  buildQueryParams,
  syncToProfile,
  loadFromProfile,
  scheduleSyncToProfile,
  fetchWatchlistKeywords,
  addToWatchlist,
  initializeSpotlightTracking,
  debugSpotlight,
} from './sync.js';