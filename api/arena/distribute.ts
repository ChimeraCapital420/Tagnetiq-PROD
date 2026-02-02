// FILE: api/arena/distribute.ts
// Unified distribution hub - combines SEO assets with cross-platform posting
// Called after listing creation to maximize visibility

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security';
import { SEO_CONFIG } from '../seo/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Platform configurations
const PLATFORMS = {
  // ===== MARKETPLACE PLATFORMS =====
  ebay: {
    name: 'eBay',
    type: 'marketplace',
    icon: '🛒',
    requiresAuth: true,
    apiAvailable: true,
    manualUrl: (listing: any) => `https://www.ebay.com/sl/sell`,
  },
  mercari: {
    name: 'Mercari',
    type: 'marketplace',
    icon: '🏪',
    requiresAuth: true,
    apiAvailable: false,
    manualUrl: (listing: any) => `https://www.mercari.com/sell/`,
  },
  poshmark: {
    name: 'Poshmark',
    type: 'marketplace',
    icon: '👗',
    requiresAuth: true,
    apiAvailable: false,
    manualUrl: (listing: any) => `https://poshmark.com/create-listing`,
  },
  depop: {
    name: 'Depop',
    type: 'marketplace',
    icon: '🌈',
    requiresAuth: true,
    apiAvailable: false,
    manualUrl: (listing: any) => `https://www.depop.com/sell/`,
  },
  offerup: {
    name: 'OfferUp',
    type: 'marketplace',
    icon: '🏷️',
    requiresAuth: true,
    apiAvailable: false,
    manualUrl: (listing: any) => `https://offerup.com/post`,
  },
  craigslist: {
    name: 'Craigslist',
    type: 'classifieds',
    icon: '📋',
    requiresAuth: false,
    apiAvailable: false,
    manualUrl: (listing: any) => `https://post.craigslist.org/`,
  },
  facebook_marketplace: {
    name: 'Facebook Marketplace',
    type: 'marketplace',
    icon: '📘',
    requiresAuth: true,
    apiAvailable: false,
    manualUrl: (listing: any) => `https://www.facebook.com/marketplace/create/item`,
  },
  
  // ===== COLLECTOR PLATFORMS =====
  whatnot: {
    name: 'Whatnot',
    type: 'collector',
    icon: '🎬',
    requiresAuth: true,
    apiAvailable: false,
    categories: ['trading-cards', 'sports', 'collectibles'],
    manualUrl: (listing: any) => `https://www.whatnot.com/sell`,
  },
  comc: {
    name: 'COMC',
    type: 'collector',
    icon: '🃏',
    requiresAuth: true,
    apiAvailable: true,
    categories: ['trading-cards', 'sports'],
    manualUrl: (listing: any) => `https://www.comc.com/`,
  },
  tcgplayer: {
    name: 'TCGplayer',
    type: 'collector',
    icon: '🎴',
    requiresAuth: true,
    apiAvailable: true,
    categories: ['trading-cards'],
    manualUrl: (listing: any) => `https://store.tcgplayer.com/admin`,
  },
  sportscollectors: {
    name: 'Sports Collectors',
    type: 'collector',
    icon: '🏈',
    requiresAuth: true,
    apiAvailable: false,
    categories: ['sports'],
    manualUrl: (listing: any) => `https://www.sportscollectorsdaily.com/`,
  },
  
  // ===== SOCIAL PLATFORMS =====
  facebook: {
    name: 'Facebook',
    type: 'social',
    icon: '📘',
    requiresAuth: false,
    apiAvailable: false,
    manualUrl: (listing: any) => {
      const url = encodeURIComponent(`${SEO_CONFIG.domain}/marketplace/${listing.id}`);
      const text = encodeURIComponent(`${listing.item_name} - $${listing.asking_price?.toFixed(2)}`);
      return `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`;
    },
  },
  twitter: {
    name: 'Twitter/X',
    type: 'social',
    icon: '🐦',
    requiresAuth: false,
    apiAvailable: false,
    manualUrl: (listing: any) => {
      const url = encodeURIComponent(`${SEO_CONFIG.domain}/marketplace/${listing.id}`);
      const text = encodeURIComponent(`Check out: ${listing.item_name} - $${listing.asking_price?.toFixed(2)}`);
      return `https://twitter.com/intent/tweet?text=${text}&url=${url}&hashtags=TagnetIQ,forsale`;
    },
  },
  instagram: {
    name: 'Instagram',
    type: 'social',
    icon: '📸',
    requiresAuth: true,
    apiAvailable: false,
    manualUrl: (listing: any) => `https://www.instagram.com/`,
  },
  pinterest: {
    name: 'Pinterest',
    type: 'social',
    icon: '📌',
    requiresAuth: false,
    apiAvailable: false,
    manualUrl: (listing: any) => {
      const url = encodeURIComponent(`${SEO_CONFIG.domain}/marketplace/${listing.id}`);
      const img = encodeURIComponent(listing.primary_photo_url || `${SEO_CONFIG.domain}/api/seo/og-image/${listing.id}`);
      const desc = encodeURIComponent(`${listing.item_name} - $${listing.asking_price?.toFixed(2)}`);
      return `https://pinterest.com/pin/create/button/?url=${url}&media=${img}&description=${desc}`;
    },
  },
  tiktok: {
    name: 'TikTok',
    type: 'social',
    icon: '🎵',
    requiresAuth: true,
    apiAvailable: false,
    manualUrl: (listing: any) => `https://www.tiktok.com/`,
  },
  reddit: {
    name: 'Reddit',
    type: 'social',
    icon: '🔴',
    requiresAuth: false,
    apiAvailable: false,
    manualUrl: (listing: any) => {
      const url = encodeURIComponent(`${SEO_CONFIG.domain}/marketplace/${listing.id}`);
      const title = encodeURIComponent(`[FS] ${listing.item_name} - $${listing.asking_price?.toFixed(2)}`);
      return `https://reddit.com/submit?url=${url}&title=${title}`;
    },
    subreddits: {
      'coins': ['r/Coins4Sale', 'r/Pmsforsale'],
      'trading-cards': ['r/pkmntcgtrades', 'r/baseballcards', 'r/footballcards'],
      'sports': ['r/SportsMemorabilia'],
      'lego': ['r/Legomarket'],
      'vinyl': ['r/VinylCollectors'],
    },
  },
  
  // ===== AUCTION PLATFORMS =====
  heritage: {
    name: 'Heritage Auctions',
    type: 'auction',
    icon: '🏛️',
    requiresAuth: true,
    apiAvailable: false,
    categories: ['coins', 'sports', 'art', 'collectibles'],
    minValue: 500,
    manualUrl: (listing: any) => `https://www.ha.com/consign`,
  },
  goldin: {
    name: 'Goldin Auctions',
    type: 'auction',
    icon: '🏆',
    requiresAuth: true,
    apiAvailable: false,
    categories: ['sports', 'trading-cards'],
    minValue: 250,
    manualUrl: (listing: any) => `https://goldin.co/sell`,
  },
  
  // ===== NICHE PLATFORMS =====
  discogs: {
    name: 'Discogs',
    type: 'niche',
    icon: '💿',
    requiresAuth: true,
    apiAvailable: true,
    categories: ['vinyl', 'music'],
    manualUrl: (listing: any) => `https://www.discogs.com/sell/post`,
  },
  reverb: {
    name: 'Reverb',
    type: 'niche',
    icon: '🎸',
    requiresAuth: true,
    apiAvailable: true,
    categories: ['music', 'instruments'],
    manualUrl: (listing: any) => `https://reverb.com/my/selling`,
  },
  grailed: {
    name: 'Grailed',
    type: 'niche',
    icon: '👟',
    requiresAuth: true,
    apiAvailable: false,
    categories: ['sneakers', 'fashion', 'streetwear'],
    manualUrl: (listing: any) => `https://www.grailed.com/sell`,
  },
  stockx: {
    name: 'StockX',
    type: 'niche',
    icon: '📈',
    requiresAuth: true,
    apiAvailable: false,
    categories: ['sneakers', 'streetwear', 'trading-cards'],
    manualUrl: (listing: any) => `https://stockx.com/sell`,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    // Return available platforms
    return res.status(200).json({
      platforms: Object.entries(PLATFORMS).map(([id, config]) => ({
        id,
        ...config,
        manualUrl: undefined, // Don't expose function
      })),
      total: Object.keys(PLATFORMS).length,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify user
  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { listing_id, platforms: selectedPlatforms } = req.body;

  if (!listing_id) {
    return res.status(400).json({ error: 'Missing listing_id' });
  }

  try {
    // Fetch listing
    const { data: listing, error } = await supabase
      .from('arena_listings')
      .select(`
        *,
        profiles!arena_listings_seller_id_fkey ( screen_name, location_text )
      `)
      .eq('id', listing_id)
      .eq('seller_id', user.id)
      .single();

    if (error || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Generate distribution package
    const distributionPackage = generateDistributionPackage(listing, selectedPlatforms);

    // Log distribution attempt
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'listing_distribute',
      resource_type: 'arena_listing',
      resource_id: listing_id,
      details: {
        platforms: selectedPlatforms,
        package_generated: true,
      },
    });

    return res.status(200).json(distributionPackage);
  } catch (error: any) {
    console.error('Distribution error:', error);
    return res.status(500).json({ error: 'Failed to generate distribution package' });
  }
}

function generateDistributionPackage(listing: any, selectedPlatforms?: string[]) {
  const { domain } = SEO_CONFIG;
  const allPlatforms = selectedPlatforms || Object.keys(PLATFORMS);
  
  // Core assets (shared across all platforms)
  const coreAssets = {
    title: listing.item_name,
    description: listing.description || listing.item_name,
    price: listing.asking_price,
    condition: listing.condition,
    category: listing.category,
    images: {
      primary: listing.primary_photo_url,
      additional: listing.additional_photos || [],
      og_image: `${domain}/api/seo/og-image/${listing.id}`,
    },
    links: {
      canonical: `${domain}/marketplace/${listing.id}`,
      short: `${domain}/m/${listing.id}`, // Short URL if you implement it
    },
    seller: {
      name: listing.profiles?.screen_name,
      location: listing.profiles?.location_text,
    },
    verification: {
      is_verified: listing.is_verified,
      badge_url: listing.is_verified ? `${domain}/verified-badge.png` : null,
    },
  };

  // Platform-specific packages
  const platformPackages: Record<string, any> = {};

  for (const platformId of allPlatforms) {
    const platform = PLATFORMS[platformId as keyof typeof PLATFORMS];
    if (!platform) continue;

    // Check category compatibility
    if (platform.categories && !platform.categories.includes(listing.category)) {
      platformPackages[platformId] = {
        ...platform,
        available: false,
        reason: `Not available for ${listing.category} category`,
      };
      continue;
    }

    // Check minimum value for auction houses
    if (platform.minValue && listing.asking_price < platform.minValue) {
      platformPackages[platformId] = {
        ...platform,
        available: false,
        reason: `Minimum value $${platform.minValue} required`,
      };
      continue;
    }

    // Generate platform-specific content
    platformPackages[platformId] = {
      ...platform,
      available: true,
      postUrl: platform.manualUrl(listing),
      optimizedContent: generatePlatformContent(platformId, listing, coreAssets),
      
      // Reddit subreddit suggestions
      ...(platformId === 'reddit' && platform.subreddits && {
        suggestedSubreddits: platform.subreddits[listing.category] || [],
      }),
    };
  }

  // Recommended platforms based on category
  const recommendations = getRecommendedPlatforms(listing.category, listing.asking_price);

  return {
    listing_id: listing.id,
    core_assets: coreAssets,
    platforms: platformPackages,
    recommendations,
    
    // Quick share links (no auth required)
    quick_share: {
      facebook: platformPackages.facebook?.postUrl,
      twitter: platformPackages.twitter?.postUrl,
      pinterest: platformPackages.pinterest?.postUrl,
      reddit: platformPackages.reddit?.postUrl,
      copy_link: coreAssets.links.canonical,
    },
    
    // SEO benefits
    seo_benefits: {
      indexed: true,
      sitemap: `${domain}/sitemap.xml`,
      product_feed: `${domain}/product-feed.xml`,
      og_image: coreAssets.images.og_image,
    },
  };
}

function generatePlatformContent(platformId: string, listing: any, core: any): any {
  const price = listing.asking_price?.toFixed(2) || '0.00';

  switch (platformId) {
    case 'ebay':
      return {
        title: `${listing.item_name}`.slice(0, 80),
        description: `${listing.description}\n\n✓ Listed on TagnetIQ\n${listing.is_verified ? '✓ Authenticity Verified' : ''}`,
        price: listing.asking_price,
        condition: mapEbayCondition(listing.condition),
        category_id: mapEbayCategory(listing.category),
      };

    case 'mercari':
      return {
        title: listing.item_name?.slice(0, 40),
        description: `${listing.description}\n\nAlso listed on TagnetIQ: ${core.links.canonical}`,
        price: listing.asking_price,
      };

    case 'facebook_marketplace':
      return {
        title: listing.item_name,
        price: listing.asking_price,
        description: `${listing.description}\n\n🔗 View full details: ${core.links.canonical}`,
        location: listing.profiles?.location_text,
      };

    case 'reddit':
      return {
        title: `[FS] ${listing.item_name} - $${price} ${listing.is_verified ? '[Verified]' : ''}`,
        body: `**${listing.item_name}**\n\n` +
              `**Price:** $${price}\n\n` +
              `**Condition:** ${listing.condition || 'See photos'}\n\n` +
              `**Description:**\n${listing.description || 'See photos'}\n\n` +
              `**Photos:** ${core.links.canonical}\n\n` +
              `${listing.is_verified ? '✓ Verified authentic on TagnetIQ' : ''}\n\n` +
              `---\n*Listed via [TagnetIQ](${SEO_CONFIG.domain})*`,
      };

    case 'craigslist':
      return {
        title: `${listing.item_name} - $${price}`,
        description: `${listing.description}\n\n` +
                     `Price: $${price}\n` +
                     `Condition: ${listing.condition}\n\n` +
                     `More photos and details: ${core.links.canonical}\n\n` +
                     `${listing.is_verified ? 'Verified authentic' : ''}`,
        price: listing.asking_price,
      };

    case 'twitter':
      return {
        tweet: `🏷️ For Sale: ${listing.item_name}\n` +
               `💰 $${price}\n` +
               `${listing.is_verified ? '✓ Verified\n' : ''}` +
               `\n${core.links.canonical}\n\n` +
               `#TagnetIQ #ForSale #${(listing.category || 'collectibles').replace(/-/g, '')}`,
      };

    default:
      return {
        title: listing.item_name,
        description: listing.description,
        price: listing.asking_price,
        link: core.links.canonical,
      };
  }
}

function getRecommendedPlatforms(category: string, price: number): string[] {
  const recommendations: string[] = [];

  // Always recommend social
  recommendations.push('twitter', 'facebook');

  // Category-specific
  switch (category) {
    case 'coins':
      recommendations.push('ebay', 'heritage', 'reddit');
      break;
    case 'trading-cards':
      recommendations.push('ebay', 'tcgplayer', 'whatnot', 'comc');
      if (price >= 250) recommendations.push('goldin');
      break;
    case 'sports':
      recommendations.push('ebay', 'whatnot', 'sportscollectors');
      if (price >= 500) recommendations.push('heritage', 'goldin');
      break;
    case 'sneakers':
      recommendations.push('stockx', 'grailed', 'ebay', 'mercari');
      break;
    case 'vinyl':
      recommendations.push('discogs', 'ebay', 'reddit');
      break;
    case 'lego':
      recommendations.push('ebay', 'mercari', 'reddit', 'facebook_marketplace');
      break;
    default:
      recommendations.push('ebay', 'mercari', 'facebook_marketplace', 'offerup');
  }

  // High value items
  if (price >= 1000) {
    if (!recommendations.includes('heritage')) recommendations.push('heritage');
  }

  return [...new Set(recommendations)]; // Remove duplicates
}

function mapEbayCondition(condition: string): number {
  const map: Record<string, number> = {
    'new': 1000, 'mint': 1000,
    'like_new': 1500, 'excellent': 1500,
    'good': 3000, 'fair': 4000, 'poor': 5000,
  };
  return map[condition?.toLowerCase()] || 3000;
}

function mapEbayCategory(category: string): string {
  const map: Record<string, string> = {
    'coins': '11116',
    'trading-cards': '183454',
    'sports': '64482',
    'lego': '19006',
    'sneakers': '15709',
    'vinyl': '176985',
  };
  return map[category?.toLowerCase()] || '1';
}