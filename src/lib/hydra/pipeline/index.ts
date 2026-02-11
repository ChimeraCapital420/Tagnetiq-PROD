// FILE: src/lib/hydra/pipeline/index.ts
// HYDRA v9.0 - Pipeline Module Exports
// Evidence-based pipeline: IDENTIFY → FETCH → REASON → VALIDATE

export { runPipeline } from './orchestrator.js';

// Stage runners (for direct access or testing)
export { runIdentifyStage } from './stages/identify.js';
export { runFetchStage } from './stages/fetch-evidence.js';
export { runReasonStage } from './stages/reason.js';
export { runValidateStage } from './stages/validate.js';

// Prompts (for inspection or override)
export { buildIdentifyPrompt } from './prompts/identify-prompt.js';
export { buildFetchPromptPerplexity, buildFetchPromptXai } from './prompts/fetch-prompt.js';
export { buildReasonPrompt } from './prompts/reason-prompt.js';
export { buildValidatePrompt } from './prompts/validate-prompt.js';

// Types
export type {
  ProviderRole,
  IdentifyResult,
  FetchResult,
  WebSearchResult,
  EvidenceSummary,
  ReasonResult,
  ValidateResult,
  ValidationFlag,
  PipelineResult,
  PipelineConfig,
  ProviderAccuracy,
  SelfHealConfig,
} from './types.js';

export {
  PROVIDER_ROLES,
  getProvidersForRole,
  DEFAULT_PIPELINE_CONFIG,
  DEFAULT_SELF_HEAL_CONFIG,
} from './types.js';