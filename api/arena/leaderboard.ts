// FILE: api/arena/leaderboard.ts
// Leaderboard endpoint - requires authentication
//
// v1.1 CHANGES — War Room Audit:
//   - Replaced inline supaAdmin and verifyUser with shared _lib imports.
//     Security patches to _lib/security.js now propagate automatically.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin.js';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyUser(req);
    
    const { data, error } = await supaAdmin
      .from('leaderboards')
      .select(`
        user_id,
        roi,
        challenge:arena_challenges(
          purchase_price,
          sale_price
        ),
        user:profiles(
          screen_name
        )
      `)
      .order('roi', { ascending: false })
      .limit(100);

    if (error) throw error;
    
    // Fix the type issues with proper null checking
    const formattedData = data?.map(entry => {
      const screenName = Array.isArray(entry.user) ? entry.user[0]?.screen_name : entry.user?.screen_name;
      const salePrice = Array.isArray(entry.challenge) ? entry.challenge[0]?.sale_price : entry.challenge?.sale_price;
      const purchasePrice = Array.isArray(entry.challenge) ? entry.challenge[0]?.purchase_price : entry.challenge?.purchase_price;
      
      return {
        user: screenName || 'Anonymous',
        roi: Number(entry.roi || 0).toFixed(2),
        totalProfit: (Number(salePrice || 0) - Number(purchasePrice || 0)).toFixed(2)
      };
    }) || [];

    return res.status(200).json(formattedData);
    
  } catch (error: any) {
    const message = error.message || 'An internal server error occurred.';
    
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    
    console.error('Error fetching leaderboard data:', message);
    return res.status(500).json({ error: message });
  }
}