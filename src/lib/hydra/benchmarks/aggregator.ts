// FILE: src/lib/hydra/benchmarks/aggregator.ts
// HYDRA v8.0 - Benchmark Aggregator
// Queries raw benchmarks → computes weekly scorecards + rankings
// Called by api/admin/provider-benchmarks.ts

import { createClient } from '@supabase/supabase-js';
import type { 
  WeeklyScorecard, 
  CategoryScore, 
  CompetitiveRanking, 
  RankEntry,
  InvestorBenchmarkReport,
} from './types.js';

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key);
}

// =============================================================================
// AGGREGATE ONE PROVIDER FOR ONE WEEK
// =============================================================================

/**
 * Build a weekly scorecard for one provider
 */
export async function aggregateProviderWeek(
  providerId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyScorecard | null> {
  const supabase = getSupabase();
  
  // Fetch all benchmarks for this provider in this week
  const { data: benchmarks, error } = await supabase
    .from('provider_benchmarks')
    .select('*')
    .eq('provider_id', providerId)
    .gte('created_at', weekStart.toISOString())
    .lt('created_at', weekEnd.toISOString())
    .order('created_at', { ascending: true });
  
  if (error || !benchmarks || benchmarks.length === 0) {
    return null;
  }
  
  // Filter to only votes with ground truth for accuracy metrics
  const withTruth = benchmarks.filter((b: any) => 
    b.ground_truth_price && b.ground_truth_price > 0
  );
  
  // --- Volume ---
  const totalVotes = benchmarks.length;
  const successfulVotes = withTruth.length;
  
  // --- Price accuracy ---
  let mae = 0;
  let mape = 0;
  let medianErrors: number[] = [];
  let within10 = 0;
  let within25 = 0;
  let within50 = 0;
  let overPredictions = 0;
  let underPredictions = 0;
  let accuratePredictions = 0;
  
  for (const b of withTruth) {
    const errorPct = b.price_error_percent || 0;
    const errorDollars = b.price_error_dollars || 0;
    
    mae += errorDollars;
    mape += errorPct;
    medianErrors.push(errorPct);
    
    if (errorPct <= 10) within10++;
    if (errorPct <= 25) within25++;
    if (errorPct <= 50) within50++;
    
    if (b.price_direction === 'over') overPredictions++;
    else if (b.price_direction === 'under') underPredictions++;
    else accuratePredictions++;
  }
  
  const n = withTruth.length || 1;
  mae = mae / n;
  mape = mape / n;
  
  // Median error
  medianErrors.sort((a, b) => a - b);
  const medianErrorPct = medianErrors.length > 0 
    ? medianErrors[Math.floor(medianErrors.length / 2)] 
    : 0;
  
  // --- Decision accuracy ---
  const correctDecisions = withTruth.filter((b: any) => b.decision_correct).length;
  const decisionAccuracy = n > 0 ? correctDecisions / n : 0;
  
  // --- Speed ---
  const responseTimes = benchmarks
    .map((b: any) => b.response_time_ms)
    .filter((t: number) => t > 0)
    .sort((a: number, b: number) => a - b);
  
  const avgResponseMs = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((s: number, t: number) => s + t, 0) / responseTimes.length)
    : 0;
  
  const p50ResponseMs = responseTimes.length > 0
    ? responseTimes[Math.floor(responseTimes.length * 0.5)]
    : 0;
    
  const p95ResponseMs = responseTimes.length > 0
    ? responseTimes[Math.floor(responseTimes.length * 0.95)]
    : 0;
  
  // --- Category breakdown ---
  const categoryScores: Record<string, CategoryScore> = {};
  const categoryGroups = groupBy(withTruth, (b: any) => b.detected_category);
  
  for (const [cat, catBenchmarks] of Object.entries(categoryGroups)) {
    const catN = catBenchmarks.length;
    const catMape = catBenchmarks.reduce((s: number, b: any) => s + (b.price_error_percent || 0), 0) / catN;
    const catWithin10 = catBenchmarks.filter((b: any) => (b.price_error_percent || 100) <= 10).length;
    const catWithin25 = catBenchmarks.filter((b: any) => (b.price_error_percent || 100) <= 25).length;
    const catAvgMs = catBenchmarks.reduce((s: number, b: any) => s + (b.response_time_ms || 0), 0) / catN;
    
    categoryScores[cat] = {
      votes: catN,
      mape: parseFloat(catMape.toFixed(2)),
      accuracy_10: parseFloat((catWithin10 / catN).toFixed(4)),
      accuracy_25: parseFloat((catWithin25 / catN).toFixed(4)),
      avg_response_ms: Math.round(catAvgMs),
      best_category: false,
      worst_category: false,
    };
  }
  
  // Mark best/worst categories
  const catEntries = Object.entries(categoryScores).filter(([_, s]) => s.votes >= 3);
  if (catEntries.length >= 2) {
    catEntries.sort((a, b) => a[1].mape - b[1].mape);
    catEntries[0][1].best_category = true;
    catEntries[catEntries.length - 1][1].worst_category = true;
  }
  
  // --- Vision ---
  const visionBenchmarks = benchmarks.filter((b: any) => b.stage === 'vision' && b.had_image);
  const visionCorrect = visionBenchmarks.filter((b: any) => 
    b.provider_item_name && 
    b.item_name && 
    b.provider_item_name.toLowerCase().includes(b.item_name.toLowerCase().split(' ')[0])
  ).length;
  
  // --- Composite score (0-100) ---
  // Weighted: accuracy 40%, decision 20%, speed 20%, coverage 20%
  const accuracyScore = Math.max(0, 100 - mape);
  const decisionScore = decisionAccuracy * 100;
  const speedScore = Math.max(0, 100 - (avgResponseMs / 150)); // <1.5s = 100, >15s = 0
  const coverageScore = Math.min(100, (totalVotes / 10) * 100); // 10+ votes = full score
  
  const compositeScore = parseFloat(
    (accuracyScore * 0.4 + decisionScore * 0.2 + speedScore * 0.2 + coverageScore * 0.2).toFixed(2)
  );
  
  // Get display name
  const { data: contact } = await supabase
    .from('provider_contacts')
    .select('provider_display_name')
    .eq('provider_id', providerId)
    .single();
  
  return {
    provider_id: providerId,
    provider_display_name: contact?.provider_display_name || providerId,
    week_start: weekStart.toISOString().split('T')[0],
    week_end: weekEnd.toISOString().split('T')[0],
    
    total_votes: totalVotes,
    successful_votes: successfulVotes,
    
    mean_absolute_error: parseFloat(mae.toFixed(2)),
    mean_absolute_percent_error: parseFloat(mape.toFixed(2)),
    median_error_percent: parseFloat(medianErrorPct.toFixed(2)),
    accuracy_rate_10: parseFloat((within10 / n).toFixed(4)),
    accuracy_rate_25: parseFloat((within25 / n).toFixed(4)),
    
    over_predictions: overPredictions,
    under_predictions: underPredictions,
    accurate_predictions: accuratePredictions,
    
    correct_decisions: correctDecisions,
    decision_accuracy: parseFloat(decisionAccuracy.toFixed(4)),
    
    avg_response_ms: avgResponseMs,
    p50_response_ms: p50ResponseMs,
    p95_response_ms: p95ResponseMs,
    
    category_scores: categoryScores,
    
    vision_votes: visionBenchmarks.length,
    vision_accuracy: visionBenchmarks.length > 0 
      ? parseFloat((visionCorrect / visionBenchmarks.length).toFixed(4))
      : 0,
    
    overall_rank: null,  // Set by buildCompetitiveRankings
    price_accuracy_rank: null,
    speed_rank: null,
    decision_accuracy_rank: null,
    
    composite_score: compositeScore,
  };
}

