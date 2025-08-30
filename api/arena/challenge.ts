// FILE: api/arena/challenge.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req); // SECURITY: Verify user authentication remains.
    
    // HEPHAESTUS NOTE: All required data is now received directly from the frontend.
    const { 
      vault_item_id, 
      asking_price, 
      purchase_price, 
      item_name, 
      primary_photo_url, 
      description 
    } = req.body;

    if (!vault_item_id || !asking_price || purchase_price === undefined || !item_name) {
      return res.status(400).json({ error: 'Missing required fields to start a challenge.' });
    }

    // HEPHAESTUS NOTE: The unnecessary database lookup for vaultItem has been removed for efficiency.

    // 1. Create the Arena Challenge
    const { data: challenge, error: challengeError } = await supaAdmin
      .from('arena_challenges')
      .insert({
        user_id: user.id,
        vault_item_id,
        purchase_price: purchase_price, // Using the price from the modal.
        status: 'active',
      })
      .select('id')
      .single();

    if (challengeError) {
      // If this fails, we don't proceed.
      console.error("Error creating arena_challenges record:", challengeError);
      throw challengeError;
    }

    // 2. Create the Marketplace Listing
    const { data: listing, error: listingError } = await supaAdmin
      .from('marketplace_listings')
      .insert({
        challenge_id: challenge.id,
        user_id: user.id,
        item_name: item_name, // Using item_name from the frontend.
        item_category: 'General Collectibles', // Placeholder as in original file.
        purchase_price: purchase_price, // Storing purchase price on listing as well.
        asking_price,
        primary_photo_url: primary_photo_url, // Using photo url from the frontend.
        description: description // Adding description from frontend
      })
      .select()
      .single();
    
    if (listingError) {
      // If the listing fails, we must roll back the challenge creation to prevent orphaned data.
      console.error("Error creating marketplace_listings record, rolling back:", listingError);
      await supaAdmin.from('arena_challenges').delete().eq('id', challenge.id);
      throw listingError;
    }

    return res.status(201).json(listing);

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    console.error('Error creating challenge:', message);
    return res.status(500).json({ error: message });
  }
}