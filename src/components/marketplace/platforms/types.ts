// FILE: src/components/marketplace/platforms/types.ts
// Shared type definitions for marketplace components

export interface MarketplaceItem {
  id: string;
  challenge_id?: string;
  item_name: string;
  asking_price: number;
  estimated_value?: number;
  primary_photo_url?: string;
  additional_photos?: string[];
  is_verified?: boolean;
  confidence_score?: number;
  category?: string;
  condition?: string;
  description?: string;
  brand?: string;
  model?: string;
  year?: string;
  dimensions?: string;
  weight?: string;
  color?: string;
  material?: string;
  authenticity_details?: string;
  // Authority source data (for AI distinction)
  authoritySource?: string;
  authorityData?: Record<string, any>;
}

export interface FormattedListing {
  title: string;
  description: string;
  price: string;
  condition?: string;
  category?: string;
  shipping?: string;
  extras?: Record<string, string>;
}

export interface PlatformConfig {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  listingUrl: string;
  titleLimit: number;
  descriptionLimit: number;
  category: PlatformCategory;
  bestFor: string[];
  formatter: (item: MarketplaceItem, customDesc: string) => FormattedListing;
}

export type PlatformCategory = 'general' | 'cards' | 'fashion' | 'music' | 'luxury' | 'specialty';

export interface PlatformCategoryConfig {
  id: PlatformCategory;
  label: string;
  icon: React.ElementType;
}

export interface ListingFormData {
  price: string;
  includeAiDescription: boolean;
  sellerNotes: string;
  itemLocation: string;
  offersShipping: boolean;
  offersLocalPickup: boolean;
}