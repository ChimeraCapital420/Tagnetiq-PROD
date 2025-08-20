// FILE: api/arena/leaderboard.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
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
    
    const formattedData = data.map(entry => ({
        user: entry.user?.screen_name || 'Anonymous',
        roi: Number(entry.roi).toFixed(2),
        totalProfit: (Number(entry.challenge?.sale_price) - Number(entry.challenge?.purchase_price)).toFixed(2)
    }));

    return res.status(200).json(formattedData);
  } catch (error: any) {
    console.error('Error fetching leaderboard data:', error);
    return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
  }
}