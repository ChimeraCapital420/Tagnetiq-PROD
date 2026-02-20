// FILE: src/lib/boardroom/oracle-insights.ts
// ═══════════════════════════════════════════════════════════════════════
// ORACLE → BOARD INSIGHTS PIPELINE
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 8 Gap #3: Oracle User Data Pipeline
//
// Aggregates anonymized user behavioral data from the existing analytics
// pipeline and transforms it into board-digestible insights.
//
// DATA SOURCES (existing — we query, never duplicate):
//   analytics_events → Raw events (scans, chats, errors, performance)
//   analytics_daily  → Pre-computed daily snapshots (DAU, WAU, etc.)
//   analytics_funnel → Conversion funnel stages
//
// OUTPUTS:
//   board_oracle_insights → One row per day, JSONB columns per domain
//
// CONSUMERS:
//   prompt-builder.ts    → Injects insights into board member context
//   briefing.ts          → Morning/evening briefing content
//   oracle-bridge.ts     → API endpoint for on-demand queries
//
// ANONYMIZATION:
//   All data is already anonymized by tracker.ts (SHA-256 hashed IDs).
//   This module never touches user IDs — only aggregates.
//
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export interface EngagementInsights {
  dau: number;
  wau: number;
  mau: number;
  dauTrend: number;
  newSignups: number;
  onboardingCompleteRate: number;
  avgStreak: number;
  activeNow: number;
}

export interface ScanPatternInsights {
  totalScans: number;
  scansTrend: number;
  avgScanTimeMs: number | null;
  successRate: number | null;
  topCategories: Array<{ category: string; count: number; pctOfTotal: number }>;
  categoryShift: string | null;
  providersUsed: Record<string, number>;
}

export interface ConversionInsights {
  funnel: Array<{ stage: string; users: number; rate: number | null }>;
  biggestDropOff: { from: string; to: string; dropRate: number } | null;
  funnelTrend: string | null;
  signupToScanRate: number | null;
  scanToVaultRate: number | null;
  vaultToOracleRate: number | null;
}

export interface MarketplaceInsights {
  listingsCreated: number;
  listingsTrend: number;
  sharesCompleted: number;
  sharesTrend: number;
}

export interface AIPerformanceInsights {
  avgResponseMs: number | null;
  p95ResponseMs: number | null;
  responseTrend: number;
  errorCount: number;
  errorRate: number;
  errorTrend: number;
  oracleChats: number;
  oracleTrend: number;
  uniqueOracleUsers: number;
  topErrorTypes: Array<{ type: string; count: number }>;
}

export interface InsightAlert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric: string;
  value: number;
}

export interface BoardInsightsSnapshot {
  engagement: EngagementInsights;
  scanPatterns: ScanPatternInsights;
  conversion: ConversionInsights;
  marketplace: MarketplaceInsights;
  aiPerformance: AIPerformanceInsights;
  executiveSummary: string;
  alerts: InsightAlert[];
}

// =============================================================================
// MAIN AGGREGATION — Computes full snapshot for a date
// =============================================================================

/**
 * Compute a full board insights snapshot for a given date.
 * Pulls from analytics_daily (pre-computed) and analytics_events (recent).
 * Returns structured data ready to insert into board_oracle_insights.
 */
export async function computeBoardInsights(
  supabase: SupabaseClient,
  date?: string,
): Promise<BoardInsightsSnapshot> {
  const snapshotDate = date || new Date().toISOString().split('T')[0];

  // Fetch data sources in parallel
  const [todaySnapshot, weekSnapshots, funnel, todayEvents, recentErrors] = await Promise.all([
    getDailySnapshot(supabase, snapshotDate),
    getWeekSnapshots(supabase, snapshotDate),
    getLatestFunnel(supabase),
    getTodayEvents(supabase, snapshotDate),
    getRecentErrors(supabase, snapshotDate),
  ]);

  // Compute each insight domain
  const engagement = computeEngagement(todaySnapshot, weekSnapshots, todayEvents);
  const scanPatterns = computeScanPatterns(todaySnapshot, weekSnapshots, todayEvents);
  const conversion = computeConversion(funnel);
  const marketplace = computeMarketplace(todaySnapshot, weekSnapshots);
  const aiPerformance = computeAIPerformance(todaySnapshot, weekSnapshots, todayEvents, recentErrors);

  // Detect anomalies
  const alerts = detectAlerts(engagement, scanPatterns, aiPerformance, conversion);

  // Build executive summary
  const executiveSummary = buildExecutiveSummary(
    engagement, scanPatterns, conversion, marketplace, aiPerformance, alerts,
  );

  return {
    engagement,
    scanPatterns,
    conversion,
    marketplace,
    aiPerformance,
    executiveSummary,
    alerts,
  };
}

