// FILE: api/arena/forums.ts
// Universal Resale Community Integration
// Covers the ENTIRE $400B resale market - not just collectibles
// Mobile-first: One-tap copy optimized content

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://tagnetiq.com';

// ============================================================================
// UNIVERSAL RESALE COMMUNITIES - ALL CATEGORIES
// ============================================================================

const COMMUNITIES: Record<string, CommunityConfig> = {
  // =========================================================================
  // 📱 ELECTRONICS & TECH
  // =========================================================================
  'hardwareswap_reddit': {
    name: 'r/hardwareswap',
    url: 'https://reddit.com/r/hardwareswap',
    categories: ['electronics', 'computers', 'phones', 'gaming', 'tech'],
    type: 'reddit',
    rules: {
      titleFormat: '[USA-{state}] [H] {title} [W] ${price} PayPal/Local',
      requiresTimestamp: true,
      requiresLocation: true,
      flairRequired: true,
    },
    icon: '💻',
    volume: 'high',
  },
  'appleswap_reddit': {
    name: 'r/appleswap',
    url: 'https://reddit.com/r/appleswap',
    categories: ['electronics', 'phones', 'computers', 'apple'],
    type: 'reddit',
    rules: {
      titleFormat: '[USA-{state}] [H] {title} [W] ${price}',
      requiresTimestamp: true,
      requiresLocation: true,
    },
    icon: '🍎',
    volume: 'high',
  },
  'phoneswap_reddit': {
    name: 'r/phoneswap',
    url: 'https://reddit.com/r/phoneswap',
    categories: ['phones', 'electronics'],
    type: 'reddit',
    rules: {
      titleFormat: '[USA-{state}] [H] {title} [W] ${price}',
      requiresTimestamp: true,
    },
    icon: '📱',
    volume: 'medium',
  },
  'gamesale_reddit': {
    name: 'r/GameSale',
    url: 'https://reddit.com/r/GameSale',
    categories: ['gaming', 'video-games', 'consoles'],
    type: 'reddit',
    rules: {
      titleFormat: '[USA-{state}] [H] {title} [W] ${price} PayPal',
      requiresTimestamp: true,
    },
    icon: '🎮',
    volume: 'high',
  },
  'avexchange_reddit': {
    name: 'r/AVexchange',
    url: 'https://reddit.com/r/AVexchange',
    categories: ['audio', 'electronics', 'headphones'],
    type: 'reddit',
    rules: {
      titleFormat: '[WTS] [USA-{state}] {title} - ${price}',
      requiresTimestamp: true,
    },
    icon: '🎧',
    volume: 'medium',
  },
  'photomarket_reddit': {
    name: 'r/photomarket',
    url: 'https://reddit.com/r/photomarket',
    categories: ['cameras', 'photography', 'electronics'],
    type: 'reddit',
    rules: {
      titleFormat: '[S] [USA-{state}] {title} - ${price}',
      requiresTimestamp: true,
    },
    icon: '📷',
    volume: 'medium',
  },
  'homelabsales_reddit': {
    name: 'r/homelabsales',
    url: 'https://reddit.com/r/homelabsales',
    categories: ['electronics', 'computers', 'servers', 'networking'],
    type: 'reddit',
    rules: {
      titleFormat: '[FS][USA-{state}] {title} - ${price}',
      requiresTimestamp: true,
    },
    icon: '🖥️',
    volume: 'medium',
  },
  'swappa': {
    name: 'Swappa',
    url: 'https://swappa.com/sell',
    categories: ['phones', 'electronics', 'computers', 'gaming'],
    type: 'marketplace',
    rules: {
      titleFormat: '{title}',
      requiresImages: true,
      requiresESN: true,
    },
    icon: '📲',
    volume: 'high',
  },

  // =========================================================================
  // 👗 FASHION & CLOTHING
  // =========================================================================
  'malefashionmarket_reddit': {
    name: 'r/MaleFashionMarket',
    url: 'https://reddit.com/r/MaleFashionMarket',
    categories: ['fashion', 'clothing', 'menswear'],
    type: 'reddit',
    rules: {
      titleFormat: '[SELL] {title} - ${price}',
      requiresImages: true,
    },
    icon: '👔',
    volume: 'medium',
  },
  'wardrobepurge_reddit': {
    name: 'r/wardrobepurge',
    url: 'https://reddit.com/r/wardrobepurge',
    categories: ['fashion', 'clothing', 'womens-fashion'],
    type: 'reddit',
    rules: {
      titleFormat: '[SELL] {title} - ${price}',
      requiresImages: true,
    },
    icon: '👗',
    volume: 'medium',
  },
  'frugalmalefashion_bst': {
    name: 'r/FrugalMaleFashion B/S/T',
    url: 'https://reddit.com/r/FrugalMaleFashion',
    categories: ['fashion', 'clothing', 'menswear'],
    type: 'reddit',
    rules: {
      titleFormat: '[WTS] {title} - ${price}',
    },
    icon: '💰',
    volume: 'high',
  },
  'sneakermarket_reddit': {
    name: 'r/sneakermarket',
    url: 'https://reddit.com/r/sneakermarket',
    categories: ['sneakers', 'shoes', 'fashion'],
    type: 'reddit',
    rules: {
      titleFormat: '[WTS] {title} Size {size} - ${price}',
      requiresTimestamp: true,
      requiresSize: true,
    },
    icon: '👟',
    volume: 'high',
  },
  'grailed': {
    name: 'Grailed',
    url: 'https://www.grailed.com/sell',
    categories: ['fashion', 'clothing', 'streetwear', 'designer'],
    type: 'marketplace',
    rules: {
      titleFormat: '{brand} {title}',
      requiresImages: true,
      requiresBrand: true,
    },
    icon: '🏷️',
    volume: 'high',
  },
  'therealreal': {
    name: 'The RealReal',
    url: 'https://www.therealreal.com/consign',
    categories: ['fashion', 'luxury', 'designer', 'watches', 'jewelry'],
    type: 'consignment',
    rules: {
      titleFormat: '{brand} {title}',
      minValue: 50,
      luxuryOnly: true,
    },
    icon: '💎',
    volume: 'high',
  },

  // =========================================================================
  // 🏠 HOME & FURNITURE
  // =========================================================================
  'fb_marketplace': {
    name: 'Facebook Marketplace',
    url: 'https://www.facebook.com/marketplace/create/item',
    categories: ['all', 'furniture', 'home', 'appliances', 'local'],
    type: 'marketplace',
    rules: {
      titleFormat: '{title}',
      requiresImages: true,
      localOnly: true,
    },
    icon: '📘',
    volume: 'highest',
  },
  'offerup': {
    name: 'OfferUp',
    url: 'https://offerup.com/post',
    categories: ['all', 'furniture', 'home', 'appliances', 'local'],
    type: 'marketplace',
    rules: {
      titleFormat: '{title}',
      requiresImages: true,
      localOnly: true,
    },
    icon: '🏷️',
    volume: 'high',
  },
  'craigslist': {
    name: 'Craigslist',
    url: 'https://post.craigslist.org/',
    categories: ['all', 'furniture', 'home', 'appliances', 'vehicles', 'local'],
    type: 'classifieds',
    rules: {
      titleFormat: '{title} - ${price}',
      requiresImages: true,
      localOnly: true,
    },
    icon: '📋',
    volume: 'high',
  },
  'nextdoor': {
    name: 'Nextdoor',
    url: 'https://nextdoor.com/for_sale_and_free/',
    categories: ['all', 'furniture', 'home', 'local'],
    type: 'local',
    rules: {
      titleFormat: '{title}',
      localOnly: true,
      neighborhoodOnly: true,
    },
    icon: '🏘️',
    volume: 'medium',
  },
  'aptdeco': {
    name: 'AptDeco',
    url: 'https://www.aptdeco.com/sell',
    categories: ['furniture', 'home'],
    type: 'consignment',
    rules: {
      titleFormat: '{brand} {title}',
      requiresImages: true,
      furnitureOnly: true,
    },
    icon: '🛋️',
    volume: 'medium',
  },
  'chairish': {
    name: 'Chairish',
    url: 'https://www.chairish.com/sell',
    categories: ['furniture', 'home', 'vintage', 'antiques'],
    type: 'marketplace',
    rules: {
      titleFormat: '{era} {title}',
      requiresImages: true,
      curatedOnly: true,
    },
    icon: '🪑',
    volume: 'medium',
  },

  // =========================================================================
  // 🚗 VEHICLES & AUTO PARTS
  // =========================================================================
  'cars_and_bids': {
    name: 'Cars & Bids',
    url: 'https://carsandbids.com/sell',
    categories: ['vehicles', 'cars', 'automotive'],
    type: 'auction',
    rules: {
      titleFormat: '{year} {make} {model}',
      requiresVIN: true,
      enthusiastCars: true,
    },
    icon: '🚗',
    volume: 'medium',
  },
  'bringatrailer': {
    name: 'Bring a Trailer',
    url: 'https://bringatrailer.com/sell-your-car/',
    categories: ['vehicles', 'cars', 'vintage', 'automotive'],
    type: 'auction',
    rules: {
      titleFormat: '{year} {make} {model}',
      requiresVIN: true,
      curatedOnly: true,
    },
    icon: '🏎️',
    volume: 'medium',
  },
  'car_parts_reddit': {
    name: 'r/car_parts',
    url: 'https://reddit.com/r/car_parts',
    categories: ['automotive', 'car-parts'],
    type: 'reddit',
    rules: {
      titleFormat: '[FS] {title} - ${price} + shipping',
    },
    icon: '🔧',
    volume: 'low',
  },
  'motorcycle_reddit': {
    name: 'r/motorcyclesforsale',
    url: 'https://reddit.com/r/motorcyclesforsale',
    categories: ['vehicles', 'motorcycles'],
    type: 'reddit',
    rules: {
      titleFormat: '{year} {title} - ${price} [{state}]',
    },
    icon: '🏍️',
    volume: 'low',
  },

  // =========================================================================
  // 🎸 MUSIC & INSTRUMENTS
  // =========================================================================
  'reverb': {
    name: 'Reverb',
    url: 'https://reverb.com/sell',
    categories: ['instruments', 'music', 'audio', 'guitars'],
    type: 'marketplace',
    rules: {
      titleFormat: '{brand} {title}',
      requiresImages: true,
    },
    icon: '🎸',
    volume: 'high',
  },
  'gear4sale_reddit': {
    name: 'r/Gear4Sale',
    url: 'https://reddit.com/r/Gear4Sale',
    categories: ['instruments', 'music', 'audio'],
    type: 'reddit',
    rules: {
      titleFormat: 'WTS: {title} - ${price}',
      requiresLocation: true,
    },
    icon: '🎹',
    volume: 'medium',
  },
  'discogs': {
    name: 'Discogs',
    url: 'https://www.discogs.com/sell/list',
    categories: ['vinyl', 'music', 'records'],
    type: 'marketplace',
    rules: {
      titleFormat: '{artist} - {title}',
      requiresGrading: true,
    },
    icon: '💿',
    volume: 'high',
  },
  'vinylcollectors_reddit': {
    name: 'r/VinylCollectors',
    url: 'https://reddit.com/r/VinylCollectors',
    categories: ['vinyl', 'records', 'music'],
    type: 'reddit',
    rules: {
      titleFormat: '[For Sale] {title} - ${price}',
      requiresGrading: true,
    },
    icon: '🎵',
    volume: 'medium',
  },

  // =========================================================================
  // 🧸 TOYS & HOBBIES
  // =========================================================================
  'toyexchange_reddit': {
    name: 'r/toyexchange',
    url: 'https://reddit.com/r/toyexchange',
    categories: ['toys', 'action-figures', 'collectibles'],
    type: 'reddit',
    rules: {
      titleFormat: '[H] {title} [W] ${price}',
      requiresTimestamp: true,
    },
    icon: '🧸',
    volume: 'medium',
  },
  'legomarket_reddit': {
    name: 'r/Legomarket',
    url: 'https://reddit.com/r/Legomarket',
    categories: ['lego', 'toys'],
    type: 'reddit',
    rules: {
      titleFormat: '[US-{state}] [H] {title} [W] ${price}',
      requiresTimestamp: true,
    },
    icon: '🧱',
    volume: 'medium',
  },
  'bricklink': {
    name: 'BrickLink',
    url: 'https://www.bricklink.com/v2/wanted/store.page',
    categories: ['lego'],
    type: 'marketplace',
    rules: {
      titleFormat: '{set_number} {title}',
      requiresSetNumber: true,
    },
    icon: '🟡',
    volume: 'high',
  },
  'miniswap_reddit': {
    name: 'r/miniswap',
    url: 'https://reddit.com/r/miniswap',
    categories: ['miniatures', 'warhammer', 'tabletop'],
    type: 'reddit',
    rules: {
      titleFormat: '[H] {title} [W] ${price} [Loc] USA',
      requiresTimestamp: true,
    },
    icon: '🎲',
    volume: 'medium',
  },

  // =========================================================================
  // 🃏 TRADING CARDS & COLLECTIBLES
  // =========================================================================
  'tcgplayer': {
    name: 'TCGplayer',
    url: 'https://store.tcgplayer.com/admin',
    categories: ['trading-cards', 'pokemon', 'mtg', 'yugioh'],
    type: 'marketplace',
    rules: {
      titleFormat: '{card_name}',
      requiresCondition: true,
    },
    icon: '🃏',
    volume: 'highest',
  },
  'pkmntcgtrades_reddit': {
    name: 'r/pkmntcgtrades',
    url: 'https://reddit.com/r/pkmntcgtrades',
    categories: ['trading-cards', 'pokemon'],
    type: 'reddit',
    rules: {
      titleFormat: '[US, US] [H] {title} [W] ${price} PayPal',
      requiresTimestamp: true,
    },
    icon: '⚡',
    volume: 'high',
  },
  'sportscardforum': {
    name: 'Sports Card Forum',
    url: 'https://www.sportscardforum.com/forumdisplay.php?f=15',
    categories: ['sports', 'trading-cards'],
    type: 'forum',
    rules: {
      titleFormat: 'FS: {title} ${price}',
      requiresImages: true,
    },
    icon: '🏈',
    volume: 'medium',
  },
  'blowoutcards': {
    name: 'Blowout Cards Forum',
    url: 'https://www.blowoutforums.com/forumdisplay.php?f=15',
    categories: ['sports', 'trading-cards'],
    type: 'forum',
    rules: {
      titleFormat: '[FS/FT] {title} - ${price}',
      requiresImages: true,
    },
    icon: '💥',
    volume: 'medium',
  },
  'comc': {
    name: 'COMC',
    url: 'https://www.comc.com/Sell',
    categories: ['trading-cards', 'sports'],
    type: 'consignment',
    rules: {
      titleFormat: '{title}',
      consignmentOnly: true,
    },
    icon: '📦',
    volume: 'high',
  },

  // =========================================================================
  // 🪙 COINS & NUMISMATICS
  // =========================================================================
  'cointalk': {
    name: 'CoinTalk',
    url: 'https://www.cointalk.com/forums/for-sale-trade.46/',
    categories: ['coins', 'numismatics'],
    type: 'forum',
    rules: {
      titleFormat: '[FS] {title} - ${price}',
      requiresImages: true,
    },
    icon: '🪙',
    volume: 'medium',
  },
  'coins4sale_reddit': {
    name: 'r/Coins4Sale',
    url: 'https://reddit.com/r/Coins4Sale',
    categories: ['coins', 'numismatics'],
    type: 'reddit',
    rules: {
      titleFormat: '[WTS] {title} - ${price}',
      requiresTimestamp: true,
    },
    icon: '💰',
    volume: 'medium',
  },
  'pmsforsale_reddit': {
    name: 'r/Pmsforsale',
    url: 'https://reddit.com/r/Pmsforsale',
    categories: ['coins', 'precious-metals', 'bullion'],
    type: 'reddit',
    rules: {
      titleFormat: '[WTS] {title} - ${price}',
      requiresTimestamp: true,
    },
    icon: '🥇',
    volume: 'high',
  },

  // =========================================================================
  // 📚 BOOKS & MEDIA
  // =========================================================================
  'bookexchange_reddit': {
    name: 'r/bookexchange',
    url: 'https://reddit.com/r/bookexchange',
    categories: ['books'],
    type: 'reddit',
    rules: {
      titleFormat: '[SELL] {title} - ${price}',
    },
    icon: '📚',
    volume: 'low',
  },
  'abebooks': {
    name: 'AbeBooks',
    url: 'https://www.abebooks.com/sell-books/',
    categories: ['books', 'rare-books'],
    type: 'marketplace',
    rules: {
      titleFormat: '{author} - {title}',
      requiresISBN: true,
    },
    icon: '📖',
    volume: 'medium',
  },
  'biblio': {
    name: 'Biblio',
    url: 'https://www.biblio.com/sell-books',
    categories: ['books', 'rare-books'],
    type: 'marketplace',
    rules: {
      titleFormat: '{title}',
    },
    icon: '📕',
    volume: 'medium',
  },

  // =========================================================================
  // ⌚ WATCHES & JEWELRY
  // =========================================================================
  'watchexchange_reddit': {
    name: 'r/Watchexchange',
    url: 'https://reddit.com/r/Watchexchange',
    categories: ['watches'],
    type: 'reddit',
    rules: {
      titleFormat: '[WTS] {brand} {title} - ${price}',
      requiresTimestamp: true,
    },
    icon: '⌚',
    volume: 'high',
  },
  'watchuseek': {
    name: 'WatchUSeek',
    url: 'https://www.watchuseek.com/forums/private-sellers-agents-forums.63/',
    categories: ['watches'],
    type: 'forum',
    rules: {
      titleFormat: 'FS: {brand} {title} - ${price}',
      requiresImages: true,
    },
    icon: '🕐',
    volume: 'medium',
  },
  'chrono24': {
    name: 'Chrono24',
    url: 'https://www.chrono24.com/sell/',
    categories: ['watches', 'luxury'],
    type: 'marketplace',
    rules: {
      titleFormat: '{brand} {model} {reference}',
      requiresReference: true,
    },
    icon: '⏱️',
    volume: 'high',
  },

  // =========================================================================
  // 🛠️ TOOLS & EQUIPMENT
  // =========================================================================
  'tools_reddit': {
    name: 'r/tools',
    url: 'https://reddit.com/r/tools',
    categories: ['tools'],
    type: 'reddit',
    rules: {
      titleFormat: '[For Sale] {title} - ${price}',
    },
    icon: '🔨',
    volume: 'low',
  },

  // =========================================================================
  // 🎯 GENERAL / CATCH-ALL
  // =========================================================================
  'ebay': {
    name: 'eBay',
    url: 'https://www.ebay.com/sl/sell',
    categories: ['all'],
    type: 'marketplace',
    rules: {
      titleFormat: '{title}',
      maxTitleLength: 80,
    },
    icon: '🛒',
    volume: 'highest',
  },
  'mercari': {
    name: 'Mercari',
    url: 'https://www.mercari.com/sell/',
    categories: ['all'],
    type: 'marketplace',
    rules: {
      titleFormat: '{title}',
      requiresImages: true,
    },
    icon: '🔴',
    volume: 'high',
  },
  'poshmark': {
    name: 'Poshmark',
    url: 'https://poshmark.com/create-listing',
    categories: ['fashion', 'clothing', 'home'],
    type: 'marketplace',
    rules: {
      titleFormat: '{brand} {title}',
      requiresBrand: true,
    },
    icon: '👛',
    volume: 'high',
  },
  'depop': {
    name: 'Depop',
    url: 'https://www.depop.com/sell/',
    categories: ['fashion', 'vintage', 'streetwear'],
    type: 'marketplace',
    rules: {
      titleFormat: '{title}',
      requiresImages: true,
    },
    icon: '🛍️',
    volume: 'high',
  },
  'whatnot': {
    name: 'Whatnot',
    url: 'https://www.whatnot.com/sell',
    categories: ['trading-cards', 'collectibles', 'funko', 'toys'],
    type: 'live-auction',
    rules: {
      titleFormat: '{title}',
      liveOnly: true,
    },
    icon: '📺',
    volume: 'high',
  },
};

