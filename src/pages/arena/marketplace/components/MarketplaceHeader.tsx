// FILE: src/pages/arena/marketplace/components/MarketplaceHeader.tsx
// Marketplace header with search, tabs, and stats
// FIXED: List Item button now opens scanner instead of navigating to vault

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, User, Plus, Camera } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategoryPills } from './CategoryPills';
import type { ViewMode, DynamicCategory, MarketplaceStats } from '../types';

interface MarketplaceHeaderProps {
  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  
  // View mode
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showSold: boolean;
  onShowSoldChange: (show: boolean) => void;
  
  // Categories
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  dynamicCategories: DynamicCategory[];
  
  // Auth
  currentUserId: string | null;
  
  // Stats
  stats: MarketplaceStats;
  
  // NEW: Scanner trigger - passed from parent component
  onOpenScanner?: () => void;
}

export const MarketplaceHeader: React.FC<MarketplaceHeaderProps> = ({
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  loading,
  viewMode,
  onViewModeChange,
  showSold,
  onShowSoldChange,
  selectedCategory,
  onCategoryChange,
  dynamicCategories,
  currentUserId,
  stats,
  onOpenScanner,
}) => {
  const navigate = useNavigate();

  // Handle List Item button click
  // Priority: 1) Use scanner callback if provided, 2) Fallback to vault
  const handleListItemClick = () => {
    if (onOpenScanner) {
      onOpenScanner();
    } else {
      // Fallback: navigate to vault if scanner callback not provided
      navigate('/vault');
    }
  };

  return (
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
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
          <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as ViewMode)}>
            <TabsList className="bg-zinc-900/50 border border-zinc-800">
              <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:text-black">
                <Package className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">All Listings</span>
                <span className="xs:hidden">All</span>
              </TabsTrigger>
              <TabsTrigger 
                value="mine" 
                className="data-[state=active]:bg-white data-[state=active]:text-black"
                disabled={!currentUserId}
              >
                <User className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">My Listings</span>
                <span className="xs:hidden">Mine</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {viewMode === 'mine' && (
            <div className="flex items-center gap-2">
              <Switch
                id="show-sold"
                checked={showSold}
                onCheckedChange={onShowSoldChange}
              />
              <Label htmlFor="show-sold" className="text-sm text-zinc-400">
                Show sold
              </Label>
            </div>
          )}
          
          {/* FIXED: List Item button now opens scanner/camera */}
          {currentUserId && (
            <Button 
              onClick={handleListItemClick}
              className="sm:ml-auto bg-emerald-600 hover:bg-emerald-700 touch-manipulation"
              size="sm"
            >
              <Camera className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">List Item</span>
              <span className="sm:hidden">List</span>
            </Button>
          )}
        </div>
        
        {/* Search Bar */}
        <form onSubmit={onSearchSubmit} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search collectibles..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 h-11 md:h-12 bg-zinc-900/80 border-zinc-800 text-white placeholder:text-zinc-500"
            />
          </div>
          <Button 
            type="submit" 
            className="h-11 md:h-12 px-4 md:px-6 bg-white text-black hover:bg-zinc-200 touch-manipulation"
            disabled={loading}
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              'Search'
            )}
          </Button>
        </form>
        
        {/* Category Pills - These are the category bubbles */}
        <CategoryPills 
          selected={selectedCategory} 
          onSelect={onCategoryChange}
          dynamicCategories={dynamicCategories}
        />
      </div>
    </div>
  );
};