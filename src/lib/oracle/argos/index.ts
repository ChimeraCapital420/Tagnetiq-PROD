// FILE: src/lib/oracle/argos/index.ts
// Argos Module — barrel exports
//
// Sprint G:  Engine (vault monitoring) + Hunt Mode
// Sprint I:  Push notifications
// Sprint J:  Watchlist management

// ── Engine (Passive Monitoring) ─────────────────────────
export {
  type AlertType,
  type AlertPriority,
  type ArgosAlert,
  type VaultScanResult,
  type PriceChange,
  scanVaultForAlerts,
  getAlerts,
  markAlertsRead,
  dismissAlerts,
  getUnreadCount,
} from './engine.js';

// ── Hunt Mode (Active Scanning) ─────────────────────────
export {
  type HuntVerdict,
  type HuntResult,
  huntTriage,
  huntBatch,
} from './hunt.js';

// ── Push Notifications (Sprint I) ───────────────────────
export {
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
} from './push.js';

// ── Watchlist (Sprint J) ────────────────────────────────
export {
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
} from './watchlist.js';