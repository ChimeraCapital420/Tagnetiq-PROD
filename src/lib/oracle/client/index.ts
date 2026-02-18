// FILE: src/lib/oracle/client/index.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Client Module — Barrel Exports
// ═══════════════════════════════════════════════════════════════════════
// Phase 1: Pure function extractions from useOracleChat.ts
// All functions run entirely on-device — zero server cost.
// ═══════════════════════════════════════════════════════════════════════

// ── Intent Detection (Liberation 2 + 10) ─────────────────
export {
  detectClientIntent,
  INTENT_SIGNALS,
  type ClientIntent,
} from './intent-detector';

// ── Energy Detection (Liberation 2) ──────────────────────
export { detectClientEnergy } from './energy-detector';

// ── Local Context Search (Liberation 2) ──────────────────
export { searchLocalContext } from './context-search';

// ── Device Detection (Liberation 2) ─────────────────────
export { getDeviceType, type DeviceType } from './device-detector';

// ── Tier Cache (sessionStorage) ──────────────────────────
export {
  getCachedTier,
  setCachedTier,
  clearCachedTier,
  type CachedTier,
} from './tier-cache';

// ── Market Data Cache (localStorage, Liberation 7) ──────
export {
  getMarketCache,
  setMarketCache,
  clearMarketCache,
  getRelevantMarketCache,
  type MarketCacheEntry,
} from './market-cache';

// ── Offline Queue (Service Worker) ──────────────────────
export { queueForOfflineSync } from './offline-queue';