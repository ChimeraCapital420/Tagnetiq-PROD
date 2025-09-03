// FILE: api/arena/listings.ts
// Create arena listing endpoint - REPLACE YOUR EXISTING FILE WITH THIS

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin';
import { verifyUser } from '../_lib/security';
import { z } from 'zod';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

const createListingSchema = z.object({
  vault_item_id: z.string().uuid(),
  title: z.string().min(5).max(100),
  description: z.string().min(20).max(2000),
  price: z.number().min(0.01),
  condition: z.enum(['mint', 'near-mint', 'excellent', 'good', 'fair', 'poor']),
  images: z.array(z.string().url()).min(1).max(10),
  shipping_included: z.boolean(),
  accepts_trades: z.boolean()
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use your existing verifyUser helper for consistent auth
    const user = await verifyUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = createListingSchema.parse(req.body);
    
    // Verify ownership of vault item
    const { data: vaultItem, error: vaultError } = await supaAdmin
      .from('vault_items')
      .select('user_id')
      .eq('id', validatedData.vault_item_id)
      .single();

    if (vaultError || !vaultItem || vaultItem.user_id !== user.id) {
      return res.status(403).json({ error: 'You do not own this vault item' });
    }

    // Check if item is already listed
    const { data: existingListing } = await supaAdmin
      .from('arena_listings')
      .select('id')
      .eq('vault_item_id', validatedData.vault_item_id)
      .eq('status', 'active')
      .single();

    if (existingListing) {
      return res.status(409).json({ error: 'Item is already listed' });
    }

    // Create listing
    const { data: listing, error: createError } = await supaAdmin
      .from('arena_listings')
      .insert({
        seller_id: user.id,
        vault_item_id: validatedData.vault_item_id,
        title: validatedData.title,
        description: validatedData.description,
        price: validatedData.price,
        condition: validatedData.condition,
        images: validatedData.images,
        shipping_included: validatedData.shipping_included,
        accepts_trades: validatedData.accepts_trades,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      })
      .select()
      .single();

    if (createError) throw createError;

    // Update vault item to reflect listing status
    await supaAdmin
      .from('vault_items')
      .update({ 
        is_listed: true,
        listed_at: new Date().toISOString()
      })
      .eq('id', validatedData.vault_item_id);

    // Create price history entry
    await supaAdmin
      .from('listing_price_history')
      .insert({
        listing_id: listing.id,
        price: validatedData.price
      });

    // Log the action for audit trail
    await supaAdmin
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'arena_listing_created',
        resource_type: 'arena_listing',
        resource_id: listing.id,
        metadata: {
          vault_item_id: validatedData.vault_item_id,
          price: validatedData.price
        }
      });

    res.status(201).json(listing);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid listing data', 
        details: error.errors 
      });
    }
    console.error('Error creating listing:', error);
    res.status(500).json({ 
      error: 'Failed to create listing',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}