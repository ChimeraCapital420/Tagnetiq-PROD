// FILE: src/components/marketplace/platforms/types.ts
// Shared type definitions for marketplace components
// FIXED: Added alternate field names from analysis results to prevent silent crashes

export interface MarketplaceItem {
  id: string;
  challenge_id?: string;

  // Primary fields
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

  // Alternate field names from analysis results
  // These may arrive instead of the primary fields depending on where data comes from
  title?: string;
  name?: string;
  price?: number;
  estimatedValue?: number;
  imageUrl?: string;
  image_url?: string;

  // Authority source data (for AI distinction)
  authoritySource?: string;
  authorityData?: Record<string, any>;

  // Authority hotlinks - maintained from HYDRA analysis
  numista_url?: string;
  googlebooks_url?: string;
  colnect_url?: string;
  tcgplayer_url?: string;
  psa_url?: string;
  ebay_url?: string;
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