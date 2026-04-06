// FILE: api/arena/listings.ts
// Create arena listing endpoint with Ghost Protocol support
// UPDATED: Handles ghost listings with location data and handling time
//
// v2.1 CHANGES — Hardening Sprint #7 + #4:
//   - #7: total_listings counter incremented atomically after successful
//         listing creation. Only fires on NEW listings — not edits or re-lists.
//         Fire-and-forget: counter failure never blocks the listing response.
//   - #4: Input validation hardening on getListings — status, limit, and
//         offset query params are now validated/sanitized before DB use.
//         limit capped at 100, offset floor at 0, status checked against enum.
//
// v2.2 CHANGES — War Room Audit:
//   - GET: UUID validation on seller_id filter to prevent filter manipulation.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin.js';
import { verifyUser } from '../_lib/security.js';
import { z } from 'zod';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

// UUID v4 format validation — prevents injection via query param filters
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// #4: Allowed status values for getListings — prevents arbitrary DB filter injection
const ALLOWED_LISTING_STATUSES = ['active', 'sold', 'expired', 'draft', 'cancelled'] as const;

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
    const user = await verifyUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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
      listingData.expires_at = validatedData.ghost_data.timer.expires_at;
      listingData.is_ghost = true;
      listingData.handling_time_hours = validatedData.ghost_data.timer.handling_hours;
      listingData.metadata = { ghost_data: validatedData.ghost_data };
      listingData.location_lat = validatedData.ghost_data.location.lat;
      listingData.location_lng = validatedData.ghost_data.location.lng;
      listingData.location_text = validatedData.ghost_data.store.name;
      listingData.offers_local_pickup = false;
    } else {
      listingData.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      listingData.vault_item_id = validatedData.vault_item_id;
      listingData.is_ghost = false;
      listingData.handling_time_hours = 24;
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

    // =========================================================================
    // HARDENING SPRINT #7 — total_listings counter
    //
    // Fires ONLY on new listing creation — not edits or re-lists.
    // Uses Supabase RPC for atomic increment (no read-modify-write race).
    // Fire-and-forget: counter failure never blocks the listing response.
    //
    // SQL to create the RPC if it doesn't exist:
    //   CREATE OR REPLACE FUNCTION increment_total_listings(p_user_id uuid)
    //   RETURNS void AS $$
    //     UPDATE profiles SET total_listings = COALESCE(total_listings, 0) + 1
    //     WHERE id = p_user_id;
    //   $$ LANGUAGE sql SECURITY DEFINER;
    // =========================================================================
    supaAdmin
      .rpc('increment_total_listings', { p_user_id: user.id })
      .then(() => {
        console.log(`[Trust] total_listings incremented for user: ${user.id}`);
      })
      .catch((err: any) => {
        // Off by 1 is acceptable — never block or surface to user
        console.warn('[Trust] total_listings increment failed (non-fatal):', err?.message);
      });
    // =========================================================================

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
      limit: limitRaw = '20',
      offset: offsetRaw = '0',
    } = req.query;

    // #4: Validate and sanitize query params before use in DB query
    if (status && !ALLOWED_LISTING_STATUSES.includes(status as any)) {
      return res.status(400).json({
        error: 'Invalid status value',
        allowed: ALLOWED_LISTING_STATUSES,
      });
    }

    // v2.2: Validate seller_id is a UUID if provided — prevents filter manipulation
    if (seller_id && typeof seller_id === 'string' && !UUID_REGEX.test(seller_id)) {
      return res.status(400).json({ error: 'Invalid seller_id format.' });
    }

    // #4: Clamp limit (1–100) and floor offset at 0
    const limitNum = Math.min(Math.max(parseInt(limitRaw as string, 10) || 20, 1), 100);
    const offsetNum = Math.max(parseInt(offsetRaw as string, 10) || 0, 0);

    let query = supaAdmin
      .from('arena_listings')
      .select('*', { count: 'exact' });

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
      query = query.eq('status', 'active');
    }
    
    if (category) {
      query = query.eq('category', category);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return res.status(200).json({
      listings: data,
      total: count,
      limit: limitNum,
      offset: offsetNum,
    });

  } catch (error) {
    console.error('❌ Error fetching listings:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch listings',
    });
  }
}