import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Authentication token is required.' });
  }

  try {
    // Verify the token is valid, not revoked, and not expired
    const { data: invite, error } = await supaAdmin
      .from('investor_invites')
      .select('id, expires_at, revoked, mode')
      .eq('token', token)
      .single();

    if (error || !invite || invite.revoked || new Date() > new Date(invite.expires_at)) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    let kpiData;

    // Serve different data based on the invite mode
    if (invite.mode === 'demo') {
      kpiData = {
        totalUsers: 1234,
        monthlyAnalyses: 5678,
        simulatedARR: 9999,
        wowUserGrowth: 12,
      };
    } else {
      // In a real "live" environment, you would query your actual production data here.
      // For now, we'll serve slightly different numbers to show the mode is working.
      kpiData = {
        totalUsers: 1572,
        monthlyAnalyses: 6231,
        simulatedARR: 12500,
        wowUserGrowth: 14,
      };
    }

    return res.status(200).json(kpiData);

  } catch (error) {
    console.error('Error fetching investor KPIs:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}