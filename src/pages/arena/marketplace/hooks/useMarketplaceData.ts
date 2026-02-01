// FILE: src/pages/arena/marketplace/hooks/useMarketplaceData.ts
// Data fetching hook for marketplace

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { MarketplaceItem, DynamicCategory, FilterState, ViewMode } from '../types';

interface UseMarketplaceDataOptions {
  filters: FilterState;
  viewMode: ViewMode;
  currentUserId: string | null;
  showSold: boolean;
}

interface UseMarketplaceDataReturn {
  items: MarketplaceItem[];
  setItems: React.Dispatch<React.SetStateAction<MarketplaceItem[]>>;
  dynamicCategories: DynamicCategory[];
  loading: boolean;
  fetchData: (query: string) => Promise<void>;
}

export function useMarketplaceData({
  filters,
  viewMode,
  currentUserId,
  showSold,
}: UseMarketplaceDataOptions): UseMarketplaceDataReturn {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<DynamicCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (query: string) => {
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

  return {
    items,
    setItems,
    dynamicCategories,
    loading,
    fetchData,
  };
}