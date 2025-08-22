// FILE: api/investor/arena-metrics.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: dau, error: dauError },
      { count: mau, error: mauError },
      { count: newChallenges, error: newChallengesError },
      { count: newListings, error: newListingsError },
      { count: newConversations, error: newConversationsError },
      { count: alertsTriggered, error: alertsTriggeredError },
      { count: totalActiveChallenges, error: totalActiveChallengesError },
    ] = await Promise.all([
      supaAdmin.from('users').select('*', { count: 'exact', head: true }).gte('last_sign_in_at', twentyFourHoursAgo),
      supaAdmin.from('users').select('*', { count: 'exact', head: true }).gte('last_sign_in_at', thirtyDaysAgo),
      supaAdmin.from('arena_challenges').select('*', { count: 'exact', head: true }).gte('created_at', twentyFourHoursAgo),
      supaAdmin.from('marketplace_listings').select('*', { count: 'exact', head: true }).gte('created_at', twentyFourHoursAgo),
      supaAdmin.from('secure_messages').select('*', { count: 'exact', head: true }).gte('created_at', twentyFourHoursAgo),
      supaAdmin.from('watchlist_alerts').select('*', { count: 'exact', head: true }).gte('triggered_at', twentyFourHoursAgo),
      supaAdmin.from('arena_challenges').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    if (dauError || mauError || newChallengesError || newListingsError || newConversationsError || alertsTriggeredError || totalActiveChallengesError) {
        console.error({dauError, mauError, newChallengesError, newListingsError, newConversationsError, alertsTriggeredError, totalActiveChallengesError});
        throw new Error('Failed to fetch one or more Arena metrics.');
    }

    const arenaMetrics = {
      userEngagement: { dau: dau ?? 0, mau: mau ?? 0 },
      contentVelocity: { newChallengesToday: newChallenges ?? 0, newListingsToday: newListings ?? 0 },
      socialInteraction: { newConversationsToday: newConversations ?? 0, alertsTriggeredToday: alertsTriggered ?? 0 },
      ecosystemHealth: { totalActiveChallenges: totalActiveChallenges ?? 0 },
    };

    return res.status(200).json(arenaMetrics);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error fetching Arena metrics:', message);
    return res.status(500).json({ error: message });
  }
}
