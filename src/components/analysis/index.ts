// FILE: src/components/analysis/index.ts
// Barrel export — backwards compatible with existing imports.
//
// Old: import AnalysisResult from '@/components/AnalysisResult'
// New: import AnalysisResult from '@/components/analysis'
// Both work.

export { default } from './AnalysisResult.js';
export { default as AnalysisResult } from './AnalysisResult.js';

// Re-export types for consumers
export type {
  NexusAction,
  NexusData,
  AnalysisResultData,
  NormalizedAnalysis,
  HistoryContext,
  AnalysisCallbacks,
} from './types.js';