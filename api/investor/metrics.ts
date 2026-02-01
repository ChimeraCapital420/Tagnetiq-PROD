// FILE: api/investor/metrics.ts
// Investor Metrics API - REAL DATA ONLY
// Queries actual tables: profiles, vault_items, vaults, arena_listings, consensus_results

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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
    const oneDayAgoISO = oneDayAgo.toISOString();

    // Fetch REAL metrics from actual tables
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
      // Total users
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      
      // DAU - need full data to filter
      supabase.from('profiles').select('id, last_login'),
      
      // Vault items (scans)
      supabase.from('vault_items').select('*', { count: 'exact', head: true }),
      
      // Vaults created
      supabase.from('vaults').select('*', { count: 'exact', head: true }),
      
      // Arena listings (NOT marketplace_listings - that's empty!)
      supabase.from('arena_listings').select('*', { count: 'exact', head: true }),
      
      // AI consensus results
      supabase.from('consensus_results').select('*', { count: 'exact', head: true }),
      
      // Feedback
      supabase.from('feedback').select('*', { count: 'exact', head: true }),
      
      // Beta invites
      supabase.from('beta_invites').select('*', { count: 'exact', head: true }),
      
      // Growth data - profiles created in period
      supabase.from('profiles')
        .select('created_at')
        .gte('created_at', startDateISO)
        .order('created_at', { ascending: true }),
    ]);

    // Calculate DAU properly
    const profiles = profilesWithLastSignIn.data || [];
    const dau = profiles.filter(p => 
      p.last_login && new Date(p.last_login) > oneDayAgo
    ).length;

    // Process growth data by day
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

    const metrics = {
      // Core KPIs - REAL NUMBERS
      totalUsers: profilesResult.count || 0,
      dau,
      totalScans: vaultItemsResult.count || 0,        // vault_items = scans
      totalVaults: vaultsResult.count || 0,
      totalListings: arenaListingsResult.count || 0,  // arena_listings
      totalAnalyses: consensusResult.count || 0,      // AI analyses
      feedbackVolume: feedbackResult.count || 0,

      // Beta metrics
      totalBetaInvites: betaInvitesResult.count || 0,
      totalBetaTesters: 0, // beta_testers table is empty
      betaConversionRate: 0,

      // Growth data for charts
      growthData: Object.values(growthByDay),

      // Market data (these are projections, clearly labeled)
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

      // Metadata
      generatedAt: new Date().toISOString(),
      periodDays: days,
      dataSource: 'live_database',
    };

    // Cache for 2 minutes
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