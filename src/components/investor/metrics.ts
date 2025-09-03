// FILE: api/investor/metrics.ts
// Investor metrics endpoint

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_SECRET!
);

// Verify auth token
async function verifyAuth(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  
  // Check if user is investor or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (!profile || !['investor', 'admin'].includes(profile.role)) {
    return null;
  }
  
  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch metrics in parallel
    const [
      userStats,
      scanStats,
      betaStats,
      growthData
    ] = await Promise.all([
      // Total users and DAU
      supabase
        .from('profiles')
        .select('id, last_sign_in_at', { count: 'exact' }),
      
      // Scan metrics
      supabase
        .from('scans')
        .select('id', { count: 'exact' })
        .gte('created_at', startDate.toISOString()),
      
      // Beta metrics
      supabase
        .from('beta_testers')
        .select('id', { count: 'exact' }),
      
      // Growth data
      supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })
    ]);

    // Calculate DAU (users active in last 24h)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const dau = userStats.data?.filter(u => 
      u.last_sign_in_at && new Date(u.last_sign_in_at) > oneDayAgo
    ).length || 0;

    // Process growth data by day
    const growthByDay = growthData.data?.reduce((acc, user) => {
      const date = new Date(user.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, users: 0, scans: 0 };
      }
      acc[date].users++;
      return acc;
    }, {} as Record<string, any>) || {};

    // Get beta invites count
    const { count: betaInvites } = await supabase
      .from('beta_invites')
      .select('*', { count: 'exact', head: true });

    const metrics = {
      totalUsers: userStats.count || 0,
      dau,
      totalScans: scanStats.count || 0,
      feedbackVolume: 0, // TODO: implement feedback counting
      totalBetaInvites: betaInvites || 0,
      totalBetaTesters: betaStats.count || 0,
      betaConversionRate: betaInvites ? ((betaStats.count || 0) / betaInvites * 100) : 0,
      growthData: Object.values(growthByDay),
      tam: { total: '$1.3T', serviceable: '$125B', obtainable: '$1B' },
      projections: { q4_2025: '$5M ARR', q1_2026: '$12M ARR' }
    };

    res.status(200).json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
}