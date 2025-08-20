// FILE: api/arena/challenge.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUserIsAdmin(req);
    const { vault_item_id, asking_price } = req.body;

    if (!vault_item_id || !asking_price) {
      return res.status(400).json({ error: 'Missing vault_item_id or asking_price.' });
    }

    // 1. Get the vault item details
    const { data: vaultItem, error: itemError } = await supaAdmin
      .from('vault_items')
      .select('asset_name, owner_valuation, photos')
      .eq('id', vault_item_id)
      .eq('user_id', user.id)
      .single();

    if (itemError || !vaultItem) {
      return res.status(404).json({ error: 'Vault item not found or you do not own it.' });
    }

    // 2. Create the Arena Challenge
    const { data: challenge, error: challengeError } = await supaAdmin
      .from('arena_challenges')
      .insert({
        user_id: user.id,
        vault_item_id,
        purchase_price: vaultItem.owner_valuation || 0,
        status: 'active',
      })
      .select('id')
      .single();

    if (challengeError) throw challengeError;

    // 3. Create the Marketplace Listing
    const { data: listing, error: listingError } = await supaAdmin
      .from('marketplace_listings')
      .insert({
        challenge_id: challenge.id,
        user_id: user.id,
        item_name: vaultItem.asset_name,
        // A real implementation would derive category from the vault item
        item_category: 'General Collectibles',
        purchase_price: vaultItem.owner_valuation || 0,
        asking_price,
        primary_photo_url: vaultItem.photos?.[0] || null,
      })
      .select()
      .single();
    
    if (listingError) throw listingError;

    return res.status(201).json(listing);

  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (message.includes('Authentication') || message.includes('Authorization')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error creating challenge:', message);
    return res.status(500).json({ error: message });
  }
}