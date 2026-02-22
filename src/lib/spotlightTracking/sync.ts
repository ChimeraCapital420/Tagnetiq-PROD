// FILE: src/lib/spotlightTracking/sync.ts
// ═══════════════════════════════════════════════════════════════════════
// PROFILE SYNC, QUERY BUILDER, WATCHLIST, INIT
// ═══════════════════════════════════════════════════════════════════════
//
// Supabase sync: device → cloud (debounced).
// Query builder: assembles URLSearchParams from on-device prefs.
// Watchlist: fetches keywords for spotlight matching.
//
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { DECAY } from './constants.js';
import { getPrefs, savePrefs, getDecayMultiplier, STORAGE_KEY } from './storage.js';
import { calculateCategoryScores, getPreferredPriceRange, getPersonalizationStatus } from './scoring.js';
import type { WatchlistItem } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const SYNC_INTERVAL = 5 * 60 * 1000;

// ============================================================================
// QUERY BUILDER
// ============================================================================

export function buildQueryParams(categoryFilter?: string): URLSearchParams {
  const params = new URLSearchParams();
  const prefs = getPrefs();

  // Category filter (from chips)
  if (categoryFilter && categoryFilter !== 'all') {
    params.set('category_filter', categoryFilter);
  } else {
    const categoryScores = calculateCategoryScores().slice(0, 10);
    if (categoryScores.length > 0) {
      params.set('category_scores', JSON.stringify(categoryScores));
    }
  }

  // Price range (learned)
  const priceRange = getPreferredPriceRange();
  if (priceRange) {
    params.set('min_price', priceRange.min.toString());
    params.set('max_price', priceRange.max.toString());
  }

  // Location
  if (prefs.location) {
    params.set('lat', prefs.location.lat.toString());
    params.set('lng', prefs.location.lng.toString());
    if (prefs.location.state) params.set('state', prefs.location.state);
    if (prefs.location.city) params.set('city', prefs.location.city);
  }

  // Hidden items
  if (prefs.hidden_item_ids.length > 0) {
    params.set('hidden', prefs.hidden_item_ids.slice(0, 50).join(','));
  }

  // Hidden categories (negative learning)
  if (prefs.hidden_categories.length > 0) {
    params.set('hidden_categories', prefs.hidden_categories.join(','));
  }

  // Onboarding interests (seeds)
  if (prefs.onboarding_interests.length > 0) {
    params.set('interests', prefs.onboarding_interests.join(','));
  }

  // Recent searches for keyword matching
  const recentSearches = prefs.searches
    .filter(s => getDecayMultiplier(s.timestamp) >= DECAY.MODERATE)
    .slice(0, 10)
    .map(s => s.value);
  if (recentSearches.length > 0) {
    params.set('searches', recentSearches.join(','));
  }

  // Personalization confidence
  const status = getPersonalizationStatus();
  params.set('confidence', status.confidence.toString());

  return params;
}

// ============================================================================
// PROFILE SYNC
// ============================================================================

let syncTimeout: NodeJS.Timeout | null = null;

export async function syncToProfile(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const prefs = getPrefs();
    if (!prefs.needs_sync) return true;

    const categoryScores = calculateCategoryScores();
    const status = getPersonalizationStatus();

    const spotlightPreferences = {
      category_scores: categoryScores.slice(0, 20),
      hidden_item_ids: prefs.hidden_item_ids.slice(0, 100),
      hidden_categories: prefs.hidden_categories,
      favorite_categories: prefs.favorite_categories,
      price_range: getPreferredPriceRange(),
      onboarding_interests: prefs.onboarding_interests,
      personalization_level: status.level,
      confidence: status.confidence,
      total_interactions: prefs.total_interactions,
      first_interaction: prefs.first_interaction,
      last_synced: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('profiles')
      .update({ spotlight_preferences: spotlightPreferences })
      .eq('id', session.user.id);

    if (error) {
      console.warn('[Spotlight] Sync failed:', error);
      return false;
    }

    prefs.last_synced = new Date().toISOString();
    prefs.needs_sync = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));

    console.log('[Spotlight] Synced to profile - Level:', status.level);
    return true;
  } catch (e) {
    console.warn('[Spotlight] Sync error:', e);
    return false;
  }
}