interface CommunityConfig {
  name: string;
  url: string;
  categories: string[];
  type: 'reddit' | 'forum' | 'marketplace' | 'auction' | 'consignment' | 'classifieds' | 'local' | 'live-auction';
  rules: {
    titleFormat: string;
    requiresImages?: boolean;
    requiresTimestamp?: boolean;
    requiresLocation?: boolean;
    requiresSize?: boolean;
    requiresBrand?: boolean;
    requiresGrading?: boolean;
    requiresVIN?: boolean;
    requiresISBN?: boolean;
    requiresReference?: boolean;
    requiresSetNumber?: boolean;
    requiresCondition?: boolean;
    requiresESN?: boolean;
    flairRequired?: boolean;
    localOnly?: boolean;
    neighborhoodOnly?: boolean;
    luxuryOnly?: boolean;
    enthusiastCars?: boolean;
    curatedOnly?: boolean;
    furnitureOnly?: boolean;
    consignmentOnly?: boolean;
    liveOnly?: boolean;
    minValue?: number;
    maxTitleLength?: number;
  };
  icon: string;
  volume: 'highest' | 'high' | 'medium' | 'low';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET: List available communities for a category
  if (req.method === 'GET') {
    const category = req.query.category as string | undefined;
    const type = req.query.type as string | undefined;
    
    let communities = Object.entries(COMMUNITIES).map(([id, config]) => ({
      id,
      ...config,
    }));

    if (category) {
      communities = communities.filter(c => 
        c.categories.includes(category) || c.categories.includes('all')
      );
    }

    if (type) {
      communities = communities.filter(c => c.type === type);
    }

    // Sort by volume
    const volumeOrder = { highest: 0, high: 1, medium: 2, low: 3 };
    communities.sort((a, b) => volumeOrder[a.volume] - volumeOrder[b.volume]);

    return res.status(200).json({
      communities,
      total: communities.length,
      categories: [...new Set(Object.values(COMMUNITIES).flatMap(c => c.categories))].sort(),
      types: [...new Set(Object.values(COMMUNITIES).map(c => c.type))].sort(),
    });
  }

