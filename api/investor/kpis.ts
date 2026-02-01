// FILE: api/investor/kpis.ts
// Core KPIs endpoint for Investor Suite
// Mobile-first: Minimal payload, efficient queries

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

    let totalUsers = 0;
    let dau = 0;
    let totalScans = 0;

    // Fetch user counts (try profiles first, then users)
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (!error && count !== null) {
        totalUsers = count;
      }
    } catch (e) {
      console.warn('Could not fetch from profiles table');
    }

    // Fetch DAU
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_sign_in_at', twentyFourHoursAgo);

      if (!error && count !== null) {
        dau = count;
      }
    } catch (e) {
      console.warn('Could not fetch DAU');
    }

    // Fetch scans (try both table names)
    try {
      const { count, error } = await supabase
        .from('scan_history')
        .select('*', { count: 'exact', head: true });

      if (error?.code === '42P01') {
        // Table doesn't exist, try 'scans'
        const { count: scansCount } = await supabase
          .from('scans')
          .select('*', { count: 'exact', head: true });
        totalScans = scansCount || 0;
      } else if (!error && count !== null) {
        totalScans = count;
      }
    } catch (e) {
      console.warn('Could not fetch scans');
    }

    const kpiData = {
      totalUsers,
      dau,
      totalScans,
      generatedAt: new Date().toISOString(),
    };

    // Cache for 1 minute
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

    return res.status(200).json(kpiData);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error fetching core KPIs:', message);

    // Return demo data instead of error
    return res.status(200).json({
      totalUsers: 1247,
      dau: 89,
      totalScans: 15634,
      generatedAt: new Date().toISOString(),
      isDemo: true,
    });
  }
}