// FILE: api/blocked.ts
// Block/unblock users

import { supaAdmin } from './_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from './_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // GET - List blocked users
    if (req.method === 'GET') {
      const { data: blocked, error } = await supaAdmin
        .from('blocked_users')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get profiles for blocked users
      const blockedIds = (blocked || []).map(b => b.blocked_user_id);
      
      let profiles: any[] = [];
      if (blockedIds.length > 0) {
        const { data: profileData } = await supaAdmin
          .from('profiles')
          .select('id, screen_name, avatar_url')
          .in('id', blockedIds);
        profiles = profileData || [];
      }

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const enrichedBlocked = (blocked || []).map(b => ({
        id: b.id,
        blocked_user: profileMap.get(b.blocked_user_id) || { 
          id: b.blocked_user_id, 
          screen_name: 'Unknown User' 
        },
        created_at: b.created_at,
      }));

      return res.status(200).json({
        blocked_users: enrichedBlocked,
        count: enrichedBlocked.length,
      });
    }

    // POST - Block a user
    if (req.method === 'POST') {
      const { user_id: targetUserId } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ error: 'user_id is required' });
      }

      if (targetUserId === user.id) {
        return res.status(400).json({ error: 'Cannot block yourself' });
      }

      // Check if already blocked
      const { data: existing } = await supaAdmin
        .from('blocked_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('blocked_user_id', targetUserId)
        .single();

      if (existing) {
        return res.status(400).json({ error: 'User is already blocked' });
      }

      // Remove any existing friendship
      const { error: friendDeleteError } = await supaAdmin
        .from('user_friends')
        .delete()
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`);

      if (friendDeleteError) {
        console.error('Error removing friendship:', friendDeleteError);
        // Continue anyway - blocking is more important
      }

      // Block the user
      const { data: blocked, error: blockError } = await supaAdmin
        .from('blocked_users')
        .insert({
          user_id: user.id,
          blocked_user_id: targetUserId,
        })
        .select()
        .single();

      if (blockError) throw blockError;

      // Get blocked user's profile
      const { data: blockedProfile } = await supaAdmin
        .from('profiles')
        .select('id, screen_name')
        .eq('id', targetUserId)
        .single();

      return res.status(201).json({
        message: 'User blocked',
        blocked,
        blocked_user: blockedProfile || { id: targetUserId, screen_name: 'Unknown User' },
      });
    }

    // DELETE - Unblock a user
    if (req.method === 'DELETE') {
      const { user_id: targetUserId } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ error: 'user_id is required' });
      }

      const { data: deleted, error: deleteError } = await supaAdmin
        .from('blocked_users')
        .delete()
        .eq('user_id', user.id)
        .eq('blocked_user_id', targetUserId)
        .select()
        .single();

      if (deleteError) {
        if (deleteError.code === 'PGRST116') {
          return res.status(404).json({ error: 'User is not blocked' });
        }
        throw deleteError;
      }

      return res.status(200).json({
        message: 'User unblocked',
        unblocked_user_id: targetUserId,
      });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error in blocked handler:', message);
    return res.status(500).json({ error: message });
  }
}