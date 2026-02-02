// FILE: src/components/dashboard/SpotlightCarousel.tsx
// Personalized Spotlight Carousel - Live marketplace items with auto-scroll
// Mobile-first, personalized, auto-refreshing

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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

// ============================================================================
// INLINE TRACKING UTILITIES
// ============================================================================

const STORAGE_KEY = 'tagnetiq_spotlight_prefs';

interface SpotlightPrefs {
  viewed_item_ids: string[];
  viewed_categories: string[];
  price_history: number[];
  clicked_item_ids: string[];
  location?: {
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    country?: string;
  };
  last_updated: string;
}

const defaultPrefs: SpotlightPrefs = {
  viewed_item_ids: [],
  viewed_categories: [],
  price_history: [],
  clicked_item_ids: [],
  last_updated: new Date().toISOString(),
};

function getPrefs(): SpotlightPrefs {
  try {
    if (typeof window === 'undefined') return { ...defaultPrefs };
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultPrefs, ...JSON.parse(stored) };
  } catch (e) {
    console.warn('Failed to load prefs:', e);
  }
  return { ...defaultPrefs };
}

function savePrefs(prefs: SpotlightPrefs): void {
  try {
    if (typeof window === 'undefined') return;
    prefs.last_updated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save prefs:', e);
  }
}

function trackClick(itemId: string, category?: string, price?: number): void {
  const prefs = getPrefs();
  
  prefs.clicked_item_ids = [
    itemId,
    ...prefs.clicked_item_ids.filter(id => id !== itemId)
  ].slice(0, 100);
  
  if (category && category !== 'all') {
    prefs.viewed_categories = [
      category,
      ...prefs.viewed_categories.filter(c => c !== category)
    ].slice(0, 15);
  }
  
  if (price && price > 0) {
    prefs.price_history = [price, ...prefs.price_history].slice(0, 100);
  }
  
  savePrefs(prefs);
}

function getTopCategories(count: number = 5): string[] {
  const prefs = getPrefs();
  const frequency: Record<string, number> = {};
  prefs.viewed_categories.forEach((cat, index) => {
    const weight = 1 + (prefs.viewed_categories.length - index) / prefs.viewed_categories.length;
    frequency[cat] = (frequency[cat] || 0) + weight;
  });
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([cat]) => cat);
}

function getPreferredPriceRange(): { min: number; max: number } | null {
  const prefs = getPrefs();
  if (prefs.price_history.length < 5) return null;
  const sorted = [...prefs.price_history].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  return {
    min: Math.max(0, Math.round(sorted[q1Index] * 0.5)),
    max: Math.round(sorted[q3Index] * 2),
  };
}

function buildQueryParams(): URLSearchParams {
  const params = new URLSearchParams();
  const prefs = getPrefs();
  
  const topCategories = getTopCategories(5);
  if (topCategories.length > 0) {
    params.set('categories', topCategories.join(','));
  }
  
  const priceRange = getPreferredPriceRange();
  if (priceRange) {
    params.set('min_price', priceRange.min.toString());
    params.set('max_price', priceRange.max.toString());
  }
  
  if (prefs.location) {
    params.set('lat', prefs.location.lat.toString());
    params.set('lng', prefs.location.lng.toString());
    if (prefs.location.state) params.set('state', prefs.location.state);
    if (prefs.location.city) params.set('city', prefs.location.city);
  }
  
  return params;
}

async function requestLocation(): Promise<SpotlightPrefs['location'] | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { 
              headers: { 'User-Agent': 'TagnetIQ/1.0' },
              signal: controller.signal
            }
          );
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            const location: SpotlightPrefs['location'] = {
              lat,
              lng,
              city: data.address?.city || data.address?.town || data.address?.village,
              state: data.address?.state,
              country: data.address?.country,
            };
            
            const prefs = getPrefs();
            prefs.location = location;
            savePrefs(prefs);
            resolve(location);
            return;
          }
        } catch (e) {
          console.warn('Geocoding failed:', e);
        }
        
        const location = { lat, lng };
        const prefs = getPrefs();
        prefs.location = location;
        savePrefs(prefs);
        resolve(location);
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 600000, enableHighAccuracy: false }
    );
  });
}

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
}> = ({ item, onClick }) => {
  const isGoodDeal = item.estimated_value && item.asking_price < item.estimated_value * 0.85;
  const savings = isGoodDeal
    ? Math.round(((item.estimated_value! - item.asking_price) / item.estimated_value!) * 100)
    : 0;

  // FIXED: Use correct route - /arena/challenge/:id
  const detailUrl = `/arena/challenge/${item.listing_id}`;

  return (
    <Link
      to={detailUrl}
      onClick={onClick}
      className="block flex-shrink-0 group"
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
            <div className="absolute top-2 right-2">
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
  const [isPaused, setIsPaused] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const locationRequestedRef = useRef(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const itemWidth = 200;
  const totalWidth = items.length * itemWidth;

  const fetchItems = useCallback(async () => {
    try {
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const params = buildQueryParams();
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

  useEffect(() => {
    if (!locationRequestedRef.current) {
      locationRequestedRef.current = true;
      requestLocation().then(() => fetchItems());
    } else {
      fetchItems();
    }
  }, [fetchItems]);

  useEffect(() => {
    if (refreshInterval > 0) {
      refreshTimerRef.current = setInterval(fetchItems, refreshInterval);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchItems, refreshInterval]);

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

  const scrollBy = (direction: 'left' | 'right') => {
    const amount = itemWidth * 2;
    setScrollPosition((prev) => {
      if (direction === 'left') return Math.max(0, prev - amount);
      const newPos = prev + amount;
      return newPos >= totalWidth ? 0 : newPos;
    });
  };

  const handleItemClick = (item: SpotlightItem) => {
    trackClick(item.listing_id, item.category, item.asking_price);
    onItemClick?.(item);
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

  if (items.length === 0) return null;

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
      </div>

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