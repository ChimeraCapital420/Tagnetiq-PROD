// FILE: api/investor/metrics.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Existing queries for KPIs - these remain unchanged
    const { count: totalUsers, error: usersError } = await supaAdmin.from('users').select('*', { count: 'exact', head: true });
    if (usersError) throw usersError;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dau, error: dauError } = await supaAdmin.from('users').select('*', { count: 'exact', head: true }).gte('last_sign_in_at', twentyFourHoursAgo);
    if (dauError) throw dauError;

    const { count: totalScans, error: scansError } = await supaAdmin.from('scan_history').select('*', { count: 'exact', head: true });
    if (scansError) throw scansError;
    
    const { count: feedbackVolume, error: feedbackError } = await supaAdmin.from('feedback').select('*', { count: 'exact', head: true });
    if (feedbackError) throw feedbackError;

    // --- MODIFICATION START ---
    // Replace the mock data generation with a call to the new Supabase RPC
    const { data: growthData, error: growthError } = await supaAdmin.rpc('get_daily_growth_metrics');
    if (growthError) throw growthError;
    // --- MODIFICATION END ---

    const staticMetrics = {
        tam: { collectibles: '25B', real_estate_flipping: '100B', used_vehicles: '1.2T' },
        projections: { q4_2025: '10,000 MAU', q1_2026: '25,000 MAU' },
        positiveAiEvaluations: Math.floor((totalScans || 0) * 0.67),
    };
    
    const metrics = {
      totalUsers: totalUsers || 0,
      dau: dau || 0,
      totalScans: totalScans || 0,
      feedbackVolume: feedbackVolume || 0,
      growthData: growthData || [], // Use the data from the RPC, fallback to empty array
      ...staticMetrics
    };

    return res.status(200).json(metrics);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error fetching investor metrics:', message);
    return res.status(500).json({ error: message });
  }
}