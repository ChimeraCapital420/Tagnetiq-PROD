// FILE: api/arena/marketplace.ts
// Marketplace listings endpoint - PUBLIC for browsing
// Supports filtering by seller_id (My Listings), status, category, price

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
  status?: string;
  seller_id?: string;
  page?: number;
  limit?: number;
  include_categories?: boolean;
}

const CACHE_DURATION = 30; // Shorter cache for more real-time data
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Rate limiting
  if (!await rateLimit(req, res, { max: 60, windowMs: 60000 })) {
    return;
  }

  try {
    // Parse query parameters
    const filters: MarketplaceFilters = {
      searchQuery: typeof req.query.searchQuery === 'string' ? req.query.searchQuery.trim() : undefined,
      category: typeof req.query.category === 'string' && req.query.category !== 'all' ? req.query.category.trim() : undefined,
      minPrice: req.query.minPrice ? Math.max(0, Number(req.query.minPrice)) : undefined,
      maxPrice: req.query.maxPrice ? Math.max(0, Number(req.query.maxPrice)) : undefined,
      verified: req.query.verified === 'true',
      sort: typeof req.query.sort === 'string' ? req.query.sort : 'newest',
      status: typeof req.query.status === 'string' ? req.query.status : 'active',
      seller_id: typeof req.query.seller_id === 'string' ? req.query.seller_id : undefined,
      page: Math.max(1, Number(req.query.page) || 1),
      limit: Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT)),
      include_categories: req.query.include_categories === 'true',
    };

    // Validate price range
    if (filters.minPrice && filters.maxPrice && filters.minPrice > filters.maxPrice) {
      return res.status(400).json({ error: 'Minimum price cannot be greater than maximum price.' });
    }

    // Build cache key (exclude seller_id for privacy, they get fresh data)
    const cacheKeyStr = filters.seller_id ? null : cacheKey(
      'marketplace',
      filters.searchQuery,
      filters.category,
      filters.minPrice,
      filters.maxPrice,
      filters.verified,
      filters.sort,
      filters.status,
      filters.page,
      filters.limit
    );
    
    // Check cache (skip for personal listings)
    if (cacheKeyStr) {
      const cached = cache.get(cacheKeyStr);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    // Build query
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
      `, { count: 'exact' });

    // Filter by status
    if (filters.status === 'active') {
      query = query.eq('status', 'active');
    } else if (filters.status === 'sold') {
      query = query.eq('status', 'sold');
    } else if (filters.status === 'all' && filters.seller_id) {
      // For "My Listings", show active and sold, not deleted
      query = query.in('status', ['active', 'sold']);
    } else {
      query = query.eq('status', 'active');
    }

    // Filter by seller (My Listings)
    if (filters.seller_id) {
      query = query.eq('seller_id', filters.seller_id);
    }

    // Search filter
    if (filters.searchQuery) {
      query = query.ilike('title', `%${filters.searchQuery}%`);
    }

    // Category filter
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    // Price filters
    if (filters.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice);
    }

    // Sorting
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

    // Pagination
    const offset = (filters.page! - 1) * filters.limit!;
    query = query.range(offset, offset + filters.limit! - 1);

    // Execute query
    const { data: listings, error, count } = await query;

    if (error) {
      console.error('Marketplace query error:', error);
      throw new Error('Failed to fetch marketplace listings.');
    }

    // Get seller names for listings
    const sellerIds = [...new Set((listings || []).map(l => l.seller_id).filter(Boolean))];
    let sellerMap: Record<string, string> = {};
    
    if (sellerIds.length > 0) {
      const { data: profiles } = await supaAdmin
        .from('profiles')
        .select('id, screen_name')
        .in('id', sellerIds);
      
      if (profiles) {
        sellerMap = profiles.reduce((acc, p) => {
          acc[p.id] = p.screen_name || 'Anonymous';
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Transform listings
    const transformedListings = (listings || []).map(listing => ({
      id: listing.id,
      challenge_id: listing.id,
      item_name: listing.title,
      asking_price: listing.price,
      estimated_value: listing.price,
      primary_photo_url: listing.images?.[0] || '/placeholder.svg',
      additional_photos: listing.images?.slice(1) || [],
      is_verified: false,
      confidence_score: null,
      category: listing.category || 'general',
      condition: listing.condition,
      description: listing.description,
      created_at: listing.created_at,
      updated_at: listing.updated_at,
      seller_id: listing.seller_id,
      seller_name: sellerMap[listing.seller_id] || 'Anonymous',
      status: listing.status,
      views: 0,
      watchlist_count: 0,
      shipping_included: listing.shipping_included,
      accepts_trades: listing.accepts_trades,
      sold_at: listing.sold_at,
      sold_price: listing.sold_price,
    }));

    // Build response
    const response: any = {
      listings: transformedListings,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / filters.limit!)
      }
    };

    // Optionally include dynamic categories
    if (filters.include_categories) {
      const { data: categoryData } = await supaAdmin
        .from('arena_listings')
        .select('category')
        .eq('status', 'active')
        .not('category', 'is', null);
      
      if (categoryData) {
        const categoryCounts = categoryData.reduce((acc, item) => {
          const cat = item.category || 'general';
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        response.categories = Object.entries(categoryCounts)
          .map(([id, count]) => ({ id, count }))
          .sort((a, b) => b.count - a.count);
      }
    }

    // Cache the response (only for non-personal queries)
    if (cacheKeyStr) {
      cache.set(cacheKeyStr, response, CACHE_DURATION);
    }

    // Return legacy format for backward compatibility OR new format
    // Check if caller wants new format
    if (req.query.format === 'v2') {
      return res.status(200).json(response);
    }
    
    // Legacy format - just return array
    return res.status(200).json(transformedListings);

  } catch (error: any) {
    console.error('Error fetching marketplace listings:', error);
    return res.status(500).json({ 
      error: 'Failed to load marketplace',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
}