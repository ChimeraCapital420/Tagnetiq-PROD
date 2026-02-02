// FILE: api/dashboard/spotlight-items.ts
// Personalized Spotlight Items API
// Features: Onboarding interests, Watchlist boost, Hidden items filter, Category filter

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

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

// Map onboarding interests to spotlight categories
const INTEREST_TO_CATEGORY_MAP: Record<string, string[]> = {
  'real-estate': ['real-estate', 'property'],
  'vehicles': ['vehicles', 'cars', 'automotive'],
  'collectibles': ['collectibles', 'memorabilia'],
  'luxury-goods': ['luxury', 'designer', 'watches'],
  'lego': ['lego', 'building-sets'],
  'star-wars': ['star-wars', 'sci-fi'],
  'sports-memorabilia': ['sports', 'memorabilia'],
  'books-media': ['books', 'media', 'comics'],
  'coins-currency': ['coins', 'currency', 'numismatics'],
  'trading-cards': ['trading-cards', 'pokemon', 'sports-cards'],
  'art-antiques': ['art', 'antiques'],
  'electronics': ['electronics', 'gadgets', 'gaming'],
};

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
  };
  onboarding_interests?: string[];
  watchlist_keywords?: string[];
  hidden_item_ids?: string[];
  category_filter?: string;
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

    // Build preferences from query params
    let preferences: SpotlightPreferences = {};

    if (req.method === 'POST' && req.body) {
      preferences = req.body;
    } else {
      // Category filter (single category from chips)
      if (req.query.category_filter) {
        preferences.category_filter = req.query.category_filter as string;
      }
      
      // Multiple categories (from preferences)
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

      // Hidden items
      if (req.query.hidden) {
        preferences.hidden_item_ids = (req.query.hidden as string).split(',');
      }

      // Onboarding interests
      if (req.query.interests) {
        preferences.onboarding_interests = (req.query.interests as string).split(',');
      }

      // Watchlist keywords
      if (req.query.watchlist_keywords) {
        preferences.watchlist_keywords = (req.query.watchlist_keywords as string).split(',');
      }
    }

    // If logged in, fetch user profile data
    if (userId) {
      try {
        // Fetch user's profile with interests and spotlight preferences
        const { data: profile } = await supaAdmin
          .from('profiles')
          .select('interests, spotlight_preferences')
          .eq('id', userId)
          .single();

        if (profile) {
          // Use onboarding interests if not already set
          if (!preferences.onboarding_interests && profile.interests) {
            preferences.onboarding_interests = profile.interests;
          }

          // Use profile spotlight preferences
          if (profile.spotlight_preferences) {
            const profilePrefs = profile.spotlight_preferences as any;
            
            // Merge hidden items
            if (profilePrefs.hidden_item_ids) {
              preferences.hidden_item_ids = [
                ...(preferences.hidden_item_ids || []),
                ...profilePrefs.hidden_item_ids,
              ];
            }
          }
        }

        // Fetch purchase history
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

        // Fetch watchlist if not already provided
        if (!preferences.watchlist_keywords?.length) {
          const { data: watchlists } = await supaAdmin
            .from('watchlists')
            .select('keywords')
            .eq('user_id', userId);

          if (watchlists && watchlists.length > 0) {
            const allKeywords = watchlists.flatMap((w: any) => w.keywords || []);
            preferences.watchlist_keywords = [...new Set(allKeywords)] as string[];
          }
        }
      } catch (e) {
        console.warn('Could not fetch user data:', e);
      }
    }

    // Build query with category filter
    let query = supaAdmin
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
      .order('created_at', { ascending: false });

    // Apply category filter if specified (from chips)
    if (preferences.category_filter && preferences.category_filter !== 'all') {
      // Use ilike for flexible matching
      query = query.ilike('category', `%${preferences.category_filter}%`);
    }

    const { data: listings, error } = await query.limit(Math.min(limit * 4, 60));

    if (error) {
      console.error('Spotlight fetch error:', error);
      throw error;
    }

    if (!listings || listings.length === 0) {
      return res.status(200).json({
        items: [],
        total: 0,
        personalized: false,
        message: 'No active listings available'
      });
    }

    // Filter out hidden items
    const hiddenSet = new Set(preferences.hidden_item_ids || []);
    const visibleListings = listings.filter((l: any) => !hiddenSet.has(l.id));

    if (visibleListings.length === 0) {
      return res.status(200).json({
        items: [],
        total: 0,
        personalized: false,
        message: 'All items hidden'
      });
    }

    // Fetch vault items
    const vaultItemIds = visibleListings
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

    // Fetch seller profiles
    const sellerIds = [...new Set(visibleListings.map((l: any) => l.seller_id))];
    let profilesMap: Record<string, any> = {};
    if (sellerIds.length > 0) {
      const { data: profiles, error: profileError } = await supaAdmin
        .from('profiles')
        .select('id, screen_name, email, location')
        .in('id', sellerIds);

      if (!profileError && profiles) {
        profilesMap = profiles.reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }
    }

    // Build mapped categories from onboarding interests
    const mappedInterestCategories: string[] = [];
    if (preferences.onboarding_interests?.length) {
      preferences.onboarding_interests.forEach(interest => {
        const mapped = INTEREST_TO_CATEGORY_MAP[interest] || [interest];
        mappedInterestCategories.push(...mapped);
      });
    }

    // Transform and score items
    const scoredItems: SpotlightItem[] = visibleListings.map((listing: any) => {
      const vaultItem = vaultItemsMap[listing.vault_item_id];
      const profile = profilesMap[listing.seller_id];

      let relevanceScore = Math.random() * 20;

      const itemCategory = (vaultItem?.category || listing.category || '').toLowerCase();
      const itemName = (vaultItem?.item_name || listing.title || '').toLowerCase();
      const hasShipping = listing.shipping_included === true;

      // ====== CATEGORY SCORING ======

      // Viewed categories (+25)
      if (preferences.viewed_categories?.length && itemCategory) {
        if (preferences.viewed_categories.some(c => itemCategory.includes(c.toLowerCase()))) {
          relevanceScore += 25;
        }
      }

      // Purchase history (+30)
      if (preferences.purchased_categories?.length && itemCategory) {
        if (preferences.purchased_categories.some(c => itemCategory.includes(c.toLowerCase()))) {
          relevanceScore += 30;
        }
      }

      // Onboarding interests (+20)
      if (mappedInterestCategories.length > 0 && itemCategory) {
        if (mappedInterestCategories.some(c => itemCategory.includes(c.toLowerCase()))) {
          relevanceScore += 20;
        }
      }

      // ====== WATCHLIST MATCHING (+35) ======
      if (preferences.watchlist_keywords?.length) {
        const matchedKeywords = preferences.watchlist_keywords.filter(keyword => {
          const kw = keyword.toLowerCase();
          return itemName.includes(kw) || itemCategory.includes(kw);
        });
        
        if (matchedKeywords.length > 0) {
          // More matched keywords = higher score
          relevanceScore += 35 + (matchedKeywords.length * 5);
        }
      }

      // ====== PRICE RANGE (+15) ======
      if (preferences.price_range) {
        const price = listing.price;
        if (price >= preferences.price_range.min && price <= preferences.price_range.max) {
          relevanceScore += 15;
        }
      }

      // ====== QUALITY SIGNALS ======
      if (vaultItem?.is_verified) relevanceScore += 12;
      if (vaultItem?.confidence_score > 0.8) relevanceScore += 8;

      // ====== LOCATION BOOST (+15) ======
      const sellerLocation = profile?.location || listing.location || '';
      if (preferences.location?.state && sellerLocation) {
        const userState = preferences.location.state.toLowerCase();
        if (sellerLocation.toLowerCase().includes(userState)) {
          relevanceScore += 15;
        }
      }

      // ====== SHIPPING (+10) ======
      if (hasShipping) relevanceScore += 10;

      // ====== RECENCY (0-10) ======
      const ageInDays = (Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24);
      relevanceScore += Math.max(0, 10 - ageInDays);

      // ====== GOOD DEAL (+10) ======
      if (vaultItem?.estimated_value && listing.price < vaultItem.estimated_value * 0.85) {
        relevanceScore += 10;
      }

      // ====== PENALTIES ======
      if (preferences.viewed_item_ids?.includes(listing.id)) {
        relevanceScore -= 15;
      }
      if (userId && listing.seller_id === userId) {
        relevanceScore -= 100;
      }

      const primaryImage = vaultItem?.primary_image_url
        || (listing.images && listing.images[0])
        || '/placeholder.svg';

      const sellerName = profile?.screen_name || null;

      return {
        id: vaultItem?.id || listing.vault_item_id || listing.id,
        listing_id: listing.id,
        item_name: vaultItem?.item_name || listing.title || 'Untitled Item',
        asking_price: listing.price,
        estimated_value: vaultItem?.estimated_value,
        primary_photo_url: primaryImage,
        category: vaultItem?.category || listing.category,
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

    // Filter and sort
    const validItems = scoredItems.filter(item => (item.relevance_score || 0) > -50);

    const sortedItems = validItems
      .sort((a, b) => {
        const randomFactor = (Math.random() - 0.5) * 8;
        return (b.relevance_score || 0) - (a.relevance_score || 0) + randomFactor;
      })
      .slice(0, limit);

    const responseItems = sortedItems.map(({ relevance_score, ...item }) => item);

    const isPersonalized = !!(
      preferences.viewed_categories?.length ||
      preferences.purchased_categories?.length ||
      preferences.onboarding_interests?.length ||
      preferences.watchlist_keywords?.length ||
      preferences.price_range ||
      preferences.location
    );

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

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