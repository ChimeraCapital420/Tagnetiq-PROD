// FILE: api/arena/challenge.ts
// STATUS: PERFORMANCE OPTIMIZED - Transaction-based with comprehensive validation

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

export const config = {
  runtime: 'nodejs', // Changed from edge to nodejs for transaction support
  maxDuration: 30,
};

interface ChallengeRequest {
  vault_item_id: string;
  asking_price: number;
  purchase_price: number;
  item_name: string;
  primary_photo_url?: string;
  description?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const body = req.body as ChallengeRequest;

    // PERFORMANCE: Comprehensive validation upfront to prevent failed transactions
    const validationErrors: string[] = [];
    
    if (!body.vault_item_id || typeof body.vault_item_id !== 'string') {
      validationErrors.push('vault_item_id is required and must be a string');
    }
    
    if (!body.item_name || typeof body.item_name !== 'string' || body.item_name.trim().length === 0) {
      validationErrors.push('item_name is required and cannot be empty');
    } else if (body.item_name.length > 200) {
      validationErrors.push('item_name cannot exceed 200 characters');
    }
    
    if (typeof body.asking_price !== 'number' || body.asking_price <= 0 || body.asking_price > 99999999) {
      validationErrors.push('asking_price must be a positive number up to 99,999,999');
    }
    
    if (typeof body.purchase_price !== 'number' || body.purchase_price < 0 || body.purchase_price > 99999999) {
      validationErrors.push('purchase_price must be a non-negative number up to 99,999,999');
    }
    
    if (body.description && body.description.length > 2000) {
      validationErrors.push('description cannot exceed 2,000 characters');
    }
    
    if (body.primary_photo_url && body.primary_photo_url.length > 2000) {
      validationErrors.push('primary_photo_url cannot exceed 2,000 characters');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }

    // SECURITY: Pre-verify vault item ownership and that it's not already in a challenge
    const { data: vaultItem, error: vaultError } = await supaAdmin
      .from('vault_items')
      .select(`
        id, 
        user_id, 
        asset_name,
        arena_challenges!inner(id, status)
      `)
      .eq('id', body.vault_item_id)
      .single();

    if (vaultError || !vaultItem) {
      return res.status(404).json({ error: 'Vault item not found.' });
    }

    if (vaultItem.user_id !== user.id) {
      return res.status(403).json({ error: 'You do not own this vault item.' });
    }

    // Check if item is already in an active challenge
    const activeChallenge = vaultItem.arena_challenges?.find((c: any) => c.status === 'active');
    if (activeChallenge) {
      return res.status(409).json({ error: 'This item is already in an active challenge.' });
    }

    // PERFORMANCE: Use database transaction for atomicity
    const { data: transactionResult, error: transactionError } = await supaAdmin.rpc(
      'create_arena_challenge_transaction',
      {
        p_user_id: user.id,
        p_vault_item_id: body.vault_item_id,
        p_purchase_price: body.purchase_price,
        p_asking_price: body.asking_price,
        p_item_name: body.item_name.trim(),
        p_primary_photo_url: body.primary_photo_url || null,
        p_description: body.description?.trim() || null,
        p_item_category: 'General Collectibles' // Default category
      }
    );

    if (transactionError) {
      console.error('Arena challenge transaction failed:', transactionError);
      
      // Provide user-friendly error messages for known issues
      if (transactionError.message?.includes('duplicate')) {
        return res.status(409).json({ error: 'A challenge for this item already exists.' });
      }
      
      return res.status(500).json({ 
        error: 'Failed to create arena challenge',
        details: process.env.NODE_ENV === 'development' ? transactionError.message : 'Internal server error'
      });
    }

    if (!transactionResult || transactionResult.length === 0) {
      return res.status(500).json({ error: 'Challenge creation failed - no data returned.' });
    }

    // Return the marketplace listing data (which includes challenge_id)
    const listing = transactionResult[0];
    
    return res.status(201).json({
      ...listing,
      success: true,
      message: 'Challenge created successfully!'
    });

  } catch (error: any) {
    console.error('Error creating arena challenge:', error);
    const message = error.message || 'An unexpected error occurred.';
    
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? message : 'Please try again later'
    });
  }
}

/* 
REQUIRED DATABASE FUNCTION - Add this to your Supabase SQL editor:

CREATE OR REPLACE FUNCTION create_arena_challenge_transaction(
  p_user_id UUID,
  p_vault_item_id UUID,
  p_purchase_price DECIMAL,
  p_asking_price DECIMAL,
  p_item_name TEXT,
  p_primary_photo_url TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_item_category TEXT DEFAULT 'General Collectibles'
)
RETURNS TABLE(
  id UUID,
  challenge_id UUID,
  user_id UUID,
  item_name TEXT,
  asking_price DECIMAL,
  primary_photo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_challenge_id UUID;
  v_listing_id UUID;
BEGIN
  -- Create arena challenge
  INSERT INTO arena_challenges (user_id, vault_item_id, purchase_price, status, created_at, updated_at)
  VALUES (p_user_id, p_vault_item_id, p_purchase_price, 'active', NOW(), NOW())
  RETURNING arena_challenges.id INTO v_challenge_id;
  
  -- Create marketplace listing
  INSERT INTO marketplace_listings (
    challenge_id, user_id, item_name, item_category, 
    purchase_price, asking_price, primary_photo_url, description,
    created_at, updated_at
  )
  VALUES (
    v_challenge_id, p_user_id, p_item_name, p_item_category,
    p_purchase_price, p_asking_price, p_primary_photo_url, p_description,
    NOW(), NOW()
  )
  RETURNING marketplace_listings.id INTO v_listing_id;
  
  -- Return the created listing with challenge reference
  RETURN QUERY
  SELECT 
    v_listing_id as id,
    v_challenge_id as challenge_id,
    p_user_id as user_id,
    p_item_name as item_name,
    p_asking_price as asking_price,
    p_primary_photo_url as primary_photo_url,
    p_description as description,
    NOW() as created_at;
END;
$$;
*/