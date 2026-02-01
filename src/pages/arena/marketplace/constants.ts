// FILE: src/pages/arena/marketplace/constants.ts
// Marketplace constants and configuration

import { 
  Package, Grid3X3, Globe, Facebook, Store 
} from 'lucide-react';

export const DEFAULT_CATEGORIES = [
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
] as const;

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
] as const;

export const CONDITION_OPTIONS = [
  { value: 'all', label: 'Any Condition' },
  { value: 'mint', label: 'Mint / New' },
  { value: 'near-mint', label: 'Near Mint' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
] as const;

export const EXPORT_PLATFORMS = [
  { id: 'ebay', name: 'eBay', icon: Globe, color: 'bg-blue-500' },
  { id: 'facebook', name: 'Facebook Marketplace', icon: Facebook, color: 'bg-blue-600' },
  { id: 'mercari', name: 'Mercari', icon: Store, color: 'bg-red-500' },
  { id: 'craigslist', name: 'Craigslist', icon: Globe, color: 'bg-purple-500' },
  { id: 'offerup', name: 'OfferUp', icon: Store, color: 'bg-green-500' },
] as const;

export const PLATFORM_URLS: Record<string, string> = {
  ebay: 'https://www.ebay.com/sl/sell',
  facebook: 'https://www.facebook.com/marketplace/create/item',
  mercari: 'https://www.mercari.com/sell/',
  craigslist: 'https://post.craigslist.org/',
  offerup: 'https://offerup.com/post',
};

export const DEFAULT_FILTERS: FilterState = {
  category: 'all',
  priceRange: [0, 10000],
  verifiedOnly: false,
  sortBy: 'newest',
  condition: 'all',
};

export const MAX_PRICE = 10000;

// Re-export types for convenience
import type { FilterState } from './types';
export type { FilterState };