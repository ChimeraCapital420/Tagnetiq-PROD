// FILE: src/lib/oracle/index.ts
// Oracle Module — main exports
//
// Usage from api/oracle/chat.ts:
//   import { getOrCreateIdentity, updateIdentityAfterChat, ... } from '../src/lib/oracle/index.js';
//
// Or import from submodules directly:
//   import { routeMessage, callOracle } from '../src/lib/oracle/providers/index.js';
//   import { scanVaultForAlerts, huntTriage } from '../src/lib/oracle/argos/index.js';
//
// Module map:
//   identity/   → Oracle CRUD, name ceremony, AI DNA
//   personality/ → Evolution via LLM, energy detection
//   prompt/      → System prompt builder + sections
//   chips/       → Dynamic quick chips
//   tier.ts      → Tier gating + message counting (Sprint D)
//   providers/   → Multi-provider routing + calling (Sprint F)
//   argos/       → Proactive alerts + hunt mode (Sprint G)

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

// ── Identity ────────────────────────────────────────────
export {
  getOrCreateIdentity,
  updateIdentityAfterChat,
  claimOracleName,
} from './identity/index.js';

export { checkForNameCeremony } from './identity/index.js';
export { buildAiDna } from './identity/index.js';

// ── Personality ─────────────────────────────────────────
export { evolvePersonality } from './personality/index.js';
export { detectUserEnergy } from './personality/index.js';

// ── Prompt ──────────────────────────────────────────────
export { buildSystemPrompt } from './prompt/index.js';

// ── Chips ───────────────────────────────────────────────
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

// ── Argos (Sprint G) ──────────────────────────────────
export {
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
} from './argos/index.js';