import { supaAdmin } from '../../src/lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  // In a real-world scenario, you would have a robust check here
  // to ensure only authenticated admins can access this endpoint.

  try {
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
  } catch (error) {
    console.error('Error fetching beta KPIs:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}