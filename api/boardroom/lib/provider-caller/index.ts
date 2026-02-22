// FILE: api/boardroom/lib/provider-caller/index.ts
// ═══════════════════════════════════════════════════════════════════════
// THE BOARD'S AI GATEWAY — BARREL EXPORTS
// ═══════════════════════════════════════════════════════════════════════
//
// This is NOT a utility wrapper. This is the central nervous system
// through which every board member connects to their AI backbone.
//
// Every conversation, every task, every briefing section, every sandbox
// scenario, every overnight debate — all flow through this gateway.
//
// REFACTORED from single 550-line monolith into modular files:
//
//   types.ts      → All TypeScript interfaces
//   config.ts     → API keys, timeouts, cost tables
//   providers.ts  → OpenAI-compatible, Anthropic, Gemini implementations
//   fallback.ts   → callProviderDirect, callWithFallback
//   metrics.ts    → Performance tracking, gateway metrics
//   supabase.ts   → Shared admin client, company context
//   towers.ts     → Local GPU tower health checks
//   utils.ts      → fetchWithTimeout
//
// IMPORT CONTRACT: This barrel re-exports everything that was public
// in the original monolith. Existing imports remain unchanged.
//
// CAPABILITIES:
//   ✓ 8 cloud providers + local GPU towers
//   ✓ Intelligent fallback chains (Primary → Groq speed → OpenAI reliable)
//   ✓ Per-provider timeout management (learned from HYDRA 504 fix)
//   ✓ Audit logging (every call tracked: who, what, when, cost)
//   ✓ Performance metrics (response time, fallback rate, quality signals)
//   ✓ Cost estimation (token tracking for budget management)
//   ✓ Local tower routing (Ollama, vLLM, llama.cpp)
//   ✓ Gateway-level error recovery
//   ✓ Shared Supabase admin client (one connection, all routes)
//   ✓ Company context loader (shared business knowledge)
//
// PROVIDERS:
//   Cloud:  OpenAI, Anthropic, Google/Gemini, DeepSeek, Groq, xAI, Perplexity, Mistral
//   Local:  Any local_tower_* with OpenAI-compatible API
//
// ═══════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────
export type {
  ProviderCallResult,
  CallOptions,
  GatewayHealthStatus,
  CallRecord,
  GatewayAuditDetails,
  TowerHealthResult,
  GatewayMetrics,
  ChatMessage,
} from './types.js';

// ── Config (API keys, timeouts, costs) ───────────────────
export {
  getApiKey,
  getAvailableProviders,
  getTimeout,
  estimateTokens,
  estimateCost,
  HARD_TIMEOUT,
  LOCAL_TOWER_TIMEOUT,
} from './config.js';

// ── Provider Implementations ─────────────────────────────
// NOTE: These are low-level. Most callers should use
// callProviderDirect or callWithFallback instead.
export {
  callOpenAICompatible,
  callAnthropic,
  callGemini,
} from './providers.js';

// ── Orchestration & Fallback ─────────────────────────────
export {
  callProviderDirect,
  callWithFallback,
} from './fallback.js';

// ── Performance Tracking ─────────────────────────────────
export {
  recordCall,
  getGatewayMetrics,
  logGatewayCall,
} from './metrics.js';

// ── Supabase & Company Context ───────────────────────────
export {
  getSupaAdmin,
  getCompanyContext,
} from './supabase.js';

// ── Local Tower Health ───────────────────────────────────
export {
  checkTowerHealth,
  checkAllTowers,
} from './towers.js';

// ── Utilities ────────────────────────────────────────────
export {
  fetchWithTimeout,
} from './utils.js';