// FILE: src/lib/spotlightTracking.ts
// User behavior tracking for spotlight personalization
// Stores preferences in localStorage, syncs learning over time

const STORAGE_KEY = 'tagnetiq_spotlight_prefs';
const MAX_HISTORY_ITEMS = 100;
const MAX_SEARCH_TERMS = 30;
const MAX_CATEGORIES = 15;

export interface SpotlightUserPreferences {
  viewed_item_ids: string[];
  viewed_categories: string[];
  search_terms: string[];
  price_history: number[];
  clicked_item_ids: string[];
  location?: {
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    country?: string;
  };
  last_updated: string;
  session_start: string;
}

const defaultPreferences: SpotlightUserPreferences = {
  viewed_item_ids: [],
  viewed_categories: [],
  search_terms: [],
  price_history: [],
  clicked_item_ids: [],
  last_updated: new Date().toISOString(),
  session_start: new Date().toISOString(),
};

// Get stored preferences
export function getSpotlightPreferences(): SpotlightUserPreferences {
  try {
    if (typeof window === 'undefined') return { ...defaultPreferences };
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultPreferences, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load spotlight preferences:', e);
  }
  return { ...defaultPreferences };
}

// Save preferences
function savePreferences(prefs: SpotlightUserPreferences): void {
  try {
    if (typeof window === 'undefined') return;
    
    prefs.last_updated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save spotlight preferences:', e);
  }
}

// Track item view (when user clicks on an item)
export function trackItemView(
  itemId: string, 
  category?: string, 
  price?: number
): void {
  const prefs = getSpotlightPreferences();
  
  // Add to viewed items (keep unique, most recent first)
  prefs.viewed_item_ids = [
    itemId,
    ...prefs.viewed_item_ids.filter(id => id !== itemId)
  ].slice(0, MAX_HISTORY_ITEMS);
  
  // Track category preference
  if (category && category !== 'all') {
    prefs.viewed_categories = [
      category,
      ...prefs.viewed_categories.filter(c => c !== category)
    ].slice(0, MAX_CATEGORIES);
  }
  
  // Track price for range analysis
  if (price && price > 0) {
    prefs.price_history = [
      price,
      ...prefs.price_history
    ].slice(0, MAX_HISTORY_ITEMS);
  }
  
  savePreferences(prefs);
}

// Track item click (impression in spotlight)
export function trackItemClick(itemId: string): void {
  const prefs = getSpotlightPreferences();
  
  prefs.clicked_item_ids = [
    itemId,
    ...prefs.clicked_item_ids.filter(id => id !== itemId)
  ].slice(0, MAX_HISTORY_ITEMS);
  
  savePreferences(prefs);
}

// Track search term
export function trackSearch(searchTerm: string): void {
  if (!searchTerm?.trim()) return;
  
  const prefs = getSpotlightPreferences();
  const normalized = searchTerm.toLowerCase().trim();
  
  prefs.search_terms = [
    normalized,
    ...prefs.search_terms.filter(t => t !== normalized)
  ].slice(0, MAX_SEARCH_TERMS);
  
  savePreferences(prefs);
}

// Track category interaction
export function trackCategoryView(category: string): void {
  if (!category || category === 'all') return;
  
  const prefs = getSpotlightPreferences();
  
  prefs.viewed_categories = [
    category,
    ...prefs.viewed_categories.filter(c => c !== category)
  ].slice(0, MAX_CATEGORIES);
  
  savePreferences(prefs);
}

// Update user location
export function updateUserLocation(
  location: SpotlightUserPreferences['location']
): void {
  const prefs = getSpotlightPreferences();
  prefs.location = location;
  savePreferences(prefs);
}

// Get computed price range preference based on viewing history
export function getPreferredPriceRange(): { min: number; max: number } | null {
  const prefs = getSpotlightPreferences();
  
  // Need at least 5 data points for meaningful range
  if (prefs.price_history.length < 5) return null;
  
  const sorted = [...prefs.price_history].sort((a, b) => a - b);
  
  // Use IQR (Interquartile Range) for robust range
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  
  // Add padding to the range
  const min = Math.max(0, Math.round(sorted[q1Index] * 0.5));
  const max = Math.round(sorted[q3Index] * 2);
  
  return { min, max };
}

// Get top categories by frequency
export function getTopCategories(count: number = 5): string[] {
  const prefs = getSpotlightPreferences();
  
  // Count frequency of each category
  const frequency: Record<string, number> = {};
  prefs.viewed_categories.forEach((cat, index) => {
    // More recent = higher weight
    const weight = 1 + (prefs.viewed_categories.length - index) / prefs.viewed_categories.length;
    frequency[cat] = (frequency[cat] || 0) + weight;
  });
  
  // Sort by frequency
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([cat]) => cat);
}

// Get viewed item IDs (to avoid showing same items)
export function getViewedItemIds(limit: number = 50): string[] {
  const prefs = getSpotlightPreferences();
  return prefs.viewed_item_ids.slice(0, limit);
}

// Clear all tracking data
export function clearSpotlightTracking(): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear spotlight tracking:', e);
  }
}

// Request user location (with permission prompt)
export async function requestUserLocation(): Promise<SpotlightUserPreferences['location'] | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        
        // Try reverse geocoding via free Nominatim API
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { 
              headers: { 'User-Agent': 'TagnetIQ/1.0' },
              signal: AbortSignal.timeout(5000)
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            const location: SpotlightUserPreferences['location'] = {
              lat,
              lng,
              city: data.address?.city || data.address?.town || data.address?.village,
              state: data.address?.state,
              country: data.address?.country,
            };
            
            updateUserLocation(location);
            resolve(location);
            return;
          }
        } catch (e) {
          console.warn('Reverse geocoding failed:', e);
        }
        
        // Fall back to just coordinates
        const location = { lat, lng };
        updateUserLocation(location);
        resolve(location);
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        resolve(null);
      },
      { 
        timeout: 8000, 
        maximumAge: 600000, // Cache for 10 minutes
        enableHighAccuracy: false 
      }
    );
  });
}

// Build API query params from preferences
export function buildSpotlightQueryParams(): URLSearchParams {
  const params = new URLSearchParams();
  const prefs = getSpotlightPreferences();
  
  // Add top categories
  const topCategories = getTopCategories(5);
  if (topCategories.length > 0) {
    params.set('categories', topCategories.join(','));
  }
  
  // Add price range
  const priceRange = getPreferredPriceRange();
  if (priceRange) {
    params.set('min_price', priceRange.min.toString());
    params.set('max_price', priceRange.max.toString());
  }
  
  // Add location
  if (prefs.location) {
    params.set('lat', prefs.location.lat.toString());
    params.set('lng', prefs.location.lng.toString());
    if (prefs.location.state) {
      params.set('state', prefs.location.state);
    }
    if (prefs.location.city) {
      params.set('city', prefs.location.city);
    }
  }
  
  return params;
}