  // POST: Generate community-optimized content
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { listing_id, community_ids } = req.body;

  if (!listing_id) {
    return res.status(400).json({ error: 'Missing listing_id' });
  }

  try {
    // Fetch listing with seller info
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

    // Get applicable communities
    const category = listing.category || 'all';
    let applicableCommunities = community_ids 
      ? Object.entries(COMMUNITIES).filter(([id]) => community_ids.includes(id))
      : Object.entries(COMMUNITIES).filter(([_, config]) => 
          config.categories.includes(category) || config.categories.includes('all')
        );

    // Filter by listing value if community has minValue
    applicableCommunities = applicableCommunities.filter(([_, config]) => {
      if (config.rules.minValue && listing.asking_price < config.rules.minValue) {
        return false;
      }
      return true;
    });

    // Generate content for each community
    const posts = applicableCommunities.map(([communityId, config]) => ({
      community_id: communityId,
      community_name: config.name,
      community_url: config.url,
      type: config.type,
      icon: config.icon,
      volume: config.volume,
      post: generatePost(listing, config),
      requirements: getRequirements(config),
    }));

    // Sort by volume
    const volumeOrder = { highest: 0, high: 1, medium: 2, low: 3 };
    posts.sort((a, b) => volumeOrder[a.volume as keyof typeof volumeOrder] - volumeOrder[b.volume as keyof typeof volumeOrder]);

    // Log generation
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'community_content_generated',
      resource_type: 'arena_listing',
      resource_id: listing_id,
      details: { communities: posts.map(p => p.community_id), category },
    });

    return res.status(200).json({
      listing_id,
      category,
      posts,
      total: posts.length,
      tips: getGeneralTips(category),
    });
  } catch (error: any) {
    console.error('Community generation error:', error);
    return res.status(500).json({ error: 'Failed to generate content' });
  }
}

