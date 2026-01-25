// FILE: src/lib/hydra/storage/index.ts
// HYDRA Storage Module Exports
// Phase 4: Storage

// =============================================================================
// SUPABASE
// =============================================================================

export {
  getSupabaseClient,
  isSupabaseAvailable,
  saveAnalysis,
  saveAnalysisAsync,
  updateAnalysis,
  getAnalysis,
  getAnalysesByUser,
  getRecentAnalyses,
  generateItemHash,
  getCachedAnalysis,
  cacheAnalysis,
  clearExpiredCache,
  getAnalysisStats,
  type AnalysisRecord,
  type CachedAnalysis,
  type StorageConfig,
} from './supabase.js';

// =============================================================================
// MODULE INFO
// =============================================================================

export const STORAGE_MODULE_VERSION = '6.0.0';