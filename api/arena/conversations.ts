// FILE: api/arena/conversations.ts
// Updated to support P2P direct messaging + listing-based conversations

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // GET - Fetch all conversations
    if (req.method === 'GET') {
      const { type } = req.query; // 'all' | 'direct' | 'listing'

      let query = supaAdmin
        .from('secure_conversations')
        .select('*')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      // Filter by conversation type if specified
      if (type === 'direct') {
        query = query.is('listing_id', null);
      } else if (type === 'listing') {
        query = query.not('listing_id', 'is', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get blocked users to filter out
      const { data: blocks } = await supaAdmin
        .from('blocked_users')
        .select('blocked_user_id')
        .eq('user_id', user.id);
      
      const blockedIds = new Set((blocks || []).map(b => b.blocked_user_id));

      // Enrich conversations with profiles and listing info
      const enrichedConversations = await Promise.all((data || []).map(async (convo) => {
        const otherUserId = convo.buyer_id === user.id ? convo.seller_id : convo.buyer_id;
        
        // Skip if other user is blocked
        if (blockedIds.has(otherUserId)) {
          return null;
        }

        // Get listing info (if listing-based conversation)
        let listing = null;
        if (convo.listing_id) {
          const { data: listingData } = await supaAdmin
            .from('arena_listings')
            .select('title, images')
            .eq('id', convo.listing_id)
            .single();
          
          if (listingData) {
            listing = {
              id: convo.listing_id,
              item_name: listingData.title,
              primary_photo_url: listingData.images?.[0] || '/placeholder.svg'
            };
          }
        }

        // Get other user's profile
        const { data: otherProfile } = await supaAdmin
          .from('profiles')
          .select('id, screen_name, avatar_url')
          .eq('id', otherUserId)
          .single();

        // Get last message
        const { data: lastMessage } = await supaAdmin
          .from('secure_messages')
          .select('encrypted_content, created_at, sender_id')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get unread count
        const { count: unreadCount } = await supaAdmin
          .from('secure_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', convo.id)
          .neq('sender_id', user.id)
          .eq('read', false);

        return {
          id: convo.id,
          conversation_type: convo.listing_id ? 'listing' : 'direct',
          listing_id: convo.listing_id,
          listing,
          other_user: otherProfile || { id: otherUserId, screen_name: 'Unknown User' },
          last_message: lastMessage || null,
          unread_count: unreadCount || 0,
          is_buyer: convo.buyer_id === user.id,
          created_at: convo.created_at,
          updated_at: convo.updated_at,
        };
      }));

      // Filter out null (blocked) conversations
      const filteredConversations = enrichedConversations.filter(c => c !== null);

      // Calculate total unread
      const totalUnread = filteredConversations.reduce((sum, c) => sum + (c?.unread_count || 0), 0);

      return res.status(200).json({
        conversations: filteredConversations,
        total_unread: totalUnread,
      });
    }

    // POST - Create new conversation (listing-based OR direct P2P)
    if (req.method === 'POST') {
      const { listingId, userId } = req.body;

      // Must provide either listingId OR userId, not both
      if (!listingId && !userId) {
        return res.status(400).json({ error: 'Either listingId or userId is required.' });
      }

      if (listingId && userId) {
        return res.status(400).json({ error: 'Provide either listingId or userId, not both.' });
      }

      let otherUserId: string;
      let conversationType: 'listing' | 'direct';

      // LISTING-BASED CONVERSATION
      if (listingId) {
        conversationType = 'listing';

        // Get listing
        const { data: listing, error: listingError } = await supaAdmin
          .from('arena_listings')
          .select('seller_id')
          .eq('id', listingId)
          .single();

        if (listingError || !listing) {
          return res.status(404).json({ error: 'Listing not found.' });
        }

        if (listing.seller_id === user.id) {
          return res.status(400).json({ error: 'Cannot message yourself.' });
        }

        otherUserId = listing.seller_id;

        // Check if conversation already exists
        const { data: existing } = await supaAdmin
          .from('secure_conversations')
          .select('id')
          .eq('listing_id', listingId)
          .eq('buyer_id', user.id)
          .single();

        if (existing) {
          return res.status(200).json({ id: existing.id, existing: true });
        }
      } 
      // DIRECT P2P CONVERSATION
      else {
        conversationType = 'direct';
        otherUserId = userId;

        if (otherUserId === user.id) {
          return res.status(400).json({ error: 'Cannot message yourself.' });
        }
      }

      // Check if other user exists
      const { data: otherUser, error: userError } = await supaAdmin
        .from('profiles')
        .select('id, screen_name, profile_visibility, allow_messages_from')
        .eq('id', otherUserId)
        .single();

      if (userError || !otherUser) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Check if blocked (either direction)
      const { data: blocked } = await supaAdmin
        .from('blocked_users')
        .select('id')
        .or(`and(user_id.eq.${user.id},blocked_user_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},blocked_user_id.eq.${user.id})`)
        .limit(1);

      if (blocked && blocked.length > 0) {
        return res.status(403).json({ error: 'Cannot message this user.' });
      }

      // For direct messages, check messaging permissions
      if (conversationType === 'direct') {
        const allowMessages = otherUser.allow_messages_from || 'everyone';

        if (allowMessages === 'nobody') {
          return res.status(403).json({ error: 'This user has disabled direct messages.' });
        }

        if (allowMessages === 'friends_only') {
          // Check if friends
          const { data: friendship } = await supaAdmin
            .from('user_friends')
            .select('status')
            .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`)
            .eq('status', 'accepted')
            .limit(1);

          if (!friendship || friendship.length === 0) {
            return res.status(403).json({ error: 'Only friends can message this user.' });
          }
        }

        // Check for existing direct conversation (either direction)
        const { data: existingDirect } = await supaAdmin
          .from('secure_conversations')
          .select('id')
          .is('listing_id', null)
          .or(`and(buyer_id.eq.${user.id},seller_id.eq.${otherUserId}),and(buyer_id.eq.${otherUserId},seller_id.eq.${user.id})`)
          .limit(1)
          .single();

        if (existingDirect) {
          return res.status(200).json({ id: existingDirect.id, existing: true });
        }
      }

      // Create new conversation
      const { data: newConvo, error: insertError } = await supaAdmin
        .from('secure_conversations')
        .insert({
          listing_id: listingId || null,
          buyer_id: user.id,
          seller_id: otherUserId,
          conversation_type: conversationType,
        })
        .select()
        .single();

      if (insertError) {
        // Handle race condition - conversation might have been created
        if (insertError.code === '23505') {
          if (listingId) {
            const { data: raceConvo } = await supaAdmin
              .from('secure_conversations')
              .select('id')
              .eq('listing_id', listingId)
              .eq('buyer_id', user.id)
              .single();
            if (raceConvo) return res.status(200).json({ id: raceConvo.id, existing: true });
          } else {
            const { data: raceConvo } = await supaAdmin
              .from('secure_conversations')
              .select('id')
              .is('listing_id', null)
              .or(`and(buyer_id.eq.${user.id},seller_id.eq.${otherUserId}),and(buyer_id.eq.${otherUserId},seller_id.eq.${user.id})`)
              .limit(1)
              .single();
            if (raceConvo) return res.status(200).json({ id: raceConvo.id, existing: true });
          }
        }
        throw insertError;
      }

      return res.status(201).json({
        id: newConvo.id,
        conversation_type: conversationType,
        other_user: {
          id: otherUser.id,
          screen_name: otherUser.screen_name,
        },
        existing: false,
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error in conversations handler:', message);
    return res.status(500).json({ error: message });
  }
}