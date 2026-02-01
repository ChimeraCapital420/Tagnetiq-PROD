// FILE: api/arena/listings/[id].ts
// Single listing endpoint - GET, PATCH, DELETE
// GET is PUBLIC, PATCH/DELETE require ownership

import { supaAdmin } from '../../_lib/supaAdmin.js';
import { verifyUser } from '../../_lib/security.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Listing ID is required' });
  }

  // Route by method
  switch (req.method) {
    case 'GET':
      return handleGet(id, res);
    case 'PATCH':
      return handlePatch(req, res, id);
    case 'DELETE':
      return handleDelete(req, res, id);
    default:
      return res.status(405).json({ error: 'Method Not Allowed' });
  }
}

// =============================================================================
// GET - Public endpoint to fetch single listing
// =============================================================================
async function handleGet(id: string, res: VercelResponse) {
  try {
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
        category,
        images,
        shipping_included,
        accepts_trades,
        status,
        created_at,
        updated_at,
        expires_at,
        sold_at,
        sold_price
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

    // Get seller profile
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

    // Transform response
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
      category: listing.category,
      shipping_included: listing.shipping_included,
      accepts_trades: listing.accepts_trades,
      created_at: listing.created_at,
      updated_at: listing.updated_at,
      expires_at: listing.expires_at,
      sold_at: listing.sold_at,
      sold_price: listing.sold_price,
    };

    return res.status(200).json(transformedListing);

  } catch (error: any) {
    console.error('Error fetching listing:', error);
    return res.status(500).json({
      error: 'Failed to load listing',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// =============================================================================
// PATCH - Update listing (requires ownership)
// Actions: mark_sold, update_price, update_details, reactivate
// =============================================================================
async function handlePatch(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    // Verify user authentication
    const user = await verifyUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch listing to verify ownership
    const { data: listing, error: fetchError } = await supaAdmin
      .from('arena_listings')
      .select('seller_id, status, price')
      .eq('id', id)
      .single();

    if (fetchError || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.seller_id !== user.id) {
      return res.status(403).json({ error: 'You do not own this listing' });
    }

    const body = req.body || {};
    const { action, price, title, description, sold_price } = body;

    let updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    // Handle different actions
    switch (action) {
      case 'mark_sold':
        if (listing.status !== 'active') {
          return res.status(400).json({ error: 'Only active listings can be marked as sold' });
        }
        updateData.status = 'sold';
        updateData.sold_at = new Date().toISOString();
        updateData.sold_price = sold_price || listing.price;
        break;

      case 'reactivate':
        if (listing.status === 'active') {
          return res.status(400).json({ error: 'Listing is already active' });
        }
        if (listing.status === 'deleted') {
          return res.status(400).json({ error: 'Deleted listings cannot be reactivated' });
        }
        updateData.status = 'active';
        updateData.sold_at = null;
        updateData.sold_price = null;
        updateData.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        break;

      case 'update_price':
        if (typeof price !== 'number' || price <= 0) {
          return res.status(400).json({ error: 'Valid price is required' });
        }
        updateData.price = price;
        
        // Log price change for history
        await supaAdmin.from('listing_price_history').insert({
          listing_id: id,
          price: price,
          changed_at: new Date().toISOString()
        }).catch(() => {}); // Non-critical, don't fail if table doesn't exist
        break;

      case 'update_details':
        if (title) updateData.title = title.substring(0, 100);
        if (description) updateData.description = description.substring(0, 2000);
        if (typeof price === 'number' && price > 0) updateData.price = price;
        break;

      default:
        // Direct field updates (for simple cases)
        if (typeof price === 'number' && price > 0) updateData.price = price;
        if (title) updateData.title = title.substring(0, 100);
        if (description) updateData.description = description.substring(0, 2000);
    }

    // Perform update
    const { data: updatedListing, error: updateError } = await supaAdmin
      .from('arena_listings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    // Update vault item if marked as sold
    if (action === 'mark_sold' && updatedListing.vault_item_id) {
      await supaAdmin
        .from('vault_items')
        .update({ 
          is_listed: false,
          sold_at: new Date().toISOString(),
          sold_price: updateData.sold_price
        })
        .eq('id', updatedListing.vault_item_id)
        .catch(() => {}); // Non-critical
    }

    // Audit log
    await supaAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: `listing_${action || 'updated'}`,
      resource_type: 'arena_listing',
      resource_id: id,
      metadata: { changes: updateData }
    }).catch(() => {}); // Non-critical

    return res.status(200).json({
      success: true,
      listing: updatedListing,
      message: action === 'mark_sold' 
        ? 'Listing marked as sold!' 
        : 'Listing updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating listing:', error);
    return res.status(500).json({
      error: 'Failed to update listing',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// =============================================================================
// DELETE - Soft delete listing (requires ownership)
// =============================================================================
async function handleDelete(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    // Verify user authentication
    const user = await verifyUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch listing to verify ownership
    const { data: listing, error: fetchError } = await supaAdmin
      .from('arena_listings')
      .select('seller_id, vault_item_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.seller_id !== user.id) {
      return res.status(403).json({ error: 'You do not own this listing' });
    }

    if (listing.status === 'deleted') {
      return res.status(400).json({ error: 'Listing is already deleted' });
    }

    // Soft delete - set status to 'deleted'
    const { error: deleteError } = await supaAdmin
      .from('arena_listings')
      .update({ 
        status: 'deleted',
        updated_at: new Date().toISOString(),
        deleted_at: new Date().toISOString()
      })
      .eq('id', id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw deleteError;
    }

    // Update vault item to reflect unlisted status
    if (listing.vault_item_id) {
      await supaAdmin
        .from('vault_items')
        .update({ is_listed: false })
        .eq('id', listing.vault_item_id)
        .catch(() => {}); // Non-critical
    }

    // Audit log
    await supaAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'listing_deleted',
      resource_type: 'arena_listing',
      resource_id: id
    }).catch(() => {}); // Non-critical

    return res.status(200).json({
      success: true,
      message: 'Listing deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting listing:', error);
    return res.status(500).json({
      error: 'Failed to delete listing',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}