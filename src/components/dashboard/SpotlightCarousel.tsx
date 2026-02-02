// FILE: src/components/dashboard/SpotlightCarousel.tsx
// Personalized Spotlight Carousel - Live marketplace items with auto-scroll
// Mobile-first, personalized, auto-refreshing

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
import {
  getSpotlightPreferences,
  trackItemClick,
  requestUserLocation,
  buildSpotlightQueryParams,
} from '@/lib/spotlightTracking';

// Types
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
  created_at: string;
}

interface SpotlightCarouselProps {
  className?: string;
  speed?: number; // pixels per second for auto-scroll
  showControls?: boolean;
  dismissible?: boolean;
  refreshInterval?: number; // ms, default 3 minutes
  onItemClick?: (item: SpotlightItem) => void;
  variant?: 'marquee' | 'carousel'; // marquee = continuous scroll, carousel = snap
}

// Lazy loading image component
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

// Individual item card
const SpotlightItemCard: React.FC<{
  item: SpotlightItem;
  onClick: () => void;
  compact?: boolean;
}> = ({ item, onClick, compact = false }) => {
  const isGoodDeal = item.estimated_value && item.asking_price < item.estimated_value * 0.85;
  const savings = isGoodDeal
    ? Math.round(((item.estimated_value! - item.asking_price) / item.estimated_value!) * 100)
    : 0;

  return (
    <Link
      to={`/arena/challenge/${item.id}`}
      onClick={onClick}
      className="block flex-shrink-0 group"
    >
      <Card
        className={cn(
          'overflow-hidden transition-all duration-200',
          'bg-zinc-900/80 hover:bg-zinc-800/90',
          'border-zinc-800/50 hover:border-zinc-700',
          'hover:shadow-xl hover:shadow-black/30',
          'hover:-translate-y-1',
          compact ? 'w-40 sm:w-48' : 'w-56 sm:w-64'
        )}
      >
        {/* Image */}
        <div className={cn(
          'relative overflow-hidden',
          compact ? 'h-32 sm:h-36' : 'h-40 sm:h-48'
        )}>
          <LazyImage
            src={item.primary_photo_url || '/placeholder.svg'}
            alt={item.item_name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />

          {/* Overlay badges */}
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

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Price overlay */}
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

        {/* Content */}
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
  );
};

// Main component
const SpotlightCarousel: React.FC<SpotlightCarouselProps> = ({
  className,
  speed = 25,
  showControls = true,
  dismissible = true,
  refreshInterval = 180000, // 3 minutes
  onItemClick,
  variant = 'marquee',
}) => {
  const [items, setItems] = useState<SpotlightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personalized, setPersonalized] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const locationRequestedRef = useRef(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate total width for seamless loop
  const itemWidth = 240; // Approximate width including gap
  const totalWidth = items.length * itemWidth;

  // Fetch spotlight items
  const fetchItems = useCallback(async () => {
    try {
      setError(null);

      // Get auth token if available
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Build query with preferences
      const params = buildSpotlightQueryParams();
      params.set('limit', '15');

      const response = await fetch(
        `/api/dashboard/spotlight-items?${params.toString()}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch spotlight items');
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        setItems(data.items);
        setPersonalized(data.personalized || false);
      } else {
        setItems([]);
      }
    } catch (err: any) {
      console.error('Spotlight fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Request location on first load
  useEffect(() => {
    if (!locationRequestedRef.current) {
      locationRequestedRef.current = true;
      requestUserLocation().then(() => {
        fetchItems();
      });
    } else {
      fetchItems();
    }
  }, [fetchItems]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      refreshTimerRef.current = setInterval(fetchItems, refreshInterval);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [fetchItems, refreshInterval]);

  // Animation loop for marquee
  const animate = useCallback(
    (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (!isPaused && items.length > 0 && variant === 'marquee') {
        setScrollPosition((prev) => {
          const newPos = prev + (speed * delta) / 1000;
          return newPos >= totalWidth ? 0 : newPos;
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    },
    [isPaused, speed, totalWidth, items.length, variant]
  );

  useEffect(() => {
    if (variant === 'marquee') {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate, variant]);

  // Manual scroll
  const scrollBy = (direction: 'left' | 'right') => {
    const amount = itemWidth * 2;
    setScrollPosition((prev) => {
      if (direction === 'left') {
        return Math.max(0, prev - amount);
      } else {
        const newPos = prev + amount;
        return newPos >= totalWidth ? 0 : newPos;
      }
    });
  };

  // Handle item click
  const handleItemClick = (item: SpotlightItem) => {
    trackItemClick(item.id);
    onItemClick?.(item);
  };

  // Don't render if dismissed
  if (isDismissed) return null;

  // Loading state
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
                className="h-48 w-48 sm:h-56 sm:w-56 rounded-xl bg-zinc-800 flex-shrink-0"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // No items - don't show the component
  if (items.length === 0) return null;

  // Duplicate items for seamless loop
  const displayItems = variant === 'marquee' ? [...items, ...items] : items;

  return (
    <div
      className={cn(
        'bg-gradient-to-b from-zinc-900/80 to-zinc-950/50',
        'border-b border-zinc-800/30',
        'backdrop-blur-sm',
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-zinc-300">Spotlight</span>
            {personalized && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 border-amber-500/30 text-amber-400 bg-amber-500/10"
              >
                For You
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
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
                        {isPaused ? (
                          <Play className="h-3.5 w-3.5" />
                        ) : (
                          <Pause className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {isPaused ? 'Play' : 'Pause'}
                    </TooltipContent>
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
      </div>

      {/* Scrolling items */}
      <div ref={containerRef} className="relative overflow-hidden pb-4">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-zinc-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-zinc-900 to-transparent z-10 pointer-events-none" />

        <motion.div
          className="flex gap-3 px-4"
          style={{
            transform:
              variant === 'marquee'
                ? `translateX(-${scrollPosition}px)`
                : undefined,
          }}
          drag={variant === 'carousel' ? 'x' : false}
          dragConstraints={containerRef}
        >
          {displayItems.map((item, index) => (
            <SpotlightItemCard
              key={`${item.id}-${index}`}
              item={item}
              onClick={() => handleItemClick(item)}
              compact
            />
          ))}
        </motion.div>
      </div>

      {/* Error state */}
      {error && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
};

export default SpotlightCarousel;