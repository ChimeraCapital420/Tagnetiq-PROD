// FILE: api/arena/marketplace.ts
// STATUS: QUERY PERFORMANCE OPTIMIZED - Pagination + Indexing + Caching

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

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
  sortBy?: 'created_at' | 'asking_price' | 'item_name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

const CACHE_DURATION = 60; // Cache for 60 seconds
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

// Simple in-memory cache for frequently accessed marketplace data
const cache = new Map<string, { data: any; timestamp: number }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyUser(req); // Verify authentication

    // PERFORMANCE: Parse and validate query parameters
    const filters: MarketplaceFilters = {
      searchQuery: typeof req.query.searchQuery === 'string' ? req.query.searchQuery.trim() : undefined,
      category: typeof req.query.category === 'string' ? req.query.category.trim() : undefined,
      minPrice: req.query.minPrice ? Math.max(0, Number(req.query.minPrice)) : undefined,
      maxPrice: req.query.maxPrice ? Math.max(0, Number(req.query.maxPrice)) : undefined,
      verified: req.query.verified === 'true',
      sortBy: ['created_at', 'asking_price', 'item_name'].includes(req.query.sortBy as string) 
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

    // PERFORMANCE: Generate cache key based on filters
    const cacheKey = JSON.stringify(filters);
    const cached = cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION * 1000) {
      return res.status(200).json({
        ...cached.data,
        cached: true,
        cache_age: Math.floor((Date.now() - cached.timestamp) / 1000)
      });
    }

    // PERFORMANCE: Optimized query with proper indexing hints
    let query = supaAdmin
      .from('marketplace_listings')
      .select(`
        id,
        challenge_id,
        item_name,
        item_category,
        asking_price,
        primary_photo_url,
        description,
        created_at,
        challenge:arena_challenges!inner(
          id,
          status,
          possession_verified,
          user_id,
          profiles:user_id(screen_name)
        )
      `)
      // PERFORMANCE: Use inner join and filter for active challenges only
      .eq('challenge.status', 'active');

    // PERFORMANCE: Apply filters with proper indexing
    if (filters.searchQuery) {
      // Use full-text search with proper indexing
      query = query.textSearch('item_name', filters.searchQuery, {
        type: 'websearch',
        config: 'english'
      });
    }

    if (filters.category) {
      query = query.eq('item_category', filters.category);
    }

    if (filters.minPrice !== undefined) {
      query = query.gte('asking_price', filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      query = query.lte('asking_price', filters.maxPrice);
    }

    if (filters.verified) {
      query = query.eq('challenge.possession_verified', true);
    }

    // PERFORMANCE: Apply sorting with index hints
    const sortColumn = filters.sortBy === 'asking_price' ? 'asking_price' : 
                      filters.sortBy === 'item_name' ? 'item_name' : 'created_at';
    query = query.order(sortColumn, { ascending: filters.sortOrder === 'asc' });

    // PERFORMANCE: Implement pagination
    const offset = (filters.page! - 1) * filters.limit!;
    query = query.range(offset, offset + filters.limit! - 1);

    const { data: listings, error, count } = await query;

    if (error) {
      console.error('Marketplace query error:', error);
      throw new Error('Failed to fetch marketplace listings.');
    }

    // PERFORMANCE: Get total count for pagination (only when needed)
    let totalCount = 0;
    if (filters.page === 1) {
      const { count: fullCount, error: countError } = await supaAdmin
        .from('marketplace_listings')
        .select('id', { count: 'exact', head: true })
        .eq('challenge.status', 'active');
      
      if (!countError) {
        totalCount = fullCount || 0;
      }
    }

    // PERFORMANCE: Transform data for optimal frontend consumption
    const transformedListings = listings?.map(listing => ({
      id: listing.id,
      challenge_id: listing.challenge_id,
      item_name: listing.item_name,
      item_category: listing.item_category,
      asking_price: listing.asking_price,
      primary_photo_url: listing.primary_photo_url,
      description: listing.description,
      created_at: listing.created_at,
      seller_name: listing.challenge?.profiles?.screen_name || 'Anonymous',
      is_verified: listing.challenge?.possession_verified || false,
    })) || [];

    const response = {
      listings: transformedListings,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: totalCount,
        totalPages: totalCount > 0 ? Math.ceil(totalCount / filters.limit!) : 0,
        hasNext: transformedListings.length === filters.limit,
        hasPrev: filters.page! > 1,
      },
      filters: filters,
      timestamp: new Date().toISOString(),
    };

    // PERFORMANCE: Cache the response
    cache.set(cacheKey, { data: response, timestamp: Date.now() });

    // PERFORMANCE: Clean old cache entries periodically
    if (cache.size > 100) {
      const cutoff = Date.now() - (CACHE_DURATION * 2 * 1000);
      for (const [key, value] of cache.entries()) {
        if (value.timestamp < cutoff) {
          cache.delete(key);
        }
      }
    }

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('Error fetching marketplace listings:', error);
    const message = error.message || 'An internal server error occurred.';
    
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    
    return res.status(500).json({ 
      error: 'Failed to load marketplace',
      details: process.env.NODE_ENV === 'development' ? message : 'Please try again later'
    });
  }
}

/* 
REQUIRED DATABASE INDEXES - Add these to your Supabase SQL editor:

-- Composite index for active marketplace listings
CREATE INDEX IF NOT EXISTS idx_marketplace_active_challenges 
ON marketplace_listings (asking_price DESC, created_at DESC) 
WHERE EXISTS (
  SELECT 1 FROM arena_challenges 
  WHERE arena_challenges.id = marketplace_listings.challenge_id 
  AND arena_challenges.status = 'active'
);

-- Full-text search index for item names
CREATE INDEX IF NOT EXISTS idx_marketplace_item_name_fts 
ON marketplace_listings 
USING gin(to_tsvector('english', item_name));

-- Category filtering index
CREATE INDEX IF NOT EXISTS idx_marketplace_category 
ON marketplace_listings (item_category, created_at DESC);

-- Price range filtering index
CREATE INDEX IF NOT EXISTS idx_marketplace_price_range 
ON marketplace_listings (asking_price, created_at DESC);
*/