// FILE: api/users/[id].ts
// Get public user profile - respects privacy settings

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
    const { id: targetUserId } = req.query;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const isOwnProfile = targetUserId === user.id;

    // Check if blocked (either direction)
    if (!isOwnProfile) {
      const { data: blocked } = await supaAdmin
        .from('blocked_users')
        .select('id')
        .or(`and(user_id.eq.${user.id},blocked_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},blocked_user_id.eq.${user.id})`)
        .limit(1);

      if (blocked && blocked.length > 0) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    // Get target user profile
    const { data: profile, error: profileError } = await supaAdmin
      .from('profiles')
      .select('id, screen_name, avatar_url, profile_visibility, allow_messages_from, created_at')
      .eq('id', targetUserId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get friendship status
    let friendship: any = null;
    if (!isOwnProfile) {
      const { data: friendData } = await supaAdmin
        .from('user_friends')
        .select('id, status, requester_id, addressee_id')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`)
        .single();
      
      friendship = friendData;
    }

    const isFriend = friendship?.status === 'accepted';
    const isPendingFromMe = friendship?.status === 'pending' && friendship?.requester_id === user.id;
    const isPendingToMe = friendship?.status === 'pending' && friendship?.addressee_id === user.id;

    // Check profile visibility
    const visibility = profile.profile_visibility || 'public';
    
    if (!isOwnProfile && visibility === 'private' && !isFriend) {
      return res.status(200).json({
        id: profile.id,
        screen_name: profile.screen_name,
        avatar_url: profile.avatar_url,
        is_private: true,
        can_view_details: false,
        friendship: {
          status: friendship?.status || null,
          friendship_id: friendship?.id || null,
          is_friend: false,
          pending_from_me: isPendingFromMe,
          pending_to_me: isPendingToMe,
          can_send_request: !friendship,
        },
      });
    }

    if (!isOwnProfile && visibility === 'friends_only' && !isFriend) {
      return res.status(200).json({
        id: profile.id,
        screen_name: profile.screen_name,
        avatar_url: profile.avatar_url,
        is_friends_only: true,
        can_view_details: false,
        friendship: {
          status: friendship?.status || null,
          friendship_id: friendship?.id || null,
          is_friend: false,
          pending_from_me: isPendingFromMe,
          pending_to_me: isPendingToMe,
          can_send_request: !friendship,
        },
      });
    }

    // Check messaging permission
    const allowMessages = profile.allow_messages_from || 'everyone';
    let canMessage = false;
    let messageReason = null;
    
    if (isOwnProfile) {
      canMessage = false;
      messageReason = 'Cannot message yourself';
    } else if (allowMessages === 'everyone') {
      canMessage = true;
    } else if (allowMessages === 'friends_only') {
      canMessage = isFriend;
      if (!isFriend) messageReason = 'Only friends can message this user';
    } else if (allowMessages === 'nobody') {
      canMessage = false;
      messageReason = 'User has disabled messages';
    }

    // Get user stats
    const { count: listingsCount } = await supaAdmin
      .from('arena_listings')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', targetUserId)
      .eq('status', 'active');

    const { count: friendsCount } = await supaAdmin
      .from('user_friends')
      .select('*', { count: 'exact', head: true })
      .or(`requester_id.eq.${targetUserId},addressee_id.eq.${targetUserId}`)
      .eq('status', 'accepted');

    const { count: salesCount } = await supaAdmin
      .from('arena_listings')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', targetUserId)
      .eq('status', 'sold');

    return res.status(200).json({
      id: profile.id,
      screen_name: profile.screen_name,
      avatar_url: profile.avatar_url,
      member_since: profile.created_at,
      is_own_profile: isOwnProfile,
      can_view_details: true,
      stats: {
        active_listings: listingsCount || 0,
        friends: friendsCount || 0,
        completed_sales: salesCount || 0,
      },
      friendship: isOwnProfile ? null : {
        status: friendship?.status || null,
        friendship_id: friendship?.id || null,
        is_friend: isFriend,
        pending_from_me: isPendingFromMe,
        pending_to_me: isPendingToMe,
        can_send_request: !friendship,
      },
      messaging: {
        can_message: canMessage,
        reason: messageReason,
      },
      privacy: isOwnProfile ? {
        profile_visibility: visibility,
        allow_messages_from: allowMessages,
      } : null,
    });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('User profile error:', message);
    return res.status(500).json({ error: message });
  }
}