/**
 * Persist a computed snapshot to the board_oracle_insights table.
 */
export async function persistBoardInsights(
  supabase: SupabaseClient,
  snapshotDate: string,
  insights: BoardInsightsSnapshot,
): Promise<void> {
  await supabase
    .from('board_oracle_insights')
    .upsert({
      snapshot_date: snapshotDate,
      computed_at: new Date().toISOString(),
      engagement: insights.engagement,
      scan_patterns: insights.scanPatterns,
      conversion: insights.conversion,
      marketplace: insights.marketplace,
      ai_performance: insights.aiPerformance,
      executive_summary: insights.executiveSummary,
      alerts: insights.alerts,
    }, { onConflict: 'snapshot_date' });
}

/**
 * Get recent insights for board consumption.
 * Returns the last N days of insights (most recent first).
 */
export async function getRecentInsights(
  supabase: SupabaseClient,
  days: number = 7,
): Promise<any[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const { data } = await supabase
    .from('board_oracle_insights')
    .select('*')
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: false });

  return data || [];
}

/**
 * Get today's insights — computes live if no snapshot exists yet.
 */
export async function getTodayInsights(
  supabase: SupabaseClient,
): Promise<BoardInsightsSnapshot> {
  const today = new Date().toISOString().split('T')[0];

  // Check for existing snapshot
  const { data: existing } = await supabase
    .from('board_oracle_insights')
    .select('*')
    .eq('snapshot_date', today)
    .single();

  if (existing) {
    return {
      engagement: existing.engagement,
      scanPatterns: existing.scan_patterns,
      conversion: existing.conversion,
      marketplace: existing.marketplace,
      aiPerformance: existing.ai_performance,
      executiveSummary: existing.executive_summary,
      alerts: existing.alerts,
    };
  }

  // No snapshot yet — compute live
  return computeBoardInsights(supabase, today);
}

/**
 * Build a board-ready context block for injection into prompts.
 * Returns a formatted string that prompt-builder.ts can append.
 */
export function formatInsightsForPrompt(insights: BoardInsightsSnapshot): string {
  const { engagement, scanPatterns, aiPerformance, conversion, marketplace, alerts } = insights;

  const sections: string[] = [];

  // Engagement headline
  sections.push(
    `**Users Today**: ${engagement.dau} DAU (${trendStr(engagement.dauTrend)} vs 7-day avg), ` +
    `${engagement.newSignups} new signups, ${engagement.activeNow} active right now`
  );

  // Scan headline
  if (scanPatterns.totalScans > 0) {
    const topCat = scanPatterns.topCategories[0];
    sections.push(
      `**Scans**: ${scanPatterns.totalScans} today (${trendStr(scanPatterns.scansTrend)}), ` +
      `${pctStr(scanPatterns.successRate)} success rate` +
      (topCat ? `, top category: ${topCat.category} (${topCat.pctOfTotal}%)` : '')
    );
  }

  // AI performance
  if (aiPerformance.avgResponseMs) {
    sections.push(
      `**AI Performance**: ${aiPerformance.avgResponseMs}ms avg response, ` +
      `${aiPerformance.errorCount} errors (${trendStr(aiPerformance.errorTrend)}), ` +
      `${aiPerformance.oracleChats} Oracle chats`
    );
  }

  // Conversion highlight
  if (conversion.biggestDropOff) {
    sections.push(
      `**Funnel Alert**: Biggest drop-off at ${conversion.biggestDropOff.from} → ${conversion.biggestDropOff.to} ` +
      `(${pctStr(conversion.biggestDropOff.dropRate)} drop)`
    );
  }

  // Marketplace
  if (marketplace.listingsCreated > 0 || marketplace.sharesCompleted > 0) {
    sections.push(
      `**Marketplace**: ${marketplace.listingsCreated} new listings (${trendStr(marketplace.listingsTrend)}), ` +
      `${marketplace.sharesCompleted} shares`
    );
  }

  // Alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'warning');
  if (criticalAlerts.length > 0) {
    sections.push(`**⚠️ Alerts**: ${criticalAlerts.map(a => a.message).join('; ')}`);
  }

  if (sections.length === 0) {
    return '';
  }

  return `
## LIVE PRODUCT DATA (from Oracle analytics)
Use this real data to ground your advice in facts, not assumptions.

${sections.join('\n')}
`;
}

