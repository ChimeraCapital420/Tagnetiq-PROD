// FILE: api/seo/feeds/facebook-catalog.ts
// Facebook Product Catalog Feed for Facebook Shops & Instagram Shopping
// Submit to Facebook Commerce Manager

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { SEO_CONFIG, isFeatureEnabled, getDisabledResponse } from '../config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isFeatureEnabled('productFeed')) {
    return getDisabledResponse(res, 'json');
  }

  try {
    const { data: listings, error } = await supabase
      .from('arena_listings')
      .select(`
        id, item_name, description, asking_price, estimated_value,
        category, condition, primary_photo_url, additional_photos,
        is_verified, created_at, updated_at,
        profiles!arena_listings_seller_id_fkey ( screen_name, location_text )
      `)
      .eq('status', 'active')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) throw error;

    // Facebook expects JSON format for dynamic ads
    const products = (listings || []).map(listing => ({
      id: listing.id,
      title: listing.item_name?.slice(0, 150) || 'Item',
      description: (listing.description || listing.item_name || '').slice(0, 5000),
      availability: 'in stock',
      condition: mapCondition(listing.condition),
      price: `${listing.asking_price?.toFixed(2) || '0.00'} USD`,
      link: `${SEO_CONFIG.domain}/marketplace/${listing.id}`,
      image_link: listing.primary_photo_url || `${SEO_CONFIG.domain}/placeholder.svg`,
      additional_image_link: listing.additional_photos?.slice(0, 10) || [],
      brand: 'TagnetIQ Marketplace',
      google_product_category: mapCategory(listing.category),
      custom_label_0: listing.is_verified ? 'Verified' : 'Standard',
      custom_label_1: listing.category || 'Collectibles',
      custom_label_2: listing.profiles?.location_text || 'USA',
      // For dynamic ads retargeting
      item_group_id: listing.category || 'general',
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).json({ products });
  } catch (error: any) {
    console.error('Facebook catalog error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function mapCondition(condition: string): string {
  const map: Record<string, string> = {
    'new': 'new', 'mint': 'new', 'like_new': 'new',
    'excellent': 'refurbished',
    'good': 'used', 'fair': 'used', 'poor': 'used',
  };
  return map[condition?.toLowerCase()] || 'used';
}

function mapCategory(category: string): string {
  const map: Record<string, string> = {
    'coins': '3441', // Collectible Coins
    'trading-cards': '5310', // Trading Cards
    'sports': '888', // Sporting Goods > Memorabilia
    'lego': '3287', // Building Toys
  };
  return map[category?.toLowerCase()] || '220'; // Collectibles
}