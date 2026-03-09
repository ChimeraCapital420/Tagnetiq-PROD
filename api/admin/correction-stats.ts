// FILE: api/admin/correction-stats.ts
// ═══════════════════════════════════════════════════════════════════════
// LIBERATION 11 LOGGING DASHBOARD — Admin Endpoint
// Hardening Sprint #10
// ═══════════════════════════════════════════════════════════════════════
//
// Admin-only endpoint that returns live CI Engine flywheel stats.
// When Scot Talcott or an investor asks "is the flywheel actually working?"
// — pull this up and show them live numbers.
//
// AUTH: Same pattern as api/admin/provider-benchmarks.ts
//   Bearer token → supabase.auth.getUser() → profiles.role === 'admin'
//
// TABLE NAMES:
//   hydra_corrections          — all correction + confirmation rows
//   hydra_correction_patterns  — aggregated patterns (candidate/confirmed/retired)
//   provider_benchmarks        — provider performance data
//
// Corrections:    correction_type != 'confirmed_accurate'
// Confirmations:  correction_type  = 'confirmed_accurate'
//
// GET /api/admin/correction-stats
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// =============================================================================
// SUPABASE + AUTH (identical pattern to provider-benchmarks.ts)
// =============================================================================

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function isAdmin(req: VercelRequest): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;

  const token = authHeader.replace('Bearer ', '');
  const supabase = getSupabase();

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin';
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // Admin gate
  const admin = await isAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const supabase = getSupabase();
    const now = new Date();

    // Date boundaries
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    // ── Run all queries in parallel for speed ─────────────────────────────
    const [
      correctionsToday,
      correctionsWeek,
      confirmationsToday,
      confirmationsWeek,
      topCategories,
      confirmedPatterns,
      candidatePatterns,
      providerErrors,
    ] = await Promise.allSettled([

      // corrections_today (everything that is NOT a confirmation)
      supabase
        .from('hydra_corrections')
        .select('id', { count: 'exact', head: true })
        .neq('correction_type', 'confirmed_accurate')
        .gte('created_at', todayStart.toISOString()),

      // corrections_this_week
      supabase
        .from('hydra_corrections')
        .select('id', { count: 'exact', head: true })
        .neq('correction_type', 'confirmed_accurate')
        .gte('created_at', weekStart.toISOString()),

      // confirmations_today (only confirmed_accurate rows)
      supabase
        .from('hydra_corrections')
        .select('id', { count: 'exact', head: true })
        .eq('correction_type', 'confirmed_accurate')
        .gte('created_at', todayStart.toISOString()),

      // confirmations_this_week
      supabase
        .from('hydra_corrections')
        .select('id', { count: 'exact', head: true })
        .eq('correction_type', 'confirmed_accurate')
        .gte('created_at', weekStart.toISOString()),

      // top_categories — from hydra_correction_patterns aggregated table
      supabase
        .from('hydra_correction_patterns')
        .select('category, occurrence_count')
        .order('occurrence_count', { ascending: false })
        .limit(10),

      // confirmed_patterns (status = 'confirmed')
      supabase
        .from('hydra_correction_patterns')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed'),

      // candidate_patterns (status = 'candidate')
      supabase
        .from('hydra_correction_patterns')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'candidate'),

      // provider_error_leaders — providers with highest error rates from benchmarks
      supabase
        .from('provider_benchmarks')
        .select('provider_id, error_rate')
        .order('error_rate', { ascending: false })
        .limit(5),

    ]);

    // ── Extract results safely ────────────────────────────────────────────
    const safeCount = (result: PromiseSettledResult<any>): number => {
      if (result.status === 'rejected') return 0;
      return result.value?.count ?? result.value?.data?.length ?? 0;
    };

    const safeData = (result: PromiseSettledResult<any>): any[] => {
      if (result.status === 'rejected') return [];
      return result.value?.data ?? [];
    };

    // Deduplicate provider_error_leaders (multiple benchmark rows per provider)
    const errorLeaderRaw = safeData(providerErrors);
    const providerErrorMap = new Map<string, number>();
    for (const row of errorLeaderRaw) {
      const existing = providerErrorMap.get(row.provider_id) ?? 0;
      providerErrorMap.set(row.provider_id, Math.max(existing, row.error_rate ?? 0));
    }
    const providerErrorLeaders = Array.from(providerErrorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([provider, error_rate]) => ({ provider, error_rate }));

    // Top categories — deduplicated + summed
    const categoryMap = new Map<string, number>();
    for (const row of safeData(topCategories)) {
      const current = categoryMap.get(row.category) ?? 0;
      categoryMap.set(row.category, current + (row.occurrence_count ?? 1));
    }
    const topCategoryList = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, count]) => ({ category, count }));

    return res.status(200).json({
      corrections_today:       safeCount(correctionsToday),
      corrections_this_week:   safeCount(correctionsWeek),
      confirmations_today:     safeCount(confirmationsToday),
      confirmations_this_week: safeCount(confirmationsWeek),
      top_categories:          topCategoryList,
      confirmed_patterns:      safeCount(confirmedPatterns),
      candidate_patterns:      safeCount(candidatePatterns),
      provider_error_leaders:  providerErrorLeaders,
      as_of:                   now.toISOString(),
    });

  } catch (error: any) {
    console.error('❌ correction-stats error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
}