function generatePost(listing: any, config: CommunityConfig): {
  title: string;
  body: string;
  checklist: string[];
  post_url: string;
} {
  const price = listing.asking_price?.toFixed(2) || '0.00';
  const location = listing.profiles?.location_text || 'USA';
  const state = extractState(location);
  const brand = listing.brand || extractBrand(listing.item_name);

  // Generate title
  let title = config.rules.titleFormat
    .replace('{title}', truncateTitle(listing.item_name, config.rules.maxTitleLength || 80))
    .replace('{price}', price)
    .replace('{state}', state)
    .replace('{brand}', brand)
    .replace('{size}', listing.size || 'OS')
    .replace('{year}', listing.year || '')
    .replace('{make}', listing.make || '')
    .replace('{model}', listing.model || '')
    .replace('{artist}', listing.artist || '')
    .replace('{author}', listing.author || '')
    .replace('{set_number}', listing.set_number || '')
    .replace('{card_name}', listing.card_name || listing.item_name)
    .replace('{era}', listing.era || 'Vintage');

  // Clean up any unreplaced placeholders
  title = title.replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();

  // Generate body
  let body = '';

  // Header
  body += `**${listing.item_name}**\n\n`;

  // Price
  body += `**Price:** $${price}`;
  if (listing.estimated_value && listing.estimated_value > listing.asking_price) {
    const discount = Math.round((1 - listing.asking_price / listing.estimated_value) * 100);
    body += ` (${discount}% below market)`;
  }
  body += '\n\n';

  // Condition
  if (listing.condition) {
    body += `**Condition:** ${formatCondition(listing.condition)}\n\n`;
  }

  // Description
  if (listing.description) {
    body += `**Description:**\n${listing.description}\n\n`;
  }

  // Verification
  if (listing.is_verified) {
    body += `✓ **Verified Authentic**\n\n`;
  }

  // Location
  if (config.rules.requiresLocation || config.rules.localOnly) {
    body += `**Location:** ${location}\n\n`;
  }

  // Shipping
  if (!config.rules.localOnly) {
    body += `**Shipping:** USPS Priority with tracking\n`;
    body += `**Payment:** PayPal G&S\n\n`;
  }

  // Timestamp note
  if (config.rules.requiresTimestamp) {
    body += `*Timestamp included in photos*\n\n`;
  }

  // Link
  body += `---\n`;
  body += `📷 Full details & photos: ${DOMAIN}/marketplace/${listing.id}\n`;

  // Build checklist
  const checklist: string[] = [];
  if (config.rules.requiresImages) checklist.push('📸 Upload photos');
  if (config.rules.requiresTimestamp) checklist.push('📝 Add timestamp with username & date');
  if (config.rules.requiresLocation) checklist.push('📍 Include location');
  if (config.rules.flairRequired) checklist.push('🏷️ Set post flair');
  if (config.rules.requiresBrand) checklist.push('👔 Specify brand');
  if (config.rules.requiresSize) checklist.push('📏 Include size');
  if (config.rules.requiresGrading) checklist.push('⭐ Add condition grade');
  if (config.rules.requiresVIN) checklist.push('🚗 Include VIN');
  if (config.rules.requiresISBN) checklist.push('📖 Add ISBN');
  if (config.rules.requiresCondition) checklist.push('✨ Specify condition');

  return {
    title,
    body,
    checklist,
    post_url: config.url,
  };
}

