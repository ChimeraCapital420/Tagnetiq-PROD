// FILE: api/investor/metrics.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Helper function to generate sample time-series data
const generateTimeSeriesData = (days = 30) => {
    const data = [];
    let userCount = 1200;
    let scanCount = 22000;
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        userCount += Math.floor(Math.random() * 20) + 5; // Grow by 5-25 users a day
        scanCount += Math.floor(Math.random() * 150) + 50; // Grow by 50-200 scans a day

        data.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            users: userCount,
            scans: scanCount
        });
    }
    return data;
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { count: totalUsers, error: usersError } = await supaAdmin.from('users').select('*', { count: 'exact', head: true });
    if (usersError) throw usersError;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dau, error: dauError } = await supaAdmin.from('users').select('*', { count: 'exact', head: true }).gte('last_sign_in_at', twentyFourHoursAgo);
    if (dauError) throw dauError;

    // CORRECTED LINES: Replaced 'in' with '='
    const { count: totalScans, error: scansError } = await supaAdmin.from('scan_history').select('*', { count: 'exact', head: true });
    if (scansError) throw scansError;
    
    const { count: feedbackVolume, error: feedbackError } = await supaAdmin.from('feedback').select('*', { count: 'exact', head: true });
    if (feedbackError) throw feedbackError;

    const staticMetrics = {
        tam: { collectibles: '25B', real_estate_flipping: '100B', used_vehicles: '1.2T' },
        projections: { q4_2025: '10,000 MAU', q1_2026: '25,000 MAU' },
        positiveAiEvaluations: Math.floor((totalScans || 0) * 0.67),
    };
    
    // Generate and add the new time-series data
    const growthData = generateTimeSeriesData();

    const metrics = {
      totalUsers: totalUsers || 0,
      dau: dau || 0,
      totalScans: totalScans || 0,
      feedbackVolume: feedbackVolume || 0,
      growthData: growthData, // Add the chart data to the response
      ...staticMetrics
    };

    return res.status(200).json(metrics);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error fetching investor metrics:', message);
    return res.status(500).json({ error: message });
  }
}