// FILE: src/lib/oracle/index.ts
// Oracle Module — main exports
//
// Complete system: C-Q + M

// ── Types ───────────────────────────────────────────────
export type {
  OracleIdentity, AiDnaProfile, ProviderStats, ProviderPersonalityMap,
  QuickChip, OracleChatResponse, PersonalityEvolution,
} from './types.js';

// ── Identity (C, C.1) ──────────────────────────────────
export {
  getOrCreateIdentity, updateIdentityAfterChat, claimOracleName,
  checkForNameCeremony, buildAiDna,
} from './identity/index.js';

// ── Personality (C) ────────────────────────────────────
export { evolvePersonality, detectUserEnergy } from './personality/index.js';

// ── Prompt (C, G+, K) ─────────────────────────────────
export { buildSystemPrompt } from './prompt/index.js';
export { buildArgosBlock, fetchArgosContext, type ArgosContext } from './prompt/argos-context.js';

// ── Chips (C) ──────────────────────────────────────────
export { getQuickChips } from './chips/index.js';

// ── Tier (D) ───────────────────────────────────────────
export {
  type UserTier, type TierInfo, type UsageInfo, type AccessResult,
  checkOracleAccess, getUserTier, hasFeature, isVoiceAllowed, isTierGatingActive,
} from './tier.js';

// ── Providers (F) ──────────────────────────────────────
export {
  type OracleProviderId, type RoutingDecision, type MessageIntent, type CallerResult,
  routeMessage, callOracle, getAvailableProviders,
} from './providers/index.js';

// ── Argos (G-J, O) ────────────────────────────────────
export {
  type AlertType, type AlertPriority, type ArgosAlert, type VaultScanResult,
  type HuntVerdict, type HuntResult,
  scanVaultForAlerts, getAlerts, markAlertsRead, dismissAlerts, getUnreadCount,
  huntTriage, huntBatch,
  type DeviceType, type PushTransport, type PushResult,
  pushAlert, pushAlertBatch, registerDevice, unregisterDevice, getDevices,
  updatePreferences, cleanupDeadSubscriptions,
  type WatchType, type WatchlistItem, type AddWatchParams,
  addToWatchlist, removeFromWatchlist, deleteFromWatchlist, getWatchlist,
  updateWatch, autoPopulateWatchlist, getWatchlistSummary,
  type ScanType, type ScanFrequency, type ScanResult,
  type InventoryAlert, type ReorderSuggestion,
  runDueScans, getReorderSuggestions, logInventoryChange,
  getInventorySummary, upsertScanSchedule, getScanSchedules,
} from './argos/index.js';

// ── Safety & Privacy (L, Q) ────────────────────────────
export {
  // Guardian (L)
  type SafetySignal, type SafetyScan, type CrisisResource, type SafetyEvent,
  scanMessage, buildSafetyPromptBlock, logSafetyEvent,
  getRecentSafetyContext, buildFollowUpBlock,
  // Privacy (L)
  type PrivacyLevel, type PrivacySettings, type SharedConversation,
  getPrivacySettings, updatePrivacySettings as updatePrivacyPreferences,
  setConversationPrivacy, lockConversation, unlockConversation,
  deleteConversation, getSharedConversation, getUserSharedConversations,
  exportUserData, autoCleanupConversations,
  // Guardrails (Q)
  HARD_LIMITS,
  type AutonomyAction, type LedgerStatus, type GuardrailCheck,
  type AutonomySettings, type ProposedAction,
  checkGuardrails, proposeAutonomousAction,
  confirmAction, cancelAction, processExpiredConfirmations,
  activateKillSwitch, deactivateKillSwitch,
  getAutonomySettings, updateAutonomySettings,
  getLedger, getPendingActions,
} from './safety/index.js';

// ── Sharing & Profiles (N) ─────────────────────────────
export {
  type ShareResult, type PublicProfile, type SharedConversationView,
  shareConversation, unshareConversation, viewSharedConversation,
  getFeaturedConversations, getUserGallery,
  getPublicProfile, updatePublicProfile, getProfileBySlug, getShareAnalytics,
} from './sharing/index.js';

// ── Oracle Eyes (M) ────────────────────────────────────
export {
  type CaptureMode, type CaptureSource, type VisualMemory, type VisualObject,
  type CaptureRequest, type CaptureResult,
  captureFromScan, captureManual, forgetMemory, forgetByQuery,
  type RecallQuery, type RecallResult, type RecalledMemory,
  recallMemories, buildRecallPromptBlock,
} from './eyes/index.js';

// ── Nexus Decision Tree (M) ────────────────────────────
export {
  type NudgeType, type MarketDemand, type NexusDecision,
  type ListingDraft, type NexusAction,
  type ScanContext, type UserContext,
  evaluateScan, logNexusDecision,
} from './nexus/index.js';