// FILE: api/friends/[id].ts
// Manage individual friend requests - accept, reject, unfriend

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);
    const { id: friendshipId } = req.query;

    if (!friendshipId || typeof friendshipId !== 'string') {
      return res.status(400).json({ error: 'Friendship ID is required' });
    }

    // Get the friendship
    const { data: friendship, error: fetchError } = await supaAdmin
      .from('user_friends')
      .select('*')
      .eq('id', friendshipId)
      .single();

    if (fetchError || !friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    // Verify user is part of this friendship
    const isRequester = friendship.requester_id === user.id;
    const isAddressee = friendship.addressee_id === user.id;

    if (!isRequester && !isAddressee) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // GET - Get friendship details
    if (req.method === 'GET') {
      const friendId = isRequester ? friendship.addressee_id : friendship.requester_id;

      const { data: friendProfile } = await supaAdmin
        .from('profiles')
        .select('id, screen_name, avatar_url')
        .eq('id', friendId)
        .single();

      return res.status(200).json({
        ...friendship,
        friend: friendProfile,
        is_incoming: isAddressee && friendship.status === 'pending',
        is_outgoing: isRequester && friendship.status === 'pending',
      });
    }

    // PATCH - Accept or reject friend request
    if (req.method === 'PATCH') {
      const { action } = req.body;

      if (!action || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'action must be "accept" or "reject"' });
      }

      // Only addressee can accept/reject incoming requests
      if (!isAddressee) {
        return res.status(403).json({ error: 'Only the recipient can respond to friend requests' });
      }

      if (friendship.status !== 'pending') {
        return res.status(400).json({ error: `Cannot ${action} a ${friendship.status} request` });
      }

      const newStatus = action === 'accept' ? 'accepted' : 'rejected';

      const { data: updated, error: updateError } = await supaAdmin
        .from('user_friends')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', friendshipId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Get friend's profile for response
      const { data: friendProfile } = await supaAdmin
        .from('profiles')
        .select('id, screen_name, avatar_url')
        .eq('id', friendship.requester_id)
        .single();

      return res.status(200).json({
        message: action === 'accept' ? 'Friend request accepted!' : 'Friend request declined',
        friendship: updated,
        friend: friendProfile,
      });
    }

    // DELETE - Unfriend or cancel request
    if (req.method === 'DELETE') {
      const { data: deleted, error: deleteError } = await supaAdmin
        .from('user_friends')
        .delete()
        .eq('id', friendshipId)
        .select()
        .single();

      if (deleteError) throw deleteError;

      let message = 'Friend removed';
      if (friendship.status === 'pending') {
        message = isRequester ? 'Friend request cancelled' : 'Friend request declined';
      }

      return res.status(200).json({ message });
    }

    res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error in friends/[id] handler:', message);
    return res.status(500).json({ error: message });
  }
}