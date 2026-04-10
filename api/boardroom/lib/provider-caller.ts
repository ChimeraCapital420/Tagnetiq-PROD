// FILE: api/boardroom/lib/provider-caller.ts
// ═══════════════════════════════════════════════════════════════════════
// PROVIDER CALLER — FLAT BARREL
// ═══════════════════════════════════════════════════════════════════════
//
// Bridge file: api/boardroom/chat.ts and other files import from
// './provider-caller.js' (flat path) but the implementation lives in
// the './provider-caller/' folder with its own index.ts barrel.
//
// Node ESM cannot resolve a directory as './provider-caller.js'.
// This file bridges the gap without touching any importers.
//
// All exports pass through from ./provider-caller/index.ts unchanged.
//
// ═══════════════════════════════════════════════════════════════════════

export type {
  ProviderCallResult,
  CallOptions,
  GatewayHealthStatus,
  CallRecord,
  GatewayAuditDetails,
  TowerHealthResult,
  GatewayMetrics,
  ChatMessage,
} from './provider-caller/types.js';

export {
  getApiKey,
  getAvailableProviders,
  getTimeout,
  estimateTokens,
  estimateCost,
  HARD_TIMEOUT,
  LOCAL_TOWER_TIMEOUT,
} from './provider-caller/config.js';

export {
  callOpenAICompatible,
  callAnthropic,
  callGemini,
} from './provider-caller/providers.js';

export {
  callProviderDirect,
  callWithFallback,
} from './provider-caller/fallback.js';

export {
  recordCall,
  getGatewayMetrics,
  logGatewayCall,
} from './provider-caller/metrics.js';

export {
  getSupaAdmin,
  getCompanyContext,
} from './provider-caller/supabase.js';

export {
  checkTowerHealth,
  checkAllTowers,
} from './provider-caller/towers.js';

export {
  fetchWithTimeout,
} from './provider-caller/utils.js';