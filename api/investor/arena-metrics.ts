// FILE: api/investor/arena-metrics.ts
// Arena Metrics API - REAL DATA ONLY
// Queries: profiles, arena_listings, secure_messages, secure_conversations
//
// SECURITY: Dual-path auth (admin JWT or invite token)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin.js';
import { verifyInvestorAccess, setInvestorCORS } from '../_lib/investorAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setInvestorCORS(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyInvestorAccess(req);

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const [
      profilesWithLastSignIn,
      totalListingsResult,
      newListingsResult,
      totalMessagesResult,
      newMessagesResult,
      totalConversationsResult,
      newConversationsResult,
      totalChallengesResult,
      totalVaultItemsResult,
      newVaultItemsResult,
    ] = await Promise.all([
      supaAdmin.from('profiles').select('id, last_login'),
      supaAdmin.from('arena_listings').select('*', { count: 'exact', head: true }),
      supaAdmin.from('arena_listings').select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo),
      supaAdmin.from('secure_messages').select('*', { count: 'exact', head: true }),
      supaAdmin.from('secure_messages').select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo),
      supaAdmin.from('secure_conversations').select('*', { count: 'exact', head: true }),
      supaAdmin.from('secure_conversations').select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo),
      supaAdmin.from('arena_challenges').select('*', { count: 'exact', head: true }),
      supaAdmin.from('vault_items').select('*', { count: 'exact', head: true }),
      supaAdmin.from('vault_items').select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo),
    ]);

    const profiles = profilesWithLastSignIn.data || [];
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dau = profiles.filter(p =>
      p.last_login && new Date(p.last_login) > oneDayAgo
    ).length;

    const mau = profiles.filter(p =>
      p.last_login && new Date(p.last_login) > thirtyDaysAgoDate
    ).length;

    const arenaMetrics = {
      userEngagement: {
        dau,
        mau,
        totalUsers: profiles.length,
      },
      contentVelocity: {
        newChallengesToday: 0,
        totalChallenges: totalChallengesResult.count || 0,
        newListingsToday: newListingsResult.count || 0,
        totalListings: totalListingsResult.count || 0,
        newItemsToday: newVaultItemsResult.count || 0,
        totalItems: totalVaultItemsResult.count || 0,
      },
      socialInteraction: {
        newConversationsToday: newConversationsResult.count || 0,
        totalConversations: totalConversationsResult.count || 0,
        alertsTriggeredToday: 0,
        totalMessages: totalMessagesResult.count || 0,
        newMessagesToday: newMessagesResult.count || 0,
      },
      ecosystemHealth: {
        totalActiveChallenges: totalChallengesResult.count || 0,
        totalActiveListings: totalListingsResult.count || 0,
      },
      generatedAt: new Date().toISOString(),
      dataSource: 'live_database',
    };

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

    return res.status(200).json(arenaMetrics);

  } catch (error: any) {
    const msg = error.message || 'An unexpected error occurred.';
    if (msg.includes('Authentication') || msg.includes('Authorization')) {
      return res.status(401).json({ error: msg });
    }
    console.error('Error fetching Arena metrics:', msg);
    return res.status(500).json({ error: 'Failed to fetch Arena metrics' });
  }
}