// FILE: src/lib/oracle/eyes/index.ts
// Oracle Eyes Module — barrel exports
//
// Sprint M: Visual Memory + Recall

// ── Capture (Tier 1 + 2) ───────────────────────────────
export {
  type CaptureMode,
  type CaptureSource,
  type VisualMemory,
  type VisualObject,
  type CaptureRequest,
  type CaptureResult,
  captureFromScan,
  captureManual,
  forgetMemory,
  forgetByQuery,
} from './capture.js';

// ── Recall ──────────────────────────────────────────────
export {
  type RecallQuery,
  type RecallResult,
  type RecalledMemory,
  recallMemories,
  buildRecallPromptBlock,
} from './recall.js';