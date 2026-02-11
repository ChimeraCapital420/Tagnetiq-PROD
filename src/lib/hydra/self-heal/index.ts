// FILE: src/lib/hydra/self-heal/index.ts
// HYDRA v9.0 - Self-Healing System
// Reads benchmark data → adjusts provider weights dynamically
// Detects degradation → alerts → auto-adjusts

import { createClient } from '@supabase/supabase-js';
import type { ProviderAccuracy, SelfHealConfig, DEFAULT_SELF_HEAL_CONFIG } from '../pipeline/types.js';

// =============================================================================
// SELF-HEAL ENGINE
// =============================================================================

const DEFAULT_CONFIG: SelfHealConfig = {
  minSamples: 20,
  windowDays: 30,
  degradationThreshold: 0.20,
  maxBoost: 1.5,
  minWeight: 0.3,
};

/**
 * Get dynamic weights for all providers based on benchmark accuracy
 * Called before Stage 3 to adjust reasoning provider weights
 * 
 * Returns null if insufficient data (falls back to static weights)
 * 
 * Caches results for 1 hour to avoid DB queries on every scan
 */
let cachedWeights: { weights: Record<string, number>; timestamp: number } | null = null;
const CACHE_TTL = 3600000; // 1 hour

export async function getDynamicWeights(
  category?: string,
  config: SelfHealConfig = DEFAULT_CONFIG
): Promise<Record<string, number> | null> {
  // Check cache
  if (cachedWeights && (Date.now() - cachedWeights.timestamp) < CACHE_TTL) {
    return cachedWeights.weights;
  }
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) return null;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get rolling accuracy for each provider
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - config.windowDays);
    
    let query = supabase
      .from('provider_benchmarks')
      .select('provider_id, price_error_percent, decision_correct, detected_category')
      .gte('created_at', windowStart.toISOString())
      .not('price_error_percent', 'is', null);
    
    // Optionally filter by category
    if (category && category !== 'general') {
      query = query.eq('detected_category', category);
    }
    
    const { data, error } = await query;
    
    if (error || !data || data.length < config.minSamples) {
      console.log(`  🔄 Self-heal: insufficient data (${data?.length || 0} samples, need ${config.minSamples})`);
      return null;
    }
    
    // Group by provider
    const providerData: Record<string, { errors: number[]; correct: number; total: number }> = {};
    
    data.forEach(row => {
      const pid = row.provider_id;
      if (!providerData[pid]) {
        providerData[pid] = { errors: [], correct: 0, total: 0 };
      }
      providerData[pid].errors.push(Math.abs(row.price_error_percent || 0));
      providerData[pid].total++;
      if (row.decision_correct) providerData[pid].correct++;
    });
    
    // Calculate fleet average accuracy
    const allErrors = data.map(r => Math.abs(r.price_error_percent || 0));
    const fleetMAPE = allErrors.reduce((a, b) => a + b, 0) / allErrors.length;
    const fleetAccuracy = allErrors.filter(e => e <= 10).length / allErrors.length;
    
    // Calculate dynamic weights
    const weights: Record<string, number> = {};
    const alerts: string[] = [];
    
    Object.entries(providerData).forEach(([providerId, data]) => {
      if (data.total < 5) {
        // Too few samples for this provider — use default weight
        return;
      }
      
      const providerMAPE = data.errors.reduce((a, b) => a + b, 0) / data.errors.length;
      const providerAccuracy = data.errors.filter(e => e <= 10).length / data.errors.length;
      
      // Calculate weight multiplier
      // Providers more accurate than fleet average get boosted
      // Providers less accurate get reduced
      const accuracyDelta = providerAccuracy - fleetAccuracy;
      let multiplier = 1.0 + (0.5 * accuracyDelta);
      
      // Clamp to config bounds
      multiplier = Math.max(config.minWeight, Math.min(config.maxBoost, multiplier));
      
      weights[providerId] = parseFloat(multiplier.toFixed(3));
      
      // Check for degradation
      // Compare last 7 days vs 30 day average
      const recentCutoff = new Date();
      recentCutoff.setDate(recentCutoff.getDate() - 7);
      const recentData = data.errors.slice(-Math.ceil(data.total * 0.25)); // Last ~25%
      
      if (recentData.length >= 5) {
        const recentAccuracy = recentData.filter(e => e <= 10).length / recentData.length;
        const drop = providerAccuracy - recentAccuracy;
        
        if (drop >= config.degradationThreshold) {
          alerts.push(`⚠️ ${providerId}: accuracy dropped ${(drop * 100).toFixed(0)}% recently`);
          // Auto-reduce weight for degraded providers
          weights[providerId] = Math.max(config.minWeight, multiplier * 0.7);
        }
      }
    });
    
    // Log self-heal results
    if (Object.keys(weights).length > 0) {
      console.log(`  🔄 Self-heal: dynamic weights from ${data.length} benchmarks`);
      Object.entries(weights).forEach(([pid, w]) => {
        const arrow = w > 1.0 ? '⬆️' : w < 1.0 ? '⬇️' : '➡️';
        console.log(`    ${arrow} ${pid}: ${w}×`);
      });
      alerts.forEach(a => console.log(`    ${a}`));
    }
    
    // Cache results
    cachedWeights = { weights, timestamp: Date.now() };
    
    return weights;
    
  } catch (error: any) {
    console.error(`  ⚠️ Self-heal error (non-fatal): ${error.message}`);
    return null;
  }
}

