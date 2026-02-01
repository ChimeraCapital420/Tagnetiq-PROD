// FILE: src/pages/arena/marketplace/types.ts
// Marketplace type definitions

export interface MarketplaceItem {
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

export interface FilterState {
  category: string;
  priceRange: [number, number];
  verifiedOnly: boolean;
  sortBy: string;
  condition: string;
}

export interface DynamicCategory {
  id: string;
  count: number;
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export type ViewMode = 'all' | 'mine';
export type LayoutMode = 'grid' | 'compact';

export interface DialogState<T> {
  open: boolean;
  item: T | null;
}

export interface MarketplaceStats {
  total: number;
  verified: number;
  avgPrice: number;
  sold: number;
}