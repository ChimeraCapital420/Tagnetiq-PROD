// FILE: src/lib/oracle/client/tier-cache.ts
// ═══════════════════════════════════════════════════════════════════════
// Client-Side Tier Cache (Liberation 2)
// ═══════════════════════════════════════════════════════════════════════
// Extracted from useOracleChat.ts monolith (Phase 1).
//
// Caches the user's tier info in sessionStorage (survives tab refreshes
// but not new tabs). Avoids redundant DB reads on every message.
// 5-minute TTL — short enough that tier upgrades propagate quickly.
// ═══════════════════════════════════════════════════════════════════════

export interface CachedTier {
  current: string;
  messagesUsed: number;
  messagesLimit: number;
  messagesRemaining: number;
  cachedAt: number;
}

const TIER_CACHE_KEY = 'oracle_tier_cache';
const TIER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached tier info from sessionStorage.
 * Returns null if cache is missing, expired, or unreadable.
 */
export function getCachedTier(): CachedTier | null {
  try {
    const raw = sessionStorage.getItem(TIER_CACHE_KEY);
    if (!raw) return null;

    const cached: CachedTier = JSON.parse(raw);

    // Check TTL
    if (Date.now() - cached.cachedAt > TIER_CACHE_TTL) return null;

    return cached;
  } catch {
    return null;
  }
}

/**
 * Cache tier info from a server response.
 * Silently fails if sessionStorage is unavailable (private browsing, etc.).
 *
 * @param tier - Tier object from server response (must have current, messagesUsed, etc.)
 */
export function setCachedTier(tier: {
  current: string;
  messagesUsed: number;
  messagesLimit: number;
  messagesRemaining: number;
}): void {
  try {
    const entry: CachedTier = {
      ...tier,
      cachedAt: Date.now(),
    };
    sessionStorage.setItem(TIER_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // sessionStorage not available — silently continue
  }
}

/**
 * Clear the cached tier (e.g. on logout or tier change).
 */
export function clearCachedTier(): void {
  try {
    sessionStorage.removeItem(TIER_CACHE_KEY);
  } catch {
    // silently continue
  }
}