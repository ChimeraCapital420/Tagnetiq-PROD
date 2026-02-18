// FILE: src/lib/oracle/client/market-cache.ts
// ═══════════════════════════════════════════════════════════════════════
// Client-Side Market Data Cache (Liberation 7)
// ═══════════════════════════════════════════════════════════════════════
// Extracted from useOracleChat.ts monolith (Phase 1).
//
// When the server returns live market data (Pro/Elite market queries),
// the client caches it in localStorage keyed by item name.
// On the next message about the same item (within 30 minutes),
// the client sends the cached data back — server skips the eBay API
// call entirely. Zero cost on cache hit.
// ═══════════════════════════════════════════════════════════════════════

export interface MarketCacheEntry {
  result: any;
  itemName: string;
  cachedAt: string;
  storedAt: number;
}

const MARKET_CACHE_KEY = 'oracle_market_cache';
const MARKET_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// =============================================================================
// CORE CACHE OPERATIONS
// =============================================================================

/**
 * Get the current market cache entry.
 * Returns null if cache is missing, expired, or unreadable.
 */
export function getMarketCache(): MarketCacheEntry | null {
  try {
    const raw = localStorage.getItem(MARKET_CACHE_KEY);
    if (!raw) return null;

    const entry: MarketCacheEntry = JSON.parse(raw);

    // Check TTL
    if (Date.now() - entry.storedAt > MARKET_CACHE_TTL) {
      localStorage.removeItem(MARKET_CACHE_KEY);
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

/**
 * Cache market data from a server response.
 * Silently fails if localStorage is unavailable or full.
 *
 * @param marketData - Market data object from server response
 */
export function setMarketCache(marketData: {
  result: any;
  itemName: string;
  cachedAt: string;
}): void {
  try {
    const entry: MarketCacheEntry = {
      ...marketData,
      storedAt: Date.now(),
    };
    localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage not available or full — silently continue
  }
}

/**
 * Clear the market cache (e.g. on logout).
 */
export function clearMarketCache(): void {
  try {
    localStorage.removeItem(MARKET_CACHE_KEY);
  } catch {
    // silently continue
  }
}

// =============================================================================
// RELEVANCE CHECK
// =============================================================================

/**
 * Check if the user's message mentions the same item that's in our market cache.
 * Uses keyword overlap — doesn't need to be perfect since the server validates.
 *
 * If >50% of the cached item name words appear in the message, it's relevant.
 *
 * @param message - The user's new message
 * @returns Cached market data if relevant, null otherwise
 */
export function getRelevantMarketCache(
  message: string,
): { result: any; cachedAt: string } | null {
  const cache = getMarketCache();
  if (!cache || !cache.itemName) return null;

  const lower = message.toLowerCase();
  const itemWords = cache.itemName
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);

  if (itemWords.length === 0) return null;

  // If >50% of the item name words appear in the message, it's relevant
  const matchCount = itemWords.filter(w => lower.includes(w)).length;
  if (matchCount >= Math.max(1, Math.floor(itemWords.length * 0.5))) {
    return { result: cache.result, cachedAt: cache.cachedAt };
  }

  return null;
}