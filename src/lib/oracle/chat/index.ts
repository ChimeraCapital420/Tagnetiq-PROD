// FILE: src/lib/oracle/chat/index.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Module — Barrel Exports
// ═══════════════════════════════════════════════════════════════════════
// Phase 1: Pure function extractions (validators, detectors, context-builders)
// Phase 2: Data fetchers (lightweight + full context loading)
// Phase 3: Prompt assembler, response pipeline, persistence, post-call
// Phase 5: Response builder (final JSON assembly)
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

// ── Data Fetchers (Phase 2) ─────────────────────────────
export {
  fetchLightweightContext,
  fetchFullContext,
} from './data-fetchers.js';

// ── Prompt Assembler (Phase 3) ──────────────────────────
export {
  assembleSystemPrompt,
} from './prompt-assembler.js';

export type { PromptAssemblyInput } from './prompt-assembler.js';

// ── Response Pipeline (Phase 3) ─────────────────────────
export {
  executeResponsePipeline,
} from './response-pipeline.js';

export type { PipelineInput, PipelineResult } from './response-pipeline.js';

// ── Persistence (Phase 3) ───────────────────────────────
export {
  persistConversation,
} from './persistence.js';

export type { PersistenceInput } from './persistence.js';

// ── Post-Call Tasks (Phase 3) ───────────────────────────
export {
  runPostCallTasks,
} from './post-call.js';

export type { PostCallInput } from './post-call.js';

// ── Response Builder (Phase 5) ──────────────────────────
export {
  buildChatResponse,
} from './response-builder.js';

export type { ResponseBuilderInput } from './response-builder.js';