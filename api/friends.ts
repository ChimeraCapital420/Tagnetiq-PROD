// FILE: api/friends.ts
// Friends system - list friends, send requests

import { supaAdmin } from './_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from './_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // GET - List all friends and pending requests
    if (req.method === 'GET') {
      const { status } = req.query;

      let query = supaAdmin
        .from('user_friends')
        .select('*')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      // Filter by status if provided
      if (status && typeof status === 'string') {
        query = query.eq('status', status);
      } else {
        // By default, don't show rejected
        query = query.neq('status', 'rejected');
      }

      const { data: friendships, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;

      // Get all unique user IDs we need to fetch
      const userIds = new Set<string>();
      (friendships || []).forEach(f => {
        if (f.requester_id !== user.id) userIds.add(f.requester_id);
        if (f.addressee_id !== user.id) userIds.add(f.addressee_id);
      });

      // Fetch profiles for these users
      const { data: profiles } = await supaAdmin
        .from('profiles')
        .select('id, screen_name, avatar_url, profile_visibility')
        .in('id', Array.from(userIds));

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Enrich friendships with profile data
      const enrichedFriendships = (friendships || []).map(f => {
        const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        const friendProfile = profileMap.get(friendId);
        const isIncoming = f.addressee_id === user.id && f.status === 'pending';
        const isOutgoing = f.requester_id === user.id && f.status === 'pending';

        return {
          id: f.id,
          friend_id: friendId,
          friend: friendProfile || { id: friendId, screen_name: 'Unknown User' },
          status: f.status,
          is_incoming_request: isIncoming,
          is_outgoing_request: isOutgoing,
          created_at: f.created_at,
          updated_at: f.updated_at,
        };
      });

      // Separate into categories
      const friends = enrichedFriendships.filter(f => f.status === 'accepted');
      const incoming = enrichedFriendships.filter(f => f.is_incoming_request);
      const outgoing = enrichedFriendships.filter(f => f.is_outgoing_request);
      const blocked = enrichedFriendships.filter(f => f.status === 'blocked');

      return res.status(200).json({
        friends,
        incoming_requests: incoming,
        outgoing_requests: outgoing,
        blocked,
        counts: {
          friends: friends.length,
          incoming: incoming.length,
          outgoing: outgoing.length,
        }
      });
    }

    // POST - Send friend request
    if (req.method === 'POST') {
      const { user_id: targetUserId } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ error: 'user_id is required' });
      }

      if (targetUserId === user.id) {
        return res.status(400).json({ error: 'Cannot send friend request to yourself' });
      }

      // Check if target user exists
      const { data: targetUser, error: userError } = await supaAdmin
        .from('profiles')
        .select('id, screen_name, profile_visibility, allow_messages_from')
        .eq('id', targetUserId)
        .single();

      if (userError || !targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if blocked (either direction)
      const { data: blocked } = await supaAdmin
        .from('blocked_users')
        .select('id')
        .or(`and(user_id.eq.${user.id},blocked_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},blocked_user_id.eq.${user.id})`)
        .limit(1);

      if (blocked && blocked.length > 0) {
        return res.status(403).json({ error: 'Cannot send friend request to this user' });
      }

      // Check for existing friendship in either direction
      const { data: existing } = await supaAdmin
        .from('user_friends')
        .select('*')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`)
        .limit(1)
        .single();

      if (existing) {
        if (existing.status === 'accepted') {
          return res.status(400).json({ error: 'Already friends with this user' });
        }
        if (existing.status === 'pending') {
          // If they sent us a request, auto-accept it
          if (existing.requester_id === targetUserId) {
            const { data: accepted, error: acceptError } = await supaAdmin
              .from('user_friends')
              .update({ status: 'accepted', updated_at: new Date().toISOString() })
              .eq('id', existing.id)
              .select()
              .single();

            if (acceptError) throw acceptError;
            return res.status(200).json({ 
              message: 'Friend request accepted!',
              friendship: accepted,
              auto_accepted: true
            });
          }
          return res.status(400).json({ error: 'Friend request already pending' });
        }
        if (existing.status === 'rejected') {
          // Allow re-requesting after rejection
          const { data: updated, error: updateError } = await supaAdmin
            .from('user_friends')
            .update({ 
              status: 'pending', 
              requester_id: user.id,
              addressee_id: targetUserId,
              updated_at: new Date().toISOString() 
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (updateError) throw updateError;
          return res.status(200).json({ 
            message: 'Friend request sent!',
            friendship: updated
          });
        }
        if (existing.status === 'blocked') {
          return res.status(403).json({ error: 'Cannot send friend request to this user' });
        }
      }

      // Create new friend request
      const { data: friendship, error: insertError } = await supaAdmin
        .from('user_friends')
        .insert({
          requester_id: user.id,
          addressee_id: targetUserId,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return res.status(201).json({
        message: 'Friend request sent!',
        friendship,
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error in friends handler:', message);
    return res.status(500).json({ error: message });
  }
}