// FILE: src/lib/spotlightTracking.ts
// Adaptive Spotlight Tracking - Learns and grows with the user
// Onboarding = seeds, Behavior = growth, Time = decay
//
// FIXED v2.1: Removed Nominatim reverse geocoding from client side.
//   Nominatim blocks browser CORS — their API is server-side only.
//   Now stores lat/lng immediately, derives city/state server-side
//   via /api/dashboard/spotlight-items when needed.
//
// FIXED v2.1: Added userGesture flag to requestLocation() to prevent
//   Chrome violation "Only request geolocation in response to user gesture".

import { supabase } from '@/lib/supabase';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'tagnetiq_spotlight_prefs';
const SYNC_INTERVAL = 5 * 60 * 1000;

// Weight system - behavior outweighs onboarding over time
export const WEIGHTS = {
  // Onboarding = seeds (low, constant)
  ONBOARDING_INTEREST: 10,
  
  // Behavioral signals (grow with engagement)
  CATEGORY_VIEW: 15,
  ITEM_CLICK: 25,
  ITEM_PURCHASE: 40,
  WATCHLIST_MATCH: 35,
  SEARCH_TERM_MATCH: 20,
  
  // Negative signals (learning what they don't want)
  HIDDEN_ITEM_CATEGORY: -20,
  VIEWED_NOT_CLICKED: -5,
  
  // Quality signals
  VERIFIED_ITEM: 12,
  HIGH_CONFIDENCE: 8,
  LOCAL_ITEM: 15,
  HAS_SHIPPING: 10,
  GOOD_DEAL: 10,
  RECENCY_MAX: 10,
};

// Time decay multipliers
export const DECAY = {
  RECENT: 1.0,      // Last 7 days = full weight
  MODERATE: 0.6,    // 7-30 days = 60% weight
  OLD: 0.3,         // 30-90 days = 30% weight
  ANCIENT: 0.1,     // 90+ days = 10% weight (but never zero)
};

// Personalization levels based on data points
export const PERSONALIZATION_LEVELS = {
  LEARNING: { min: 0, max: 10, label: 'Learning', icon: '🌱', description: 'Getting to know you...' },
  GROWING: { min: 11, max: 30, label: 'Growing', icon: '🌿', description: 'Starting to understand your taste' },
  PERSONALIZED: { min: 31, max: 100, label: 'Personalized', icon: '🌳', description: 'Curated for you' },
  EXPERT: { min: 101, max: Infinity, label: 'Expert', icon: '✨', description: 'Deeply personalized' },
};

// Map onboarding interests to categories
export const INTEREST_TO_CATEGORY_MAP: Record<string, string[]> = {
  'real-estate': ['real-estate', 'property', 'home'],
  'vehicles': ['vehicles', 'cars', 'automotive', 'motorcycle'],
  'collectibles': ['collectibles', 'memorabilia', 'vintage'],
  'luxury-goods': ['luxury', 'designer', 'watches', 'jewelry'],
  'lego': ['lego', 'building-sets', 'toys'],
  'star-wars': ['star-wars', 'sci-fi', 'collectibles'],
  'sports-memorabilia': ['sports', 'memorabilia', 'cards'],
  'books-media': ['books', 'media', 'comics', 'magazines'],
  'coins-currency': ['coins', 'currency', 'numismatics', 'bullion'],
  'trading-cards': ['trading-cards', 'pokemon', 'sports-cards', 'tcg'],
  'art-antiques': ['art', 'antiques', 'paintings', 'sculptures'],
  'electronics': ['electronics', 'gadgets', 'gaming', 'computers'],
};

// Category filter chips
export const CATEGORY_CHIPS = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'coins', label: 'Coins', icon: '🪙' },
  { id: 'trading-cards', label: 'Cards', icon: '🃏' },
  { id: 'lego', label: 'LEGO', icon: '🧱' },
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'collectibles', label: 'Collectibles', icon: '🎨' },
  { id: 'sports', label: 'Sports', icon: '🏆' },
  { id: 'art', label: 'Art', icon: '🖼️' },
  { id: 'books', label: 'Books', icon: '📚' },
  { id: 'luxury', label: 'Luxury', icon: '💎' },
];

// ============================================================================
// TYPES
// ============================================================================

interface TimestampedAction {
  value: string;
  timestamp: string;
  count?: number;
}

