// FILE: src/lib/analytics/index.ts
// Anonymous Analytics Module
//
// Sprint E+: Every data point, zero PII

export {
  // Anonymization
  anonymize,

  // Event tracking
  type EventCategory,
  type TrackEvent,
  track,
  trackBatch,

  // Convenience trackers (server-side)
  trackOnboarding,
  trackScan,
  trackVault,
  trackOracle,
  trackShare,
  trackFeature,
  trackPerformance,
  trackError,

  // KPI computation (cron)
  computeDailySnapshot,
  computeFunnelSnapshot,

  // KPI queries (dashboard)
  getLiveKPIs,
  getDailyKPIs,
  getFunnel,
  getFeatureUsage,
} from './tracker.js';