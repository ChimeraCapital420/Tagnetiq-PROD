// FILE: api/boardroom/index.ts
// Executive Boardroom - Private feature for admin/whitelisted users only

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

// Verify user has boardroom access
async function verifyBoardroomAccess(userId: string): Promise<{ hasAccess: boolean; accessLevel: string | null }> {
  const { data, error } = await supaAdmin
    .from('boardroom_access')
    .select('access_level, expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { hasAccess: false, accessLevel: null };
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { hasAccess: false, accessLevel: null };
  }

  return { hasAccess: true, accessLevel: data.access_level };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);
    
    // Verify boardroom access
    const { hasAccess, accessLevel } = await verifyBoardroomAccess(user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Boardroom access not authorized.' });
    }

    // GET - Get board members and user's meetings
    if (req.method === 'GET') {
      // Get all board members
      const { data: members, error: membersError } = await supaAdmin
        .from('boardroom_members')
        .select('id, slug, name, role, title, ai_provider, avatar_url, personality, expertise, voice_style, display_order')
        .eq('is_active', true)
        .order('display_order');

      if (membersError) throw membersError;

      // Get user's recent meetings
      const { data: meetings, error: meetingsError } = await supaAdmin
        .from('boardroom_meetings')
        .select('id, title, meeting_type, status, participants, started_at, concluded_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(20);

      if (meetingsError) throw meetingsError;

      // Get pending action items
      const { data: actionItems } = await supaAdmin
        .from('boardroom_action_items')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('priority', { ascending: false })
        .limit(10);

      return res.status(200).json({
        members,
        meetings: meetings || [],
        action_items: actionItems || [],
        access_level: accessLevel,
      });
    }

    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Boardroom error:', message);
    return res.status(500).json({ error: message });
  }
}