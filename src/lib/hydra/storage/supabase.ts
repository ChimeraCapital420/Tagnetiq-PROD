// FILE: src/lib/hydra/storage/supabase.ts
// Supabase Storage Operations for HYDRA
// Handles saving analysis results and retrieving cached data

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ConsensusResult, ModelVote, AuthorityData } from '../types.js';
import type { FormattedAnalysisResponse } from '../pricing/formatter.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AnalysisRecord {
  id: string;
  user_id?: string;
  item_name: string;
  category: string;
  decision: 'BUY' | 'SELL';
  estimated_value: number;
  confidence: number;
  analysis_quality: string;
  total_votes: number;
  consensus_metrics: Record<string, number | boolean>;
  authority_data?: Record<string, unknown>;
  votes?: Record<string, unknown>[];
  processing_time?: number;
  created_at: string;
  updated_at: string;
}

export interface CachedAnalysis {
  itemHash: string;
  result: FormattedAnalysisResponse;
  expiresAt: Date;
}

export interface StorageConfig {
  /** Supabase URL */
  supabaseUrl?: string;
  /** Supabase anon key */
  supabaseKey?: string;
  /** Table name for analyses (default: 'analyses') */
  tableName?: string;
  /** Cache table name (default: 'analysis_cache') */
  cacheTableName?: string;
  /** Cache TTL in seconds (default: 3600 = 1 hour) */
  cacheTTL?: number;
}

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client
 */
export function getSupabaseClient(config?: StorageConfig): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  
  const url = config?.supabaseUrl || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = config?.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.warn('⚠️ Supabase credentials not configured');
    return null;
  }
  
  try {
    supabaseClient = createClient(url, key);
    return supabaseClient;
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    return null;
  }
}

/**
 * Check if Supabase is available
 */
export function isSupabaseAvailable(): boolean {
  return getSupabaseClient() !== null;
}

// =============================================================================
// SAVE OPERATIONS
// =============================================================================

/**
 * Save analysis result to Supabase
 */
