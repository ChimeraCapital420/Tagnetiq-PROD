// FILE: api/investor/partnership-kpis.ts

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyUserIsAdmin(req);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: total_opportunities, error: totalError },
      { count: new_opportunities, error: newError },
      { count: monetized_partners, error: monetizedError },
      { count: rejected_partners, error: rejectedError },
    ] = await Promise.all([
      supaAdmin.from('partnership_opportunities').select('*', { count: 'exact', head: true }),
      supaAdmin.from('partnership_opportunities').select('*', { count: 'exact', head: true }).gte('discovered_at', thirtyDaysAgo),
      supaAdmin.from('partnership_opportunities').select('*', { count: 'exact', head: true }).eq('status', 'confirmed_monetized'),
      supaAdmin.from('partnership_opportunities').select('*', { count: 'exact', head: true }).eq('status', 'rejected')
    ]);

    if (totalError || newError || monetizedError || rejectedError) {
        console.error({ totalError, newError, monetizedError, rejectedError });
        throw new Error('Failed to fetch one or more partnership KPIs.');
    }

    const totalMonetized = monetized_partners ?? 0;
    const totalRejected = rejected_partners ?? 0;
    const conversionDenominator = totalMonetized + totalRejected;
    const conversion_rate = conversionDenominator > 0 ? (totalMonetized / conversionDenominator) * 100 : 0;

    const kpiData = {
      total_opportunities: total_opportunities ?? 0,
      new_opportunities: new_opportunities ?? 0,
      monetized_partners: totalMonetized,
      conversion_rate: parseFloat(conversion_rate.toFixed(1)),
    };

    return res.status(200).json(kpiData);

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authorization')) return res.status(403).json({ error: message });
    if (message.includes('Authentication')) return res.status(401).json({ error: message });
    console.error('Error fetching partnership KPIs:', message);
    return res.status(500).json({ error: message });
  }
}