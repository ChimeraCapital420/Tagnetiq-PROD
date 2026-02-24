// FILE: api/investor/kpis.ts
// Core KPIs endpoint - REAL DATA from original tables + analytics engine
// Sprint E+: Now includes engagement, retention, and funnel metrics
//
// SECURITY: Dual-path auth (admin JWT or invite token)
// All data is ANONYMOUS. No PII exposed. Investors see aggregates only.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin.js';
import { verifyInvestorAccess, setInvestorCORS } from '../_lib/investorAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setInvestorCORS(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyInvestorAccess(req);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // =========================================================================
    // CORE METRICS — original tables (always available)
    // =========================================================================

    const [
      profilesResult,
      dauResult,
      vaultItemsResult,
      consensusResult,
    ] = await Promise.all([
      supaAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supaAdmin.from('profiles').select('*', { count: 'exact', head: true })
        .gte('last_login', twentyFourHoursAgo),
      supaAdmin.from('vault_items').select('*', { count: 'exact', head: true }),
      supaAdmin.from('consensus_results').select('*', { count: 'exact', head: true }),
    ]);

    // =========================================================================
    // ENGAGEMENT METRICS — analytics engine (graceful if tables don't exist yet)
    // =========================================================================

    let engagement = {
      available: false,
      wau: 0,
      mau: 0,
      totalOracleChats: 0,
      totalShares: 0,
      avgStreak: 0,
      scanSuccessRate: null as number | null,
      avgScanTimeMs: null as number | null,
      p95ResponseMs: null as number | null,
      errorCount: 0,
    };

    let funnel = {
      available: false,
      signupToOnboard: null as number | null,
      onboardToScan: null as number | null,
      scanToVault: null as number | null,
      vaultToOracle: null as number | null,
      oracleToShare: null as number | null,
    };

    // Try to fetch from analytics_daily (Sprint E+)
    const analyticsCheck = await supaAdmin
      .from('analytics_daily')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1);

    if (!analyticsCheck.error && analyticsCheck.data && analyticsCheck.data.length > 0) {
      const { data: latestSnapshot } = await supaAdmin
        .from('analytics_daily')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();

      if (latestSnapshot) {
        engagement = {
          available: true,
          wau: latestSnapshot.wau || 0,
          mau: latestSnapshot.mau || 0,
          totalOracleChats: latestSnapshot.oracle_messages_count || 0,
          totalShares: latestSnapshot.total_shares || 0,
          avgStreak: latestSnapshot.avg_streak || 0,
          scanSuccessRate: latestSnapshot.scan_success_rate,
          avgScanTimeMs: latestSnapshot.avg_scan_time_ms,
          p95ResponseMs: latestSnapshot.p95_response_ms,
          errorCount: latestSnapshot.error_count || 0,
        };
      }

      // Try funnel data
      const { data: latestFunnel } = await supaAdmin
        .from('analytics_funnel')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();

      if (latestFunnel) {
        funnel = {
          available: true,
          signupToOnboard: latestFunnel.signup_to_onboard,
          onboardToScan: latestFunnel.onboard_to_scan,
          scanToVault: latestFunnel.scan_to_vault,
          vaultToOracle: latestFunnel.vault_to_oracle,
          oracleToShare: latestFunnel.oracle_to_share,
        };
      }
    }

    // =========================================================================
    // ONBOARDING METRICS — tour completion (Sprint E)
    // =========================================================================

    let onboarding = {
      available: false,
      tourCompleted: 0,
      tourDismissed: 0,
      tourInProgress: 0,
    };

    const onboardingCheck = await supaAdmin
      .from('onboarding_progress')
      .select('tour_completed, tour_dismissed', { count: 'exact' });

    if (!onboardingCheck.error && onboardingCheck.data) {
      const rows = onboardingCheck.data;
      onboarding = {
        available: true,
        tourCompleted: rows.filter(r => r.tour_completed).length,
        tourDismissed: rows.filter(r => r.tour_dismissed && !r.tour_completed).length,
        tourInProgress: rows.filter(r => !r.tour_completed && !r.tour_dismissed).length,
      };
    }

    // =========================================================================
    // SHARING METRICS — conversation sharing (Sprint N)
    // =========================================================================

    let sharing = {
      available: false,
      totalSharedConversations: 0,
      totalShareViews: 0,
      publicProfiles: 0,
    };

    const sharingCheck = await supaAdmin
      .from('oracle_conversations')
      .select('share_views', { count: 'exact' })
      .not('share_token', 'is', null);

    if (!sharingCheck.error) {
      const sharedConvos = sharingCheck.data || [];
      sharing = {
        available: true,
        totalSharedConversations: sharingCheck.count || 0,
        totalShareViews: sharedConvos.reduce((sum, c) => sum + (c.share_views || 0), 0),
        publicProfiles: 0,
      };

      const { count: profileCount } = await supaAdmin
        .from('public_profiles')
        .select('*', { count: 'exact', head: true });

      sharing.publicProfiles = profileCount || 0;
    }

    // =========================================================================
    // BUILD RESPONSE
    // =========================================================================

    const kpiData = {
      totalUsers: profilesResult.count || 0,
      dau: dauResult.count || 0,
      totalScans: vaultItemsResult.count || 0,
      totalAnalyses: consensusResult.count || 0,
      engagement,
      funnel,
      onboarding,
      sharing,
      generatedAt: new Date().toISOString(),
      dataSource: 'live_database',
      analyticsEngineActive: engagement.available,
    };

    // Cache for 1 minute
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

    return res.status(200).json(kpiData);

  } catch (error: any) {
    const msg = error.message || 'An unexpected error occurred.';
    if (msg.includes('Authentication') || msg.includes('Authorization')) {
      return res.status(401).json({ error: msg });
    }
    console.error('Error fetching core KPIs:', msg);
    return res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
}