// FILE: api/partner/listings.ts
// Partner API - Public listings endpoint for third-party integrations
// Requires API key, rate limited, returns paginated listings

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://tagnetiq.com';

// Rate limits per tier
const RATE_LIMITS = {
  free: { requests_per_day: 100, listings_per_request: 20 },
  basic: { requests_per_day: 1000, listings_per_request: 50 },
  pro: { requests_per_day: 10000, listings_per_request: 100 },
  enterprise: { requests_per_day: 100000, listings_per_request: 500 },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for partner domains
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

  const partner = await validateApiKey(apiKey);
  if (!partner) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Check rate limit
  const rateLimitResult = await checkRateLimit(partner);
  if (!rateLimitResult.allowed) {
    res.setHeader('X-RateLimit-Limit', rateLimitResult.limit.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', rateLimitResult.reset.toString());
    return res.status(429).json({
      error: 'Rate limit exceeded',
      limit: rateLimitResult.limit,
      reset: rateLimitResult.reset,
    });
  }

  // Parse query parameters
  const {
    page = '1',
    limit = '20',
    category,
    min_price,
    max_price,
    condition,
    verified_only,
    sort = 'created_at',
    order = 'desc',
    search,
    seller_id,
    since,
    fields,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(
    parseInt(limit as string) || 20,
    RATE_LIMITS[partner.tier as keyof typeof RATE_LIMITS].listings_per_request
  );
  const offset = (pageNum - 1) * limitNum;

  try {
    // Build query
    let query = supabase
      .from('arena_listings')
      .select(`
        id, item_name, description, asking_price, estimated_value,
        category, condition, primary_photo_url, additional_photos,
        is_verified, created_at, updated_at,
        profiles!arena_listings_seller_id_fkey (
          id, screen_name, location_text, is_verified
        )
      `, { count: 'exact' })
      .eq('status', 'active')
      .eq('is_public', true);

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }

    if (min_price) {
      query = query.gte('asking_price', parseFloat(min_price as string));
    }

    if (max_price) {
      query = query.lte('asking_price', parseFloat(max_price as string));
    }

    if (condition) {
      query = query.eq('condition', condition);
    }

    if (verified_only === 'true') {
      query = query.eq('is_verified', true);
    }

    if (seller_id) {
      query = query.eq('seller_id', seller_id);
    }

    if (since) {
      query = query.gte('created_at', since);
    }

    if (search) {
      query = query.ilike('item_name', `%${search}%`);
    }

    // Apply sorting
    const validSorts = ['created_at', 'asking_price', 'updated_at'];
    const sortField = validSorts.includes(sort as string) ? sort as string : 'created_at';
    const sortOrder = order === 'asc' ? true : false;
    query = query.order(sortField, { ascending: sortOrder });

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data: listings, count, error } = await query;

    if (error) throw error;

    // Format response
    const formattedListings = (listings || []).map(listing => formatListing(listing, fields as string));

    // Log API usage
    await logApiUsage(partner.id, req.url || '', listings?.length || 0);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimitResult.limit.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    res.setHeader('X-RateLimit-Reset', rateLimitResult.reset.toString());
    res.setHeader('Cache-Control', 'public, s-maxage=60');

    return res.status(200).json({
      success: true,
      data: formattedListings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limitNum),
        has_more: offset + limitNum < (count || 0),
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

// Validate API key and return partner info
async function validateApiKey(apiKey: string): Promise<any> {
  // Hash the API key for lookup
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const { data: partner, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();

  if (error || !partner) return null;

  return partner;
}

// Check and update rate limit
async function checkRateLimit(partner: any): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const tier = partner.tier || 'free';
  const limits = RATE_LIMITS[tier as keyof typeof RATE_LIMITS];
  const today = new Date().toISOString().split('T')[0];

  // Get today's usage
  const { data: usage } = await supabase
    .from('api_usage')
    .select('request_count')
    .eq('partner_id', partner.id)
    .eq('date', today)
    .single();

  const currentCount = usage?.request_count || 0;
  const remaining = Math.max(0, limits.requests_per_day - currentCount - 1);
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);

  if (currentCount >= limits.requests_per_day) {
    return {
      allowed: false,
      limit: limits.requests_per_day,
      remaining: 0,
      reset: Math.floor(reset.getTime() / 1000),
    };
  }

  // Increment usage
  await supabase.from('api_usage').upsert({
    partner_id: partner.id,
    date: today,
    request_count: currentCount + 1,
  }, { onConflict: 'partner_id,date' });

  return {
    allowed: true,
    limit: limits.requests_per_day,
    remaining,
    reset: Math.floor(reset.getTime() / 1000),
  };
}

// Log API usage for analytics
async function logApiUsage(partnerId: string, endpoint: string, resultCount: number): Promise<void> {
  await supabase.from('api_logs').insert({
    partner_id: partnerId,
    endpoint,
    result_count: resultCount,
    created_at: new Date().toISOString(),
  });
}

// Format listing for API response
function formatListing(listing: any, fields?: string): any {
  const formatted: any = {
    id: listing.id,
    title: listing.item_name,
    description: listing.description,
    price: {
      asking: listing.asking_price,
      estimated: listing.estimated_value,
      currency: 'USD',
    },
    category: listing.category,
    condition: listing.condition,
    images: {
      primary: listing.primary_photo_url,
      additional: listing.additional_photos || [],
    },
    verified: listing.is_verified,
    seller: listing.profiles ? {
      id: listing.profiles.id,
      name: listing.profiles.screen_name,
      location: listing.profiles.location_text,
      verified: listing.profiles.is_verified,
    } : null,
    urls: {
      listing: `${DOMAIN}/marketplace/${listing.id}`,
      api: `${DOMAIN}/api/partner/listing/${listing.id}`,
    },
    timestamps: {
      created: listing.created_at,
      updated: listing.updated_at,
    },
  };

  // Filter fields if specified
  if (fields) {
    const requestedFields = fields.split(',').map(f => f.trim());
    const filtered: any = { id: formatted.id };
    
    for (const field of requestedFields) {
      if (formatted[field] !== undefined) {
        filtered[field] = formatted[field];
      }
    }
    
    return filtered;
  }

  return formatted;
}