// FILE: api/partner/listing/[id].ts
// Partner API - Get single listing by ID
// Full listing details including seller info

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://tagnetiq.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate API key
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      docs: `${DOMAIN}/docs/api`,
    });
  }

  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const { data: partner } = await supabase
    .from('api_keys')
    .select('id, tier')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();

  if (!partner) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Listing ID required' });
  }

  try {
    const { data: listing, error } = await supabase
      .from('arena_listings')
      .select(`
        id, item_name, description, asking_price, estimated_value,
        category, condition, primary_photo_url, additional_photos,
        is_verified, hydra_analysis, created_at, updated_at,
        profiles!arena_listings_seller_id_fkey (
          id, screen_name, location_text, is_verified, avatar_url
        )
      `)
      .eq('id', id)
      .eq('status', 'active')
      .eq('is_public', true)
      .single();

    if (error || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Log API access
    await supabase.from('api_logs').insert({
      partner_id: partner.id,
      endpoint: `/partner/listing/${id}`,
      result_count: 1,
      created_at: new Date().toISOString(),
    });

    res.setHeader('Cache-Control', 'public, s-maxage=60');

    return res.status(200).json({
      success: true,
      data: {
        id: listing.id,
        title: listing.item_name,
        description: listing.description,
        price: {
          asking: listing.asking_price,
          estimated: listing.estimated_value,
          currency: 'USD',
          discount: listing.estimated_value > listing.asking_price
            ? Math.round((1 - listing.asking_price / listing.estimated_value) * 100)
            : null,
        },
        category: listing.category,
        condition: listing.condition,
        images: {
          primary: listing.primary_photo_url,
          additional: listing.additional_photos || [],
          count: (listing.additional_photos?.length || 0) + (listing.primary_photo_url ? 1 : 0),
        },
        verification: {
          is_verified: listing.is_verified,
          analysis: listing.hydra_analysis ? {
            confidence: listing.hydra_analysis.confidence,
            identification: listing.hydra_analysis.identification,
          } : null,
        },
        seller: listing.profiles ? {
          id: listing.profiles.id,
          name: listing.profiles.screen_name,
          location: listing.profiles.location_text,
          verified: listing.profiles.is_verified,
          avatar: listing.profiles.avatar_url,
        } : null,
        urls: {
          listing: `${DOMAIN}/marketplace/${listing.id}`,
          checkout: `${DOMAIN}/marketplace/${listing.id}?action=buy`,
          message: `${DOMAIN}/marketplace/${listing.id}?action=message`,
        },
        timestamps: {
          created: listing.created_at,
          updated: listing.updated_at,
        },
      },
      meta: {
        api_version: '1.0',
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Partner API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}