// FILE: src/lib/oracle/chat/index.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Module — Barrel Exports
// ═══════════════════════════════════════════════════════════════════════
// Phase 1: Pure function extractions (validators, detectors, context-builders)
// Phase 2: Data fetchers (lightweight + full context loading)
// Phase 3: Prompt assembler, response pipeline, persistence, post-call
// Phase 5: Response builder (final JSON assembly)
//
// v11.1 Liberation 11:
//   detectors.ts        → added detectRefinementIntent + RefinementIntentResult
//   prompt-assembler.ts → added HuntBuffer type to PromptAssemblyInput
//   correction-extractor.ts (NEW) → Phase 2 two-phase extraction
//   refinement-bridge.ts    (NEW) → Phase 3 bridge to refine-analysis
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
  // v11.1 L11 Phase 1
  detectRefinementIntent,
} from './detectors.js';

export type {
  // v11.1 L11 Phase 1
  RefinementIntentResult,
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

export type {
  PromptAssemblyInput,
  // v11.1 L11 Phase 4
  HuntBuffer,
} from './prompt-assembler.js';

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

// ── Correction Extractor (v11.1 L11 Phase 2 — NEW) ──────
export {
  extractCorrectionsRegex,
  parseCorrectionsFromResponse,
} from './correction-extractor.js';

export type {
  CorrectionField,
  CorrectionInput,
  ExtractionResult,
} from './correction-extractor.js';

// ── Refinement Bridge (v11.1 L11 Phase 3 — NEW) ─────────
export {
  callRefinementBridge,
} from './refinement-bridge.js';

export type {
  RefinementResult,
  BridgeInput,
} from './refinement-bridge.js';