// FILE: src/lib/oracle/safety/index.ts
// Safety & Privacy Module — barrel exports
//
// Sprint L: Crisis detection + conversation privacy
// Sprint Q: Autonomy guardrails

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

// ── Guardrails (Autonomy Safety) ────────────────────────
export {
  HARD_LIMITS,
  type AutonomyAction,
  type LedgerStatus,
  type GuardrailCheck,
  type AutonomySettings,
  type ProposedAction,
  checkGuardrails,
  proposeAutonomousAction,
  confirmAction,
  cancelAction,
  processExpiredConfirmations,
  activateKillSwitch,
  deactivateKillSwitch,
  getAutonomySettings,
  updateAutonomySettings,
  getLedger,
  getPendingActions,
} from './guardrails.js';