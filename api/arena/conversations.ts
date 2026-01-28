// FILE: api/arena/conversations.ts
// Fixed to use arena_listings instead of marketplace_listings

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    if (req.method === 'GET') {
      // Fetch all conversations for this user (as buyer or seller)
      const { data, error } = await supaAdmin
        .from('secure_conversations')
        .select(`
          id,
          listing_id,
          buyer_id,
          seller_id,
          created_at,
          updated_at
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch listing details and profiles separately to avoid join issues
      const enrichedConversations = await Promise.all((data || []).map(async (convo) => {
        // Get listing info
        const { data: listing } = await supaAdmin
          .from('arena_listings')
          .select('title, images')
          .eq('id', convo.listing_id)
          .single();

        // Get buyer profile
        const { data: buyer } = await supaAdmin
          .from('profiles')
          .select('id, screen_name')
          .eq('id', convo.buyer_id)
          .single();

        // Get seller profile
        const { data: seller } = await supaAdmin
          .from('profiles')
          .select('id, screen_name')
          .eq('id', convo.seller_id)
          .single();

        // Get last message
        const { data: lastMessage } = await supaAdmin
          .from('secure_messages')
          .select('encrypted_content, created_at, sender_id')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get unread count for this user
        const { count: unreadCount } = await supaAdmin
          .from('secure_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', convo.id)
          .neq('sender_id', user.id)
          .eq('read', false);

        return {
          ...convo,
          listing: listing ? {
            item_name: listing.title,
            primary_photo_url: listing.images?.[0] || '/placeholder.svg'
          } : null,
          buyer: buyer || { id: convo.buyer_id, screen_name: 'Unknown' },
          seller: seller || { id: convo.seller_id, screen_name: 'Unknown' },
          last_message: lastMessage || null,
          unread_count: unreadCount || 0,
          is_seller: convo.seller_id === user.id,
        };
      }));

      return res.status(200).json(enrichedConversations);
    }

    if (req.method === 'POST') {
      const { listingId } = req.body;

      if (!listingId) {
        return res.status(400).json({ error: 'listingId is required.' });
      }

      // Get listing from arena_listings
      const { data: listing, error: listingError } = await supaAdmin
        .from('arena_listings')
        .select('seller_id')
        .eq('id', listingId)
        .single();

      if (listingError || !listing) {
        return res.status(404).json({ error: 'Listing not found.' });
      }

      if (listing.seller_id === user.id) {
        return res.status(400).json({ error: 'Cannot start a conversation with yourself.' });
      }

      // Check if conversation already exists
      const { data: existing } = await supaAdmin
        .from('secure_conversations')
        .select('id')
        .eq('listing_id', listingId)
        .eq('buyer_id', user.id)
        .single();

      if (existing) {
        return res.status(200).json(existing);
      }

      // Create new conversation
      const { data, error } = await supaAdmin
        .from('secure_conversations')
        .insert({
          listing_id: listingId,
          buyer_id: user.id,
          seller_id: listing.seller_id
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          const { data: existingConvo } = await supaAdmin
            .from('secure_conversations')
            .select('id')
            .eq('listing_id', listingId)
            .eq('buyer_id', user.id)
            .single();
          return res.status(200).json(existingConvo);
        }
        throw error;
      }

      return res.status(201).json(data);
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