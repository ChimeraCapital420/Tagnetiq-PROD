// FILE: src/lib/oracle/argos/index.ts
// Argos Module — barrel exports

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