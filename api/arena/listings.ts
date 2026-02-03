// FILE: api/arena/listings.ts
// Create arena listing endpoint with Ghost Protocol support
// UPDATED: Handles ghost listings with location data and handling time

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin.js';
import { verifyUser } from '../_lib/security.js';
import { z } from 'zod';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const ghostDataSchema = z.object({
  is_ghost: z.literal(true),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number(),
    captured_at: z.string(),
    address: z.string().optional(),
  }),
  store: z.object({
    type: z.string(),
    name: z.string().min(1),
    address: z.string().optional(),
    aisle: z.string().optional(),
    shelf_price: z.number().min(0),
    notes: z.string().optional(),
    hours: z.string().optional(),
  }),
  timer: z.object({
    created_at: z.string(),
    expires_at: z.string(),
    handling_hours: z.number().min(24).max(168), // 1-7 days
  }),
  kpis: z.object({
    scan_to_toggle_ms: z.number(),
    estimated_margin: z.number(),
    velocity_score: z.enum(['low', 'medium', 'high']),
  }),
});

const createListingSchema = z.object({
  vault_item_id: z.string().uuid().optional(), // Optional for ghost listings
  title: z.string().min(5).max(100),
  description: z.string().min(20).max(2000),
  price: z.number().min(0.01),
  condition: z.enum(['mint', 'near-mint', 'excellent', 'good', 'fair', 'poor']),
  images: z.array(z.string()).min(1).max(10),
  shipping_included: z.boolean().optional().default(true),
  accepts_trades: z.boolean().optional().default(false),
  category: z.string().optional(),
  
  // Ghost Protocol fields
  is_ghost: z.boolean().optional().default(false),
  ghost_data: ghostDataSchema.optional(),
  handling_time_hours: z.number().min(24).max(168).optional(),
  
  // Location fields (for non-ghost or general use)
  location_text: z.string().optional(),
  location_lat: z.number().optional(),
  location_lng: z.number().optional(),
  offers_shipping: z.boolean().optional().default(true),
  offers_local_pickup: z.boolean().optional().default(true),
});

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Route to appropriate handler
  switch (req.method) {
    case 'POST':
      return createListing(req, res);
    case 'GET':
      return getListings(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// =============================================================================
// CREATE LISTING
// =============================================================================

async function createListing(req: VercelRequest, res: VercelResponse) {
  try {
    // Authenticate user
    const user = await verifyUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request body
    const validatedData = createListingSchema.parse(req.body);
    const isGhostListing = validatedData.is_ghost && !!validatedData.ghost_data;
    
    console.log(`📝 Creating ${isGhostListing ? 'ghost' : 'standard'} listing:`, validatedData.title);

    // For non-ghost listings, verify vault item ownership
    if (!isGhostListing && validatedData.vault_item_id) {
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
    }

    // Build listing data
    const listingData: any = {
      seller_id: user.id,
      title: validatedData.title,
      description: validatedData.description,
      price: validatedData.price,
      condition: validatedData.condition,
      images: validatedData.images,
      shipping_included: validatedData.shipping_included,
      accepts_trades: validatedData.accepts_trades,
      category: validatedData.category || 'general',
      status: 'active',
      offers_shipping: validatedData.offers_shipping,
      offers_local_pickup: validatedData.offers_local_pickup,
    };

    // Set expiration
    if (isGhostListing && validatedData.ghost_data) {
      // Ghost listings use the timer from ghost_data
      listingData.expires_at = validatedData.ghost_data.timer.expires_at;
      listingData.is_ghost = true;
      listingData.handling_time_hours = validatedData.ghost_data.timer.handling_hours;
      
      // Store ghost data in metadata
      listingData.metadata = {
        ghost_data: validatedData.ghost_data,
      };
      
      // Use ghost location
      listingData.location_lat = validatedData.ghost_data.location.lat;
      listingData.location_lng = validatedData.ghost_data.location.lng;
      listingData.location_text = validatedData.ghost_data.store.name;
      
      // Ghost listings default to shipping only
      listingData.offers_local_pickup = false;
      
    } else {
      // Standard listing - 30 days expiration
      listingData.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      listingData.vault_item_id = validatedData.vault_item_id;
      listingData.is_ghost = false;
      listingData.handling_time_hours = 24; // Standard 1-day handling
      
      // Use provided location if any
      if (validatedData.location_text) {
        listingData.location_text = validatedData.location_text;
      }
      if (validatedData.location_lat && validatedData.location_lng) {
        listingData.location_lat = validatedData.location_lat;
        listingData.location_lng = validatedData.location_lng;
      }
    }

    // Create listing
    const { data: listing, error: createError } = await supaAdmin
      .from('arena_listings')
      .insert(listingData)
      .select()
      .single();

    if (createError) {
      console.error('❌ Listing creation error:', createError);
      throw createError;
    }

    console.log(`✅ Listing created: ${listing.id}`);

    // For standard listings, update vault item status
    if (!isGhostListing && validatedData.vault_item_id) {
      await supaAdmin
        .from('vault_items')
        .update({ 
          status: 'listed',
          status_details: { listing_id: listing.id, listed_at: new Date().toISOString() },
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', validatedData.vault_item_id);
    }

    // Create price history entry
    await supaAdmin
      .from('listing_price_history')
      .insert({
        listing_id: listing.id,
        price: validatedData.price,
      });

    // Log the action for audit trail
    await supaAdmin
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: isGhostListing ? 'ghost_listing_created' : 'arena_listing_created',
        resource_type: 'arena_listing',
        resource_id: listing.id,
        metadata: {
          vault_item_id: validatedData.vault_item_id || null,
          price: validatedData.price,
          is_ghost: isGhostListing,
          ghost_store: isGhostListing ? validatedData.ghost_data?.store.name : null,
        },
      });

    return res.status(201).json({
      success: true,
      listing,
      isGhost: isGhostListing,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid listing data', 
        details: error.errors,
      });
    }
    
    console.error('❌ Error creating listing:', error);
    return res.status(500).json({ 
      error: 'Failed to create listing',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}

// =============================================================================
// GET LISTINGS
// =============================================================================

async function getListings(req: VercelRequest, res: VercelResponse) {
  try {
    const { 
      seller_id,
      is_ghost,
      status,
      category,
      limit = '20',
      offset = '0',
    } = req.query;

    let query = supaAdmin
      .from('arena_listings')
      .select('*', { count: 'exact' });

    // Filters
    if (seller_id) {
      query = query.eq('seller_id', seller_id);
    }
    
    if (is_ghost === 'true') {
      query = query.eq('is_ghost', true);
    } else if (is_ghost === 'false') {
      query = query.eq('is_ghost', false);
    }
    
    if (status) {
      query = query.eq('status', status);
    } else {
      // Default to active listings
      query = query.eq('status', 'active');
    }
    
    if (category) {
      query = query.eq('category', category);
    }

    // Pagination
    query = query
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return res.status(200).json({
      listings: data,
      total: count,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

  } catch (error) {
    console.error('❌ Error fetching listings:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch listings',
    });
  }
}