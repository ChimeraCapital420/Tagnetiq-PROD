// FILE: src/types/ghost.ts
// Ghost Protocol Type Definitions
// Extends core types with ghost-specific fields

import type { GhostData } from '@/hooks/useGhostMode';

// =============================================================================
// ANALYSIS RESULT EXTENSION
// =============================================================================

/**
 * Extended AnalysisResult that includes ghost data
 * Import this instead of the base AnalysisResult when ghost mode is relevant
 */
export interface AnalysisResultWithGhost {
  // Core fields from base AnalysisResult
  id: string;
  decision: 'BUY' | 'SELL' | 'HOLD';
  itemName: string;
  estimatedValue: number;
  confidenceScore: number;
  summary_reasoning: string;
  analysis_quality: 'OPTIMAL' | 'ACCEPTABLE' | 'LIMITED';
  valuation_factors: string[];
  capturedAt: string;
  category: string;
  subcategory?: string;
  
  // Image fields
  imageUrl: string;
  imageUrls: string[];
  thumbnailUrl?: string;
  
  // Market data
  marketComps: any[];
  authorityData?: any;
  
  // Resale toolkit
  resale_toolkit: {
    listInArena: boolean;
    sellOnProPlatforms: boolean;
    linkToMyStore: boolean;
    shareToSocial: boolean;
  };
  
  // Tags
  tags: string[];
  
  // Ghost Protocol extension
  ghostData?: GhostData;
  
  // Additional metadata
  processingTime?: number;
  aiModelsUsed?: string[];
}

// =============================================================================
// MARKETPLACE ITEM EXTENSION
// =============================================================================

/**
 * Extended MarketplaceItem that includes ghost data
 */
export interface MarketplaceItemWithGhost {
  // Core fields
  id?: string;
  item_name: string;
  description: string;
  asking_price: number;
  estimated_value?: number;
  condition: string;
  category: string;
  
  // Images
  primary_photo_url: string;
  images?: string[];
  
  // Verification
  is_verified?: boolean;
  confidence_score?: number;
  
  // Authority sources
  authoritySource?: string;
  numista_url?: string;
  googlebooks_url?: string;
  colnect_url?: string;
  
  // Ghost Protocol extension
  ghostData?: GhostData;
  isGhostListing?: boolean;
}

// =============================================================================
// GHOST LISTING RECORD (DATABASE)
// =============================================================================

/**
 * Ghost listing as stored in arena_listings table
 */
export interface GhostListingRecord {
  id: string;
  seller_id: string;
  vault_item_id: string | null;
  title: string;
  description: string;
  price: number;
  original_price: number | null;
  condition: string;
  images: string[];
  shipping_included: boolean;
  accepts_trades: boolean;
  status: 'active' | 'sold' | 'fulfilled' | 'expired';
  views: number;
  watchers: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  sold_at: string | null;
  deleted_at: string | null;
  
  // Ghost-specific
  is_ghost: boolean;
  handling_time_hours: number;
  metadata: {
    ghost_data?: GhostData;
  };
  
  // Location
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  offers_shipping: boolean;
  offers_local_pickup: boolean;
  
  category: string;
  sold_price: number | null;
}

// =============================================================================
// GHOST ANALYTICS
// =============================================================================

/**
 * Ghost analytics record for KPI tracking
 */
export interface GhostAnalyticsRecord {
  id: string;
  user_id: string;
  listing_id: string | null;
  vault_item_id: string | null;
  
  // Location
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy: number | null;
  region: string | null;
  
  // Store
  store_type: string;
  store_name: string | null;
  
  // Pricing
  shelf_price: number;
  listed_price: number;
  sold_price: number | null;
  actual_cost: number | null;
  estimated_margin: number | null;
  actual_margin: number | null;
  
  // Velocity
  velocity_score: 'low' | 'medium' | 'high' | null;
  
  // Timing KPIs
  scan_to_toggle_ms: number | null;
  scan_to_list_seconds: number | null;
  list_to_sale_hours: number | null;
  sale_to_fulfill_hours: number | null;
  
  // Status
  status: 'listed' | 'sold' | 'fulfilled' | 'expired' | 'cancelled';
  
  // Timestamps
  scanned_at: string;
  listed_at: string;
  sold_at: string | null;
  fulfilled_at: string | null;
  expired_at: string | null;
  
  // Item metadata
  category: string | null;
  item_name: string | null;
  hydra_confidence: number | null;
  
  created_at: string;
}

// =============================================================================
// SCOUT STATS
// =============================================================================

/**
 * Aggregated stats for a scout (user)
 */
export interface ScoutStats {
  userId: string;
  
  // Hunt counts
  totalHunts: number;
  activeHunts: number;
  soldHunts: number;
  fulfilledHunts: number;
  expiredHunts: number;
  
  // Profit
  totalPotentialProfit: number;
  totalRealizedProfit: number;
  avgProfitPerHunt: number;
  
  // Performance
  successRate: number; // fulfilled / (fulfilled + expired)
  avgSaleTime: number; // hours from list to sale
  avgFulfillTime: number; // hours from sale to fulfill
  
  // Activity
  storesVisited: number;
  favoriteStoreType: string | null;
  regionsActive: string[];
}

// =============================================================================
// HEATMAP DATA
// =============================================================================

/**
 * Data point for investor heatmap visualization
 */
export interface HeatmapDataPoint {
  lat: number;
  lng: number;
  intensity: number; // 0-1 based on scan frequency
  
  // Aggregated metrics
  scanCount: number;
  avgMargin: number;
  avgVelocity: number;
  successRate: number;
  
  // Store info
  topStoreTypes: string[];
  topCategories: string[];
}

/**
 * Regional aggregation for heatmap
 */
export interface RegionalHotspot {
  region: string;
  storeType: string;
  
  scanCount: number;
  fulfilledCount: number;
  
  avgEstimatedMargin: number;
  avgActualMargin: number | null;
  avgVelocity: number;
  
  totalRealizedProfit: number;
}