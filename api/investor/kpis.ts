// FILE: api/investor/kpis.ts

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalUsers, error: usersError },
      { count: dau, error: dauError },
      { count: totalScans, error: scansError }
    ] = await Promise.all([
      supaAdmin.from('users').select('*', { count: 'exact', head: true }),
      supaAdmin.from('users').select('*', { count: 'exact', head: true }).gte('last_sign_in_at', twentyFourHoursAgo),
      supaAdmin.from('scans').select('*', { count: 'exact', head: true })
    ]);

    if (usersError || dauError || scansError) {
      console.error({ usersError, dauError, scansError });
      throw new Error('Failed to fetch one or more core KPIs.');
    }

    const kpiData = {
      totalUsers: totalUsers ?? 0,
      dau: dau ?? 0,
      totalScans: totalScans ?? 0,
    };

    return res.status(200).json(kpiData);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error fetching core KPIs:', message);
    return res.status(500).json({ error: message });
  }
}
