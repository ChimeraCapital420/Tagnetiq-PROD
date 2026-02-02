// FILE: api/dashboard/spotlight-items.ts
// Personalized Spotlight Items API - Pulls from live arena_listings
// Location is a BOOST, not a filter - shipping items always show
// Considers: user preferences, search history, viewed items, location, purchases

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

// Create Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supaAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Auth verification (optional - allows anonymous browsing)
async function verifyUser(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supaAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

interface SpotlightPreferences {
  viewed_categories?: string[];
  viewed_item_ids?: string[];
  search_terms?: string[];
  purchased_categories?: string[];
  price_range?: { min: number; max: number };
  location?: { 
    lat: number; 
    lng: number; 
    city?: string; 
    state?: string;
    country?: string;
  };
}

interface SpotlightItem {
  id: string;
  listing_id: string;
  item_name: string;
  asking_price: number;
  estimated_value?: number;
  primary_photo_url: string;
  category?: string;
  condition?: string;
  is_verified: boolean;
  seller_id: string;
  seller_name?: string;
  seller_location?: string;
  shipping_available?: boolean;
  created_at: string;
  relevance_score?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await verifyUser(req);
    const userId = user?.id;
    
    const limit = Math.min(parseInt(req.query.limit as string) || 15, 30);
    
    // Get preferences from POST body or query params
    let preferences: SpotlightPreferences = {};
    
    if (req.method === 'POST' && req.body) {
      preferences = req.body;
    } else {
      if (req.query.categories) {
        preferences.viewed_categories = (req.query.categories as string).split(',');
      }
      if (req.query.min_price || req.query.max_price) {
        preferences.price_range = {
          min: parseInt(req.query.min_price as string) || 0,
          max: parseInt(req.query.max_price as string) || 100000,
        };
      }
      if (req.query.lat && req.query.lng) {
        preferences.location = {
          lat: parseFloat(req.query.lat as string),
          lng: parseFloat(req.query.lng as string),
          city: req.query.city as string,
          state: req.query.state as string,
        };
      }
    }

    // If logged in, fetch user's purchase history for better personalization
    if (userId) {
      try {
        const { data: purchases } = await supaAdmin
          .from('arena_listings')
          .select('category')
          .eq('buyer_id', userId)
          .eq('status', 'sold')
          .limit(20);
        
        if (purchases && purchases.length > 0) {
          const purchasedCategories = purchases
            .map((p: any) => p.category)
            .filter(Boolean);
          preferences.purchased_categories = [...new Set(purchasedCategories)] as string[];
        }
      } catch (e) {
        console.warn('Could not fetch purchase history:', e);
      }
    }

    // Fetch ACTIVE marketplace listings - simple query first
    const { data: listings, error } = await supaAdmin
      .from('arena_listings')
      .select(`
        id,
        vault_item_id,
        seller_id,
        title,
        description,
        price,
        condition,
        category,
        images,
        status,
        shipping_included,
        location,
        created_at,
        expires_at
      `)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(Math.min(limit * 4, 60));

    if (error) {
      console.error('Spotlight fetch error:', error);
      throw error;
    }

    // If no active listings, return empty array
    if (!listings || listings.length === 0) {
      return res.status(200).json({
        items: [],
        total: 0,
        personalized: false,
        message: 'No active listings available'
      });
    }

    // Fetch vault items for these listings
    const vaultItemIds = listings
      .map((l: any) => l.vault_item_id)
      .filter(Boolean);

    let vaultItemsMap: Record<string, any> = {};
    
    if (vaultItemIds.length > 0) {
      const { data: vaultItems } = await supaAdmin
        .from('vault_items')
        .select('id, item_name, primary_image_url, estimated_value, is_verified, confidence_score, category')
        .in('id', vaultItemIds);
      
      if (vaultItems) {
        vaultItemsMap = vaultItems.reduce((acc: any, item: any) => {
          acc[item.id] = item;
          return acc;
        }, {});
      }
    }

    // Fetch seller profiles - USE CORRECT COLUMN NAMES: screen_name, email
    const sellerIds = [...new Set(listings.map((l: any) => l.seller_id))];
    let profilesMap: Record<string, any> = {};
    
    if (sellerIds.length > 0) {
      const { data: profiles, error: profileError } = await supaAdmin
        .from('profiles')
        .select('id, screen_name, email, location')
        .in('id', sellerIds);
      
      if (profileError) {
        console.warn('Profile fetch error (non-critical):', profileError.message);
      } else if (profiles) {
        profilesMap = profiles.reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }
    }

    // Transform and score items
    const scoredItems: SpotlightItem[] = listings.map((listing: any) => {
      const vaultItem = vaultItemsMap[listing.vault_item_id];
      const profile = profilesMap[listing.seller_id];
      
      // Base random score for variety (0-20)
      let relevanceScore = Math.random() * 20;
      
      const itemCategory = vaultItem?.category || listing.category;
      const hasShipping = listing.shipping_included === true;
      
      // CATEGORY AFFINITY: User has viewed this category (+25 points)
      if (preferences.viewed_categories?.length && itemCategory) {
        if (preferences.viewed_categories.includes(itemCategory)) {
          relevanceScore += 25;
        }
      }
      
      // PURCHASE HISTORY: User has bought this category before (+30 points)
      if (preferences.purchased_categories?.length && itemCategory) {
        if (preferences.purchased_categories.includes(itemCategory)) {
          relevanceScore += 30;
        }
      }
      
      // PRICE RANGE PREFERENCE: Within user's typical range (+15 points)
      if (preferences.price_range) {
        const price = listing.price;
        if (price >= preferences.price_range.min && price <= preferences.price_range.max) {
          relevanceScore += 15;
        }
      }
      
      // VERIFIED ITEMS: Boost verified items (+12 points)
      if (vaultItem?.is_verified) {
        relevanceScore += 12;
      }
      
      // HIGH CONFIDENCE: AI is confident about this item (+8 points)
      if (vaultItem?.confidence_score && vaultItem.confidence_score > 0.8) {
        relevanceScore += 8;
      }
      
      // LOCATION BOOST (not filter!): Same state/region (+15 points)
      const sellerLocation = profile?.location || listing.location || '';
      
      if (preferences.location?.state && sellerLocation) {
        const userState = preferences.location.state.toLowerCase();
        if (sellerLocation.toLowerCase().includes(userState)) {
          relevanceScore += 15; // Local item boost
        }
      }
      
      // SHIPPING AVAILABLE: Boost items that ship (+10 points)
      if (hasShipping) {
        relevanceScore += 10;
      }
      
      // RECENCY: Newer listings get boosted (0-10 points)
      const ageInDays = (Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24);
      relevanceScore += Math.max(0, 10 - ageInDays);
      
      // GOOD DEAL: Price below estimated value (+10 points)
      if (vaultItem?.estimated_value && listing.price < vaultItem.estimated_value * 0.85) {
        relevanceScore += 10;
      }
      
      // EXCLUDE ALREADY VIEWED: Lower priority for items user has seen
      if (preferences.viewed_item_ids?.includes(listing.id)) {
        relevanceScore -= 15;
      }
      
      // EXCLUDE OWN LISTINGS: Don't show user their own items
      if (userId && listing.seller_id === userId) {
        relevanceScore -= 100;
      }

      // Get primary image
      const primaryImage = vaultItem?.primary_image_url 
        || (listing.images && listing.images[0]) 
        || '/placeholder.svg';

      // Get seller display name - USE screen_name (correct column)
      const sellerName = profile?.screen_name || null;

      return {
        id: vaultItem?.id || listing.vault_item_id || listing.id,
        listing_id: listing.id,
        item_name: vaultItem?.item_name || listing.title || 'Untitled Item',
        asking_price: listing.price,
        estimated_value: vaultItem?.estimated_value,
        primary_photo_url: primaryImage,
        category: itemCategory,
        condition: listing.condition,
        is_verified: vaultItem?.is_verified || false,
        seller_id: listing.seller_id,
        seller_name: sellerName,
        seller_location: sellerLocation,
        shipping_available: hasShipping,
        created_at: listing.created_at,
        relevance_score: relevanceScore,
      };
    });

    // Filter out items with very negative scores (own items)
    const validItems = scoredItems.filter(item => (item.relevance_score || 0) > -50);

    // Sort by relevance with slight randomization for variety
    const sortedItems = validItems
      .sort((a, b) => {
        const randomFactor = (Math.random() - 0.5) * 8;
        return (b.relevance_score || 0) - (a.relevance_score || 0) + randomFactor;
      })
      .slice(0, limit);

    // Remove internal score from response
    const responseItems = sortedItems.map(({ relevance_score, ...item }) => item);

    // Determine if results are personalized
    const isPersonalized = !!(
      preferences.viewed_categories?.length ||
      preferences.purchased_categories?.length ||
      preferences.price_range ||
      preferences.location
    );

    // Cache for 2 minutes
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=180');

    return res.status(200).json({
      items: responseItems,
      total: responseItems.length,
      personalized: isPersonalized,
    });

  } catch (error: any) {
    console.error('Spotlight API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch spotlight items',
      details: error.message 
    });
  }
}