/**
 * Get provider accuracy report for a specific category
 * Used by admin endpoints and investor reports
 */
export async function getProviderAccuracy(
  category?: string,
  windowDays: number = 30
): Promise<ProviderAccuracy[]> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) return [];
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);
    
    let query = supabase
      .from('provider_benchmarks')
      .select('provider_id, price_error_percent, decision_correct, detected_category')
      .gte('created_at', windowStart.toISOString())
      .not('price_error_percent', 'is', null);
    
    if (category) {
      query = query.eq('detected_category', category);
    }
    
    const { data, error } = await query;
    if (error || !data) return [];
    
    // Group and calculate
    const grouped: Record<string, number[]> = {};
    const decisions: Record<string, { correct: number; total: number }> = {};
    
    data.forEach(row => {
      const pid = row.provider_id;
      if (!grouped[pid]) grouped[pid] = [];
      if (!decisions[pid]) decisions[pid] = { correct: 0, total: 0 };
      
      grouped[pid].push(Math.abs(row.price_error_percent || 0));
      decisions[pid].total++;
      if (row.decision_correct) decisions[pid].correct++;
    });
    
    return Object.entries(grouped).map(([providerId, errors]) => {
      const within10 = errors.filter(e => e <= 10).length / errors.length;
      const within25 = errors.filter(e => e <= 25).length / errors.length;
      const mape = errors.reduce((a, b) => a + b, 0) / errors.length;
      
      const fleetMAPE = data.map(r => Math.abs(r.price_error_percent || 0)).reduce((a, b) => a + b, 0) / data.length;
      const fleetAccuracy = data.map(r => Math.abs(r.price_error_percent || 0)).filter(e => e <= 10).length / data.length;
      const accuracyDelta = within10 - fleetAccuracy;
      const multiplier = Math.max(0.3, Math.min(1.5, 1.0 + (0.5 * accuracyDelta)));
      
      return {
        providerId,
        category: category || 'all',
        accuracy: {
          within10Pct: parseFloat((within10 * 100).toFixed(1)),
          within25Pct: parseFloat((within25 * 100).toFixed(1)),
          mape: parseFloat(mape.toFixed(1)),
          sampleSize: errors.length,
        },
        weightMultiplier: parseFloat(multiplier.toFixed(3)),
        isDegraded: false, // TODO: implement degradation check
        updatedAt: new Date().toISOString(),
      };
    });
  } catch (error: any) {
    console.error('Self-heal getProviderAccuracy error:', error.message);
    return [];
  }
}

/**
 * Clear the weight cache (call after manual weight updates)
 */
export function clearWeightCache(): void {
  cachedWeights = null;
}