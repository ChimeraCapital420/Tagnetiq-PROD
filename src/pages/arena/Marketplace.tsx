// FILE: src/pages/arena/Marketplace.tsx
// TagnetIQ Marketplace v2.0 - "Gallery Commerce" Design
// Clean, curated, collector-focused marketplace

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, SlidersHorizontal, Grid3X3, LayoutGrid, 
  ShieldCheck, TrendingUp, TrendingDown, Minus,
  ExternalLink, Share2, Heart, HeartOff, Eye,
  Package, Filter, X, ChevronDown, Sparkles,
  DollarSign, Tag, Clock, MapPin, Star,
  Copy, Facebook, Globe, Store
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useAppContext } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface MarketplaceItem {
  id: string;
  challenge_id: string;
  item_name: string;
  asking_price: number;
  estimated_value?: number;
  primary_photo_url: string;
  additional_photos?: string[];
  is_verified: boolean;
  confidence_score?: number;
  category?: string;
  condition?: string;
  seller_name?: string;
  seller_rating?: number;
  location?: string;
  listed_at?: string;
  views?: number;
  watchlist_count?: number;
  description?: string;
}

interface FilterState {
  category: string;
  priceRange: [number, number];
  verifiedOnly: boolean;
  sortBy: string;
  condition: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORIES = [
  { id: 'all', label: 'All Items', icon: Package },
  { id: 'coins', label: 'Coins', icon: DollarSign },
  { id: 'trading_cards', label: 'Trading Cards', icon: Grid3X3 },
  { id: 'sports_cards', label: 'Sports Cards', icon: Star },
  { id: 'vinyl_records', label: 'Vinyl', icon: Star },
  { id: 'comics', label: 'Comics', icon: Star },
  { id: 'stamps', label: 'Stamps', icon: Tag },
  { id: 'toys', label: 'Toys & Games', icon: Package },
  { id: 'art', label: 'Art', icon: Sparkles },
  { id: 'jewelry', label: 'Jewelry', icon: Sparkles },
  { id: 'watches', label: 'Watches', icon: Clock },
  { id: 'memorabilia', label: 'Memorabilia', icon: Star },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'best_deal', label: 'Best Deals' },
  { value: 'most_viewed', label: 'Most Viewed' },
  { value: 'ending_soon', label: 'Ending Soon' },
];

const CONDITION_OPTIONS = [
  { value: 'all', label: 'Any Condition' },
  { value: 'mint', label: 'Mint / New' },
  { value: 'near_mint', label: 'Near Mint' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

const EXPORT_PLATFORMS = [
  { id: 'ebay', name: 'eBay', icon: Globe, color: 'bg-blue-500' },
  { id: 'facebook', name: 'Facebook Marketplace', icon: Facebook, color: 'bg-blue-600' },
  { id: 'mercari', name: 'Mercari', icon: Store, color: 'bg-red-500' },
  { id: 'craigslist', name: 'Craigslist', icon: Globe, color: 'bg-purple-500' },
  { id: 'offerup', name: 'OfferUp', icon: Store, color: 'bg-green-500' },
  { id: 'poshmark', name: 'Poshmark', icon: Store, color: 'bg-pink-500' },
];

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/**
 * Price Fairness Indicator
 * Compares asking price to HYDRA estimated value
 */
const PriceFairnessIndicator: React.FC<{ 
  askingPrice: number; 
  estimatedValue?: number;
  size?: 'sm' | 'md';
}> = ({ askingPrice, estimatedValue, size = 'sm' }) => {
  if (!estimatedValue || estimatedValue === 0) return null;
  
  const ratio = askingPrice / estimatedValue;
  
  let status: 'great' | 'fair' | 'high';
  let label: string;
  let Icon: any;
  let colorClass: string;
  
  if (ratio <= 0.85) {
    status = 'great';
    label = 'Great Deal';
    Icon = TrendingDown;
    colorClass = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  } else if (ratio <= 1.15) {
    status = 'fair';
    label = 'Fair Price';
    Icon = Minus;
    colorClass = 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  } else {
    status = 'high';
    label = 'Above Market';
    Icon = TrendingUp;
    colorClass = 'text-rose-400 bg-rose-400/10 border-rose-400/20';
  }
  
  if (size === 'sm') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border',
              colorClass
            )}>
              <Icon className="h-3 w-3" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">
              HYDRA Value: ${estimatedValue.toLocaleString()}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border',
      colorClass
    )}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
};