export async function loadFromProfile(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('spotlight_preferences, interests')
      .eq('id', session.user.id)
      .single();

    if (error || !profile) return false;

    const prefs = getPrefs();

    if (profile.interests && Array.isArray(profile.interests)) {
      prefs.onboarding_interests = profile.interests;
    }

    if (profile.spotlight_preferences) {
      const p = profile.spotlight_preferences as any;

      if (p.hidden_item_ids) {
        prefs.hidden_item_ids = [...new Set([
          ...prefs.hidden_item_ids,
          ...p.hidden_item_ids
        ])].slice(0, 200);
      }

      if (p.hidden_categories) {
        prefs.hidden_categories = [...new Set([
          ...prefs.hidden_categories,
          ...p.hidden_categories
        ])].slice(0, 20);
      }

      if (p.favorite_categories) {
        prefs.favorite_categories = p.favorite_categories;
      }

      if (p.total_interactions) {
        prefs.total_interactions = Math.max(prefs.total_interactions || 0, p.total_interactions);
      }

      if (p.first_interaction && !prefs.first_interaction) {
        prefs.first_interaction = p.first_interaction;
      }
    }

    prefs.needs_sync = false;
    savePrefs(prefs);

    console.log('[Spotlight] Loaded from profile');
    return true;
  } catch (e) {
    console.warn('[Spotlight] Load error:', e);
    return false;
  }
}

export function scheduleSyncToProfile(): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => syncToProfile(), 10000);
}

// ============================================================================
// WATCHLIST INTEGRATION
// ============================================================================

export async function fetchWatchlistKeywords(): Promise<string[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return [];

    const response = await fetch('/api/arena/watchlist', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    });

    if (!response.ok) return [];

    const watchlists: WatchlistItem[] = await response.json();
    return [...new Set(watchlists.flatMap(w => w.keywords))];
  } catch (e) {
    console.warn('[Spotlight] Watchlist fetch failed:', e);
    return [];
  }
}

export async function addToWatchlist(keywords: string[]): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return false;

    const response = await fetch('/api/arena/watchlist', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keywords }),
    });

    return response.ok;
  } catch (e) {
    console.warn('[Spotlight] Watchlist add failed:', e);
    return false;
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export async function initializeSpotlightTracking(): Promise<void> {
  await loadFromProfile();

  // NOTE: Do NOT call requestLocation() here.
  // Location should only be requested in response to a user gesture
  // (e.g., tapping "Enable local items" or "Allow location").
  // Auto-requesting triggers Chrome violation:
  //   "Only request geolocation information in response to a user gesture."

  setInterval(() => {
    const prefs = getPrefs();
    if (prefs.needs_sync) syncToProfile();
  }, SYNC_INTERVAL);

  const status = getPersonalizationStatus();
  console.log(`[Spotlight] Initialized - ${status.icon} ${status.level} (${status.confidence}% confidence)`);
}

// ============================================================================
// DEBUG HELPERS
// ============================================================================

export function debugSpotlight(): void {
  const prefs = getPrefs();
  const scores = calculateCategoryScores();
  const status = getPersonalizationStatus();

  console.group('🔍 Spotlight Debug');
  console.log('Status:', status);
  console.log('Category Scores:', scores);
  console.log('Price Range:', getPreferredPriceRange());
  console.log('Onboarding Seeds:', prefs.onboarding_interests);
  console.log('Total Interactions:', prefs.total_interactions);
  console.log('Hidden Items:', prefs.hidden_item_ids.length);
  console.log('Hidden Categories:', prefs.hidden_categories);
  console.groupEnd();
}

if (typeof window !== 'undefined') {
  (window as any).debugSpotlight = debugSpotlight;
}