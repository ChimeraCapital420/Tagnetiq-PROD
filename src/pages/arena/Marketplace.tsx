// FILE: src/pages/arena/Marketplace.tsx
// TagnetIQ Marketplace v3.0 - With My Listings, Mark Sold, Delete, Dynamic Categories
// Mobile-first with touch actions

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { 
  Search, SlidersHorizontal, Grid3X3, LayoutGrid, 
  ShieldCheck, TrendingUp, TrendingDown, Minus,
  ExternalLink, Heart, HeartOff, Eye,
  Package, Filter, User,
  CheckCircle2, Trash2, MoreVertical, Edit,
  AlertCircle, RefreshCw, Plus, Copy, Facebook, Globe, Store
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
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
  seller_id?: string;
  seller_name?: string;
  seller_rating?: number;
  location?: string;
  listed_at?: string;
  created_at?: string;
  views?: number;
  watchlist_count?: number;
  description?: string;
  status?: 'active' | 'sold' | 'deleted';
  sold_at?: string;
  sold_price?: number;
}

interface FilterState {
  category: string;
  priceRange: [number, number];
  verifiedOnly: boolean;
  sortBy: string;
  condition: string;
}

interface DynamicCategory {
  id: string;
  count: number;
  label?: string;
  icon?: any;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CATEGORIES = [
  { id: 'all', label: 'All Items', icon: Package },
  { id: 'coins', label: 'Coins', icon: Package },
  { id: 'trading_cards', label: 'Trading Cards', icon: Grid3X3 },
  { id: 'pokemon_cards', label: 'Pokemon', icon: Package },
  { id: 'sports_cards', label: 'Sports Cards', icon: Package },
  { id: 'vinyl_records', label: 'Vinyl', icon: Package },
  { id: 'comics', label: 'Comics', icon: Package },
  { id: 'lego', label: 'LEGO', icon: Package },
  { id: 'video_games', label: 'Video Games', icon: Package },
  { id: 'sneakers', label: 'Sneakers', icon: Package },
  { id: 'general', label: 'Other', icon: Package },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
];

const CONDITION_OPTIONS = [
  { value: 'all', label: 'Any Condition' },
  { value: 'mint', label: 'Mint / New' },
  { value: 'near-mint', label: 'Near Mint' },
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
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getCategoryLabel(id: string): string {
  const found = DEFAULT_CATEGORIES.find(c => c.id === id);
  if (found) return found.label;
  return id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getCategoryIcon(id: string): any {
  const found = DEFAULT_CATEGORIES.find(c => c.id === id);
  return found?.icon || Package;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const PriceFairnessIndicator: React.FC<{ 
  askingPrice: number; 
  estimatedValue?: number;
}> = ({ askingPrice, estimatedValue }) => {
  if (!estimatedValue || estimatedValue === 0) return null;
  
  const ratio = askingPrice / estimatedValue;
  
  let Icon: any;
  let colorClass: string;
  let label: string;
  
  if (ratio <= 0.85) {
    Icon = TrendingDown;
    colorClass = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    label = 'Great Deal';
  } else if (ratio <= 1.15) {
    Icon = Minus;
    colorClass = 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    label = 'Fair Price';
  } else {
    Icon = TrendingUp;
    colorClass = 'text-rose-400 bg-rose-400/10 border-rose-400/20';
    label = 'Above Market';
  }
  
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
            Est. Value: ${estimatedValue.toLocaleString()}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'active') return null;
  
  if (status === 'sold') {
    return (
      <Badge className="bg-emerald-500/90 text-white border-0">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Sold
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary" className="bg-zinc-700">
      {status}
    </Badge>
  );
};

const OwnerActionsDropdown: React.FC<{
  item: MarketplaceItem;
  onMarkSold: () => void;
  onDelete: () => void;
  onEdit: () => void;
}> = ({ item, onMarkSold, onDelete, onEdit }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="secondary" 
          size="sm" 
          className="h-8 w-8 p-0 bg-white/10 hover:bg-white/20"
          onClick={(e) => e.preventDefault()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {item.status === 'active' && (
          <>
            <DropdownMenuItem onClick={onMarkSold} className="text-emerald-400">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark as Sold
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Listing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {item.status === 'sold' && (
          <>
            <DropdownMenuItem onClick={onEdit}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Relist Item
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onDelete} className="text-red-400">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Listing
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

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
          onClick={(e) => e.preventDefault()}
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
            toast.success('Link copied to clipboard');
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

const MarketplaceCard: React.FC<{
  item: MarketplaceItem;
  layout: 'grid' | 'compact';
  isOwner: boolean;
  onWatchlist: (id: string) => void;
  onExport: (item: MarketplaceItem, platform: string) => void;
  onMarkSold: (item: MarketplaceItem) => void;
  onDelete: (item: MarketplaceItem) => void;
  isWatchlisted?: boolean;
}> = ({ item, layout, isOwner, onWatchlist, onExport, onMarkSold, onDelete, isWatchlisted = false }) => {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  const timeAgo = useMemo(() => {
    const dateStr = item.created_at || item.listed_at;
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }, [item.created_at, item.listed_at]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 80;
    if (info.offset.x < -threshold && isOwner && item.status === 'active') {
      onMarkSold(item);
    } else if (info.offset.x > threshold && isOwner) {
      onDelete(item);
    }
    setSwipeOffset(0);
  };

  const isSold = item.status === 'sold';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      drag={isOwner ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDrag={(_, info) => setSwipeOffset(info.offset.x)}
      onDragEnd={handleDragEnd}
      style={{ x: swipeOffset }}
      className="relative"
    >
      {isOwner && (
        <>
          <div className={cn(
            'absolute inset-y-0 left-0 w-20 flex items-center justify-center rounded-l-xl transition-opacity',
            'bg-red-500/80',
            swipeOffset > 40 ? 'opacity-100' : 'opacity-0'
          )}>
            <Trash2 className="h-6 w-6 text-white" />
          </div>
          <div className={cn(
            'absolute inset-y-0 right-0 w-20 flex items-center justify-center rounded-r-xl transition-opacity',
            'bg-emerald-500/80',
            swipeOffset < -40 ? 'opacity-100' : 'opacity-0'
          )}>
            <CheckCircle2 className="h-6 w-6 text-white" />
          </div>
        </>
      )}
      
      <Link to={`/arena/challenge/${item.challenge_id}`}>
        <Card className={cn(
          'group relative overflow-hidden transition-all duration-300',
          'bg-gradient-to-b from-zinc-900/50 to-zinc-950/80',
          'border-zinc-800/50 hover:border-zinc-700/80',
          'hover:shadow-xl hover:shadow-black/20',
          layout === 'compact' && 'flex flex-row h-32',
          isSold && 'opacity-75'
        )}>
          <div className={cn(
            'relative overflow-hidden bg-zinc-900',
            layout === 'grid' ? 'aspect-square' : 'w-32 h-32 flex-shrink-0'
          )}>
            {!imageLoaded && <Skeleton className="absolute inset-0" />}
            <img
              src={item.primary_photo_url || '/placeholder.svg'}
              alt={item.item_name}
              onLoad={() => setImageLoaded(true)}
              className={cn(
                'w-full h-full object-cover transition-transform duration-500',
                'group-hover:scale-110',
                !imageLoaded && 'opacity-0',
                isSold && 'grayscale'
              )}
            />
            
            {isSold && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Badge className="bg-emerald-500 text-white text-lg px-4 py-1">
                  SOLD
                </Badge>
              </div>
            )}
            
            <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
              <div className="flex flex-col gap-1.5">
                {item.is_verified && (
                  <Badge className="bg-emerald-500/90 text-white border-0 shadow-lg">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
                <StatusBadge status={item.status || 'active'} />
                {!isSold && (
                  <PriceFairnessIndicator 
                    askingPrice={item.asking_price} 
                    estimatedValue={item.estimated_value}
                  />
                )}
              </div>
              
              {isOwner && (
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  <User className="h-3 w-3 mr-1" />
                  Yours
                </Badge>
              )}
            </div>
            
            <AnimatePresence>
              {isHovered && layout === 'grid' && !isSold && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-2 left-2 right-2 flex gap-2"
                  onClick={(e) => e.preventDefault()}
                >
                  {isOwner ? (
                    <OwnerActionsDropdown
                      item={item}
                      onMarkSold={() => onMarkSold(item)}
                      onDelete={() => onDelete(item)}
                      onEdit={() => navigate(`/arena/edit/${item.id}`)}
                    />
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 h-8 bg-white/10 backdrop-blur-sm hover:bg-white/20"
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
                  )}
                  <ExportDropdown item={item} onExport={onExport} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <CardContent className={cn(
            'flex flex-col',
            layout === 'grid' ? 'p-4' : 'p-3 flex-1 justify-center'
          )}>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {item.category && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-zinc-800/50">
                  {getCategoryLabel(item.category)}
                </Badge>
              )}
              {timeAgo && (
                <span className="text-[10px] text-zinc-500">{timeAgo}</span>
              )}
            </div>
            
            <h3 className={cn(
              'font-semibold text-zinc-100 leading-tight',
              layout === 'grid' ? 'text-sm line-clamp-2 mb-2' : 'text-sm line-clamp-1 mb-1'
            )}>
              {item.item_name}
            </h3>
            
            <div className="flex items-baseline gap-2 mt-auto">
              <span className={cn(
                'text-lg font-bold',
                isSold ? 'text-emerald-400' : 'text-white'
              )}>
                ${(isSold ? item.sold_price || item.asking_price : item.asking_price).toLocaleString()}
              </span>
              {isSold && item.sold_price !== item.asking_price && (
                <span className="text-xs text-zinc-500 line-through">
                  ${item.asking_price.toLocaleString()}
                </span>
              )}
            </div>
            
            {layout === 'grid' && (
              <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500">
                {item.seller_name && !isOwner && (
                  <span className="flex items-center gap-1 truncate">
                    <User className="h-3 w-3" />
                    {item.seller_name}
                  </span>
                )}
                {item.views !== undefined && item.views > 0 && (
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {item.views}
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

const CategoryPills: React.FC<{
  selected: string;
  onSelect: (category: string) => void;
  dynamicCategories: DynamicCategory[];
}> = ({ selected, onSelect, dynamicCategories }) => {
  const categories = useMemo(() => {
    const allCat = { id: 'all', label: 'All Items', icon: Package, count: 0 };
    
    if (dynamicCategories.length === 0) {
      return [allCat, ...DEFAULT_CATEGORIES.slice(1)];
    }
    
    const dynamicWithLabels = dynamicCategories.map(dc => ({
      id: dc.id,
      label: getCategoryLabel(dc.id),
      icon: getCategoryIcon(dc.id),
      count: dc.count
    }));
    
    return [allCat, ...dynamicWithLabels];
  }, [dynamicCategories]);

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={selected === cat.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelect(cat.id)}
            className={cn(
              'rounded-full px-4 h-9 flex-shrink-0 transition-all gap-1.5',
              selected === cat.id 
                ? 'bg-white text-black hover:bg-zinc-200' 
                : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
            )}
          >
            <cat.icon className="h-3.5 w-3.5" />
            {cat.label}
            {cat.count > 0 && (
              <span className="text-[10px] opacity-60">({cat.count})</span>
            )}
          </Button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

const FilterPanel: React.FC<{
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  maxPrice: number;
}> = ({ filters, onChange, maxPrice }) => {
  return (
    <div className="space-y-6">
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
      </div>
      
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
      
      <div className="flex items-center justify-between py-2">
        <div className="space-y-0.5">
          <Label className="text-sm">Verified Only</Label>
          <p className="text-xs text-zinc-500">HYDRA verified items</p>
        </div>
        <Switch
          checked={filters.verifiedOnly}
          onCheckedChange={(checked) => onChange({ ...filters, verifiedOnly: checked })}
        />
      </div>
      
      <Separator className="bg-zinc-800" />
      
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
  const navigate = useNavigate();
  
  // Auth state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Data state
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<DynamicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI state
  const [searchTerm, setSearchTerm] = useState(searchArenaQuery || searchParams.get('q') || '');
  const [layout, setLayout] = useState<'grid' | 'compact'>('grid');
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all');
  const [showSold, setShowSold] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    category: searchParams.get('category') || 'all',
    priceRange: [0, 10000],
    verifiedOnly: false,
    sortBy: 'newest',
    condition: 'all',
  });
  
  // Dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: MarketplaceItem | null }>({ 
    open: false, 
    item: null 
  });
  const [soldDialog, setSoldDialog] = useState<{ open: boolean; item: MarketplaceItem | null }>({ 
    open: false, 
    item: null 
  });

  // =============================================================================
  // AUTH HELPER
  // =============================================================================
  
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  }, []);

  // Get current user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setCurrentUserId(session?.user?.id || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const fetchMarketplaceData = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('searchQuery', query);
      if (filters.category !== 'all') params.set('category', filters.category);
      if (filters.verifiedOnly) params.set('verified', 'true');
      params.set('sort', filters.sortBy);
      params.set('include_categories', 'true');
      params.set('format', 'v2');
      
      if (viewMode === 'mine' && currentUserId) {
        params.set('seller_id', currentUserId);
        params.set('status', showSold ? 'all' : 'active');
      } else {
        params.set('status', 'active');
      }
      
      const url = `/api/arena/marketplace?${params.toString()}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error('Failed to fetch marketplace data.');
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setItems(data);
      } else {
        setItems(data.listings || []);
        if (data.categories) {
          setDynamicCategories(data.categories);
        }
      }
    } catch (error) {
      toast.error("Error Loading Marketplace", { 
        description: (error as Error).message 
      });
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.verifiedOnly, filters.sortBy, viewMode, currentUserId, showSold]);

  useEffect(() => {
    if (searchArenaQuery) {
      setSearchTerm(searchArenaQuery);
      fetchMarketplaceData(searchArenaQuery);
      setSearchArenaQuery('');
    } else {
      fetchMarketplaceData(searchTerm);
    }
  }, [searchArenaQuery, fetchMarketplaceData, setSearchArenaQuery, viewMode, showSold]);

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMarketplaceData(searchTerm);
    setSearchParams(searchTerm ? { q: searchTerm } : {});
  };

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

  const handleExport = async (item: MarketplaceItem, platform: string) => {
    toast.loading(`Preparing ${platform} listing...`, { id: 'export' });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const platformUrls: Record<string, string> = {
      ebay: 'https://www.ebay.com/sl/sell',
      facebook: 'https://www.facebook.com/marketplace/create/item',
      mercari: 'https://www.mercari.com/sell/',
      craigslist: 'https://post.craigslist.org/',
      offerup: 'https://offerup.com/post',
    };
    
    const listingText = `${item.item_name}\n\nPrice: $${item.asking_price}\n${item.condition ? `Condition: ${item.condition}` : ''}\n${item.description || ''}\n\nListed on TagnetIQ`;
    
    await navigator.clipboard.writeText(listingText);
    
    toast.success(`Opening ${platform}`, {
      id: 'export',
      description: 'Listing details copied to clipboard',
    });
    
    window.open(platformUrls[platform], '_blank');
  };

  const handleMarkSold = (item: MarketplaceItem) => {
    if (!currentUserId) {
      toast.error('Please log in to manage your listings');
      return;
    }
    setSoldDialog({ open: true, item });
  };

  const confirmMarkSold = async () => {
    const item = soldDialog.item;
    if (!item) return;
    
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`/api/arena/listings/${item.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'mark_sold' })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark as sold');
      }
      
      toast.success('Listing marked as sold! 🎉');
      
      setItems(prev => prev.map(i => 
        i.id === item.id 
          ? { ...i, status: 'sold' as const, sold_at: new Date().toISOString() } 
          : i
      ));
    } catch (error: any) {
      if (error.message === 'Not authenticated') {
        toast.error('Please log in to manage your listings');
      } else {
        toast.error('Failed to mark as sold', { description: error.message });
      }
    } finally {
      setSoldDialog({ open: false, item: null });
    }
  };

  const handleDelete = (item: MarketplaceItem) => {
    if (!currentUserId) {
      toast.error('Please log in to manage your listings');
      return;
    }
    setDeleteDialog({ open: true, item });
  };

  const confirmDelete = async () => {
    const item = deleteDialog.item;
    if (!item) return;
    
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`/api/arena/listings/${item.id}`, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete');
      }
      
      toast.success('Listing deleted');
      
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (error: any) {
      if (error.message === 'Not authenticated') {
        toast.error('Please log in to manage your listings');
      } else {
        toast.error('Failed to delete listing', { description: error.message });
      }
    } finally {
      setDeleteDialog({ open: false, item: null });
    }
  };

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filters.priceRange[0] > 0 && item.asking_price < filters.priceRange[0]) return false;
      if (filters.priceRange[1] < 10000 && item.asking_price > filters.priceRange[1]) return false;
      if (filters.verifiedOnly && !item.is_verified) return false;
      if (filters.condition !== 'all' && item.condition !== filters.condition) return false;
      return true;
    });
  }, [items, filters]);

  const stats = useMemo(() => ({
    total: filteredItems.length,
    verified: filteredItems.filter(i => i.is_verified).length,
    avgPrice: filteredItems.length 
      ? Math.round(filteredItems.reduce((sum, i) => sum + i.asking_price, 0) / filteredItems.length)
      : 0,
    sold: filteredItems.filter(i => i.status === 'sold').length,
  }), [filteredItems]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-blue-500/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-transparent to-transparent" />
        
        <div className="container mx-auto px-4 py-6 md:py-8 relative">
          {/* Title Row */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight">
                Marketplace
              </h1>
              <p className="text-zinc-400 mt-1 text-sm md:text-base">
                {viewMode === 'mine' ? 'Manage your listings' : 'Discover verified collectibles'}
              </p>
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-4 md:gap-6 text-sm">
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-zinc-500 text-xs">Listings</div>
              </div>
              {viewMode === 'mine' && stats.sold > 0 && (
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold text-emerald-400">{stats.sold}</div>
                  <div className="text-zinc-500 text-xs">Sold</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-white">${stats.avgPrice}</div>
                <div className="text-zinc-500 text-xs">Avg Price</div>
              </div>
            </div>
          </div>
          
          {/* View Mode Tabs */}
          <div className="flex items-center gap-4 mb-4">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'all' | 'mine')}>
              <TabsList className="bg-zinc-900/50 border border-zinc-800">
                <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:text-black">
                  <Package className="h-4 w-4 mr-2" />
                  All Listings
                </TabsTrigger>
                <TabsTrigger 
                  value="mine" 
                  className="data-[state=active]:bg-white data-[state=active]:text-black"
                  disabled={!currentUserId}
                >
                  <User className="h-4 w-4 mr-2" />
                  My Listings
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {viewMode === 'mine' && (
              <div className="flex items-center gap-2">
                <Switch
                  id="show-sold"
                  checked={showSold}
                  onCheckedChange={setShowSold}
                />
                <Label htmlFor="show-sold" className="text-sm text-zinc-400">
                  Show sold
                </Label>
              </div>
            )}
            
            {currentUserId && (
              <Button 
                onClick={() => navigate('/vault')}
                className="ml-auto bg-emerald-600 hover:bg-emerald-700"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">List Item</span>
              </Button>
            )}
          </div>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search collectibles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 md:h-12 bg-zinc-900/80 border-zinc-800 text-white placeholder:text-zinc-500"
              />
            </div>
            <Button 
              type="submit" 
              className="h-11 md:h-12 px-4 md:px-6 bg-white text-black hover:bg-zinc-200"
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
            dynamicCategories={dynamicCategories}
          />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-4 md:py-6">
        <div className="flex gap-6">
          {/* Desktop Filters */}
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
                {filteredItems.length} items
              </p>
              
              <div className="flex items-center gap-2">
                {/* Mobile Filter */}
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
                    className={cn('h-8 w-8 p-0', layout === 'grid' && 'bg-zinc-800')}
                    onClick={() => setLayout('grid')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn('h-8 w-8 p-0', layout === 'compact' && 'bg-zinc-800')}
                    onClick={() => setLayout('compact')}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Mobile swipe hint */}
            {viewMode === 'mine' && filteredItems.length > 0 && (
              <div className="lg:hidden mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800 flex items-center gap-2 text-xs text-zinc-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>Swipe left to mark sold, swipe right to delete</span>
              </div>
            )}
            
            {/* Items */}
            {loading ? (
              <div className={cn(
                'grid gap-4',
                layout === 'grid' 
                  ? 'grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' 
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
              <div className="text-center py-16 md:py-20">
                <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 rounded-full bg-zinc-900 flex items-center justify-center">
                  <Package className="h-8 w-8 md:h-10 md:w-10 text-zinc-700" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                  {viewMode === 'mine' ? 'No Listings Yet' : 'No Listings Found'}
                </h3>
                <p className="text-zinc-500 max-w-md mx-auto text-sm">
                  {viewMode === 'mine' 
                    ? 'Start selling by listing items from your vault.'
                    : 'Try adjusting your filters or search terms.'}
                </p>
                {viewMode === 'mine' ? (
                  <Button 
                    className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => navigate('/vault')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    List Your First Item
                  </Button>
                ) : (
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
                )}
              </div>
            ) : (
              <motion.div 
                layout
                className={cn(
                  'grid gap-3 md:gap-4',
                  layout === 'grid' 
                    ? 'grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' 
                    : 'grid-cols-1 md:grid-cols-2'
                )}
              >
                <AnimatePresence mode="popLayout">
                  {filteredItems.map((item) => (
                    <MarketplaceCard
                      key={item.id}
                      item={item}
                      layout={layout}
                      isOwner={item.seller_id === currentUserId}
                      onWatchlist={handleWatchlistToggle}
                      onExport={handleExport}
                      onMarkSold={handleMarkSold}
                      onDelete={handleDelete}
                      isWatchlisted={watchlist.has(item.id)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </main>
        </div>
      </div>
      
      {/* Mark as Sold Dialog */}
      <AlertDialog open={soldDialog.open} onOpenChange={(open) => !open && setSoldDialog({ open: false, item: null })}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Mark as Sold?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark "{soldDialog.item?.item_name}" as sold. You can still see it in your listings with "Show sold" enabled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 hover:bg-zinc-800">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmMarkSold}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark as Sold
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, item: null })}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Listing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{deleteDialog.item?.item_name}" from the marketplace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 hover:bg-zinc-800">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Marketplace;