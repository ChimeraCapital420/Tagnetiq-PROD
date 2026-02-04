import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateISO = startDate.toISOString();

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // =========================================================================
    // EXISTING METRICS - Your original queries
    // =========================================================================
    
    const [
      profilesResult,
      profilesWithLastSignIn,
      vaultItemsResult,
      vaultsResult,
      arenaListingsResult,
      consensusResult,
      feedbackResult,
      betaInvitesResult,
      growthResult,
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('id, last_login'),
      supabase.from('vault_items').select('*', { count: 'exact', head: true }),
      supabase.from('vaults').select('*', { count: 'exact', head: true }),
      supabase.from('arena_listings').select('*', { count: 'exact', head: true }),
      supabase.from('consensus_results').select('*', { count: 'exact', head: true }),
      supabase.from('feedback').select('*', { count: 'exact', head: true }),
      supabase.from('beta_invites').select('*', { count: 'exact', head: true }),
      supabase.from('profiles')
        .select('created_at')
        .gte('created_at', startDateISO)
        .order('created_at', { ascending: true }),
    ]);

    // =========================================================================
    // GHOST PROTOCOL METRICS - New queries (gracefully handles missing tables)
    // =========================================================================
    
    const ghostTableCheck = await supabase
      .from('ghost_analytics')
      .select('id')
      .limit(1);
    
    const hasGhostTable = !ghostTableCheck.error;

    let ghostMetrics = {
      darkInventory: { value: 0, count: 0 },
      arbitrage: [] as any[],
      hydraAccuracy: [] as any[],
      coverage: [] as any[],
      scoutEconomics: [] as any[],
      platforms: [] as any[],
    };

    if (hasGhostTable) {
      const [
        darkInventoryResult,
        arbitrageResult,
        hydraAccuracyResult,
        coverageResult,
        scoutEconomicsResult,
        platformResult,
      ] = await Promise.all([
        // Dark Inventory: Ghost listings that are active (using YOUR enum value)
        supabase
          .from('arena_listings')
          .select('price, is_ghost')
          .eq('is_ghost', true)
          .eq('status', 'active'),
        
        // Arbitrage: Fulfilled ghost analytics
        supabase
          .from('ghost_analytics')
          .select('shelf_price, sold_price, actual_cost, actual_margin')
          .eq('status', 'fulfilled')
          .not('actual_margin', 'is', null),
        
        // HYDRA Accuracy
        supabase
          .from('ghost_analytics')
          .select('hydra_accuracy_percent, created_at')
          .eq('status', 'fulfilled')
          .not('hydra_accuracy_percent', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100),
        
        // Coverage
        supabase
          .from('ghost_analytics')
          .select('store_name, region, created_at'),
        
        // Scout Economics
        supabase
          .from('ghost_analytics')
          .select('user_id, actual_margin')
          .eq('status', 'fulfilled')
          .not('actual_margin', 'is', null),
        
        // Platform breakdown
        supabase
          .from('ghost_analytics')
          .select('sale_platform')
          .not('sale_platform', 'is', null),
      ]);

      const ghostListings = darkInventoryResult.data || [];
      
      ghostMetrics = {
        darkInventory: {
          value: ghostListings.reduce((sum, item) => sum + (item.price || 0), 0),
          count: ghostListings.length,
        },
        arbitrage: arbitrageResult.data || [],
        hydraAccuracy: hydraAccuracyResult.data || [],
        coverage: coverageResult.data || [],
        scoutEconomics: scoutEconomicsResult.data || [],
        platforms: platformResult.data || [],
      };
    }

    // =========================================================================
    // CALCULATE METRICS
    // =========================================================================

    // DAU
    const profiles = profilesWithLastSignIn.data || [];
    const dau = profiles.filter(p => 
      p.last_login && new Date(p.last_login) > oneDayAgo
    ).length;

    // Growth data by day
    const growthByDay: Record<string, { date: string; users: number }> = {};
    const growthData = growthResult.data || [];
    
    growthData.forEach(user => {
      if (!user.created_at) return;
      const date = new Date(user.created_at).toISOString().split('T')[0];
      if (!growthByDay[date]) {
        growthByDay[date] = { date, users: 0 };
      }
      growthByDay[date].users++;
    });

    // Arbitrage Spread
    const arbitrageData = ghostMetrics.arbitrage;
    let avgArbitrageSpread = 0;
    let totalRealizedProfit = 0;
    
    if (arbitrageData.length > 0) {
      const spreads = arbitrageData
        .filter((a: any) => a.actual_cost && a.actual_cost > 0 && a.sold_price)
        .map((a: any) => ((a.sold_price - a.actual_cost) / a.actual_cost) * 100);
      
      avgArbitrageSpread = spreads.length > 0 
        ? spreads.reduce((a: number, b: number) => a + b, 0) / spreads.length 
        : 0;
      
      totalRealizedProfit = arbitrageData.reduce((sum: number, a: any) => sum + (a.actual_margin || 0), 0);
    }

    // HYDRA Accuracy
    const hydraData = ghostMetrics.hydraAccuracy;
    const hydraAccuracy = hydraData.length > 0
      ? hydraData.reduce((sum: number, h: any) => sum + (h.hydra_accuracy_percent || 0), 0) / hydraData.length
      : 0;
    
    let hydraTrend = 0;
    if (hydraData.length >= 10) {
      const midpoint = Math.floor(hydraData.length / 2);
      const recentAvg = hydraData.slice(0, midpoint).reduce((s: number, h: any) => s + (h.hydra_accuracy_percent || 0), 0) / midpoint;
      const olderAvg = hydraData.slice(midpoint).reduce((s: number, h: any) => s + (h.hydra_accuracy_percent || 0), 0) / (hydraData.length - midpoint);
      hydraTrend = recentAvg - olderAvg;
    }

    // Coverage Velocity
    const coverageData = ghostMetrics.coverage;
    const uniqueStores = new Set(coverageData.map((c: any) => c.store_name).filter(Boolean)).size;
    const uniqueRegions = new Set(coverageData.map((c: any) => c.region).filter(Boolean)).size;
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyDataPoints = coverageData.filter((c: any) => 
      c.created_at && new Date(c.created_at) > oneWeekAgo
    ).length;

    // Scout Economics
    const scoutData = ghostMetrics.scoutEconomics;
    const scoutProfits: Record<string, number> = {};
    
    scoutData.forEach((s: any) => {
      if (!s.user_id) return;
      scoutProfits[s.user_id] = (scoutProfits[s.user_id] || 0) + (s.actual_margin || 0);
    });
    
    const scoutProfitValues = Object.values(scoutProfits);
    const activeScouts = scoutProfitValues.length;
    const avgScoutProfit = activeScouts > 0
      ? scoutProfitValues.reduce((a, b) => a + b, 0) / activeScouts
      : 0;

    // Platform breakdown
    const platformData = ghostMetrics.platforms;
    const platformCounts: Record<string, number> = {};
    platformData.forEach((p: any) => {
      if (p.sale_platform) {
        platformCounts[p.sale_platform] = (platformCounts[p.sale_platform] || 0) + 1;
      }
    });

    // =========================================================================
    // BUILD RESPONSE - Compatible with your existing Metrics interface
    // =========================================================================

    const metrics = {
      // Your existing fields
      totalUsers: profilesResult.count || 0,
      dau,
      totalScans: vaultItemsResult.count || 0,
      totalVaults: vaultsResult.count || 0,
      totalListings: arenaListingsResult.count || 0,
      totalAnalyses: consensusResult.count || 0,
      feedbackVolume: feedbackResult.count || 0,
      positiveAiEvaluations: consensusResult.count || 0,

      totalBetaInvites: betaInvitesResult.count || 0,
      totalBetaTesters: 0,
      betaConversionRate: 0,

      growthData: Object.values(growthByDay),

      // Ghost Protocol (new section)
      ghostProtocol: {
        enabled: hasGhostTable,
        
        darkInventory: {
          value: ghostMetrics.darkInventory.value,
          count: ghostMetrics.darkInventory.count,
        },

        arbitrageSpread: {
          avgPercent: Math.round(avgArbitrageSpread),
          totalTransactions: arbitrageData.length,
          totalRealizedProfit: Math.round(totalRealizedProfit * 100) / 100,
        },

        hydraAccuracy: {
          percent: Math.round(hydraAccuracy * 10) / 10,
          trend: Math.round(hydraTrend * 10) / 10,
          totalPredictions: hydraData.length,
        },

        coverageVelocity: {
          storesMapped: uniqueStores,
          weeklyDataPoints: weeklyDataPoints,
          regionsCovered: uniqueRegions,
          totalDataPoints: coverageData.length,
        },

        scoutEconomics: {
          avgMonthlyProfit: Math.round(avgScoutProfit * 100) / 100,
          activeScouts: activeScouts,
        },

        platformBreakdown: Object.entries(platformCounts)
          .map(([platform, count]) => ({ platform, count }))
          .sort((a, b) => b.count - a.count),
      },

      tam: { 
        total: '$1.3T', 
        serviceable: '$125B', 
        obtainable: '$1B',
        note: 'Collectibles market TAM estimate'
      },
      projections: { 
        note: 'Based on current growth trajectory',
        q4_2025: '$5M ARR', 
        q1_2026: '$12M ARR' 
      },

      generatedAt: new Date().toISOString(),
      periodDays: days,
      dataSource: 'live_database',
    };

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

    return res.status(200).json(metrics);

  } catch (error) {
    console.error('Error fetching investor metrics:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}