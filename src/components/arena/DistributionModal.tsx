// FILE: src/components/arena/DistributionModal.tsx
// Multi-platform distribution modal for listings

import { useState, useEffect } from 'react';
import { 
  X, ExternalLink, Copy, Check, Share2, Zap, 
  TrendingUp, Globe, Users, ShoppingBag 
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

interface DistributionModalProps {
  listingId: string;
  itemName: string;
  price: number;
  imageUrl?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DistributionModal({
  listingId,
  itemName,
  price,
  imageUrl,
  isOpen,
  onClose,
}: DistributionModalProps) {
  const [loading, setLoading] = useState(true);
  const [distributionData, setDistributionData] = useState<any>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'recommended' | 'all' | 'social'>('recommended');

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

  const openPlatform = (url: string) => {
    window.open(url, '_blank', 'width=600,height=700,scrollbars=yes');
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
              <p className="text-sm text-zinc-400">Share to 20+ platforms instantly</p>
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
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                SEO Indexed ✓
              </span>
              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                OG Image Ready ✓
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('recommended')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'recommended' 
                ? 'bg-blue-500 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Zap size={16} />
            Recommended
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'all' 
                ? 'bg-blue-500 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Globe size={16} />
            All Platforms
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Quick Share Row */}
              {distributionData?.quick_share && (
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