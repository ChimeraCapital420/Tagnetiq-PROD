// FILE: src/lib/oracle/argos/index.ts
// Argos Module — barrel exports
//
// Sprint G:  Vault monitoring + hunt mode
// Sprint H:  Hunt personality injection
// Sprint I:  Push notifications
// Sprint J:  Watchlist management
// Sprint O:  Cron engine + inventory management

// ── Engine (Sprint G) ───────────────────────────────────
export {
  type AlertType,
  type AlertPriority,
  type ArgosAlert,
  type VaultScanResult,
  scanVaultForAlerts,
  getAlerts,
  markAlertsRead,
  dismissAlerts,
  getUnreadCount,
} from './engine.js';

// ── Hunt Mode (Sprint G, H) ────────────────────────────
export {
  type HuntVerdict,
  type HuntResult,
  huntTriage,
  huntBatch,
} from './hunt.js';

// ── Push Notifications (Sprint I) ──────────────────────
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

// ── Watchlist (Sprint J) ───────────────────────────────
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

// ── Cron Engine + Inventory (Sprint O) ─────────────────
export {
  type ScanType,
  type ScanFrequency,
  type ScanResult,
  type InventoryAlert,
  type ReorderSuggestion,
  runDueScans,
  getReorderSuggestions,
  logInventoryChange,
  getInventorySummary,
  upsertScanSchedule,
  getScanSchedules,
} from './cron.js';