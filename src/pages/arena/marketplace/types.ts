// FILE: src/pages/arena/marketplace/types.ts
// Marketplace type definitions
// Updated with hierarchical categories, authority URLs, and arbitrage data

import type { LucideIcon } from 'lucide-react';

// ============================================================================
// CATEGORY TYPES
// ============================================================================

/**
 * Dynamic category with count (from database)
 */
export interface DynamicCategory {
  id: string;
  count: number;
  label?: string;
  icon?: LucideIcon;
  parentId?: string;
  isOrganic?: boolean; // Auto-discovered from listings
}

/**
 * Sub-category definition
 */
export interface SubCategory {
  id: string;
  label: string;
  keywords: string[]; // Used by HYDRA for auto-classification
}

/**
 * Main category with sub-categories
 */
export interface MainCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  subCategories: SubCategory[];
  keywords: string[];
}

// ============================================================================
// AUTHORITY & SOURCE TYPES
// ============================================================================

/**
 * Authority source URLs - links to authoritative databases
 */
export interface AuthorityUrls {
  numista_url?: string | null;
  googlebooks_url?: string | null;
  colnect_url?: string | null;
  tcgplayer_url?: string | null;
  psa_url?: string | null;
  beckett_url?: string | null;
  authority_url?: string | null;
  authoritySource?: string | null;
}

// ============================================================================
// MARKETPLACE ITEM TYPES
// ============================================================================

/**
 * Marketplace item status
 */
export type ItemStatus = 'active' | 'sold' | 'pending' | 'draft' | 'expired';

/**
 * Item condition
 */
export type ItemCondition = 'mint' | 'near-mint' | 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Full marketplace item with all fields
 */
export interface MarketplaceItem extends AuthorityUrls {
  id: string;
  item_name: string;
  description?: string | null;
  asking_price: number;
  estimated_value?: number | null;
  status: ItemStatus;
  condition?: ItemCondition | null;
  
  // Categories (hierarchical)
  category?: string | null; // Legacy single category
  main_category?: string | null; // Main category ID
  sub_category?: string | null; // Sub-category ID
  
  // Images
  image_url?: string | null;
  images?: string[];
  thumbnail_url?: string | null;
  
  // Location & shipping
  location?: string | null;
  zip_code?: string | null;
  city?: string | null;
  state?: string | null;
  offers_shipping?: boolean;
  offers_local_pickup?: boolean;
  shipping_cost?: number | null;
  
  // Seller
  seller_id: string;
  seller?: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    rating?: number | null;
    verified?: boolean;
  };
  
  // Verification
  is_verified?: boolean;
  verification_method?: string | null;
  confidence_score?: number | null;
  
  // Analysis
  analysis_id?: string | null;
  hydra_analysis?: HydraAnalysis | null;
  
  // Arbitrage data
  arbitrage?: ArbitrageData | null;
  
  // Timestamps
  created_at: string;
  updated_at?: string;
  sold_at?: string | null;
  expires_at?: string | null;
  
  // Engagement
  view_count?: number;
  watchlist_count?: number;
  message_count?: number;
}

/**
 * HYDRA analysis result attached to item
 */
export interface HydraAnalysis {
  id: string;
  identified_name: string;
  description: string;
  category: string;
  sub_category?: string;
  confidence: number;
  estimated_value: number;
  value_range?: { min: number; max: number };
  condition_assessment?: string;
  authenticity_indicators?: string[];
  authority_sources?: AuthorityUrls;
  market_data?: {
    recent_sales?: Array<{ price: number; date: string; platform: string }>;
    price_trend?: 'rising' | 'stable' | 'falling';
    demand_level?: 'high' | 'medium' | 'low';
  };
}

/**
 * Arbitrage opportunity data
 * Used to show flip potential in the marketplace
 */
export interface ArbitrageData {
  /** Estimated profit margin percentage */
  profit_margin: number;
  /** Suggested selling platforms */
  suggested_platforms: string[];
  /** Recent comparable sales */
  comparable_sales?: Array<{
    price: number;
    platform: string;
    date: string;
    url?: string;
  }>;
  /** Price difference from market average */
  price_vs_market: number; // negative = below market (good buy)
  /** Flip rating: 1-5 stars */
  flip_rating: number;
  /** Time to sell estimate */
  estimated_sell_time?: string; // e.g., "1-2 weeks"
}

// ============================================================================
// FILTER & UI TYPES
// ============================================================================

/**
 * Filter state for marketplace
 */
export interface FilterState {
  category: string;
  priceRange: [number, number];
  verifiedOnly: boolean;
  sortBy: SortOption;
  condition: string;
  // Extended filters
  mainCategory?: string;
  subCategory?: string;
  location?: string;
  radius?: number; // miles
  shippingOnly?: boolean;
  localOnly?: boolean;
  minFlipRating?: number; // 1-5 for arbitrage
}

/**
 * Sort options
 */
export type SortOption = 'newest' | 'oldest' | 'price_low' | 'price_high' | 'profit_high';

/**
 * View mode
 */
export type ViewMode = 'all' | 'mine' | 'watchlist';

/**
 * Layout mode
 */
export type LayoutMode = 'grid' | 'compact' | 'list';

/**
 * Marketplace stats
 */
export interface MarketplaceStats {
  total: number;
  verified: number;
  avgPrice: number;
  sold: number;
  // Extended stats
  totalValue?: number;
  avgFlipPotential?: number;
  topCategories?: Array<{ id: string; count: number }>;
}

// ============================================================================
// DIALOG TYPES
// ============================================================================

/**
 * Dialog state for mark sold
 */
export interface SoldDialogState {
  isOpen: boolean;
  item: MarketplaceItem | null;
  salePrice?: number;
  buyerInfo?: string;
}

/**
 * Dialog state for delete confirmation
 */
export interface DeleteDialogState {
  isOpen: boolean;
  item: MarketplaceItem | null;
}

/**
 * Dialog state for export to platform
 */
export interface ExportDialogState {
  isOpen: boolean;
  item: MarketplaceItem | null;
  platform?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Paginated response from marketplace API
 */
export interface MarketplaceResponse {
  items: MarketplaceItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  categories: DynamicCategory[];
}

/**
 * Create listing request
 */
export interface CreateListingRequest {
  item_name: string;
  description?: string;
  asking_price: number;
  category?: string;
  main_category?: string;
  sub_category?: string;
  condition?: ItemCondition;
  images?: string[];
  location?: string;
  zip_code?: string;
  offers_shipping?: boolean;
  offers_local_pickup?: boolean;
  shipping_cost?: number;
  // From HYDRA analysis
  analysis_id?: string;
  estimated_value?: number;
  // Authority links
  numista_url?: string;
  googlebooks_url?: string;
  colnect_url?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Add authority URLs to any type
 */
export type WithAuthority<T> = T & AuthorityUrls;

/**
 * Partial marketplace item for updates
 */
export type MarketplaceItemUpdate = Partial<Omit<MarketplaceItem, 'id' | 'seller_id' | 'created_at'>>;

/**
 * Marketplace item for display (subset of fields)
 */
export type MarketplaceItemPreview = Pick<
  MarketplaceItem,
  'id' | 'item_name' | 'asking_price' | 'image_url' | 'status' | 'category' | 'location' | 'created_at'
>;