// =============================================================================
// DATA SOURCE QUERIES
// =============================================================================

async function getDailySnapshot(supabase: SupabaseClient, date: string): Promise<any | null> {
  const { data } = await supabase
    .from('analytics_daily')
    .select('*')
    .eq('snapshot_date', date)
    .single();
  return data;
}

async function getWeekSnapshots(supabase: SupabaseClient, date: string): Promise<any[]> {
  const weekAgo = new Date(new Date(date).getTime() - 7 * 86400000).toISOString().split('T')[0];
  const { data } = await supabase
    .from('analytics_daily')
    .select('*')
    .gte('snapshot_date', weekAgo)
    .lt('snapshot_date', date)
    .order('snapshot_date', { ascending: true });
  return data || [];
}

async function getLatestFunnel(supabase: SupabaseClient): Promise<any | null> {
  const { data } = await supabase
    .from('analytics_funnel')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();
  return data;
}

async function getTodayEvents(supabase: SupabaseClient, date: string): Promise<any[]> {
  const dayStart = `${date}T00:00:00Z`;
  const dayEnd = `${date}T23:59:59Z`;

  const { data } = await supabase
    .from('analytics_events')
    .select('anon_id, event_name, event_category, properties, created_at')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  return data || [];
}

async function getRecentErrors(supabase: SupabaseClient, date: string): Promise<any[]> {
  const dayStart = `${date}T00:00:00Z`;

  const { data } = await supabase
    .from('analytics_events')
    .select('event_name, properties, created_at')
    .eq('event_category', 'error')
    .gte('created_at', dayStart)
    .order('created_at', { ascending: false })
    .limit(50);

  return data || [];
}

// =============================================================================
// INSIGHT COMPUTATION — One function per domain
// =============================================================================

function computeEngagement(
  today: any | null,
  weekHistory: any[],
  todayEvents: any[],
): EngagementInsights {
  const dau = today?.dau || new Set(todayEvents.map(e => e.anon_id)).size;
  const wau = today?.wau || 0;
  const mau = today?.mau || 0;

  // DAU trend: compare to 7-day average
  const weekAvgDAU = weekHistory.length > 0
    ? weekHistory.reduce((sum, d) => sum + (d.dau || 0), 0) / weekHistory.length
    : 0;
  const dauTrend = weekAvgDAU > 0 ? ((dau - weekAvgDAU) / weekAvgDAU) * 100 : 0;

  const newSignups = today?.new_signups
    || todayEvents.filter(e => e.event_name === 'onboard_start').length;
  const onboardComplete = today?.onboarding_complete
    || todayEvents.filter(e => e.event_name === 'onboard_complete').length;
  const onboardingCompleteRate = newSignups > 0 ? onboardComplete / newSignups : 0;

  // Active in last 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const activeNow = new Set(
    todayEvents.filter(e => e.created_at >= fiveMinAgo).map(e => e.anon_id),
  ).size;

  return {
    dau,
    wau,
    mau,
    dauTrend: round(dauTrend),
    newSignups,
    onboardingCompleteRate: round(onboardingCompleteRate, 3),
    avgStreak: today?.avg_streak || 0,
    activeNow,
  };
}

