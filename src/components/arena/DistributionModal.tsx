// FILE: src/components/arena/DistributionModal.tsx
// Multi-platform distribution modal for listings
// Updated: Universal communities for FULL $400B resale market
//
// FIXES:
//   - Scroll: added min-h-0 to content area (flexbox overflow fix)
//   - Links: open in new tab instead of popup (Facebook blocks popups)

import { useState, useEffect } from 'react';
import { 
  X, ExternalLink, Copy, Check, Share2, Zap, 
  TrendingUp, Globe, Users, ShoppingBag, MessageSquare 
} from 'lucide-react';

interface Platform {
  id: string;
  name: string;
  type: string;
  icon: string;
  available: boolean;
  reason?: string;
  postUrl?: string;
  optimizedContent?: any;
  suggestedSubreddits?: string[];
}

interface Community {
  id: string;
  name: string;
  url: string;
  icon: string;
  type: string;
  volume: string;
  requirements?: string[];
  post?: {
    title: string;
    body: string;
    checklist: string[];
  };
}

interface DistributionModalProps {
  listingId: string;
  itemName: string;
  price: number;
  imageUrl?: string;
  category?: string;
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// UNIVERSAL COMMUNITIES - Covers ALL resale categories
// ============================================================================
const UNIVERSAL_COMMUNITIES: Record<string, Community[]> = {
  // ELECTRONICS
  electronics: [
    { id: 'hardwareswap', name: 'r/hardwareswap', url: 'https://reddit.com/r/hardwareswap/submit', icon: '💻', type: 'reddit', volume: 'high' },
    { id: 'appleswap', name: 'r/appleswap', url: 'https://reddit.com/r/appleswap/submit', icon: '🍎', type: 'reddit', volume: 'high' },
    { id: 'phoneswap', name: 'r/phoneswap', url: 'https://reddit.com/r/phoneswap/submit', icon: '📱', type: 'reddit', volume: 'medium' },
    { id: 'avexchange', name: 'r/AVexchange', url: 'https://reddit.com/r/AVexchange/submit', icon: '🎧', type: 'reddit', volume: 'medium' },
    { id: 'swappa', name: 'Swappa', url: 'https://swappa.com/sell', icon: '📲', type: 'marketplace', volume: 'high' },
  ],
  phones: [
    { id: 'appleswap', name: 'r/appleswap', url: 'https://reddit.com/r/appleswap/submit', icon: '🍎', type: 'reddit', volume: 'high' },
    { id: 'phoneswap', name: 'r/phoneswap', url: 'https://reddit.com/r/phoneswap/submit', icon: '📱', type: 'reddit', volume: 'medium' },
    { id: 'swappa', name: 'Swappa', url: 'https://swappa.com/sell', icon: '📲', type: 'marketplace', volume: 'high' },
  ],
  computers: [
    { id: 'hardwareswap', name: 'r/hardwareswap', url: 'https://reddit.com/r/hardwareswap/submit', icon: '💻', type: 'reddit', volume: 'high' },
    { id: 'homelabsales', name: 'r/homelabsales', url: 'https://reddit.com/r/homelabsales/submit', icon: '🖥️', type: 'reddit', volume: 'medium' },
  ],
  gaming: [
    { id: 'gamesale', name: 'r/GameSale', url: 'https://reddit.com/r/GameSale/submit', icon: '🎮', type: 'reddit', volume: 'high' },
    { id: 'hardwareswap', name: 'r/hardwareswap', url: 'https://reddit.com/r/hardwareswap/submit', icon: '💻', type: 'reddit', volume: 'high' },
  ],
  cameras: [
    { id: 'photomarket', name: 'r/photomarket', url: 'https://reddit.com/r/photomarket/submit', icon: '📷', type: 'reddit', volume: 'medium' },
  ],
  audio: [
    { id: 'avexchange', name: 'r/AVexchange', url: 'https://reddit.com/r/AVexchange/submit', icon: '🎧', type: 'reddit', volume: 'medium' },
  ],

  // FASHION
  fashion: [
    { id: 'sneakermarket', name: 'r/sneakermarket', url: 'https://reddit.com/r/sneakermarket/submit', icon: '👟', type: 'reddit', volume: 'high' },
    { id: 'malefashionmarket', name: 'r/MaleFashionMarket', url: 'https://reddit.com/r/MaleFashionMarket/submit', icon: '👔', type: 'reddit', volume: 'medium' },
    { id: 'wardrobepurge', name: 'r/wardrobepurge', url: 'https://reddit.com/r/wardrobepurge/submit', icon: '👗', type: 'reddit', volume: 'medium' },
    { id: 'grailed', name: 'Grailed', url: 'https://www.grailed.com/sell', icon: '🏷️', type: 'marketplace', volume: 'high' },
    { id: 'poshmark', name: 'Poshmark', url: 'https://poshmark.com/create-listing', icon: '👛', type: 'marketplace', volume: 'high' },
    { id: 'depop', name: 'Depop', url: 'https://www.depop.com/sell/', icon: '🛍️', type: 'marketplace', volume: 'high' },
  ],
  sneakers: [
    { id: 'sneakermarket', name: 'r/sneakermarket', url: 'https://reddit.com/r/sneakermarket/submit', icon: '👟', type: 'reddit', volume: 'high' },
    { id: 'stockx', name: 'StockX', url: 'https://stockx.com/sell', icon: '📈', type: 'marketplace', volume: 'highest' },
    { id: 'goat', name: 'GOAT', url: 'https://www.goat.com/sell', icon: '🐐', type: 'marketplace', volume: 'highest' },
  ],
  watches: [
    { id: 'watchexchange', name: 'r/Watchexchange', url: 'https://reddit.com/r/Watchexchange/submit', icon: '⌚', type: 'reddit', volume: 'high' },
    { id: 'watchuseek', name: 'WatchUSeek', url: 'https://www.watchuseek.com/forums/private-sellers-agents-forums.63/', icon: '🕐', type: 'forum', volume: 'medium' },
    { id: 'chrono24', name: 'Chrono24', url: 'https://www.chrono24.com/sell/', icon: '⏱️', type: 'marketplace', volume: 'high' },
  ],
  designer: [
    { id: 'therealreal', name: 'The RealReal', url: 'https://www.therealreal.com/consign', icon: '💎', type: 'consignment', volume: 'high' },
    { id: 'vestiaire', name: 'Vestiaire Collective', url: 'https://www.vestiairecollective.com/sell/', icon: '👜', type: 'marketplace', volume: 'high' },
  ],

  // COLLECTIBLES
  collectibles: [
    { id: 'tcgplayer', name: 'TCGplayer', url: 'https://store.tcgplayer.com/admin', icon: '🃏', type: 'marketplace', volume: 'highest' },
    { id: 'whatnot', name: 'Whatnot', url: 'https://www.whatnot.com/sell', icon: '📺', type: 'live-auction', volume: 'high' },
  ],
  'trading-cards': [
    { id: 'pkmntcgtrades', name: 'r/pkmntcgtrades', url: 'https://reddit.com/r/pkmntcgtrades/submit', icon: '⚡', type: 'reddit', volume: 'high' },
    { id: 'tcgplayer', name: 'TCGplayer', url: 'https://store.tcgplayer.com/admin', icon: '🃏', type: 'marketplace', volume: 'highest' },
    { id: 'whatnot', name: 'Whatnot', url: 'https://www.whatnot.com/sell', icon: '📺', type: 'live-auction', volume: 'high' },
  ],
  pokemon: [
    { id: 'pkmntcgtrades', name: 'r/pkmntcgtrades', url: 'https://reddit.com/r/pkmntcgtrades/submit', icon: '⚡', type: 'reddit', volume: 'high' },
    { id: 'tcgplayer', name: 'TCGplayer', url: 'https://store.tcgplayer.com/admin', icon: '🃏', type: 'marketplace', volume: 'highest' },
  ],
  coins: [
    { id: 'coins4sale', name: 'r/Coins4Sale', url: 'https://reddit.com/r/Coins4Sale/submit', icon: '🪙', type: 'reddit', volume: 'medium' },
    { id: 'pmsforsale', name: 'r/Pmsforsale', url: 'https://reddit.com/r/Pmsforsale/submit', icon: '🥇', type: 'reddit', volume: 'high' },
    { id: 'cointalk', name: 'CoinTalk', url: 'https://www.cointalk.com/forums/for-sale-trade.46/', icon: '💰', type: 'forum', volume: 'medium' },
  ],
  lego: [
    { id: 'legomarket', name: 'r/Legomarket', url: 'https://reddit.com/r/Legomarket/submit', icon: '🧱', type: 'reddit', volume: 'medium' },
    { id: 'bricklink', name: 'BrickLink', url: 'https://www.bricklink.com/v2/wanted/store.page', icon: '🟡', type: 'marketplace', volume: 'high' },
  ],
  vinyl: [
    { id: 'vinylcollectors', name: 'r/VinylCollectors', url: 'https://reddit.com/r/VinylCollectors/submit', icon: '🎵', type: 'reddit', volume: 'medium' },
    { id: 'discogs', name: 'Discogs', url: 'https://www.discogs.com/sell/list', icon: '💿', type: 'marketplace', volume: 'high' },
  ],
  comics: [
    { id: 'comicswap', name: 'r/comicswap', url: 'https://reddit.com/r/comicswap/submit', icon: '📚', type: 'reddit', volume: 'medium' },
  ],
  funko: [
    { id: 'funkoswap', name: 'r/funkoswap', url: 'https://reddit.com/r/funkoswap/submit', icon: '🎭', type: 'reddit', volume: 'medium' },
    { id: 'whatnot', name: 'Whatnot', url: 'https://www.whatnot.com/sell', icon: '📺', type: 'live-auction', volume: 'high' },
  ],

  // HOME & FURNITURE
  furniture: [
    { id: 'facebook', name: 'FB Marketplace', url: 'https://www.facebook.com/marketplace/create/item', icon: '📘', type: 'marketplace', volume: 'highest' },
    { id: 'offerup', name: 'OfferUp', url: 'https://offerup.com/post', icon: '🏷️', type: 'marketplace', volume: 'high' },
    { id: 'craigslist', name: 'Craigslist', url: 'https://post.craigslist.org/', icon: '📋', type: 'classifieds', volume: 'high' },
    { id: 'aptdeco', name: 'AptDeco', url: 'https://www.aptdeco.com/sell', icon: '🛋️', type: 'consignment', volume: 'medium' },
    { id: 'chairish', name: 'Chairish', url: 'https://www.chairish.com/sell', icon: '🪑', type: 'marketplace', volume: 'medium' },
  ],
  appliances: [
    { id: 'facebook', name: 'FB Marketplace', url: 'https://www.facebook.com/marketplace/create/item', icon: '📘', type: 'marketplace', volume: 'highest' },
    { id: 'offerup', name: 'OfferUp', url: 'https://offerup.com/post', icon: '🏷️', type: 'marketplace', volume: 'high' },
    { id: 'craigslist', name: 'Craigslist', url: 'https://post.craigslist.org/', icon: '📋', type: 'classifieds', volume: 'high' },
  ],
  tools: [
    { id: 'facebook', name: 'FB Marketplace', url: 'https://www.facebook.com/marketplace/create/item', icon: '📘', type: 'marketplace', volume: 'highest' },
    { id: 'craigslist', name: 'Craigslist', url: 'https://post.craigslist.org/', icon: '📋', type: 'classifieds', volume: 'high' },
  ],

  // VEHICLES
  vehicles: [
    { id: 'facebook', name: 'FB Marketplace', url: 'https://www.facebook.com/marketplace/create/item', icon: '📘', type: 'marketplace', volume: 'highest' },
    { id: 'craigslist', name: 'Craigslist', url: 'https://post.craigslist.org/', icon: '📋', type: 'classifieds', volume: 'high' },
    { id: 'carsandbids', name: 'Cars & Bids', url: 'https://carsandbids.com/sell', icon: '🚗', type: 'auction', volume: 'medium' },
  ],
  'auto-parts': [
    { id: 'facebook', name: 'FB Marketplace', url: 'https://www.facebook.com/marketplace/create/item', icon: '📘', type: 'marketplace', volume: 'highest' },
    { id: 'craigslist', name: 'Craigslist', url: 'https://post.craigslist.org/', icon: '📋', type: 'classifieds', volume: 'high' },
  ],

  // MUSIC & INSTRUMENTS
  instruments: [
    { id: 'gear4sale', name: 'r/Gear4Sale', url: 'https://reddit.com/r/Gear4Sale/submit', icon: '🎸', type: 'reddit', volume: 'medium' },
    { id: 'reverb', name: 'Reverb', url: 'https://reverb.com/sell', icon: '🎹', type: 'marketplace', volume: 'high' },
  ],

  // SPORTS & OUTDOOR
  sports: [
    { id: 'facebook', name: 'FB Marketplace', url: 'https://www.facebook.com/marketplace/create/item', icon: '📘', type: 'marketplace', volume: 'highest' },
    { id: 'sidelineswap', name: 'SidelineSwap', url: 'https://sidelineswap.com/sell', icon: '⚽', type: 'marketplace', volume: 'medium' },
  ],
  bicycles: [
    { id: 'facebook', name: 'FB Marketplace', url: 'https://www.facebook.com/marketplace/create/item', icon: '📘', type: 'marketplace', volume: 'highest' },
    { id: 'pinkbike', name: 'Pinkbike', url: 'https://www.pinkbike.com/buysell/post/', icon: '🚴', type: 'marketplace', volume: 'medium' },
  ],

  // TOYS & KIDS
  toys: [
    { id: 'toyexchange', name: 'r/toyexchange', url: 'https://reddit.com/r/toyexchange/submit', icon: '🧸', type: 'reddit', volume: 'medium' },
    { id: 'whatnot', name: 'Whatnot', url: 'https://www.whatnot.com/sell', icon: '📺', type: 'live-auction', volume: 'high' },
  ],
  baby: [
    { id: 'facebook', name: 'FB Marketplace', url: 'https://www.facebook.com/marketplace/create/item', icon: '📘', type: 'marketplace', volume: 'highest' },
    { id: 'kidizen', name: 'Kidizen', url: 'https://www.kidizen.com/sell', icon: '👶', type: 'marketplace', volume: 'medium' },
  ],

  // BOOKS & MEDIA
  books: [
    { id: 'bookexchange', name: 'r/bookexchange', url: 'https://reddit.com/r/bookexchange/submit', icon: '📚', type: 'reddit', volume: 'low' },
    { id: 'abebooks', name: 'AbeBooks', url: 'https://www.abebooks.com/sell-books/', icon: '📖', type: 'marketplace', volume: 'medium' },
  ],
  'video-games': [
    { id: 'gamesale', name: 'r/GameSale', url: 'https://reddit.com/r/GameSale/submit', icon: '🎮', type: 'reddit', volume: 'high' },
  ],

  // DEFAULT / GENERAL
  general: [
    { id: 'facebook', name: 'FB Marketplace', url: 'https://www.facebook.com/marketplace/create/item', icon: '📘', type: 'marketplace', volume: 'highest' },
    { id: 'offerup', name: 'OfferUp', url: 'https://offerup.com/post', icon: '🏷️', type: 'marketplace', volume: 'high' },
    { id: 'craigslist', name: 'Craigslist', url: 'https://post.craigslist.org/', icon: '📋', type: 'classifieds', volume: 'high' },
    { id: 'mercari', name: 'Mercari', url: 'https://www.mercari.com/sell/', icon: '🔴', type: 'marketplace', volume: 'high' },
  ],
};

// Get communities for a category with fallback
function getCommunitiesForCategory(category?: string): Community[] {
  if (!category) return UNIVERSAL_COMMUNITIES.general;
  
  const normalized = category.toLowerCase().replace(/[_\s]/g, '-');
  
  // Direct match
  if (UNIVERSAL_COMMUNITIES[normalized]) {
    return UNIVERSAL_COMMUNITIES[normalized];
  }
  
  // Partial match
  for (const [key, communities] of Object.entries(UNIVERSAL_COMMUNITIES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return communities;
    }
  }
  
  return UNIVERSAL_COMMUNITIES.general;
}

export function DistributionModal({
  listingId,
  itemName,
  price,
  imageUrl,
  category,
  isOpen,
  onClose,
}: DistributionModalProps) {
  const [loading, setLoading] = useState(true);
  const [distributionData, setDistributionData] = useState<any>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'recommended' | 'communities' | 'social' | 'all'>('recommended');

  // Get category-specific communities
  const communities = getCommunitiesForCategory(category);

  useEffect(() => {
    if (isOpen && listingId) {
      fetchDistributionData();
    }
  }, [isOpen, listingId]);

  const fetchDistributionData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/arena/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      });
      const data = await response.json();
      setDistributionData(data);
      
      // Pre-select recommended platforms
      if (data.recommendations) {
        setSelectedPlatforms(new Set(data.recommendations.slice(0, 5)));
      }
    } catch (error) {
      console.error('Failed to load distribution data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // FIX: Open in new tab instead of popup — Facebook/eBay block popup windows
  const openPlatform = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getPlatformsByType = (type: string) => {
    if (!distributionData?.platforms) return [];
    return Object.entries(distributionData.platforms)
      .filter(([_, p]: [string, any]) => p.type === type && p.available)
      .map(([id, p]: [string, any]) => ({ id, ...p }));
  };

  const getRecommendedPlatforms = () => {
    if (!distributionData?.platforms || !distributionData?.recommendations) return [];
    return distributionData.recommendations
      .map((id: string) => ({ id, ...distributionData.platforms[id] }))
      .filter((p: any) => p.available);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Share2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Distribute Listing</h2>
              <p className="text-sm text-zinc-400">Share to 50+ platforms instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Listing Preview */}
        <div className="p-4 bg-zinc-800/50 mx-4 mt-4 rounded-xl flex gap-4">
          {imageUrl && (
            <img src={imageUrl} alt={itemName} className="w-20 h-20 rounded-lg object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{itemName}</h3>
            <p className="text-emerald-400 text-xl font-bold">${price.toFixed(2)}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                SEO Indexed ✓
              </span>
              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                OG Image Ready ✓
              </span>
              {category && (
                <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                  {category}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 border-b border-zinc-800 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('recommended')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'recommended' 
                ? 'bg-blue-500 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Zap size={16} />
            Recommended
          </button>
          <button
            onClick={() => setActiveTab('communities')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'communities' 
                ? 'bg-orange-500 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <MessageSquare size={16} />
            Communities
            <span className="text-xs bg-orange-600/50 px-1.5 py-0.5 rounded">
              {communities.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'social' 
                ? 'bg-blue-500 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Users size={16} />
            Social
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'all' 
                ? 'bg-blue-500 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Globe size={16} />
            All Platforms
          </button>
        </div>

        {/* Content — FIX: min-h-0 enables proper flex overflow scrolling */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {loading && activeTab !== 'communities' ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Quick Share Row */}
              {distributionData?.quick_share && activeTab !== 'communities' && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-zinc-400 mb-3">Quick Share (One Click)</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(distributionData.quick_share).map(([platform, url]) => {
                      if (platform === 'copy_link') {
                        return (
                          <button
                            key={platform}
                            onClick={() => copyToClipboard(url as string, 'link')}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                          >
                            {copiedStates['link'] ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                            <span>{copiedStates['link'] ? 'Copied!' : 'Copy Link'}</span>
                          </button>
                        );
                      }
                      return (
                        <button
                          key={platform}
                          onClick={() => openPlatform(url as string)}
                          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors capitalize"
                        >
                          <span>{getEmojiForPlatform(platform)}</span>
                          <span>{platform.replace('_', ' ')}</span>
                          <ExternalLink size={14} className="text-zinc-500" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Communities Tab */}
              {activeTab === 'communities' && (
                <CommunityGrid
                  communities={communities}
                  itemName={itemName}
                  price={price}
                  category={category}
                  onOpen={openPlatform}
                  onCopy={copyToClipboard}
                  copiedStates={copiedStates}
                />
              )}

              {/* Platform Grid */}
              {activeTab === 'recommended' && (
                <PlatformGrid
                  platforms={getRecommendedPlatforms()}
                  title="Recommended for Your Item"
                  description="Best platforms based on category and price"
                  onOpen={openPlatform}
                  onCopy={copyToClipboard}
                  copiedStates={copiedStates}
                />
              )}

              {activeTab === 'social' && (
                <PlatformGrid
                  platforms={getPlatformsByType('social')}
                  title="Social Media"
                  description="Share with your followers"
                  onOpen={openPlatform}
                  onCopy={copyToClipboard}
                  copiedStates={copiedStates}
                />
              )}

              {activeTab === 'all' && (
                <>
                  <PlatformGrid
                    platforms={getPlatformsByType('marketplace')}
                    title="Marketplaces"
                    description="Major selling platforms"
                    onOpen={openPlatform}
                    onCopy={copyToClipboard}
                    copiedStates={copiedStates}
                  />
                  <PlatformGrid
                    platforms={getPlatformsByType('collector')}
                    title="Collector Platforms"
                    description="Specialized for collectibles"
                    onOpen={openPlatform}
                    onCopy={copyToClipboard}
                    copiedStates={copiedStates}
                  />
                  <PlatformGrid
                    platforms={getPlatformsByType('auction')}
                    title="Auction Houses"
                    description="For high-value items"
                    onOpen={openPlatform}
                    onCopy={copyToClipboard}
                    copiedStates={copiedStates}
                  />
                  <PlatformGrid
                    platforms={getPlatformsByType('niche')}
                    title="Niche Markets"
                    description="Category specialists"
                    onOpen={openPlatform}
                    onCopy={copyToClipboard}
                    copiedStates={copiedStates}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <TrendingUp size={16} className="text-emerald-400" />
              <span>SEO active: Your listing is already indexed on Google</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Community Grid Component
// ============================================================================
function CommunityGrid({
  communities,
  itemName,
  price,
  category,
  onOpen,
  onCopy,
  copiedStates,
}: {
  communities: Community[];
  itemName: string;
  price: number;
  category?: string;
  onOpen: (url: string) => void;
  onCopy: (text: string, key: string) => void;
  copiedStates: Record<string, boolean>;
}) {
  // Group by type
  const redditCommunities = communities.filter(c => c.type === 'reddit');
  const marketplaces = communities.filter(c => c.type === 'marketplace' || c.type === 'consignment');
  const forums = communities.filter(c => c.type === 'forum');
  const others = communities.filter(c => !['reddit', 'marketplace', 'consignment', 'forum'].includes(c.type));

  // Generate title for Reddit posts
  const generateRedditTitle = (community: Community): string => {
    const priceStr = price.toFixed(0);
    if (community.id.includes('swap') || community.id.includes('sale')) {
      return `[WTS] ${itemName} - $${priceStr}`;
    }
    return `[For Sale] ${itemName} - $${priceStr}`;
  };

  return (
    <div className="space-y-6">
      {/* Category Context */}
      <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare size={16} className="text-orange-400" />
          <span className="font-medium text-orange-300">
            Communities for {category || 'General Items'}
          </span>
        </div>
        <p className="text-xs text-orange-400/70">
          These communities are curated for your item category. Most Reddit communities require timestamp photos and specific title formats.
        </p>
      </div>

      {/* Reddit Communities */}
      {redditCommunities.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔶</span>
            <h4 className="text-sm font-medium text-zinc-300">Reddit Communities</h4>
            <span className="text-xs text-zinc-500">({redditCommunities.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {redditCommunities.map((community) => {
              const title = generateRedditTitle(community);
              return (
                <div
                  key={community.id}
                  className="bg-zinc-800 rounded-xl p-3 hover:bg-zinc-700/80 transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{community.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{community.name}</div>
                      <div className="text-xs text-zinc-500">
                        {community.volume === 'high' ? '🔥 High traffic' : 
                         community.volume === 'highest' ? '🚀 Highest traffic' : 
                         '📊 Active'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Generated Title Preview */}
                  <div className="bg-zinc-900 rounded-lg p-2 mb-2">
                    <p className="text-xs text-zinc-400 mb-1">Suggested title:</p>
                    <p className="text-sm font-mono text-orange-300 break-all">{title}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => onCopy(title, `title-${community.id}`)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
                    >
                      {copiedStates[`title-${community.id}`] ? (
                        <><Check size={14} className="text-emerald-400" /> Copied!</>
                      ) : (
                        <><Copy size={14} /> Copy Title</>
                      )}
                    </button>
                    <button
                      onClick={() => onOpen(community.url)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg text-sm transition-colors"
                    >
                      <ExternalLink size={14} />
                      Post
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Reddit Tips */}
          <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg">
            <p className="text-xs text-zinc-400">
              💡 <strong>Reddit Tips:</strong> Most subreddits require a timestamp photo (your username + date on paper next to item). Check each subreddit's rules before posting.
            </p>
          </div>
        </div>
      )}

      {/* Marketplaces */}
      {marketplaces.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🛒</span>
            <h4 className="text-sm font-medium text-zinc-300">Specialized Marketplaces</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {marketplaces.map((community) => (
              <button
                key={community.id}
                onClick={() => onOpen(community.url)}
                className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all hover:scale-[1.02]"
              >
                <span className="text-2xl">{community.icon}</span>
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-sm">{community.name}</div>
                  <div className="text-xs text-zinc-500">
                    {community.type === 'consignment' ? 'Consignment' : 'List now'}
                  </div>
                </div>
                <ExternalLink size={14} className="text-zinc-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Forums */}
      {forums.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💬</span>
            <h4 className="text-sm font-medium text-zinc-300">Collector Forums</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {forums.map((community) => (
              <button
                key={community.id}
                onClick={() => onOpen(community.url)}
                className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all hover:scale-[1.02]"
              >
                <span className="text-2xl">{community.icon}</span>
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-sm">{community.name}</div>
                  <div className="text-xs text-zinc-500">Forum</div>
                </div>
                <ExternalLink size={14} className="text-zinc-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Others (Live Auctions, etc) */}
      {others.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎯</span>
            <h4 className="text-sm font-medium text-zinc-300">Other Platforms</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {others.map((community) => (
              <button
                key={community.id}
                onClick={() => onOpen(community.url)}
                className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all hover:scale-[1.02]"
              >
                <span className="text-2xl">{community.icon}</span>
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-sm">{community.name}</div>
                  <div className="text-xs text-zinc-500 capitalize">{community.type.replace('-', ' ')}</div>
                </div>
                <ExternalLink size={14} className="text-zinc-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {communities.length === 0 && (
        <div className="text-center py-8 text-zinc-500">
          <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
          <p>No specific communities found for this category.</p>
          <p className="text-sm">Use the All Platforms tab for general options.</p>
        </div>
      )}
    </div>
  );
}

// Platform Grid Component
function PlatformGrid({
  platforms,
  title,
  description,
  onOpen,
  onCopy,
  copiedStates,
}: {
  platforms: Platform[];
  title: string;
  description: string;
  onOpen: (url: string) => void;
  onCopy: (text: string, key: string) => void;
  copiedStates: Record<string, boolean>;
}) {
  if (platforms.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="mb-3">
        <h4 className="text-sm font-medium text-zinc-300">{title}</h4>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            onClick={() => platform.postUrl && onOpen(platform.postUrl)}
            disabled={!platform.available}
            className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
              platform.available
                ? 'bg-zinc-800 hover:bg-zinc-700 hover:scale-[1.02]'
                : 'bg-zinc-800/50 opacity-50 cursor-not-allowed'
            }`}
          >
            <span className="text-2xl">{platform.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{platform.name}</div>
              <div className="text-xs text-zinc-500 truncate">
                {platform.available ? 'Click to post' : platform.reason}
              </div>
            </div>
            {platform.available && (
              <ExternalLink size={14} className="text-zinc-500 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
      
      {/* Reddit Subreddit Suggestions */}
      {platforms.some(p => p.id === 'reddit' && p.suggestedSubreddits?.length) && (
        <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <p className="text-xs text-orange-400 mb-2">Suggested subreddits:</p>
          <div className="flex flex-wrap gap-2">
            {platforms
              .find(p => p.id === 'reddit')
              ?.suggestedSubreddits?.map(sub => (
                <a
                  key={sub}
                  href={`https://reddit.com/${sub}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 bg-orange-500/20 text-orange-300 rounded hover:bg-orange-500/30 transition-colors"
                >
                  {sub}
                </a>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function for platform emojis
function getEmojiForPlatform(platform: string): string {
  const emojiMap: Record<string, string> = {
    twitter: '🐦',
    x: '✖️',
    facebook: '📘',
    instagram: '📸',
    threads: '🧵',
    whatsapp: '💬',
    telegram: '✈️',
    copy_link: '🔗',
    email: '📧',
    sms: '💬',
  };
  return emojiMap[platform] || '🔗';
}
