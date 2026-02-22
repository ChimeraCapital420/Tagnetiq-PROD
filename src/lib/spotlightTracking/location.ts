// FILE: src/lib/spotlightTracking/location.ts
// ═══════════════════════════════════════════════════════════════════════
// LOCATION — Geolocation with user-gesture guard
// ═══════════════════════════════════════════════════════════════════════
//
// FIXED v2.1: Removed Nominatim reverse geocoding from client side.
//   Nominatim blocks browser CORS — their API is server-side only.
//   Now stores lat/lng immediately, derives city/state server-side
//   via /api/dashboard/spotlight-items when needed.
//
// FIXED v2.1: Added userGesture flag to requestLocation() to prevent
//   Chrome violation "Only request geolocation in response to user gesture".
//
// ═══════════════════════════════════════════════════════════════════════

import { getPrefs, savePrefs } from './storage.js';
import type { SpotlightPrefs } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Key for caching location in sessionStorage (avoids re-prompting) */
const LOCATION_CACHE_KEY = 'tagnetiq_location_cache';
const LOCATION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// REQUEST LOCATION
// ============================================================================

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