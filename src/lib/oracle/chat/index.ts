// FILE: src/lib/oracle/chat/index.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Module — Barrel Exports
// ═══════════════════════════════════════════════════════════════════════
// Phase 1: Pure function extractions
// Phase 2+: Will add data-fetchers, prompt-assembler, response-pipeline, persistence
// ═══════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────
export type {
  ClientContext,
  CachedMarketData,
  ChatRequest,
  AnalysisContext,
  ContentDetectionResult,
  MarketItemRef,
  ChatContext,
  CallResult,
  ChatResponse,
} from './types.js';

// ── Validators ───────────────────────────────────────────
export {
  VALID_INTENTS,
  VALID_ENERGIES,
  validateIntent,
  validateEnergy,
  generateTitle,
} from './validators.js';

// ── Detectors ────────────────────────────────────────────
export {
  isRecallQuestion,
  isContentCreationRequest,
  isMarketQuery,
} from './detectors.js';

// ── Context Builders ─────────────────────────────────────
export {
  buildVisualMemoryContext,
  buildAnalysisContextBlock,
} from './context-builders.js';