export async function saveAnalysis(
  analysisId: string,
  consensus: ConsensusResult,
  category: string,
  userId?: string,
  votes?: ModelVote[],
  authorityData?: AuthorityData | null,
  processingTime?: number,
  config?: StorageConfig
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient(config);
  
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  const tableName = config?.tableName || 'analyses';
  
  try {
    const record: Partial<AnalysisRecord> = {
      id: analysisId,
      user_id: userId,
      item_name: consensus.itemName,
      category,
      decision: consensus.decision,
      estimated_value: consensus.estimatedValue,
      confidence: consensus.confidence,
      analysis_quality: consensus.analysisQuality,
      total_votes: consensus.totalVotes,
      consensus_metrics: consensus.consensusMetrics,
      authority_data: authorityData ? {
        source: authorityData.source,
        catalogNumber: authorityData.catalogNumber,
        title: authorityData.title,
        marketValue: authorityData.marketValue,
      } : undefined,
      votes: votes?.map(v => ({
        provider: v.providerName,
        decision: v.decision,
        value: v.estimatedValue,
        confidence: v.confidence,
        weight: v.weight,
      })),
      processing_time: processingTime,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    const { error } = await client
      .from(tableName)
      .upsert(record, { onConflict: 'id' });
    
    if (error) {
      console.error('❌ Failed to save analysis:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`✅ Analysis ${analysisId} saved to Supabase`);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Error saving analysis:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save analysis asynchronously (fire and forget)
 */
export function saveAnalysisAsync(
  analysisId: string,
  consensus: ConsensusResult,
  category: string,
  userId?: string,
  votes?: ModelVote[],
  authorityData?: AuthorityData | null,
  processingTime?: number
): void {
  saveAnalysis(analysisId, consensus, category, userId, votes, authorityData, processingTime)
    .catch(error => console.error('Background save failed:', error));
}

/**
 * Update analysis with additional data
 */
export async function updateAnalysis(
  analysisId: string,
  updates: Partial<AnalysisRecord>,
  config?: StorageConfig
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient(config);
  
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  const tableName = config?.tableName || 'analyses';
  
  try {
    const { error } = await client
      .from(tableName)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', analysisId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
    
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =============================================================================
// RETRIEVE OPERATIONS
// =============================================================================

/**
 * Get analysis by ID
 */
export async function getAnalysis(
  analysisId: string,
  config?: StorageConfig
): Promise<AnalysisRecord | null> {
  const client = getSupabaseClient(config);
  
  if (!client) return null;
  
  const tableName = config?.tableName || 'analyses';
  
  try {
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .eq('id', analysisId)
      .single();
    
    if (error || !data) return null;
    
    return data as AnalysisRecord;
    
  } catch {
    return null;
  }
}

/**
 * Get analyses by user ID
 */
export async function getAnalysesByUser(
  userId: string,
  limit: number = 50,
  config?: StorageConfig
): Promise<AnalysisRecord[]> {
  const client = getSupabaseClient(config);
  
  if (!client) return [];
  
  const tableName = config?.tableName || 'analyses';
  
  try {
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error || !data) return [];
    
    return data as AnalysisRecord[];
    
  } catch {
    return [];
  }
}

/**
 * Get recent analyses
 */
export async function getRecentAnalyses(
  limit: number = 20,
  config?: StorageConfig
): Promise<AnalysisRecord[]> {
  const client = getSupabaseClient(config);
  
  if (!client) return [];
  
  const tableName = config?.tableName || 'analyses';
  
  try {
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error || !data) return [];
    
    return data as AnalysisRecord[];
    
  } catch {
    return [];
  }
}

// =============================================================================
// CACHING OPERATIONS
// =============================================================================

/**
 * Generate hash for item (for cache lookup)
 */
export function generateItemHash(itemName: string, category?: string): string {
  const input = `${itemName.toLowerCase().trim()}|${category || ''}`;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get cached analysis result
 */
export async function getCachedAnalysis(
  itemHash: string,
  config?: StorageConfig
): Promise<FormattedAnalysisResponse | null> {
  const client = getSupabaseClient(config);
  
  if (!client) return null;
  
  const cacheTableName = config?.cacheTableName || 'analysis_cache';
  
  try {
    const { data, error } = await client
      .from(cacheTableName)
      .select('*')
      .eq('item_hash', itemHash)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) return null;
    
    return data.result as FormattedAnalysisResponse;
    
  } catch {
    return null;
  }
}

/**
 * Cache analysis result
 */
export async function cacheAnalysis(
  itemHash: string,
  result: FormattedAnalysisResponse,
  config?: StorageConfig
): Promise<{ success: boolean }> {
  const client = getSupabaseClient(config);
  
  if (!client) return { success: false };
  
  const cacheTableName = config?.cacheTableName || 'analysis_cache';
  const ttl = config?.cacheTTL || 3600; // 1 hour default
  
  try {
    const expiresAt = new Date(Date.now() + ttl * 1000);
    
    const { error } = await client
      .from(cacheTableName)
      .upsert({
        item_hash: itemHash,
        result,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      }, { onConflict: 'item_hash' });
    
    return { success: !error };
    
  } catch {
    return { success: false };
  }
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(
  config?: StorageConfig
): Promise<{ deleted: number }> {
  const client = getSupabaseClient(config);
  
  if (!client) return { deleted: 0 };
  
  const cacheTableName = config?.cacheTableName || 'analysis_cache';
  
  try {
    const { data, error } = await client
      .from(cacheTableName)
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('item_hash');
    
    return { deleted: data?.length || 0 };
    
  } catch {
    return { deleted: 0 };
  }
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get analysis statistics
 */
export async function getAnalysisStats(
  config?: StorageConfig
): Promise<{
  totalAnalyses: number;
  avgConfidence: number;
  buyPercentage: number;
  topCategories: Array<{ category: string; count: number }>;
} | null> {
  const client = getSupabaseClient(config);
  
  if (!client) return null;
  
  const tableName = config?.tableName || 'analyses';
  
  try {
    // Get total count
    const { count: totalAnalyses } = await client
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    // Get aggregates
    const { data: analyses } = await client
      .from(tableName)
      .select('confidence, decision, category');
    
    if (!analyses || analyses.length === 0) {
      return {
        totalAnalyses: 0,
        avgConfidence: 0,
        buyPercentage: 0,
        topCategories: [],
      };
    }
    
    const avgConfidence = analyses.reduce((sum, a) => sum + (a.confidence || 0), 0) / analyses.length;
    const buyCount = analyses.filter(a => a.decision === 'BUY').length;
    const buyPercentage = (buyCount / analyses.length) * 100;
    
    // Count by category
    const categoryCounts: Record<string, number> = {};
    for (const a of analyses) {
      if (a.category) {
        categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
      }
    }
    
    const topCategories = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalAnalyses: totalAnalyses || analyses.length,
      avgConfidence: Math.round(avgConfidence),
      buyPercentage: Math.round(buyPercentage),
      topCategories,
    };
    
  } catch {
    return null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
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
};