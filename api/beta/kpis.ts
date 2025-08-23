// FILE: api/beta/kpis.ts
import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  try {
    await verifyUserIsAdmin(req); // SECURITY: Verify user is an admin

    // Perform queries to get the KPI data.
    // Using { count: 'exact', head: true } is a performant way to get only the count.
    const { count: totalTesters } = await supaAdmin.from('beta_testers').select('*', { count: 'exact', head: true });
    const { count: invitesSent } = await supaAdmin.from('beta_invites').select('*', { count: 'exact', head: true });

    // In a real app, activation rate would be a more complex calculation.
    // For now, we'll return a realistic placeholder.
    const kpiData = {
      totalTesters: totalTesters || 0,
      invitesSent: invitesSent || 0,
      activationRate: '71%', // Placeholder for calculated value
    };

    return res.status(200).json(kpiData);
  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication') || message.includes('Authorization')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error fetching beta KPIs:', error);
    return res.status(500).json({ error: message });
  }
}