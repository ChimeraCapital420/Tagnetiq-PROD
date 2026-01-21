// FILE: api/investor/metrics.ts
// Investor metrics endpoint - Vercel Serverless Function
// 
// NOTE: This file belongs in api/investor/metrics.ts (NOT src/components/)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with service role for elevated permissions
// Uses standard Vercel environment variables (no VITE_ prefix needed server-side)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_SECRET || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables for investor metrics API');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Verify auth token and check investor/admin role
async function verifyAuth(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  
  try {
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
  } catch (err) {
    console.error('Auth verification error:', err);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) {
    return res.status(403).json({ error: 'Unauthorized - Investor or Admin role required' });
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
      
      // Scan metrics - try multiple table names for compatibility
      supabase
        .from('scan_history')
        .select('id', { count: 'exact' })
        .gte('created_at', startDate.toISOString())
        .then(result => {
          // Fallback to 'scans' table if scan_history doesn't exist
          if (result.error?.code === '42P01') {
            return supabase
              .from('scans')
              .select('id', { count: 'exact' })
              .gte('created_at', startDate.toISOString());
          }
          return result;
        }),
      
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

    // Get beta invites count (handle missing table gracefully)
    let betaInvites = 0;
    try {
      const { count } = await supabase
        .from('beta_invites')
        .select('*', { count: 'exact', head: true });
      betaInvites = count || 0;
    } catch (err) {
      console.warn('beta_invites table not found, using 0');
    }

    const metrics = {
      totalUsers: userStats.count || 0,
      dau,
      totalScans: scanStats.count || 0,
      feedbackVolume: 0, // TODO: implement feedback counting
      totalBetaInvites: betaInvites,
      totalBetaTesters: betaStats.count || 0,
      betaConversionRate: betaInvites ? ((betaStats.count || 0) / betaInvites * 100) : 0,
      growthData: Object.values(growthByDay),
      tam: { total: '$1.3T', serviceable: '$125B', obtainable: '$1B' },
      projections: { q4_2025: '$5M ARR', q1_2026: '$12M ARR' },
      generatedAt: new Date().toISOString()
    };

    res.status(200).json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
}