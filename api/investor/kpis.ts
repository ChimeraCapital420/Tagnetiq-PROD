// FILE: api/investor/kpis.ts
// Core KPIs endpoint - REAL DATA ONLY
// Queries: profiles (20), vault_items (17), consensus_results (77)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch REAL data from actual tables
    const [
      profilesResult,
      dauResult,
      vaultItemsResult,
      consensusResult,
    ] = await Promise.all([
      // Total users from profiles
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      
      // DAU - users active in last 24h (use last_login column)
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .gte('last_login', twentyFourHoursAgo),
      
      // Total scans = vault_items (this is where scanned items are stored)
      supabase.from('vault_items').select('*', { count: 'exact', head: true }),
      
      // AI analyses completed (consensus_results)
      supabase.from('consensus_results').select('*', { count: 'exact', head: true }),
    ]);

    const kpiData = {
      totalUsers: profilesResult.count || 0,
      dau: dauResult.count || 0,
      totalScans: vaultItemsResult.count || 0,
      totalAnalyses: consensusResult.count || 0,
      generatedAt: new Date().toISOString(),
    };

    // Cache for 1 minute
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

    return res.status(200).json(kpiData);

  } catch (error) {
    console.error('Error fetching core KPIs:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch KPIs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}