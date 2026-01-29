// FILE: api/boardroom/memory.ts
// Manage board member memories

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

async function verifyBoardroomAccess(userId: string): Promise<boolean> {
  const { data } = await supaAdmin
    .from('boardroom_access')
    .select('access_level, expires_at')
    .eq('user_id', userId)
    .single();

  if (!data) return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);
    
    if (!await verifyBoardroomAccess(user.id)) {
      return res.status(403).json({ error: 'Boardroom access not authorized.' });
    }

    // GET - Get memories for a specific member or all
    if (req.method === 'GET') {
      const { member_id, member_slug } = req.query;

      let query = supaAdmin
        .from('boardroom_member_memory')
        .select(`
          *,
          boardroom_members:member_id (slug, name, title)
        `)
        .eq('user_id', user.id)
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false });

      if (member_id) {
        query = query.eq('member_id', member_id);
      } else if (member_slug) {
        // Get member ID from slug first
        const { data: member } = await supaAdmin
          .from('boardroom_members')
          .select('id')
          .eq('slug', member_slug)
          .single();
        
        if (member) {
          query = query.eq('member_id', member.id);
        }
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      return res.status(200).json(data);
    }

    // POST - Add a memory manually
    if (req.method === 'POST') {
      const { member_id, member_slug, content, memory_type, importance } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'content is required.' });
      }

      let targetMemberId = member_id;

      // Resolve slug to ID if needed
      if (!targetMemberId && member_slug) {
        const { data: member } = await supaAdmin
          .from('boardroom_members')
          .select('id')
          .eq('slug', member_slug)
          .single();
        
        if (member) targetMemberId = member.id;
      }

      // If no specific member, add to all members
      if (!targetMemberId) {
        const { data: allMembers } = await supaAdmin
          .from('boardroom_members')
          .select('id')
          .eq('is_active', true);

        const memories = (allMembers || []).map(m => ({
          user_id: user.id,
          member_id: m.id,
          content,
          memory_type: memory_type || 'fact',
          importance: importance || 5,
        }));

        const { data, error } = await supaAdmin
          .from('boardroom_member_memory')
          .upsert(memories, { onConflict: 'user_id,member_id,content' })
          .select();

        if (error) throw error;

        return res.status(201).json({ added_to: 'all_members', count: data?.length });
      }

      const { data, error } = await supaAdmin
        .from('boardroom_member_memory')
        .upsert({
          user_id: user.id,
          member_id: targetMemberId,
          content,
          memory_type: memory_type || 'fact',
          importance: importance || 5,
        }, { onConflict: 'user_id,member_id,content' })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json(data);
    }

    // DELETE - Remove a memory
    if (req.method === 'DELETE') {
      const { id, member_id, clear_all } = req.body;

      if (clear_all && member_id) {
        // Clear all memories for a specific member
        const { error } = await supaAdmin
          .from('boardroom_member_memory')
          .delete()
          .eq('user_id', user.id)
          .eq('member_id', member_id);

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'All memories cleared for member.' });
      }

      if (!id) {
        return res.status(400).json({ error: 'Memory id is required.' });
      }

      const { error } = await supaAdmin
        .from('boardroom_member_memory')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Boardroom memory error:', message);
    return res.status(500).json({ error: message });
  }
}