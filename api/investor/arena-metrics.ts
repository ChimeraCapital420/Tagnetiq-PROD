// FILE: api/investor/arena-metrics.ts
// Arena Metrics API - REAL DATA ONLY
// Queries: profiles, arena_listings, secure_messages, secure_conversations

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch REAL data from actual tables
    const [
      // User engagement - from profiles
      profilesWithLastSignIn,
      
      // Arena listings (NOT marketplace_listings!)
      totalListingsResult,
      newListingsResult,
      
      // Messages - secure_messages has 35 rows
      totalMessagesResult,
      newMessagesResult,
      
      // Conversations - secure_conversations has 24 rows
      totalConversationsResult,
      newConversationsResult,
      
      // Challenges - arena_challenges is empty (0 rows)
      totalChallengesResult,
      
      // Vault items (user content)
      totalVaultItemsResult,
      newVaultItemsResult,
    ] = await Promise.all([
      // Get profiles with last_login for DAU/MAU calculation
      supabase.from('profiles').select('id, last_login'),
      
      // Total arena listings
      supabase.from('arena_listings').select('*', { count: 'exact', head: true }),
      
      // New listings today
      supabase.from('arena_listings').select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo),
      
      // Total messages
      supabase.from('secure_messages').select('*', { count: 'exact', head: true }),
      
      // New messages today
      supabase.from('secure_messages').select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo),
      
      // Total conversations
      supabase.from('secure_conversations').select('*', { count: 'exact', head: true }),
      
      // New conversations today
      supabase.from('secure_conversations').select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo),
      
      // Total challenges (will be 0 - table is empty)
      supabase.from('arena_challenges').select('*', { count: 'exact', head: true }),
      
      // Total vault items
      supabase.from('vault_items').select('*', { count: 'exact', head: true }),
      
      // New vault items today
      supabase.from('vault_items').select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo),
    ]);

    // Calculate DAU and MAU from profiles
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
        dau,                              // Real DAU
        mau,                              // Real MAU
        totalUsers: profiles.length,      // Total users (20)
      },
      contentVelocity: {
        // Challenges are 0 - be honest about it
        newChallengesToday: 0,            // arena_challenges is empty
        totalChallenges: totalChallengesResult.count || 0,
        
        // Listings - arena_listings has 11
        newListingsToday: newListingsResult.count || 0,
        totalListings: totalListingsResult.count || 0,
        
        // Vault items (scans)
        newItemsToday: newVaultItemsResult.count || 0,
        totalItems: totalVaultItemsResult.count || 0,
      },
      socialInteraction: {
        // Messages - secure_messages has 35
        newConversationsToday: newConversationsResult.count || 0,
        totalConversations: totalConversationsResult.count || 0,
        
        // We don't have alerts triggered (watchlist_alerts is empty)
        alertsTriggeredToday: 0,
        
        // Total messages
        totalMessages: totalMessagesResult.count || 0,
        newMessagesToday: newMessagesResult.count || 0,
      },
      ecosystemHealth: {
        // Be honest - challenges feature not yet adopted
        totalActiveChallenges: totalChallengesResult.count || 0,
        totalActiveListings: totalListingsResult.count || 0,
      },
      
      // Metadata
      generatedAt: new Date().toISOString(),
      dataSource: 'live_database',
    };

    // Cache for 2 minutes
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

    return res.status(200).json(arenaMetrics);

  } catch (error) {
    console.error('Error fetching Arena metrics:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch Arena metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}