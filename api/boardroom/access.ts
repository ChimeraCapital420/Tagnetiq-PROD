// FILE: api/boardroom/access.ts
// Manage boardroom access - admin only

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

async function verifyBoardroomAdmin(userId: string): Promise<boolean> {
  const { data } = await supaAdmin
    .from('boardroom_access')
    .select('access_level')
    .eq('user_id', userId)
    .eq('access_level', 'admin')
    .single();

  return !!data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);
    
    // Only admins can manage access
    if (!await verifyBoardroomAdmin(user.id)) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    // GET - List all users with access
    if (req.method === 'GET') {
      const { data, error } = await supaAdmin
        .from('boardroom_access')
        .select(`
          id,
          user_id,
          access_level,
          granted_at,
          expires_at,
          notes,
          profiles:user_id (screen_name, email)
        `)
        .order('granted_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json(data);
    }

    // POST - Grant access to a user
    if (req.method === 'POST') {
      const { user_id, access_level, expires_at, notes } = req.body;

      if (!user_id) {
        return res.status(400).json({ error: 'user_id is required.' });
      }

      // Verify user exists
      const { data: targetUser, error: userError } = await supaAdmin
        .from('profiles')
        .select('id, screen_name')
        .eq('id', user_id)
        .single();

      if (userError || !targetUser) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const { data, error } = await supaAdmin
        .from('boardroom_access')
        .upsert({
          user_id,
          access_level: access_level || 'member',
          granted_by: user.id,
          expires_at: expires_at || null,
          notes,
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        ...data,
        user: targetUser,
      });
    }

    // DELETE - Revoke access
    if (req.method === 'DELETE') {
      const { user_id } = req.body;

      if (!user_id) {
        return res.status(400).json({ error: 'user_id is required.' });
      }

      // Can't remove your own access
      if (user_id === user.id) {
        return res.status(400).json({ error: 'Cannot revoke your own access.' });
      }

      const { error } = await supaAdmin
        .from('boardroom_access')
        .delete()
        .eq('user_id', user_id);

      if (error) throw error;

      return res.status(200).json({ success: true, message: 'Access revoked.' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Boardroom access error:', message);
    return res.status(500).json({ error: message });
  }
}