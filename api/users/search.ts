// FILE: api/users/search.ts
// Search for users by screen_name

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { q, limit = '20' } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query (q) must be at least 2 characters' });
    }

    const searchLimit = Math.min(50, parseInt(limit as string) || 20);
    const searchTerm = q.trim();

    // Get blocked users (both directions)
    const { data: blocks } = await supaAdmin
      .from('blocked_users')
      .select('user_id, blocked_user_id')
      .or(`user_id.eq.${user.id},blocked_user_id.eq.${user.id}`);

    const blockedIds = new Set<string>();
    (blocks || []).forEach(b => {
      if (b.user_id === user.id) blockedIds.add(b.blocked_user_id);
      if (b.blocked_user_id === user.id) blockedIds.add(b.user_id);
    });

    // Search users by screen_name (case-insensitive)
    const { data: users, error } = await supaAdmin
      .from('profiles')
      .select('id, screen_name, avatar_url, profile_visibility, created_at')
      .ilike('screen_name', `%${searchTerm}%`)
      .neq('id', user.id) // Exclude self
      .limit(searchLimit);

    if (error) throw error;

    // Get friendship status for all found users
    const userIds = (users || []).map(u => u.id);
    let friendships: any[] = [];
    
    if (userIds.length > 0) {
      const { data: friendData } = await supaAdmin
        .from('user_friends')
        .select('requester_id, addressee_id, status')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .or(userIds.map(id => `requester_id.eq.${id},addressee_id.eq.${id}`).join(','));
      
      friendships = friendData || [];
    }

    // Build friendship map
    const friendshipMap = new Map<string, { status: string; isIncoming: boolean }>();
    friendships.forEach(f => {
      const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
      if (userIds.includes(otherId)) {
        friendshipMap.set(otherId, {
          status: f.status,
          isIncoming: f.addressee_id === user.id && f.status === 'pending',
        });
      }
    });

    // Filter and enrich results
    const results = (users || [])
      .filter(u => !blockedIds.has(u.id))
      .map(u => {
        const friendship = friendshipMap.get(u.id);
        return {
          id: u.id,
          screen_name: u.screen_name,
          avatar_url: u.avatar_url,
          profile_visibility: u.profile_visibility || 'public',
          member_since: u.created_at,
          friendship_status: friendship?.status || null,
          is_friend: friendship?.status === 'accepted',
          has_pending_request: friendship?.status === 'pending',
          is_incoming_request: friendship?.isIncoming || false,
        };
      });

    return res.status(200).json({
      users: results,
      count: results.length,
      query: searchTerm,
    });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('User search error:', message);
    return res.status(500).json({ error: message });
  }
}