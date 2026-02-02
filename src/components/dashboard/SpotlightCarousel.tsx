// FILE: src/components/dashboard/SpotlightCarousel.tsx
// Personalized Spotlight Carousel with:
// - Adaptive learning indicator (🌱 → 🌿 → 🌳 → ✨)
// - Category filter chips
// - Hide item button (negative learning)
// - Quick watchlist button
// - Onboarding interests integration
// - Profile sync

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ShieldCheck,
  MapPin,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  X,
  RefreshCw,
  Truck,
  Heart,
  EyeOff,
  Filter,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  trackItemClick,
  trackItemView,
  hideItem,
  getHiddenItems,
  setActiveFilter,
  getActiveFilter,
  buildQueryParams,
  requestLocation,
  initializeSpotlightTracking,
  fetchWatchlistKeywords,
  addToWatchlist,
  getPersonalizationStatus,
  CATEGORY_CHIPS,
  type PersonalizationStatus,
} from '@/lib/spotlightTracking';

// ============================================================================
// TYPES
// ============================================================================

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
}

interface SpotlightCarouselProps {
  className?: string;
  speed?: number;
  showControls?: boolean;
  dismissible?: boolean;
  refreshInterval?: number;
  onItemClick?: (item: SpotlightItem) => void;
}

// ============================================================================
// LAZY IMAGE COMPONENT
// ============================================================================

const LazyImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className = '' }) => {
  const [imageSrc, setImageSrc] = useState('/placeholder.svg');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);

    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setLoaded(true);
    };
    img.onerror = () => {
      setError(true);
      setImageSrc('/placeholder.svg');
    };
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-zinc-800">
      {!loaded && !error && (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
      )}
      <img
        src={imageSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn(
          className,
          'transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
};

// ============================================================================
// ITEM CARD COMPONENT
// ============================================================================

const SpotlightItemCard: React.FC<{
  item: SpotlightItem;
  onClick: () => void;
  onHide: () => void;
  onWatchlist: () => void;
  isHiding?: boolean;
}> = ({ item, onClick, onHide, onWatchlist, isHiding }) => {
  const [showActions, setShowActions] = useState(false);
  const isGoodDeal = item.estimated_value && item.asking_price < item.estimated_value * 0.85;
  const savings = isGoodDeal
    ? Math.round(((item.estimated_value! - item.asking_price) / item.estimated_value!) * 100)
    : 0;

  const detailUrl = `/arena/challenge/${item.listing_id}`;

  // Track view when card becomes visible
  useEffect(() => {
    trackItemView(item.listing_id, item.category);
  }, [item.listing_id, item.category]);

  return (
    <div
      className="relative flex-shrink-0 group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={() => setShowActions(true)}
    >
      {/* Action buttons overlay */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute top-1 right-1 z-20 flex flex-col gap-1"
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 w-7 p-0 bg-black/70 hover:bg-black/90 border-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onHide();
                    }}
                  >
                    <EyeOff className="h-3.5 w-3.5 text-zinc-300" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Hide this item</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 w-7 p-0 bg-black/70 hover:bg-rose-500/90 border-0 transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onWatchlist();
                    }}
                  >
                    <Heart className="h-3.5 w-3.5 text-zinc-300" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Add to Watchlist</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        )}
      </AnimatePresence>

      <Link
        to={detailUrl}
        onClick={onClick}
        className={cn(
          'block',
          isHiding && 'opacity-50 pointer-events-none'
        )}
      >
        <Card
          className={cn(
            'overflow-hidden transition-all duration-200 w-40 sm:w-48',
            'bg-zinc-900/80 hover:bg-zinc-800/90',
            'border-zinc-800/50 hover:border-zinc-700',
            'hover:shadow-xl hover:shadow-black/30',
            'hover:-translate-y-1'
          )}
        >
          <div className="relative overflow-hidden h-32 sm:h-36">
            <LazyImage
              src={item.primary_photo_url || '/placeholder.svg'}
              alt={item.item_name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />

            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {item.is_verified && (
                <Badge className="bg-emerald-500/90 text-white text-[10px] px-1.5 py-0.5 gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  <span className="hidden sm:inline">Verified</span>
                </Badge>
              )}
              {isGoodDeal && (
                <Badge className="bg-amber-500/90 text-black text-[10px] px-1.5 py-0.5 gap-1">
                  <TrendingDown className="h-3 w-3" />
                  {savings}% off
                </Badge>
              )}
            </div>

            {item.shipping_available && (
              <div className="absolute top-2 right-8">
                <Badge variant="secondary" className="bg-blue-500/90 text-white text-[10px] px-1.5 py-0.5 gap-1">
                  <Truck className="h-3 w-3" />
                </Badge>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            <div className="absolute bottom-2 left-2 right-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-bold text-white drop-shadow-lg">
                  ${item.asking_price.toLocaleString()}
                </span>
                {item.estimated_value && item.estimated_value !== item.asking_price && (
                  <span className="text-[10px] sm:text-xs text-zinc-400 line-through">
                    ${item.estimated_value.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-2 sm:p-3">
            <h4 className="text-xs sm:text-sm font-medium text-zinc-200 truncate group-hover:text-white">
              {item.item_name}
            </h4>

            {item.seller_location && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500">
                <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="truncate">{item.seller_location}</span>
              </div>
            )}
          </div>
        </Card>
      </Link>
    </div>
  );
};

// ============================================================================
// CATEGORY FILTER CHIPS
// ============================================================================

const CategoryFilterChips: React.FC<{
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}> = ({ activeFilter, onFilterChange }) => {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
      {CATEGORY_CHIPS.map((chip) => (
        <Button
          key={chip.id}
          variant={activeFilter === chip.id ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs whitespace-nowrap flex-shrink-0 gap-1',
            activeFilter === chip.id
              ? 'bg-primary text-primary-foreground'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          )}
          onClick={() => onFilterChange(chip.id)}
        >
          <span>{chip.icon}</span>
          <span>{chip.label}</span>
        </Button>
      ))}
    </div>
  );
};

// ============================================================================
// PERSONALIZATION BADGE
// ============================================================================

const PersonalizationBadge: React.FC<{
  status: PersonalizationStatus;
}> = ({ status }) => {
  // Color based on confidence level
  const getBadgeStyles = () => {
    if (status.confidence >= 75) {
      return 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10';
    }
    if (status.confidence >= 50) {
      return 'border-blue-500/40 text-blue-400 bg-blue-500/10';
    }
    if (status.confidence >= 25) {
      return 'border-amber-500/40 text-amber-400 bg-amber-500/10';
    }
    return 'border-zinc-500/40 text-zinc-400 bg-zinc-500/10';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1.5 py-0 h-4 cursor-help transition-colors',
              getBadgeStyles()
            )}
          >
            <span className="mr-0.5">{status.icon}</span>
            <span className="hidden sm:inline">{status.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px]">
          <div className="space-y-1">
            <p className="font-medium">{status.description}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{status.confidence}% confidence</span>
              <span>•</span>
              <span>{status.dataPoints} interactions</span>
            </div>
            {status.confidence < 50 && (
              <p className="text-xs text-amber-400/80 mt-1">
                Keep browsing to improve your recommendations!
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SpotlightCarousel: React.FC<SpotlightCarouselProps> = ({
  className,
  speed = 25,
  showControls = true,
  dismissible = true,
  refreshInterval = 180000,
  onItemClick,
}) => {
  const [items, setItems] = useState<SpotlightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personalized, setPersonalized] = useState(false);
  const [personalizationStatus, setPersonalizationStatus] = useState<PersonalizationStatus | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [activeFilter, setActiveFilterState] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [hidingItemId, setHidingItemId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const locationRequestedRef = useRef(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  const itemWidth = 200;
  const totalWidth = items.length * itemWidth;

  // Initialize tracking on mount
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      initializeSpotlightTracking().then(() => {
        setActiveFilterState(getActiveFilter());
        setPersonalizationStatus(getPersonalizationStatus());
      });
    }
  }, []);

  // Update personalization status periodically
  useEffect(() => {
    const updateStatus = () => {
      setPersonalizationStatus(getPersonalizationStatus());
    };

    // Update after any user interaction might have changed it
    const interval = setInterval(updateStatus, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchItems = useCallback(async (filter?: string) => {
    try {
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const params = buildQueryParams(filter || activeFilter);
      params.set('limit', '15');

      // Fetch watchlist keywords for boosting
      const watchlistKeywords = await fetchWatchlistKeywords();
      if (watchlistKeywords.length > 0) {
        params.set('watchlist_keywords', watchlistKeywords.join(','));
      }

      const response = await fetch(
        `/api/dashboard/spotlight-items?${params.toString()}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch spotlight items');
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        // Filter out hidden items client-side as backup
        const hiddenIds = getHiddenItems();
        const visibleItems = data.items.filter(
          (item: SpotlightItem) => !hiddenIds.includes(item.listing_id)
        );
        setItems(visibleItems);
        setPersonalized(data.personalized || false);
      } else {
        setItems([]);
      }

      // Update personalization status after fetch
      setPersonalizationStatus(getPersonalizationStatus());
    } catch (err: any) {
      console.error('Spotlight fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  // Initial fetch with location
  useEffect(() => {
    if (!locationRequestedRef.current) {
      locationRequestedRef.current = true;
      requestLocation().then(() => fetchItems());
    } else {
      fetchItems();
    }
  }, [fetchItems]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      refreshTimerRef.current = setInterval(fetchItems, refreshInterval);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchItems, refreshInterval]);

  // Animation loop
  const animate = useCallback(
    (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (!isPaused && items.length > 0) {
        setScrollPosition((prev) => {
          const newPos = prev + (speed * delta) / 1000;
          return newPos >= totalWidth ? 0 : newPos;
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    },
    [isPaused, speed, totalWidth, items.length]
  );

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [animate]);

  // Handlers
  const scrollBy = (direction: 'left' | 'right') => {
    const amount = itemWidth * 2;
    setScrollPosition((prev) => {
      if (direction === 'left') return Math.max(0, prev - amount);
      const newPos = prev + amount;
      return newPos >= totalWidth ? 0 : newPos;
    });
  };

  const handleItemClick = (item: SpotlightItem) => {
    trackItemClick(item.id, item.listing_id, item.category, item.asking_price);
    // Update status after click
    setTimeout(() => setPersonalizationStatus(getPersonalizationStatus()), 100);
    onItemClick?.(item);
  };

  const handleHideItem = async (item: SpotlightItem) => {
    setHidingItemId(item.listing_id);
    
    // Hide locally immediately (also learns from the category)
    hideItem(item.listing_id, item.category);
    
    // Remove from displayed items
    setItems(prev => prev.filter(i => i.listing_id !== item.listing_id));
    
    // Update personalization status
    setTimeout(() => setPersonalizationStatus(getPersonalizationStatus()), 100);
    
    toast.success('Item hidden', {
      description: 'We\'ll learn from this to improve your feed.',
      action: {
        label: 'Undo',
        onClick: () => {
          fetchItems();
        },
      },
    });
    
    setHidingItemId(null);
  };

  const handleAddToWatchlist = async (item: SpotlightItem) => {
    // Extract keywords from item name
    const keywords = item.item_name
      .split(/[\s,\-]+/)
      .filter(word => word.length > 2)
      .slice(0, 5);

    if (keywords.length === 0) {
      toast.error('Could not extract keywords from item name');
      return;
    }

    const success = await addToWatchlist(keywords);
    
    if (success) {
      toast.success('Added to Watchlist! 💜', {
        description: `Keywords: ${keywords.join(', ')}`,
      });
    } else {
      toast.error('Failed to add to watchlist', {
        description: 'Please try again or sign in.',
      });
    }
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilterState(filter);
    setActiveFilter(filter);
    setLoading(true);
    fetchItems(filter);
  };

  if (isDismissed) return null;

  if (loading) {
    return (
      <div className={cn('bg-zinc-900/50 border-b border-zinc-800/50', className)}>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-zinc-300">Spotlight</span>
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-48 w-40 sm:w-48 rounded-xl bg-zinc-800 flex-shrink-0"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !loading) {
    return (
      <div className={cn('bg-zinc-900/50 border-b border-zinc-800/50', className)}>
        <div className="px-4 py-6 text-center">
          <Sparkles className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">
            {activeFilter !== 'all' 
              ? `No items in "${activeFilter}" category. Try "All"!`
              : 'No spotlight items available right now.'}
          </p>
          {activeFilter !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => handleFilterChange('all')}
            >
              Show All Items
            </Button>
          )}
        </div>
      </div>
    );
  }

  const displayItems = [...items, ...items];

  return (
    <div
      className={cn(
        'bg-gradient-to-b from-zinc-900/80 to-zinc-950/50',
        'border-b border-zinc-800/30 backdrop-blur-sm',
        'relative overflow-hidden',
        className
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 2000)}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-zinc-300">Spotlight</span>
            
            {/* Adaptive Personalization Badge */}
            {personalizationStatus && (
              <PersonalizationBadge status={personalizationStatus} />
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Filter toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showFilters ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'h-7 w-7 p-0',
                      showFilters 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Filter Categories</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {showControls && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                        onClick={() => setIsPaused(!isPaused)}
                      >
                        {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{isPaused ? 'Play' : 'Pause'}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                  onClick={() => scrollBy('left')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                  onClick={() => scrollBy('right')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                        onClick={() => {
                          setLoading(true);
                          fetchItems();
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Refresh</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}

            {dismissible && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                onClick={() => setIsDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Category filter chips */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CategoryFilterChips
                activeFilter={activeFilter}
                onFilterChange={handleFilterChange}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Carousel */}
      <div ref={containerRef} className="relative overflow-hidden pb-4">
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-zinc-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-zinc-900 to-transparent z-10 pointer-events-none" />

        <motion.div
          className="flex gap-3 px-4"
          style={{ transform: `translateX(-${scrollPosition}px)` }}
        >
          {displayItems.map((item, index) => (
            <SpotlightItemCard
              key={`${item.listing_id}-${index}`}
              item={item}
              onClick={() => handleItemClick(item)}
              onHide={() => handleHideItem(item)}
              onWatchlist={() => handleAddToWatchlist(item)}
              isHiding={hidingItemId === item.listing_id}
            />
          ))}
        </motion.div>
      </div>

      {error && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
};

export default SpotlightCarousel;