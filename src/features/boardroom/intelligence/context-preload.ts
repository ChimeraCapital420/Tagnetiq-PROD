// FILE: src/features/boardroom/intelligence/context-preload.ts
// Sprint 9: Cognitive Context Preloading
//
// On boardroom page load, prefetches the cognitive dashboard data
// (room energy, member trust profiles, recent signals) and caches
// it in sessionStorage. When the user sends their first message,
// the client sends this cached context so the server skips its own
// fetchBoardMemberContext() call — saving ~100ms + 3 DB reads.
//
// Mobile-first: Fetches once, caches for 5 minutes. On slow networks,
// the boardroom renders immediately while this loads in background.

import { supabase } from '@/lib/supabase';
import { API_ENDPOINTS } from '../constants';

// =============================================================================
// TYPES
// =============================================================================

export interface CachedCognitiveContext {
  /** Member trust levels: slug → trust score */
  memberTrust: Record<string, number>;
  /** Member trust tiers: slug → tier name */
  memberTiers: Record<string, string>;
  /** Recent topic categories discussed */
  recentTopics: string[];
  /** Room energy snapshot */
  roomEnergy: {
    dominantMood: string;
    momentum: string;
    tensionLevel: string;
  } | null;
  /** When this was cached */
  cachedAt: number;
  /** Cache version (bump to invalidate) */
  version: number;
}

// =============================================================================
// CACHE CONFIG
// =============================================================================

const CACHE_KEY = 'boardroom_cognitive_ctx';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_VERSION = 1;

// =============================================================================
// CACHE OPERATIONS
// =============================================================================

/**
 * Get cached cognitive context if still fresh.
 * Returns null if expired or missing.
 */
export function getCachedContext(): CachedCognitiveContext | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cached: CachedCognitiveContext = JSON.parse(raw);

    // Version check
    if (cached.version !== CACHE_VERSION) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    // TTL check
    if (Date.now() - cached.cachedAt > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return cached;
  } catch {
    // Corrupt cache — clear it
    try { sessionStorage.removeItem(CACHE_KEY); } catch { /* noop */ }
    return null;
  }
}

/**
 * Store cognitive context in sessionStorage.
 */
function setCachedContext(ctx: CachedCognitiveContext): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(ctx));
  } catch {
    // sessionStorage full or unavailable — silently continue
  }
}

/**
 * Clear the cached context (call after meeting ends or member changes).
 */
export function clearCachedContext(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // noop
  }
}

// =============================================================================
// PRELOAD
// =============================================================================

/**
 * Prefetch cognitive dashboard data in background.
 * Called on boardroom page mount. Non-blocking, fire-and-forget.
 *
 * If the cognitive API endpoint doesn't exist yet (Sprint 8 not deployed),
 * this gracefully returns null — zero impact on existing functionality.
 */
export async function preloadCognitiveContext(): Promise<CachedCognitiveContext | null> {
  // Check cache first
  const existing = getCachedContext();
  if (existing) return existing;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    // Fetch cognitive dashboard from Sprint 8 endpoint
    const cognitiveEndpoint = `${API_ENDPOINTS.boardroom}/cognitive`;

    const response = await fetch(cognitiveEndpoint, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      // Short timeout — this is a background preload, don't block anything
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // Sprint 8 endpoint might not be deployed yet — that's fine
      if (response.status === 404) {
        console.debug('[Intelligence] Cognitive endpoint not available yet');
        return null;
      }
      return null;
    }

    const data = await response.json();

    // Extract what we need for client-side hints
    const ctx: CachedCognitiveContext = {
      memberTrust: {},
      memberTiers: {},
      recentTopics: [],
      roomEnergy: null,
      cachedAt: Date.now(),
      version: CACHE_VERSION,
    };

    // Parse dashboard response (matches cognitive.ts GET response shape)
    if (data.memberSummary) {
      for (const member of data.memberSummary) {
        if (member.slug && typeof member.trust === 'number') {
          ctx.memberTrust[member.slug] = member.trust;
        }
        if (member.slug && member.tier) {
          ctx.memberTiers[member.slug] = member.tier;
        }
      }
    }

    if (data.roomEnergy) {
      ctx.roomEnergy = {
        dominantMood: data.roomEnergy.dominantMood || 'neutral',
        momentum: data.roomEnergy.momentum || 'building',
        tensionLevel: data.roomEnergy.tensionLevel || 'none',
      };
    }

    if (data.recentSignals) {
      ctx.recentTopics = data.recentSignals
        .map((s: any) => s.topicCategory)
        .filter(Boolean)
        .slice(0, 5);
    }

    // Cache it
    setCachedContext(ctx);

    console.debug('[Intelligence] Cognitive context preloaded', {
      members: Object.keys(ctx.memberTrust).length,
      hasEnergy: !!ctx.roomEnergy,
    });

    return ctx;
  } catch (err) {
    // Network error, timeout, etc — silently continue
    console.debug('[Intelligence] Preload failed (non-critical):', err);
    return null;
  }
}

// =============================================================================
// CONTEXT ENRICHMENT
// =============================================================================

/**
 * Get trust score for a specific member from cache.
 * Returns undefined if not cached (server will compute it).
 */
export function getCachedMemberTrust(slug: string): number | undefined {
  const ctx = getCachedContext();
  return ctx?.memberTrust[slug];
}

/**
 * Get trust tier for a specific member from cache.
 */
export function getCachedMemberTier(slug: string): string | undefined {
  const ctx = getCachedContext();
  return ctx?.memberTiers[slug];
}

/**
 * Check if a topic was recently discussed (helps server prioritize).
 */
export function wasRecentlyDiscussed(topic: string): boolean {
  const ctx = getCachedContext();
  if (!ctx) return false;
  return ctx.recentTopics.includes(topic);
}