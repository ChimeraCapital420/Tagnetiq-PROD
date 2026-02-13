// FILE: api/investor/live-feed.ts
// Live Feed API - REAL DATA from original tables + analytics engine
// Sprint E+: Now includes Oracle chats, shares, tour completions, community moments
//
// Original: profiles, vault_items, arena_listings, secure_messages, consensus_results
// New:      analytics_events (anonymous aggregates only — no PII ever exposed)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Event types — expanded to include new Sprint features
type EventType =
  | 'USER_SIGNUP'
  | 'ITEM_VAULTED'
  | 'LISTING_CREATED'
  | 'MESSAGE_SENT'
  | 'AI_ANALYSIS'
  | 'ORACLE_CHAT'
  | 'CONVERSATION_SHARED'
  | 'TOUR_COMPLETED'
  | 'COMMUNITY_MOMENT'
  | 'SCAN_COMPLETED'
  | 'VAULT_MILESTONE';

interface FeedEvent {
  type: EventType;
  timestamp: string;
  location?: string;
  details?: string;
  source: 'database';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const events: FeedEvent[] = [];

    // Get data from the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // =========================================================================
    // ORIGINAL SOURCES (unchanged)
    // =========================================================================

    const [
      profilesResult,
      vaultItemsResult,
      listingsResult,
      messagesResult,
      analysesResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, created_at, location_text')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('vault_items')
        .select('id, created_at, name, category')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('arena_listings')
        .select('id, created_at, title')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('secure_messages')
        .select('id, created_at')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('consensus_results')
        .select('id, created_at')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    // Process original sources (unchanged)
    if (profilesResult.data) {
      profilesResult.data.forEach(profile => {
        if (profile.created_at) {
          events.push({
            type: 'USER_SIGNUP',
            timestamp: profile.created_at,
            location: profile.location_text || undefined,
            source: 'database',
          });
        }
      });
    }

    if (vaultItemsResult.data) {
      vaultItemsResult.data.forEach(item => {
        if (item.created_at) {
          events.push({
            type: 'ITEM_VAULTED',
            timestamp: item.created_at,
            details: item.category || 'Collectible',
            source: 'database',
          });
        }
      });
    }

    if (listingsResult.data) {
      listingsResult.data.forEach(listing => {
        if (listing.created_at) {
          events.push({
            type: 'LISTING_CREATED',
            timestamp: listing.created_at,
            details: listing.title || 'Arena Listing',
            source: 'database',
          });
        }
      });
    }

    if (messagesResult.data) {
      messagesResult.data.forEach(msg => {
        if (msg.created_at) {
          events.push({
            type: 'MESSAGE_SENT',
            timestamp: msg.created_at,
            details: 'Secure message sent',
            source: 'database',
          });
        }
      });
    }

    if (analysesResult.data) {
      analysesResult.data.forEach(analysis => {
        if (analysis.created_at) {
          events.push({
            type: 'AI_ANALYSIS',
            timestamp: analysis.created_at,
            details: 'HYDRA analysis completed',
            source: 'database',
          });
        }
      });
    }

    // =========================================================================
    // NEW SOURCES (Sprint E+ — graceful if tables don't exist)
    // All data is anonymous. No PII. No user names. No content.
    // =========================================================================

    // Oracle conversations (Sprint K+)
    const oracleResult = await supabase
      .from('oracle_conversations')
      .select('id, created_at, message_count')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!oracleResult.error && oracleResult.data) {
      oracleResult.data.forEach(convo => {
        if (convo.created_at) {
          events.push({
            type: 'ORACLE_CHAT',
            timestamp: convo.created_at,
            details: `Oracle conversation (${convo.message_count || 0} messages)`,
            source: 'database',
          });
        }
      });
    }

    // Shared conversations (Sprint N)
    const sharedResult = await supabase
      .from('oracle_conversations')
      .select('id, updated_at, share_views')
      .not('share_token', 'is', null)
      .gte('updated_at', sevenDaysAgo)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (!sharedResult.error && sharedResult.data) {
      sharedResult.data.forEach(shared => {
        if (shared.updated_at) {
          events.push({
            type: 'CONVERSATION_SHARED',
            timestamp: shared.updated_at,
            details: `Conversation shared (${shared.share_views || 0} views)`,
            source: 'database',
          });
        }
      });
    }

    // Tour completions (Sprint E)
    const tourResult = await supabase
      .from('onboarding_progress')
      .select('tour_completed_at')
      .eq('tour_completed', true)
      .not('tour_completed_at', 'is', null)
      .gte('tour_completed_at', sevenDaysAgo)
      .order('tour_completed_at', { ascending: false })
      .limit(5);

    if (!tourResult.error && tourResult.data) {
      tourResult.data.forEach(tour => {
        if (tour.tour_completed_at) {
          events.push({
            type: 'TOUR_COMPLETED',
            timestamp: tour.tour_completed_at,
            details: 'New user completed guided tour',
            source: 'database',
          });
        }
      });
    }

    // Community moments (Sprint E)
    const momentsResult = await supabase
      .from('community_moments')
      .select('id, created_at, headline, moment_type')
      .eq('is_published', true)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(3);

    if (!momentsResult.error && momentsResult.data) {
      momentsResult.data.forEach(moment => {
        if (moment.created_at) {
          events.push({
            type: 'COMMUNITY_MOMENT',
            timestamp: moment.created_at,
            details: moment.headline || 'Community highlight',
            source: 'database',
          });
        }
      });
    }

    // Analytics event aggregates — anonymous counts only
    // (Not individual events — we show "12 scans completed this hour", not individual scans)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const recentAnalytics = await supabase
      .from('analytics_events')
      .select('event_name, event_category')
      .gte('created_at', oneHourAgo);

    if (!recentAnalytics.error && recentAnalytics.data && recentAnalytics.data.length > 0) {
      const counts: Record<string, number> = {};
      recentAnalytics.data.forEach(e => {
        counts[e.event_name] = (counts[e.event_name] || 0) + 1;
      });

      // Add aggregate events for the live feed
      if (counts['scan_complete'] && counts['scan_complete'] > 0) {
        events.push({
          type: 'SCAN_COMPLETED',
          timestamp: new Date().toISOString(),
          details: `${counts['scan_complete']} scans completed in the last hour`,
          source: 'database',
        });
      }
    }

    // =========================================================================
    // SORT AND RETURN
    // =========================================================================

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (events.length === 0) {
      return res.status(200).json({
        type: 'AI_ANALYSIS',
        timestamp: new Date().toISOString(),
        details: 'System ready for activity',
        source: 'database',
        note: 'No recent activity in the last 7 days',
      });
    }

    // Return one random event from the most recent 15
    const recentEvents = events.slice(0, 15);
    const randomEvent = recentEvents[Math.floor(Math.random() * recentEvents.length)];

    // Short cache for "live" feel
    res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5');

    return res.status(200).json(randomEvent);

  } catch (error) {
    console.error('Error fetching live feed:', error);
    return res.status(200).json({
      type: 'AI_ANALYSIS',
      timestamp: new Date().toISOString(),
      details: 'System operational',
      source: 'database',
    });
  }
}