/**
 * Confidence Score Badge
 */
const ConfidenceBadge: React.FC<{ score?: number }> = ({ score }) => {
  if (!score) return null;
  
  const percentage = Math.round(score * 100);
  let colorClass = 'bg-zinc-500/20 text-zinc-400';
  
  if (percentage >= 95) {
    colorClass = 'bg-emerald-500/20 text-emerald-400';
  } else if (percentage >= 85) {
    colorClass = 'bg-amber-500/20 text-amber-400';
  } else if (percentage >= 70) {
    colorClass = 'bg-orange-500/20 text-orange-400';
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className={cn('text-xs font-mono', colorClass)}>
            {percentage}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>HYDRA Confidence Score</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Export to Platform Dropdown
 */
const ExportDropdown: React.FC<{ 
  item: MarketplaceItem;
  onExport: (item: MarketplaceItem, platform: string) => void;
}> = ({ item, onExport }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="secondary" 
          size="sm" 
          className="h-8 gap-1.5 bg-white/5 hover:bg-white/10 border-white/10"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Export Listing To
        </div>
        <DropdownMenuSeparator />
        {EXPORT_PLATFORMS.map((platform) => (
          <DropdownMenuItem 
            key={platform.id}
            onClick={() => onExport(item, platform.id)}
            className="gap-2 cursor-pointer"
          >
            <div className={cn('p-1 rounded', platform.color)}>
              <platform.icon className="h-3 w-3 text-white" />
            </div>
            {platform.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => {
            navigator.clipboard.writeText(
              `${item.item_name} - $${item.asking_price}\n${window.location.origin}/arena/challenge/${item.challenge_id}`
            );
            toast.success('Listing copied to clipboard');
          }}
          className="gap-2 cursor-pointer"
        >
          <Copy className="h-4 w-4" />
          Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * Marketplace Item Card
 */
const MarketplaceCard: React.FC<{
  item: MarketplaceItem;
  layout: 'grid' | 'compact';
  onWatchlist: (id: string) => void;
  onExport: (item: MarketplaceItem, platform: string) => void;
  isWatchlisted?: boolean;
}> = ({ item, layout, onWatchlist, onExport, isWatchlisted = false }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const timeAgo = useMemo(() => {
    if (!item.listed_at) return null;
    const diff = Date.now() - new Date(item.listed_at).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  }, [item.listed_at]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link to={`/arena/challenge/${item.challenge_id}`}>
        <Card className={cn(
          'group relative overflow-hidden transition-all duration-300',
          'bg-gradient-to-b from-zinc-900/50 to-zinc-950/80',
          'border-zinc-800/50 hover:border-zinc-700/80',
          'hover:shadow-xl hover:shadow-black/20',
          layout === 'compact' && 'flex flex-row h-32'
        )}>
          {/* Image Container */}
          <div className={cn(
            'relative overflow-hidden bg-zinc-900',
            layout === 'grid' ? 'aspect-square' : 'w-32 h-32 flex-shrink-0'
          )}>
            {!imageLoaded && (
              <Skeleton className="absolute inset-0" />
            )}
            <img
              src={item.primary_photo_url || '/placeholder.svg'}
              alt={item.item_name}
              onLoad={() => setImageLoaded(true)}
              className={cn(
                'w-full h-full object-cover transition-transform duration-500',
                'group-hover:scale-110',
                !imageLoaded && 'opacity-0'
              )}
            />
            
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Top Badges */}
            <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
              <div className="flex flex-col gap-1.5">
                {item.is_verified && (
                  <Badge className="bg-emerald-500/90 text-white border-0 shadow-lg">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
                <PriceFairnessIndicator 
                  askingPrice={item.asking_price} 
                  estimatedValue={item.estimated_value}
                />
              </div>
              
              <ConfidenceBadge score={item.confidence_score} />
            </div>
            
            {/* Quick Actions (visible on hover) */}
            <AnimatePresence>
              {isHovered && layout === 'grid' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-2 left-2 right-2 flex gap-2"
                  onClick={(e) => e.preventDefault()}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 h-8 bg-white/10 backdrop-blur-sm hover:bg-white/20 border-white/10"
                    onClick={(e) => {
                      e.preventDefault();
                      onWatchlist(item.id);
                    }}
                  >
                    {isWatchlisted ? (
                      <HeartOff className="h-3.5 w-3.5 mr-1.5" />
                    ) : (
                      <Heart className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {isWatchlisted ? 'Remove' : 'Watch'}
                  </Button>
                  <ExportDropdown item={item} onExport={onExport} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Content */}
          <CardContent className={cn(
            'flex flex-col',
            layout === 'grid' ? 'p-4' : 'p-3 flex-1 justify-center'
          )}>
            {/* Category & Time */}
            <div className="flex items-center gap-2 mb-1.5">
              {item.category && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-zinc-800/50">
                  {item.category}
                </Badge>
              )}
              {timeAgo && (
                <span className="text-[10px] text-zinc-500">{timeAgo}</span>
              )}
            </div>
            
            {/* Title */}
            <h3 className={cn(
              'font-semibold text-zinc-100 leading-tight',
              layout === 'grid' ? 'text-sm line-clamp-2 mb-2' : 'text-sm line-clamp-1 mb-1'
            )}>
              {item.item_name}
            </h3>
            
            {/* Price Row */}
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-lg font-bold text-white">
                ${item.asking_price.toLocaleString()}
              </span>
              {item.estimated_value && item.estimated_value !== item.asking_price && (
                <span className="text-xs text-zinc-500 line-through">
                  ${item.estimated_value.toLocaleString()}
                </span>
              )}
            </div>
            
            {/* Meta Info */}
            {layout === 'grid' && (
              <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500">
                {item.views !== undefined && (
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {item.views}
                  </span>
                )}
                {item.watchlist_count !== undefined && (
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {item.watchlist_count}
                  </span>
                )}
                {item.location && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3" />
                    {item.location}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
};

/**
 * Category Pills
 */
const CategoryPills: React.FC<{
  selected: string;
  onSelect: (category: string) => void;
}> = ({ selected, onSelect }) => {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.id}
            variant={selected === cat.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelect(cat.id)}
            className={cn(
              'rounded-full px-4 h-9 flex-shrink-0 transition-all',
              selected === cat.id 
                ? 'bg-white text-black hover:bg-zinc-200' 
                : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
            )}
          >
            <cat.icon className="h-3.5 w-3.5 mr-1.5" />
            {cat.label}
          </Button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

/**
 * Filter Panel (Sheet for mobile, sidebar for desktop)
 */
const FilterPanel: React.FC<{
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  maxPrice: number;
}> = ({ filters, onChange, maxPrice }) => {
  return (
    <div className="space-y-6">
      {/* Sort */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Sort By
        </Label>
        <Select
          value={filters.sortBy}
          onValueChange={(value) => onChange({ ...filters, sortBy: value })}
        >
          <SelectTrigger className="bg-zinc-900/50 border-zinc-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Price Range */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Price Range
          </Label>
          <span className="text-sm text-zinc-300">
            ${filters.priceRange[0]} - ${filters.priceRange[1] >= maxPrice ? `${maxPrice}+` : filters.priceRange[1]}
          </span>
        </div>
        <Slider
          value={filters.priceRange}
          onValueChange={(value) => onChange({ ...filters, priceRange: value as [number, number] })}
          max={maxPrice}
          step={10}
          className="py-2"
        />
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.priceRange[0]}
            onChange={(e) => onChange({ 
              ...filters, 
              priceRange: [parseInt(e.target.value) || 0, filters.priceRange[1]] 
            })}
            className="bg-zinc-900/50 border-zinc-800 h-9"
          />
          <Input
            type="number"
            placeholder="Max"
            value={filters.priceRange[1]}
            onChange={(e) => onChange({ 
              ...filters, 
              priceRange: [filters.priceRange[0], parseInt(e.target.value) || maxPrice] 
            })}
            className="bg-zinc-900/50 border-zinc-800 h-9"
          />
        </div>
      </div>
      
      {/* Condition */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Condition
        </Label>
        <Select
          value={filters.condition}
          onValueChange={(value) => onChange({ ...filters, condition: value })}
        >
          <SelectTrigger className="bg-zinc-900/50 border-zinc-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Verified Only */}
      <div className="flex items-center justify-between py-2">
        <div className="space-y-0.5">
          <Label className="text-sm">Verified Only</Label>
          <p className="text-xs text-zinc-500">Show HYDRA verified items</p>
        </div>
        <Switch
          checked={filters.verifiedOnly}
          onCheckedChange={(checked) => onChange({ ...filters, verifiedOnly: checked })}
        />
      </div>
      
      <Separator className="bg-zinc-800" />
      
      {/* Reset */}
      <Button
        variant="outline"
        className="w-full border-zinc-800 hover:bg-zinc-800"
        onClick={() => onChange({
          category: 'all',
          priceRange: [0, maxPrice],
          verifiedOnly: false,
          sortBy: 'newest',
          condition: 'all',
        })}
      >
        Reset Filters
      </Button>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const Marketplace: React.FC = () => {
  const { searchArenaQuery, setSearchArenaQuery } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchArenaQuery || searchParams.get('q') || '');
  const [layout, setLayout] = useState<'grid' | 'compact'>('grid');
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    category: searchParams.get('category') || 'all',
    priceRange: [0, 10000],
    verifiedOnly: false,
    sortBy: 'newest',
    condition: 'all',
  });

  // Fetch marketplace data
  const fetchMarketplaceData = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('searchQuery', query);
      if (filters.category !== 'all') params.set('category', filters.category);
      if (filters.verifiedOnly) params.set('verified', 'true');
      params.set('sort', filters.sortBy);
      
      const url = `/api/arena/marketplace?${params.toString()}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error('Failed to fetch marketplace data.');
      
      const data = await response.json();
      setItems(data);
    } catch (error) {
      toast.error("Error Loading Marketplace", { 
        description: (error as Error).message 
      });
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.verifiedOnly, filters.sortBy]);

  // Initial load
  useEffect(() => {
    if (searchArenaQuery) {
      setSearchTerm(searchArenaQuery);
      fetchMarketplaceData(searchArenaQuery);
      setSearchArenaQuery('');
    } else {
      fetchMarketplaceData(searchTerm);
    }
  }, [searchArenaQuery, fetchMarketplaceData, setSearchArenaQuery]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMarketplaceData(searchTerm);
    setSearchParams(searchTerm ? { q: searchTerm } : {});
  };

  // Handle category change
  const handleCategoryChange = (category: string) => {
    setFilters(prev => ({ ...prev, category }));
    setSearchParams(params => {
      if (category === 'all') {
        params.delete('category');
      } else {
        params.set('category', category);
      }
      return params;
    });
  };

  // Handle watchlist toggle
  const handleWatchlistToggle = (itemId: string) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        toast.success('Removed from watchlist');
      } else {
        next.add(itemId);
        toast.success('Added to watchlist');
      }
      return next;
    });
  };

  // Handle export
  const handleExport = async (item: MarketplaceItem, platform: string) => {
    toast.loading(`Preparing ${platform} listing...`, { id: 'export' });
    
    // Simulate export preparation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const platformUrls: Record<string, string> = {
      ebay: `https://www.ebay.com/sl/sell`,
      facebook: `https://www.facebook.com/marketplace/create/item`,
      mercari: `https://www.mercari.com/sell/`,
      craigslist: `https://post.craigslist.org/`,
      offerup: `https://offerup.com/post`,
      poshmark: `https://poshmark.com/create-listing`,
    };
    
    // Copy listing details to clipboard
    const listingText = `
${item.item_name}

Price: $${item.asking_price}
${item.condition ? `Condition: ${item.condition}` : ''}
${item.description || ''}

Listed on TagnetIQ Marketplace
    `.trim();
    
    await navigator.clipboard.writeText(listingText);
    
    toast.success(`Opening ${platform}`, {
      id: 'export',
      description: 'Listing details copied to clipboard',
      action: {
        label: 'Open',
        onClick: () => window.open(platformUrls[platform], '_blank'),
      },
    });
    
    window.open(platformUrls[platform], '_blank');
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filters.priceRange[0] > 0 && item.asking_price < filters.priceRange[0]) return false;
      if (filters.priceRange[1] < 10000 && item.asking_price > filters.priceRange[1]) return false;
      if (filters.verifiedOnly && !item.is_verified) return false;
      if (filters.condition !== 'all' && item.condition !== filters.condition) return false;
      return true;
    });
  }, [items, filters]);

  // Stats
  const stats = useMemo(() => ({
    total: filteredItems.length,
    verified: filteredItems.filter(i => i.is_verified).length,
    avgPrice: filteredItems.length 
      ? Math.round(filteredItems.reduce((sum, i) => sum + i.asking_price, 0) / filteredItems.length)
      : 0,
  }), [filteredItems]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-blue-500/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-transparent to-transparent" />
        
        <div className="container mx-auto px-4 py-8 relative">
          {/* Title */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Marketplace
              </h1>
              <p className="text-zinc-400 mt-1">
                Discover verified collectibles from trusted sellers
              </p>
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-zinc-500">Listings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">{stats.verified}</div>
                <div className="text-zinc-500">Verified</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">${stats.avgPrice}</div>
                <div className="text-zinc-500">Avg Price</div>
              </div>
            </div>
          </div>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search collectibles, cards, coins, vinyl..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 bg-zinc-900/80 border-zinc-800 text-white placeholder:text-zinc-500 focus:border-zinc-700 focus:ring-zinc-700"
              />
            </div>
            <Button 
              type="submit" 
              size="lg"
              className="h-12 px-6 bg-white text-black hover:bg-zinc-200"
              disabled={loading}
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                'Search'
              )}
            </Button>
          </form>
          
          {/* Category Pills */}
          <CategoryPills 
            selected={filters.category} 
            onSelect={handleCategoryChange} 
          />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Desktop Filters Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </h3>
              <FilterPanel 
                filters={filters} 
                onChange={setFilters}
                maxPrice={10000}
              />
            </div>
          </aside>
          
          {/* Items Grid */}
          <main className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-zinc-400">
                {filteredItems.length} items found
              </p>
              
              <div className="flex items-center gap-2">
                {/* Mobile Filter Button */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="lg:hidden border-zinc-800 hover:bg-zinc-800"
                    >
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="bg-zinc-950 border-zinc-800">
                    <SheetHeader>
                      <SheetTitle className="text-white">Filters</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <FilterPanel 
                        filters={filters} 
                        onChange={setFilters}
                        maxPrice={10000}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
                
                {/* Layout Toggle */}
                <div className="flex border border-zinc-800 rounded-lg p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-8 w-8 p-0',
                      layout === 'grid' && 'bg-zinc-800'
                    )}
                    onClick={() => setLayout('grid')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-8 w-8 p-0',
                      layout === 'compact' && 'bg-zinc-800'
                    )}
                    onClick={() => setLayout('compact')}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Items */}
            {loading ? (
              <div className={cn(
                'grid gap-4',
                layout === 'grid' 
                  ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' 
                  : 'grid-cols-1'
              )}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="bg-zinc-900/50 border-zinc-800">
                    <Skeleton className={cn(
                      'bg-zinc-800',
                      layout === 'grid' ? 'aspect-square' : 'h-32 w-32'
                    )} />
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4 bg-zinc-800" />
                      <Skeleton className="h-6 w-1/2 bg-zinc-800" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-zinc-900 flex items-center justify-center">
                  <Package className="h-10 w-10 text-zinc-700" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Listings Found</h3>
                <p className="text-zinc-500 max-w-md mx-auto">
                  Try adjusting your filters or search terms to find what you're looking for.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4 border-zinc-800"
                  onClick={() => {
                    setSearchTerm('');
                    setFilters({
                      category: 'all',
                      priceRange: [0, 10000],
                      verifiedOnly: false,
                      sortBy: 'newest',
                      condition: 'all',
                    });
                    fetchMarketplaceData('');
                  }}
                >
                  Clear All Filters
                </Button>
              </div>
            ) : (
              <motion.div 
                layout
                className={cn(
                  'grid gap-4',
                  layout === 'grid' 
                    ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' 
                    : 'grid-cols-1 md:grid-cols-2'
                )}
              >
                <AnimatePresence mode="popLayout">
                  {filteredItems.map((item) => (
                    <MarketplaceCard
                      key={item.id}
                      item={item}
                      layout={layout}
                      onWatchlist={handleWatchlistToggle}
                      onExport={handleExport}
                      isWatchlisted={watchlist.has(item.id)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Marketplace;