// FILE: api/arena/fulfill-ghost.ts
// Ghost Protocol - Fulfillment Completion API
// Captures verified sale data and updates analytics for investor metrics
// Feeds: HYDRA Accuracy, Arbitrage Spread, Platform Intelligence, Scout Economics
//
// v9.4 FIX: .catch() → .then(ok, err) on PostgrestBuilder calls

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// =============================================================================
// VALIDATION
// =============================================================================

const FulfillmentSchema = z.object({
  listing_id: z.string().uuid(),
  
  // Sale Details
  sale_platform: z.enum([
    'tagnetiq', 'ebay', 'facebook', 'mercari', 'poshmark', 
    'offerup', 'craigslist', 'depop', 'etsy', 'whatnot', 
    'hibid', 'local_cash', 'other'
  ]),
  sale_price: z.number().positive(),
  actual_cost: z.number().min(0),
  platform_fees: z.number().min(0).default(0),
  
  // Shipping
  shipping_cost: z.number().min(0).default(0),
  shipping_carrier: z.enum([
    'usps', 'ups', 'fedex', 'dhl', 'pirateship', 'local_pickup', 'other'
  ]),
  tracking_number: z.string().min(1),
  
  // Optional
  proof_url: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
});

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  const token = authHeader.substring(7);

  // Initialize Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Validate request body
    const validationResult = FulfillmentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: validationResult.error.flatten() 
      });
    }
    
    const data = validationResult.data;
    const now = new Date().toISOString();

    // =======================================================================
    // 1. Fetch the ghost listing
    // =======================================================================
    
    const { data: listing, error: fetchError } = await supabase
      .from('arena_listings')
      .select('*')
      .eq('id', data.listing_id)
      .eq('seller_id', user.id)
      .eq('is_ghost', true)
      .single();
    
    if (fetchError || !listing) {
      return res.status(404).json({ error: 'Ghost listing not found' });
    }
    
    if (listing.status === 'fulfilled') {
      return res.status(400).json({ error: 'Listing already fulfilled' });
    }

    // =======================================================================
    // 2. Calculate final metrics
    // =======================================================================
    
    const ghostData = listing.metadata?.ghost_data || {};
    const shelfPrice = ghostData.shelf_price || 0;
    const listedPrice = listing.price || 0;
    const estimatedMargin = ghostData.estimated_margin || (listedPrice - shelfPrice);
    
    // Actual financials
    const grossProfit = data.sale_price - data.actual_cost;
    const netProfit = grossProfit - data.platform_fees - data.shipping_cost;
    const actualMargin = netProfit;
    const marginPercent = data.actual_cost > 0 ? (netProfit / data.actual_cost) * 100 : 0;
    
    // HYDRA accuracy
    const hydraAccuracyDiff = netProfit - estimatedMargin;
    const hydraAccuracyPercent = estimatedMargin !== 0 
      ? Math.abs(1 - (hydraAccuracyDiff / estimatedMargin)) * 100 
      : 100;
    
    // Time metrics
    const listedAt = new Date(listing.created_at);
    const soldAt = listing.sold_at ? new Date(listing.sold_at) : new Date();
    const fulfilledAt = new Date();
    
    const listToSaleHours = (soldAt.getTime() - listedAt.getTime()) / (1000 * 60 * 60);
    const saleToFulfillHours = (fulfilledAt.getTime() - soldAt.getTime()) / (1000 * 60 * 60);

    // =======================================================================
    // 3. Update the listing status
    // =======================================================================
    
    const { error: updateError } = await supabase
      .from('arena_listings')
      .update({
        status: 'fulfilled',
        fulfilled_at: now,
        metadata: {
          ...listing.metadata,
          fulfillment: {
            sale_platform: data.sale_platform,
            sale_price: data.sale_price,
            actual_cost: data.actual_cost,
            platform_fees: data.platform_fees,
            shipping_cost: data.shipping_cost,
            shipping_carrier: data.shipping_carrier,
            tracking_number: data.tracking_number,
            proof_url: data.proof_url,
            notes: data.notes,
            net_profit: netProfit,
            margin_percent: marginPercent,
            hydra_accuracy_percent: hydraAccuracyPercent,
            fulfilled_at: now,
          },
        },
      })
      .eq('id', data.listing_id);
    
    if (updateError) {
      console.error('Failed to update listing:', updateError);
      return res.status(500).json({ error: 'Failed to update listing' });
    }

    // =======================================================================
    // 4. Update ghost_analytics with actual data
    // =======================================================================
    
    const { error: analyticsError } = await supabase
      .from('ghost_analytics')
      .update({
        // Actual pricing
        sold_price: data.sale_price,
        actual_cost: data.actual_cost,
        actual_margin: actualMargin,
        
        // Platform data
        sale_platform: data.sale_platform,
        platform_fees: data.platform_fees,
        shipping_cost: data.shipping_cost,
        shipping_carrier: data.shipping_carrier,
        
        // Time metrics
        list_to_sale_hours: Math.round(listToSaleHours),
        sale_to_fulfill_hours: Math.round(saleToFulfillHours),
        
        // Status
        status: 'fulfilled',
        fulfilled_at: now,
        
        // HYDRA feedback
        hydra_accuracy_percent: hydraAccuracyPercent,
        hydra_accuracy_diff: hydraAccuracyDiff,
      })
      .eq('listing_id', data.listing_id);
    
    if (analyticsError) {
      console.error('Failed to update analytics:', analyticsError);
      // Non-fatal, continue
    }

    // =======================================================================
    // 5. Record platform intelligence
    // v9.4 FIX: .then(ok, err) instead of .catch()
    // =======================================================================
    
    await supabase.from('platform_sales').insert({
      user_id: user.id,
      listing_id: data.listing_id,
      platform: data.sale_platform,
      sale_price: data.sale_price,
      platform_fees: data.platform_fees,
      net_after_fees: data.sale_price - data.platform_fees,
      category: listing.category_id,
      sold_at: soldAt.toISOString(),
      fulfilled_at: now,
    }).then(() => {}, () => {
      // Table might not exist yet, non-fatal
    });

    // =======================================================================
    // 6. Update scout stats (for Scout Economics KPI)
    // v9.4 FIX: .then(ok, err) instead of .catch()
    // =======================================================================
    
    await supabase.rpc('increment_scout_stats', {
      p_user_id: user.id,
      p_profit: netProfit,
      p_sale_count: 1,
      p_ghost_count: 1,
    }).then(() => {}, () => {
      // RPC might not exist yet, non-fatal
    });

    // =======================================================================
    // 7. Create audit log
    // v9.4 FIX: .then(ok, err) instead of .catch()
    // =======================================================================
    
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'ghost_fulfilled',
      resource_type: 'arena_listing',
      resource_id: data.listing_id,
      metadata: {
        sale_platform: data.sale_platform,
        sale_price: data.sale_price,
        net_profit: netProfit,
        hydra_accuracy: hydraAccuracyPercent,
      },
    }).then(() => {}, () => {});

    // =======================================================================
    // RESPONSE
    // =======================================================================
    
    return res.status(200).json({
      success: true,
      listing_id: data.listing_id,
      metrics: {
        sale_price: data.sale_price,
        actual_cost: data.actual_cost,
        platform_fees: data.platform_fees,
        shipping_cost: data.shipping_cost,
        gross_profit: grossProfit,
        net_profit: netProfit,
        margin_percent: marginPercent,
        hydra_estimated: estimatedMargin,
        hydra_accuracy_percent: hydraAccuracyPercent,
        list_to_sale_hours: Math.round(listToSaleHours),
        sale_to_fulfill_hours: Math.round(saleToFulfillHours),
      },
      message: `Ghost hunt complete! Net profit: $${netProfit.toFixed(2)}`,
    });

  } catch (error) {
    console.error('Fulfillment error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
}