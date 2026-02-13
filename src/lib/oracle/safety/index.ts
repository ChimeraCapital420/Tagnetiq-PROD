// FILE: src/lib/oracle/safety/index.ts
// Safety & Privacy Module — barrel exports

// ── Guardian (Crisis Detection + Care) ──────────────────
export {
  type SafetySignal,
  type SafetyScan,
  type CrisisResource,
  type SafetyEvent,
  scanMessage,
  buildSafetyPromptBlock,
  logSafetyEvent,
  getRecentSafetyContext,
  buildFollowUpBlock,
} from './guardian.js';

// ── Privacy (Conversation Control) ──────────────────────
export {
  type PrivacyLevel,
  type PrivacySettings,
  type SharedConversation,
  getPrivacySettings,
  updatePrivacySettings,
  setConversationPrivacy,
  lockConversation,
  unlockConversation,
  deleteConversation,
  getSharedConversation,
  getUserSharedConversations,
  exportUserData,
  autoCleanupConversations,
} from './privacy.js';