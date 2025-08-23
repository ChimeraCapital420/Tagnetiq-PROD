// FILE: api/arena/conversations.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security'; // CORRECTED: Use standard user verification

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req); // SECURITY: Verify user authentication

    if (req.method === 'GET') {
      const { data, error } = await supaAdmin
        .from('secure_conversations')
        .select(`
          *,
          listing:marketplace_listings(item_name, primary_photo_url),
          buyer:profiles(id, screen_name),
          seller:profiles(id, screen_name)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { listingId } = req.body;
      if (!listingId) {
        return res.status(400).json({ error: 'listingId is required.' });
      }

      const { data: listing, error: listingError } = await supaAdmin
        .from('marketplace_listings')
        .select('user_id')
        .eq('id', listingId)
        .single();

      if (listingError || !listing) return res.status(404).json({ error: 'Listing not found.' });
      if (listing.user_id === user.id) return res.status(400).json({ error: 'Cannot start a conversation with yourself.' });

      const { data, error } = await supaAdmin
        .from('secure_conversations')
        .insert({
          listing_id: listingId,
          buyer_id: user.id,
          seller_id: listing.user_id
        })
        .select()
        .single();
      
      if (error) {
        // Handle case where conversation already exists
        if (error.code === '23505') { // unique_violation
            const { data: existing } = await supaAdmin.from('secure_conversations').select('id').eq('listing_id', listingId).eq('buyer_id', user.id).single();
            return res.status(200).json(existing);
        }
        throw error;
      }
      return res.status(201).json(data);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) return res.status(401).json({ error: message });
    console.error('Error in conversations handler:', message);
    return res.status(500).json({ error: message });
  }
}