// FILE: api/investor/metrics.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    // --- Batch all Supabase queries to run in parallel ---
    const [
      totalUsersResult,
      dauResult,
      totalScansResult,
      feedbackVolumeResult,
      growthDataResult,
      betaInvitesResult, // <-- NEW
      betaTestersResult  // <-- NEW
    ] = await Promise.all([
      supaAdmin.from('users').select('*', { count: 'exact', head: true }),
      supaAdmin.from('users').select('*', { count: 'exact', head: true }).gte('last_sign_in_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supaAdmin.from('scan_history').select('*', { count: 'exact', head: true }),
      supaAdmin.from('feedback').select('*', { count: 'exact', head: true }),
      supaAdmin.rpc('get_daily_growth_metrics', { days_range: days }),
      supaAdmin.from('beta_invites').select('*', { count: 'exact', head: true }),
      supaAdmin.from('beta_testers').select('*', { count: 'exact', head: true })
    ]);

    // --- Process results and handle errors ---
    if (totalUsersResult.error) throw totalUsersResult.error;
    const totalUsers = totalUsersResult.count;

    if (dauResult.error) throw dauResult.error;
    const dau = dauResult.count;

    if (totalScansResult.error) throw totalScansResult.error;
    const totalScans = totalScansResult.count;

    if (feedbackVolumeResult.error) throw feedbackVolumeResult.error;
    const feedbackVolume = feedbackVolumeResult.count;

    if (growthDataResult.error) throw growthDataResult.error;
    const growthData = growthDataResult.data;
    
    // --- MODIFICATION START: Calculate Beta Conversion Rate ---
    if (betaInvitesResult.error) throw betaInvitesResult.error;
    const totalBetaInvites = betaInvitesResult.count || 0;

    if (betaTestersResult.error) throw betaTestersResult.error;
    const totalBetaTesters = betaTestersResult.count || 0;

    const betaConversionRate = totalBetaInvites > 0 ? (totalBetaTesters / totalBetaInvites) * 100 : 0;
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
      growthData: growthData || [],
      totalBetaInvites,      // <-- Add to response
      totalBetaTesters,      // <-- Add to response
      betaConversionRate,    // <-- Add to response
      ...staticMetrics
    };

    return res.status(200).json(metrics);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error fetching investor metrics:', message);
    return res.status(500).json({ error: message });
  }
}