// =============================================================================
// AGGREGATE ALL PROVIDERS FOR ONE WEEK
// =============================================================================

/**
 * Build scorecards for all active providers
 */
export async function aggregateAllProviders(
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyScorecard[]> {
  const supabase = getSupabase();
  
  // Get distinct providers with votes in this period
  const { data: providers } = await supabase
    .from('provider_benchmarks')
    .select('provider_id')
    .gte('created_at', weekStart.toISOString())
    .lt('created_at', weekEnd.toISOString());
  
  if (!providers || providers.length === 0) return [];
  
  const uniqueProviders = [...new Set(providers.map((p: any) => p.provider_id))];
  
  const scorecards: WeeklyScorecard[] = [];
  
  for (const pid of uniqueProviders) {
    const scorecard = await aggregateProviderWeek(pid, weekStart, weekEnd);
    if (scorecard) {
      scorecards.push(scorecard);
    }
  }
  
  return scorecards;
}

// =============================================================================
// COMPETITIVE RANKINGS
// =============================================================================

/**
 * Build competitive rankings across all providers
 * This is the PAID tier data
 */
export function buildCompetitiveRankings(
  scorecards: WeeklyScorecard[],
  previousWeekScorecards?: WeeklyScorecard[]
): CompetitiveRanking {
  // Sort by composite score for overall ranking
  const overall = rankBy(scorecards, 'composite_score', 'desc', previousWeekScorecards);
  const priceAccuracy = rankBy(scorecards, 'mean_absolute_percent_error', 'asc', previousWeekScorecards);
  const speed = rankBy(scorecards, 'avg_response_ms', 'asc', previousWeekScorecards);
  const decisionAcc = rankBy(scorecards, 'decision_accuracy', 'desc', previousWeekScorecards);
  const visionAcc = rankBy(
    scorecards.filter(s => s.vision_votes > 0), 
    'vision_accuracy', 'desc', 
    previousWeekScorecards
  );
  
  // Apply ranks back to scorecards
  overall.forEach((entry, i) => {
    const sc = scorecards.find(s => s.provider_id === entry.provider_id);
    if (sc) sc.overall_rank = i + 1;
  });
  priceAccuracy.forEach((entry, i) => {
    const sc = scorecards.find(s => s.provider_id === entry.provider_id);
    if (sc) sc.price_accuracy_rank = i + 1;
  });
  speed.forEach((entry, i) => {
    const sc = scorecards.find(s => s.provider_id === entry.provider_id);
    if (sc) sc.speed_rank = i + 1;
  });
  decisionAcc.forEach((entry, i) => {
    const sc = scorecards.find(s => s.provider_id === entry.provider_id);
    if (sc) sc.decision_accuracy_rank = i + 1;
  });
  
  // Category leaders
  const allCategories = new Set<string>();
  for (const sc of scorecards) {
    Object.keys(sc.category_scores).forEach(c => allCategories.add(c));
  }
  
  const categoryLeaders: Record<string, RankEntry[]> = {};
  for (const cat of allCategories) {
    const catScorecards = scorecards.filter(s => s.category_scores[cat]?.votes >= 2);
    if (catScorecards.length >= 2) {
      categoryLeaders[cat] = catScorecards
        .map(s => ({
          rank: 0,
          provider_id: s.provider_id,
          provider_display_name: s.provider_display_name,
          score: s.category_scores[cat].accuracy_10,
          delta_from_last_week: null,
        }))
        .sort((a, b) => b.score - a.score)
        .map((entry, i) => ({ ...entry, rank: i + 1 }));
    }
  }
  
  return {
    week_start: scorecards[0]?.week_start || '',
    overall,
    price_accuracy: priceAccuracy,
    speed,
    decision_accuracy: decisionAcc,
    vision_accuracy: visionAcc,
    category_leaders: categoryLeaders,
  };
}

// =============================================================================
// INVESTOR REPORT DATA
// =============================================================================

/**
 * Build data for the investor suite PDF
 */
export async function buildInvestorReport(
  weekCount: number = 4
): Promise<InvestorBenchmarkReport> {
  const supabase = getSupabase();
  
  // Get total benchmarks
  const { count: totalVotes } = await supabase
    .from('provider_benchmarks')
    .select('*', { count: 'exact', head: true });
  
  // Get distinct analyses
  const { data: analyses } = await supabase
    .from('provider_benchmarks')
    .select('analysis_id')
    .limit(10000);
  
  const uniqueAnalyses = new Set(analyses?.map((a: any) => a.analysis_id) || []);
  
  // Get distinct providers
  const { data: providers } = await supabase
    .from('provider_benchmarks')
    .select('provider_id')
    .limit(10000);
  
  const uniqueProviders = new Set(providers?.map((p: any) => p.provider_id) || []);
  
  // Get distinct categories
  const { data: categories } = await supabase
    .from('provider_benchmarks')
    .select('detected_category')
    .limit(10000);
  
  const uniqueCategories = new Set(categories?.map((c: any) => c.detected_category) || []);
  
  // Build weekly trend data
  const weeklyTrends: Array<{ week: string; avg_platform_accuracy: number; total_analyses: number }> = [];
  
  const now = new Date();
  for (let i = weekCount - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const { data: weekData } = await supabase
      .from('provider_benchmarks')
      .select('price_error_percent, analysis_id')
      .gte('created_at', weekStart.toISOString())
      .lt('created_at', weekEnd.toISOString())
      .not('price_error_percent', 'is', null);
    
    if (weekData && weekData.length > 0) {
      const avgError = weekData.reduce((s: number, d: any) => s + d.price_error_percent, 0) / weekData.length;
      const weekAnalyses = new Set(weekData.map((d: any) => d.analysis_id)).size;
      
      weeklyTrends.push({
        week: weekStart.toISOString().split('T')[0],
        avg_platform_accuracy: parseFloat((100 - avgError).toFixed(2)),
        total_analyses: weekAnalyses,
      });
    }
  }
  
  // Get latest weekly scorecards for provider rankings
  const latestWeekStart = new Date(now);
  latestWeekStart.setDate(latestWeekStart.getDate() - 7);
  latestWeekStart.setHours(0, 0, 0, 0);
  
  const scorecards = await aggregateAllProviders(latestWeekStart, now);
  buildCompetitiveRankings(scorecards);
  
  const providerRankings = scorecards
    .sort((a, b) => (a.overall_rank || 99) - (b.overall_rank || 99))
    .map((sc, i) => {
      const catEntries = Object.entries(sc.category_scores);
      const best = catEntries.sort((a, b) => a[1].mape - b[1].mape)[0];
      const worst = catEntries.sort((a, b) => b[1].mape - a[1].mape)[0];
      
      return {
        rank: i + 1,
        provider_id: sc.provider_id,
        provider_name: sc.provider_display_name,
        composite_score: sc.composite_score,
        mape: sc.mean_absolute_percent_error,
        decision_accuracy: sc.decision_accuracy,
        avg_speed_ms: sc.avg_response_ms,
        strongest_category: best?.[0] || 'n/a',
        weakest_category: worst?.[0] || 'n/a',
      };
    });
  
  return {
    generated_at: new Date().toISOString(),
    period: `Last ${weekCount} weeks`,
    total_analyses: uniqueAnalyses.size,
    total_votes_tracked: totalVotes || 0,
    providers_tracked: uniqueProviders.size,
    categories_covered: uniqueCategories.size,
    platform_accuracy: {
      market_verified_analyses: uniqueAnalyses.size,
      avg_final_price_error: scorecards.length > 0
        ? parseFloat((scorecards.reduce((s, sc) => s + sc.mean_absolute_percent_error, 0) / scorecards.length).toFixed(2))
        : 0,
      authority_match_rate: 0, // TODO: calculate from benchmarks
    },
    provider_rankings: providerRankings,
    category_performance: {},
    weekly_trends: weeklyTrends,
  };
}

// =============================================================================
// PERSIST WEEKLY SCORECARDS
// =============================================================================

/**
 * Save weekly scorecards to provider_benchmark_weekly table
 */
export async function persistWeeklyAggregates(
  scorecards: WeeklyScorecard[]
): Promise<void> {
  const supabase = getSupabase();
  
  for (const sc of scorecards) {
    const row = {
      week_start: sc.week_start,
      week_end: sc.week_end,
      provider_id: sc.provider_id,
      total_votes: sc.total_votes,
      successful_votes: sc.successful_votes,
      failed_votes: sc.total_votes - sc.successful_votes,
      mean_absolute_error: sc.mean_absolute_error,
      mean_absolute_percent_error: sc.mean_absolute_percent_error,
      median_error_percent: sc.median_error_percent,
      within_10_percent: Math.round(sc.accuracy_rate_10 * sc.successful_votes),
      within_25_percent: Math.round(sc.accuracy_rate_25 * sc.successful_votes),
      accuracy_rate_10: sc.accuracy_rate_10,
      accuracy_rate_25: sc.accuracy_rate_25,
      over_predictions: sc.over_predictions,
      under_predictions: sc.under_predictions,
      accurate_predictions: sc.accurate_predictions,
      correct_decisions: sc.correct_decisions,
      decision_accuracy: sc.decision_accuracy,
      avg_response_ms: sc.avg_response_ms,
      p50_response_ms: sc.p50_response_ms,
      p95_response_ms: sc.p95_response_ms,
      category_scores: sc.category_scores,
      vision_votes: sc.vision_votes,
      vision_accuracy: sc.vision_accuracy,
      overall_rank: sc.overall_rank,
      price_accuracy_rank: sc.price_accuracy_rank,
      speed_rank: sc.speed_rank,
      decision_accuracy_rank: sc.decision_accuracy_rank,
      composite_score: sc.composite_score,
    };
    
    await supabase
      .from('provider_benchmark_weekly')
      .upsert(row, { onConflict: 'week_start,provider_id' });
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

function rankBy(
  scorecards: WeeklyScorecard[],
  field: keyof WeeklyScorecard,
  order: 'asc' | 'desc',
  previousWeek?: WeeklyScorecard[]
): RankEntry[] {
  const sorted = [...scorecards].sort((a, b) => {
    const aVal = a[field] as number;
    const bVal = b[field] as number;
    return order === 'asc' ? aVal - bVal : bVal - aVal;
  });
  
  return sorted.map((sc, i) => {
    // Calculate delta from last week
    let delta: number | null = null;
    if (previousWeek) {
      const prevSc = previousWeek.find(p => p.provider_id === sc.provider_id);
      if (prevSc) {
        const prevRank = previousWeek
          .sort((a, b) => {
            const aVal = a[field] as number;
            const bVal = b[field] as number;
            return order === 'asc' ? aVal - bVal : bVal - aVal;
          })
          .findIndex(p => p.provider_id === sc.provider_id) + 1;
        delta = prevRank - (i + 1); // Positive = improved
      }
    }
    
    return {
      rank: i + 1,
      provider_id: sc.provider_id,
      provider_display_name: sc.provider_display_name,
      score: sc[field] as number,
      delta_from_last_week: delta,
    };
  });
}