function computeScanPatterns(
  today: any | null,
  weekHistory: any[],
  todayEvents: any[],
): ScanPatternInsights {
  const totalScans = today?.total_scans
    || todayEvents.filter(e => e.event_name === 'scan_complete').length;

  // Trend vs 7-day avg
  const weekAvgScans = weekHistory.length > 0
    ? weekHistory.reduce((sum, d) => sum + (d.total_scans || 0), 0) / weekHistory.length
    : 0;
  const scansTrend = weekAvgScans > 0 ? ((totalScans - weekAvgScans) / weekAvgScans) * 100 : 0;

  // Top categories from today's snapshot or compute from events
  let topCategories: Array<{ category: string; count: number; pctOfTotal: number }> = [];
  if (today?.top_scan_categories && Array.isArray(today.top_scan_categories)) {
    const total = today.top_scan_categories.reduce((s: number, c: any) => s + (c.count || 0), 0);
    topCategories = today.top_scan_categories.map((c: any) => ({
      category: c.category,
      count: c.count,
      pctOfTotal: total > 0 ? round((c.count / total) * 100) : 0,
    }));
  } else {
    // Compute from events
    const scanEvents = todayEvents.filter(e => e.event_name === 'scan_complete');
    const catCounts: Record<string, number> = {};
    for (const e of scanEvents) {
      const cat = e.properties?.category || 'general';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    const total = scanEvents.length;
    topCategories = Object.entries(catCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([category, count]) => ({
        category,
        count,
        pctOfTotal: total > 0 ? round((count / total) * 100) : 0,
      }));
  }

  // Category shift — compare this week vs last week's top categories
  let categoryShift: string | null = null;
  if (weekHistory.length >= 3) {
    const recentCats: Record<string, number> = {};
    const olderCats: Record<string, number> = {};
    const midpoint = Math.floor(weekHistory.length / 2);

    for (const d of weekHistory.slice(midpoint)) {
      for (const c of (d.top_scan_categories || [])) {
        recentCats[c.category] = (recentCats[c.category] || 0) + c.count;
      }
    }
    for (const d of weekHistory.slice(0, midpoint)) {
      for (const c of (d.top_scan_categories || [])) {
        olderCats[c.category] = (olderCats[c.category] || 0) + c.count;
      }
    }

    const shifts: string[] = [];
    for (const [cat, recentCount] of Object.entries(recentCats)) {
      const olderCount = olderCats[cat] || 0;
      if (olderCount > 0) {
        const change = ((recentCount - olderCount) / olderCount) * 100;
        if (Math.abs(change) >= 10) {
          shifts.push(`${cat} ${change > 0 ? '+' : ''}${round(change)}%`);
        }
      }
    }
    if (shifts.length > 0) {
      categoryShift = shifts.slice(0, 3).join(', ');
    }
  }

  // Provider usage from events
  const providersUsed: Record<string, number> = {};
  for (const e of todayEvents.filter(e => e.event_name === 'scan_complete')) {
    const providers = e.properties?.providersUsed;
    if (typeof providers === 'number') {
      const key = `${providers}_providers`;
      providersUsed[key] = (providersUsed[key] || 0) + 1;
    }
  }

  return {
    totalScans,
    scansTrend: round(scansTrend),
    avgScanTimeMs: today?.avg_scan_time_ms || null,
    successRate: today?.scan_success_rate || null,
    topCategories,
    categoryShift,
    providersUsed,
  };
}

function computeConversion(funnel: any | null): ConversionInsights {
  if (!funnel) {
    return {
      funnel: [],
      biggestDropOff: null,
      funnelTrend: null,
      signupToScanRate: null,
      scanToVaultRate: null,
      vaultToOracleRate: null,
    };
  }

  const stages = [
    { stage: 'Signup', users: funnel.stage_signup || 0 },
    { stage: 'Onboarding', users: funnel.stage_onboard || 0 },
    { stage: 'First Scan', users: funnel.stage_first_scan || 0 },
    { stage: 'Vault Item', users: funnel.stage_vault_item || 0 },
    { stage: 'Oracle Chat', users: funnel.stage_oracle_chat || 0 },
    { stage: 'Share', users: funnel.stage_share || 0 },
    { stage: 'Marketplace', users: funnel.stage_marketplace || 0 },
    { stage: 'Subscription', users: funnel.stage_subscription || 0 },
  ];

  // Compute rates between stages
  const funnelWithRates = stages.map((s, i) => ({
    ...s,
    rate: i === 0 ? 1 : (stages[i - 1].users > 0 ? s.users / stages[i - 1].users : null),
  }));

  // Find biggest drop-off
  let biggestDropOff: ConversionInsights['biggestDropOff'] = null;
  let worstRate = 1;

  for (let i = 1; i < funnelWithRates.length; i++) {
    const rate = funnelWithRates[i].rate;
    if (rate !== null && rate < worstRate && funnelWithRates[i - 1].users > 5) {
      worstRate = rate;
      biggestDropOff = {
        from: funnelWithRates[i - 1].stage,
        to: funnelWithRates[i].stage,
        dropRate: round(1 - rate, 3),
      };
    }
  }

  return {
    funnel: funnelWithRates,
    biggestDropOff,
    funnelTrend: null, // TODO: compare with previous week's funnel
    signupToScanRate: funnel.onboard_to_scan || null,
    scanToVaultRate: funnel.scan_to_vault || null,
    vaultToOracleRate: funnel.vault_to_oracle || null,
  };
}

function computeMarketplace(
  today: any | null,
  weekHistory: any[],
): MarketplaceInsights {
  const listingsCreated = today?.total_listings || 0;
  const sharesCompleted = today?.total_shares || 0;

  const weekAvgListings = weekHistory.length > 0
    ? weekHistory.reduce((sum, d) => sum + (d.total_listings || 0), 0) / weekHistory.length
    : 0;
  const weekAvgShares = weekHistory.length > 0
    ? weekHistory.reduce((sum, d) => sum + (d.total_shares || 0), 0) / weekHistory.length
    : 0;

  return {
    listingsCreated,
    listingsTrend: weekAvgListings > 0 ? round(((listingsCreated - weekAvgListings) / weekAvgListings) * 100) : 0,
    sharesCompleted,
    sharesTrend: weekAvgShares > 0 ? round(((sharesCompleted - weekAvgShares) / weekAvgShares) * 100) : 0,
  };
}

function computeAIPerformance(
  today: any | null,
  weekHistory: any[],
  todayEvents: any[],
  recentErrors: any[],
): AIPerformanceInsights {
  const avgResponseMs = today?.avg_api_response_ms || null;
  const p95ResponseMs = today?.p95_response_ms || null;
  const errorCount = today?.error_count || todayEvents.filter(e => e.event_category === 'error').length;
  const oracleChats = today?.total_oracle_chats
    || todayEvents.filter(e => e.event_name === 'oracle_chat').length;
  const uniqueOracleUsers = today?.unique_oracle_users
    || new Set(todayEvents.filter(e => e.event_category === 'oracle').map(e => e.anon_id)).size;

  // Trends
  const weekAvgResponse = weekHistory.length > 0
    ? weekHistory.reduce((sum, d) => sum + (d.avg_api_response_ms || 0), 0) / weekHistory.length
    : 0;
  const weekAvgErrors = weekHistory.length > 0
    ? weekHistory.reduce((sum, d) => sum + (d.error_count || 0), 0) / weekHistory.length
    : 0;
  const weekAvgOracle = weekHistory.length > 0
    ? weekHistory.reduce((sum, d) => sum + (d.total_oracle_chats || 0), 0) / weekHistory.length
    : 0;

  const totalEvents = todayEvents.length || 1;

  // Top error types
  const errorTypeCounts: Record<string, number> = {};
  for (const e of recentErrors) {
    const type = e.event_name || 'unknown_error';
    errorTypeCounts[type] = (errorTypeCounts[type] || 0) + 1;
  }
  const topErrorTypes = Object.entries(errorTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  return {
    avgResponseMs,
    p95ResponseMs,
    responseTrend: weekAvgResponse > 0 && avgResponseMs
      ? round(((avgResponseMs - weekAvgResponse) / weekAvgResponse) * 100)
      : 0,
    errorCount,
    errorRate: round(errorCount / totalEvents, 4),
    errorTrend: weekAvgErrors > 0 ? round(((errorCount - weekAvgErrors) / weekAvgErrors) * 100) : 0,
    oracleChats,
    oracleTrend: weekAvgOracle > 0 ? round(((oracleChats - weekAvgOracle) / weekAvgOracle) * 100) : 0,
    uniqueOracleUsers,
    topErrorTypes,
  };
}

// =============================================================================
// ANOMALY DETECTION
// =============================================================================

function detectAlerts(
  engagement: EngagementInsights,
  scans: ScanPatternInsights,
  ai: AIPerformanceInsights,
  conversion: ConversionInsights,
): InsightAlert[] {
  const alerts: InsightAlert[] = [];

  // DAU drop > 30%
  if (engagement.dauTrend < -30) {
    alerts.push({
      severity: 'critical',
      message: `DAU dropped ${Math.abs(round(engagement.dauTrend))}% vs 7-day average`,
      metric: 'dau',
      value: engagement.dau,
    });
  } else if (engagement.dauTrend < -15) {
    alerts.push({
      severity: 'warning',
      message: `DAU down ${Math.abs(round(engagement.dauTrend))}% vs 7-day average`,
      metric: 'dau',
      value: engagement.dau,
    });
  }

  // Scan volume drop > 25%
  if (scans.scansTrend < -25) {
    alerts.push({
      severity: 'warning',
      message: `Scan volume dropped ${Math.abs(round(scans.scansTrend))}%`,
      metric: 'scans',
      value: scans.totalScans,
    });
  }

  // Success rate below 85%
  if (scans.successRate !== null && scans.successRate < 0.85) {
    alerts.push({
      severity: 'warning',
      message: `Scan success rate at ${pctStr(scans.successRate)} (target: 85%+)`,
      metric: 'scan_success_rate',
      value: scans.successRate,
    });
  }

  // Error spike > 50%
  if (ai.errorTrend > 50) {
    alerts.push({
      severity: 'critical',
      message: `Error count spiked ${round(ai.errorTrend)}% vs average`,
      metric: 'errors',
      value: ai.errorCount,
    });
  }

  // Response time degradation > 30%
  if (ai.responseTrend > 30 && ai.avgResponseMs && ai.avgResponseMs > 2000) {
    alerts.push({
      severity: 'warning',
      message: `API response time degraded to ${ai.avgResponseMs}ms (${round(ai.responseTrend)}% slower)`,
      metric: 'response_time',
      value: ai.avgResponseMs,
    });
  }

  // Funnel drop-off > 80%
  if (conversion.biggestDropOff && conversion.biggestDropOff.dropRate > 0.8) {
    alerts.push({
      severity: 'warning',
      message: `${pctStr(conversion.biggestDropOff.dropRate)} of users drop off at ${conversion.biggestDropOff.from} → ${conversion.biggestDropOff.to}`,
      metric: 'funnel_drop',
      value: conversion.biggestDropOff.dropRate,
    });
  }

  // Positive signals
  if (engagement.dauTrend > 20) {
    alerts.push({
      severity: 'info',
      message: `DAU up ${round(engagement.dauTrend)}% — momentum building`,
      metric: 'dau_growth',
      value: engagement.dau,
    });
  }

  if (scans.scansTrend > 20) {
    alerts.push({
      severity: 'info',
      message: `Scan volume up ${round(scans.scansTrend)}% — users are engaging`,
      metric: 'scan_growth',
      value: scans.totalScans,
    });
  }

  return alerts;
}

// =============================================================================
// EXECUTIVE SUMMARY BUILDER
// =============================================================================

function buildExecutiveSummary(
  engagement: EngagementInsights,
  scans: ScanPatternInsights,
  conversion: ConversionInsights,
  marketplace: MarketplaceInsights,
  ai: AIPerformanceInsights,
  alerts: InsightAlert[],
): string {
  const lines: string[] = [];

  // Lead with the most important signal
  const criticals = alerts.filter(a => a.severity === 'critical');
  const warnings = alerts.filter(a => a.severity === 'warning');
  const positives = alerts.filter(a => a.severity === 'info');

  if (criticals.length > 0) {
    lines.push(`🚨 ${criticals.length} critical alert(s): ${criticals.map(a => a.message).join('. ')}`);
  }

  // User engagement headline
  const dauDir = engagement.dauTrend >= 0 ? 'up' : 'down';
  lines.push(
    `${engagement.dau} active users today (${dauDir} ${Math.abs(round(engagement.dauTrend))}% vs weekly avg). ` +
    `${engagement.newSignups} new signups, ${pctStr(engagement.onboardingCompleteRate)} completed onboarding.`
  );

  // Scan activity
  if (scans.totalScans > 0) {
    lines.push(
      `${scans.totalScans} scans (${trendStr(scans.scansTrend)})` +
      (scans.topCategories[0] ? `, led by ${scans.topCategories[0].category}` : '') +
      (scans.categoryShift ? `. Category shifts: ${scans.categoryShift}` : '') +
      '.'
    );
  }

  // Conversion
  if (conversion.biggestDropOff) {
    lines.push(
      `Biggest funnel gap: ${conversion.biggestDropOff.from} → ${conversion.biggestDropOff.to} ` +
      `(${pctStr(conversion.biggestDropOff.dropRate)} drop-off).`
    );
  }

  // AI health
  if (ai.avgResponseMs) {
    lines.push(
      `AI responding in ${ai.avgResponseMs}ms avg (${trendStr(ai.responseTrend)}). ` +
      `${ai.errorCount} errors today.`
    );
  }

  // Positive momentum
  if (positives.length > 0) {
    lines.push(`📈 ${positives.map(a => a.message).join('. ')}`);
  }

  if (warnings.length > 0 && criticals.length === 0) {
    lines.push(`⚠️ ${warnings.length} warning(s) to monitor: ${warnings.map(a => a.message).join('. ')}`);
  }

  return lines.join('\n\n');
}

// =============================================================================
// HELPERS
// =============================================================================

function round(n: number, decimals: number = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function trendStr(pct: number): string {
  if (pct > 0) return `+${round(pct)}%`;
  if (pct < 0) return `${round(pct)}%`;
  return 'flat';
}

function pctStr(rate: number | null): string {
  if (rate === null) return 'N/A';
  return `${round(rate * 100)}%`;
}