interface CategoryScore {
  category: string;
  score: number;
  sources: string[]; // What contributed to this score
}

export interface SpotlightPrefs {
  // Timestamped behavioral data (for decay calculation)
  category_interactions: TimestampedAction[];
  item_clicks: TimestampedAction[];
  item_views: TimestampedAction[];
  searches: TimestampedAction[];
  purchases: TimestampedAction[];
  
  // User-controlled (no decay)
  hidden_item_ids: string[];
  hidden_categories: string[];
  favorite_categories: string[];
  active_filter?: string;
  
  // Onboarding seeds (low constant weight)
  onboarding_interests: string[];
  
  // Location
  location?: {
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    country?: string;
  };
  
  // Price learning
  price_history: { price: number; timestamp: string }[];
  
  // Sync
  last_updated: string;
  last_synced?: string;
  needs_sync: boolean;
  
  // Analytics
  total_interactions: number;
  first_interaction?: string;
}

export interface WatchlistItem {
  id: string;
  keywords: string[];
  created_at: string;
}

export interface PersonalizationStatus {
  level: string;
  icon: string;
  label: string;
  description: string;
  dataPoints: number;
  confidence: number; // 0-100
}

// ============================================================================
// STORAGE
// ============================================================================

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

function getDecayMultiplier(timestamp: string): number {
  const ageInDays = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24);
  
  if (ageInDays <= 7) return DECAY.RECENT;
  if (ageInDays <= 30) return DECAY.MODERATE;
  if (ageInDays <= 90) return DECAY.OLD;
  return DECAY.ANCIENT;
}

function addTimestampedAction(
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
// ADAPTIVE SCORING ENGINE
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

// ============================================================================
// LOCATION
// ============================================================================

/** Key for caching location in sessionStorage (avoids re-prompting) */
const LOCATION_CACHE_KEY = 'tagnetiq_location_cache';
const LOCATION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Request user location. Only prompts for geolocation when called.
 * 
 * IMPORTANT: Call this ONLY in response to a user gesture (button tap,
 * form submit, etc.) to avoid Chrome violation:
 * "Only request geolocation information in response to a user gesture."
 * 
 * Reverse geocoding (city/state) is NOT done client-side because
 * Nominatim blocks browser CORS. The server can derive city/state
 * from lat/lng when building spotlight results.
 * 
 * @param userGesture - Set to true when called from a click/tap handler.
 *                      When false, only returns cached location (no prompt).
 */
export async function requestLocation(
  userGesture: boolean = false,
): Promise<SpotlightPrefs['location'] | null> {
  // ── Check cache first (avoids re-prompting within session) ──
  try {
    const cached = sessionStorage.getItem(LOCATION_CACHE_KEY);
    if (cached) {
      const { location, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < LOCATION_CACHE_TTL) {
        return location;
      }
    }
  } catch { /* silent */ }

  // ── If not a user gesture, return stored location without prompting ──
  if (!userGesture) {
    const prefs = getPrefs();
    return prefs.location || null;
  }

  // ── Request geolocation (only on user gesture) ──
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;

        // Store lat/lng only — no reverse geocoding from client.
        // Nominatim's API blocks browser CORS requests.
        // Server-side spotlight-items endpoint can derive city/state
        // from lat/lng if needed for "local items" features.
        const location: SpotlightPrefs['location'] = { lat, lng };

        // Save to prefs (persists across sessions)
        const prefs = getPrefs();
        // Preserve any server-derived city/state if we already have it
        if (prefs.location?.city) {
          location.city = prefs.location.city;
          location.state = prefs.location.state;
          location.country = prefs.location.country;
        }
        prefs.location = location;
        savePrefs(prefs);

        // Cache in sessionStorage (avoids re-prompting this session)
        try {
          sessionStorage.setItem(
            LOCATION_CACHE_KEY,
            JSON.stringify({ location, timestamp: Date.now() }),
          );
        } catch { /* silent */ }

        resolve(location);
      },
      (err) => {
        console.warn('[Spotlight] Geolocation denied or failed:', err.message);
        resolve(null);
      },
      { timeout: 8000, maximumAge: 600000, enableHighAccuracy: false },
    );
  });
}

export function getLocation(): SpotlightPrefs['location'] | undefined {
  return getPrefs().location;
}

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