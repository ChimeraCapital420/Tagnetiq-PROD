// FILE: api/arena/listings/[id].ts
// Fetch single listing by ID - PUBLIC endpoint

import { supaAdmin } from '../../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Listing ID is required' });
    }

    // Fetch listing with seller profile
    const { data: listing, error } = await supaAdmin
      .from('arena_listings')
      .select(`
        id,
        seller_id,
        vault_item_id,
        title,
        description,
        price,
        condition,
        images,
        shipping_included,
        accepts_trades,
        status,
        created_at,
        expires_at
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Listing fetch error:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Listing not found' });
      }
      throw error;
    }

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Get seller profile separately to avoid join issues
    let sellerName = 'Anonymous';
    let sellerEmail = 'Anonymous Seller';
    
    if (listing.seller_id) {
      const { data: profile } = await supaAdmin
        .from('profiles')
        .select('screen_name, email')
        .eq('id', listing.seller_id)
        .single();
      
      if (profile) {
        sellerName = profile.screen_name || 'Anonymous';
        sellerEmail = profile.email || profile.screen_name || 'Anonymous Seller';
      }
    }

    // Transform to match frontend expectations
    const transformedListing = {
      id: listing.id,
      item_name: listing.title,
      purchase_price: 0,
      asking_price: listing.price,
      primary_photo_url: listing.images?.[0] || '/placeholder.svg',
      additional_photos: listing.images?.slice(1) || [],
      listing_id: listing.id,
      seller_id: listing.seller_id,
      seller_email: sellerEmail,
      seller_name: sellerName,
      possession_verified: false,
      status: listing.status,
      description: listing.description,
      condition: listing.condition,
      shipping_included: listing.shipping_included,
      accepts_trades: listing.accepts_trades,
      created_at: listing.created_at,
      expires_at: listing.expires_at,
    };

    return res.status(200).json(transformedListing);

  } catch (error: any) {
    console.error('Error fetching listing:', error);
    return res.status(500).json({
      error: 'Failed to load listing',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
}