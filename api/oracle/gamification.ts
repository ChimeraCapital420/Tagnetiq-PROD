// FILE: api/oracle/gamification.ts
// Gamification API — stats, leaderboard, award points
// GET: ?action=stats | ?action=leaderboard
// POST: { action: 'award', pointAction: '...', metadata?: {} }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  awardPoints,
  getGamificationStats,
  getLeaderboard,
  type PointAction,
  POINT_ACTIONS,
} from '../../src/lib/oracle/gamification/index.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function verifyUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const action = req.query.action as string;

      if (action === 'leaderboard') {
        const leaderboard = await getLeaderboard(supabaseAdmin, 20);
        return res.status(200).json({ leaderboard });
      }

      // Default: user stats
      const stats = await getGamificationStats(supabaseAdmin, user.id);
      return res.status(200).json(stats);
    }

    if (req.method === 'POST') {
      const { pointAction, metadata } = req.body;

      if (!pointAction || !(pointAction in POINT_ACTIONS)) {
        return res.status(400).json({ error: 'Invalid point action' });
      }

      const result = await awardPoints(
        supabaseAdmin,
        user.id,
        pointAction as PointAction,
        metadata,
      );

      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Gamification] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
