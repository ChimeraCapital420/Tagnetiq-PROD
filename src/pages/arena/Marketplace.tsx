// FILE: src/pages/arena/Marketplace.tsx
// Marketplace Page - Slim Orchestrator (~200 lines)
// All components modularized in ./marketplace/

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  SlidersHorizontal, Grid3X3, LayoutGrid, Package, 
  Filter, AlertCircle, Plus
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// Import modular components
import {
  MarketplaceHeader,
  MarketplaceCard,
  FilterPanel,
  MarkSoldDialog,
  DeleteDialog,
  useMarketplaceData,
  useListingActions,
  DEFAULT_FILTERS,
  MAX_PRICE,
  type MarketplaceItem,
  type FilterState,
  type ViewMode,
  type LayoutMode,
} from './marketplace';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const Marketplace: React.FC = () => {
  const { searchArenaQuery, setSearchArenaQuery } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Auth state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // UI state
  const [searchTerm, setSearchTerm] = useState(searchArenaQuery || searchParams.get('q') || '');
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [showSold, setShowSold] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    category: searchParams.get('category') || 'all',
  });

  // Data hook
  const { items, setItems, dynamicCategories, loading, fetchData } = useMarketplaceData({
    filters,
    viewMode,
    currentUserId,
    showSold,
  });

  // Actions hook
  const {
    soldDialog,
    deleteDialog,
    handleMarkSold,
    confirmMarkSold,
    handleDelete,
    confirmDelete,
    handleExport,
    closeSoldDialog,
    closeDeleteDialog,
  } = useListingActions({
    currentUserId,
    onItemUpdated: (item) => {
      setItems(prev => prev.map(i => 
        i.id === item.id 
          ? { ...i, status: 'sold' as const, sold_at: new Date().toISOString() } 
          : i
      ));
    },
    onItemDeleted: (itemId) => {
      setItems(prev => prev.filter(i => i.id !== itemId));
    },
  });

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

  // Fetch data on mount and filter changes
  useEffect(() => {
    if (searchArenaQuery) {
      setSearchTerm(searchArenaQuery);
      fetchData(searchArenaQuery);
      setSearchArenaQuery('');
    } else {
      fetchData(searchTerm);
    }
  }, [searchArenaQuery, fetchData, setSearchArenaQuery, viewMode, showSold]);

  // Event handlers
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(searchTerm);
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

  // Computed values
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filters.priceRange[0] > 0 && item.asking_price < filters.priceRange[0]) return false;
      if (filters.priceRange[1] < MAX_PRICE && item.asking_price > filters.priceRange[1]) return false;
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
      {/* Header */}
      <MarketplaceHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onSearchSubmit={handleSearch}
        loading={loading}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showSold={showSold}
        onShowSoldChange={setShowSold}
        selectedCategory={filters.category}
        onCategoryChange={handleCategoryChange}
        dynamicCategories={dynamicCategories}
        currentUserId={currentUserId}
        stats={stats}
      />
      
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
              <FilterPanel filters={filters} onChange={setFilters} />
            </div>
          </aside>
          
          {/* Items Grid */}
          <main className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-zinc-400">{filteredItems.length} items</p>
              
              <div className="flex items-center gap-2">
                {/* Mobile Filter */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="lg:hidden border-zinc-800 hover:bg-zinc-800">
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="bg-zinc-950 border-zinc-800">
                    <SheetHeader>
                      <SheetTitle className="text-white">Filters</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <FilterPanel filters={filters} onChange={setFilters} />
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
                    <Skeleton className={cn('bg-zinc-800', layout === 'grid' ? 'aspect-square' : 'h-32 w-32')} />
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
                  <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate('/vault')}>
                    <Plus className="h-4 w-4 mr-2" />
                    List Your First Item
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    className="mt-4 border-zinc-800"
                    onClick={() => {
                      setSearchTerm('');
                      setFilters({ ...DEFAULT_FILTERS, priceRange: [0, MAX_PRICE] });
                      fetchData('');
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
                      isWatchlisted={watchlist.has(item.id)}
                      onWatchlist={handleWatchlistToggle}
                      onExport={handleExport}
                      onMarkSold={handleMarkSold}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </main>
        </div>
      </div>
      
      {/* Dialogs */}
      <MarkSoldDialog dialog={soldDialog} onClose={closeSoldDialog} onConfirm={confirmMarkSold} />
      <DeleteDialog dialog={deleteDialog} onClose={closeDeleteDialog} onConfirm={confirmDelete} />
    </div>
  );
};

export default Marketplace;
```

---

## Summary

**Refactored Structure:**
```
src/pages/arena/
├── Marketplace.tsx                    (~200 lines - orchestrator)
└── marketplace/
    ├── index.ts                       (barrel exports)
    ├── types.ts                       (TypeScript interfaces)
    ├── constants.ts                   (categories, options)
    ├── utils/
    │   └── helpers.ts                 (utility functions)
    ├── hooks/
    │   ├── useMarketplaceData.ts      (data fetching)
    │   └── useListingActions.ts       (CRUD actions)
    └── components/
        ├── MarketplaceHeader.tsx      (header + search + tabs)
        ├── MarketplaceCard.tsx        (listing card)
        ├── CategoryPills.tsx          (category filter)
        ├── FilterPanel.tsx            (sidebar filters)
        ├── ListingActionsMenu.tsx     (owner actions + QuickActions)
        ├── ConfirmationDialogs.tsx    (mark sold + delete dialogs)
        ├── PriceFairnessIndicator.tsx (price indicator)
        ├── StatusBadge.tsx            (sold/active badge)
        └── ExportDropdown.tsx         (export to platforms)