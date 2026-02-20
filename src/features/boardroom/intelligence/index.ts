// FILE: src/features/boardroom/intelligence/index.ts
// Sprint 9: Boardroom Client-Side Intelligence — Barrel Exports
//
// The user's device is the boardroom's front desk.
// Everything here runs on-device at zero server cost.
//
// Modules:
//   client-energy   — Energy detection from message text
//   client-router   — Topic detection + routing preview
//   context-preload — Prefetch cognitive dashboard, cache in sessionStorage
//   offline-queue   — Queue messages when offline, replay when back

// ── Client Energy Detection ──────────────────────────────────────────
export {
  type ClientEnergyType,
  type ClientEnergyResult,
  type ClientRoomEnergyHint,
  detectClientEnergy,
  estimateRoomEnergy,
} from './client-energy';

// ── Client Topic Detection & Routing Preview ─────────────────────────
export {
  type ClientRoutingPreview,
  detectClientTopic,
  previewRouting,
} from './client-router';

// ── Cognitive Context Preloading ─────────────────────────────────────
export {
  type CachedCognitiveContext,
  preloadCognitiveContext,
  getCachedContext,
  clearCachedContext,
  getCachedMemberTrust,
  getCachedMemberTier,
  wasRecentlyDiscussed,
} from './context-preload';

// ── Offline Message Queue ────────────────────────────────────────────
export {
  type QueuedMessage,
  type OfflineQueueState,
  enqueueMessage,
  dequeueMessage,
  getPendingMessages,
  getPendingCount,
  clearQueue,
  isOnline,
  replayQueue,
  startNetworkListeners,
} from './offline-queue';