function getRequirements(config: CommunityConfig): string[] {
  const reqs: string[] = [];
  if (config.rules.requiresTimestamp) reqs.push('Timestamp photo required');
  if (config.rules.localOnly) reqs.push('Local pickup only');
  if (config.rules.minValue) reqs.push(`Minimum value: $${config.rules.minValue}`);
  if (config.rules.luxuryOnly) reqs.push('Luxury/designer items only');
  if (config.rules.curatedOnly) reqs.push('Items must be approved');
  return reqs;
}

function extractState(location: string): string {
  const stateMatch = location.match(/\b([A-Z]{2})\b/);
  if (stateMatch) return stateMatch[1];
  
  const states: Record<string, string> = {
    'california': 'CA', 'texas': 'TX', 'florida': 'FL', 'new york': 'NY',
    'new jersey': 'NJ', 'pennsylvania': 'PA', 'ohio': 'OH', 'michigan': 'MI',
    'illinois': 'IL', 'georgia': 'GA', 'north carolina': 'NC', 'virginia': 'VA',
  };
  
  const lower = location.toLowerCase();
  for (const [name, abbr] of Object.entries(states)) {
    if (lower.includes(name)) return abbr;
  }
  
  return 'US';
}

function extractBrand(itemName: string): string {
  const knownBrands = [
    'Apple', 'Samsung', 'Sony', 'Nike', 'Adidas', 'Supreme', 'Louis Vuitton',
    'Gucci', 'Rolex', 'Omega', 'Fender', 'Gibson', 'Canon', 'Nikon',
  ];
  
  for (const brand of knownBrands) {
    if (itemName.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }
  
  return '';
}

function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength - 3) + '...';
}

function formatCondition(condition: string): string {
  const map: Record<string, string> = {
    'new': 'New/Sealed',
    'mint': 'Mint',
    'like_new': 'Like New',
    'excellent': 'Excellent',
    'good': 'Good',
    'fair': 'Fair',
    'poor': 'Poor/For Parts',
  };
  return map[condition?.toLowerCase()] || condition;
}

function getGeneralTips(category: string): string[] {
  return [
    '📸 Clear, well-lit photos sell faster',
    '💰 Price competitively - check sold listings',
    '📝 Be detailed and honest about condition',
    '⚡ Respond to inquiries quickly',
    '📦 Ship promptly with tracking',
  ];
}