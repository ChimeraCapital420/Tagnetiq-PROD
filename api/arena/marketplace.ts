// FILE: api/arena/marketplace.ts
// STATUS: QUERY PERFORMANCE OPTIMIZED - Fixed for arena_listings schema
// PUBLIC endpoint - no auth required for browsing

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cache, cacheKey } from '../_lib/cache.js';
import { rateLimit } from '../_lib/rateLimit.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

interface MarketplaceFilters {
  searchQuery?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  verified?: boolean;
  sort?: string;
  sortBy?: 'created_at' | 'price' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

const CACHE_DURATION = 60;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Apply rate limiting
  if (!await rateLimit(req, res, { max: 60, windowMs: 60000 })) {
    return;
  }

  try {
    // PUBLIC: No auth required for browsing marketplace

    // Parse and validate query parameters
    const filters: MarketplaceFilters = {
      searchQuery: typeof req.query.searchQuery === 'string' ? req.query.searchQuery.trim() : undefined,
      category: typeof req.query.category === 'string' ? req.query.category.trim() : undefined,
      minPrice: req.query.minPrice ? Math.max(0, Number(req.query.minPrice)) : undefined,
      maxPrice: req.query.maxPrice ? Math.max(0, Number(req.query.maxPrice)) : undefined,
      verified: req.query.verified === 'true',
      sort: typeof req.query.sort === 'string' ? req.query.sort : 'newest',
      sortBy: ['created_at', 'price', 'title'].includes(req.query.sortBy as string) 
        ? req.query.sortBy as MarketplaceFilters['sortBy'] 
        : 'created_at',
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
      page: Math.max(1, Number(req.query.page) || 1),
      limit: Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT)),
    };

    // Validate price range
    if (filters.minPrice && filters.maxPrice && filters.minPrice > filters.maxPrice) {
      return res.status(400).json({ error: 'Minimum price cannot be greater than maximum price.' });
    }

    // Check cache
    const cacheKeyStr = cacheKey(
      'marketplace',
      filters.searchQuery,
      filters.minPrice,
      filters.maxPrice,
      filters.verified,
      filters.sort,
      filters.sortBy,
      filters.sortOrder,
      filters.page,
      filters.limit
    );
    
    const cached = cache.get(cacheKeyStr);
    if (cached) {
      return res.status(200).json(cached);
    }

    // Query arena_listings with CORRECT column names
    let query = supaAdmin
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
      `, { count: 'exact' })
      .eq('status', 'active');

    // Apply search filter on title
    if (filters.searchQuery) {
      query = query.ilike('title', `%${filters.searchQuery}%`);
    }

    // Apply price filters
    if (filters.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice);
    }

    // NOTE: Category filter disabled - arena_listings doesn't have category column
    // Categories in frontend are decorative only until we add category to DB schema
    // Frontend sends category param but we ignore it for now

    // Apply sorting
    switch (filters.sort) {
      case 'price_low':
        query = query.order('price', { ascending: true });
        break;
      case 'price_high':
        query = query.order('price', { ascending: false });
        break;
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Apply pagination
    const offset = (filters.page! - 1) * filters.limit!;
    query = query.range(offset, offset + filters.limit! - 1);

    const { data: listings, error, count } = await query;

    if (error) {
      console.error('Marketplace query error:', error);
      throw new Error('Failed to fetch marketplace listings.');
    }

    // Transform to match frontend expectations
    const transformedListings = (listings || []).map(listing => ({
      id: listing.id,
      challenge_id: listing.id,
      item_name: listing.title,
      asking_price: listing.price,
      estimated_value: listing.price,
      primary_photo_url: listing.images?.[0] || '/placeholder.svg',
      is_verified: false,
      confidence_score: null,
      category: listing.condition,
      condition: listing.condition,
      description: listing.description,
      created_at: listing.created_at,
      seller_id: listing.seller_id,
      seller_name: 'Seller',
      views: 0,
      watchlist_count: 0,
      shipping_included: listing.shipping_included,
      accepts_trades: listing.accepts_trades,
      additional_photos: listing.images?.slice(1) || [],
    }));

    // Cache and return
    cache.set(cacheKeyStr, transformedListings, CACHE_DURATION);
    return res.status(200).json(transformedListings);

  } catch (error: any) {
    console.error('Error fetching marketplace listings:', error);
    return res.status(500).json({ 
      error: 'Failed to load marketplace',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
}