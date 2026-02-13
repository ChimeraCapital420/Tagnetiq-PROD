// FILE: src/lib/oracle/index.ts
// Oracle Module — main exports
//
// The complete Oracle system:
//   identity/   → Oracle CRUD, name ceremony, AI DNA (C, C.1)
//   personality/ → Evolution via LLM, energy detection (C)
//   prompt/      → System prompt builder + all context sections (C, G+)
//   chips/       → Dynamic quick chips (C)
//   tier.ts      → Tier gating + message counting (D)
//   providers/   → Multi-provider routing + calling (F)
//   argos/       → Alerts, hunt mode, push, watchlist (G, H, I, J)

// ── Types ───────────────────────────────────────────────
export type {
  OracleIdentity,
  AiDnaProfile,
  ProviderStats,
  ProviderPersonalityMap,
  QuickChip,
  OracleChatResponse,
  PersonalityEvolution,
} from './types.js';

// ── Identity (Sprint C, C.1) ────────────────────────────
export {
  getOrCreateIdentity,
  updateIdentityAfterChat,
  claimOracleName,
  checkForNameCeremony,
  buildAiDna,
} from './identity/index.js';

// ── Personality (Sprint C) ──────────────────────────────
export { evolvePersonality } from './personality/index.js';
export { detectUserEnergy } from './personality/index.js';

// ── Prompt (Sprint C, G+) ──────────────────────────────
export { buildSystemPrompt } from './prompt/index.js';
export { buildArgosBlock, fetchArgosContext, type ArgosContext } from './prompt/argos-context.js';

// ── Chips (Sprint C) ───────────────────────────────────
export { getQuickChips } from './chips/index.js';

// ── Tier (Sprint D) ────────────────────────────────────
export {
  type UserTier,
  type TierInfo,
  type UsageInfo,
  type AccessResult,
  checkOracleAccess,
  getUserTier,
  hasFeature,
  isVoiceAllowed,
  isTierGatingActive,
} from './tier.js';

// ── Providers (Sprint F) ───────────────────────────────
export {
  type OracleProviderId,
  type RoutingDecision,
  type MessageIntent,
  type CallerResult,
  routeMessage,
  callOracle,
  getAvailableProviders,
} from './providers/index.js';

// ── Argos (Sprint G, H, I, J) ─────────────────────────
export {
  // Engine
  type AlertType,
  type AlertPriority,
  type ArgosAlert,
  type VaultScanResult,
  type HuntVerdict,
  type HuntResult,
  scanVaultForAlerts,
  getAlerts,
  markAlertsRead,
  dismissAlerts,
  getUnreadCount,
  huntTriage,
  huntBatch,
  // Push (Sprint I)
  type DeviceType,
  type PushTransport,
  type PushResult,
  pushAlert,
  pushAlertBatch,
  registerDevice,
  unregisterDevice,
  getDevices,
  updatePreferences,
  cleanupDeadSubscriptions,
  // Watchlist (Sprint J)
  type WatchType,
  type WatchlistItem,
  type AddWatchParams,
  addToWatchlist,
  removeFromWatchlist,
  deleteFromWatchlist,
  getWatchlist,
  updateWatch,
  autoPopulateWatchlist,
  getWatchlistSummary,
} from './argos/index.js';