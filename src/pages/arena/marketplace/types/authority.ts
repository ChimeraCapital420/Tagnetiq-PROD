// FILE: src/pages/arena/marketplace/types/authority.ts
// NEW: Authority URL type definitions for marketplace items
// These fields store links to authoritative sources like Numista, Google Books, Colnect

/**
 * Authority source URLs that can be associated with a marketplace item.
 * These links are preserved from the HYDRA analysis and should stay with
 * the listing throughout its lifecycle.
 */
export interface AuthorityUrls {
  /** Numista database link for coins/currency */
  numista_url?: string | null;
  
  /** Google Books link for books/publications */
  googlebooks_url?: string | null;
  
  /** Colnect database link for stamps, coins, collectibles */
  colnect_url?: string | null;
  
  /** TCGPlayer link for trading cards */
  tcgplayer_url?: string | null;
  
  /** PSA certification lookup link */
  psa_url?: string | null;
  
  /** Beckett grading/database link */
  beckett_url?: string | null;
  
  /** Generic authority URL for other sources */
  authority_url?: string | null;
  
  /** Name of the primary authority source (e.g., "Numista", "Google Books") */
  authoritySource?: string | null;
}

/**
 * Extended MarketplaceItem interface that includes authority URLs.
 * Use this when you need to work with listings that have authority data.
 * 
 * @example
 * ```tsx
 * import type { MarketplaceItemWithAuthority } from './types/authority';
 * 
 * const listing: MarketplaceItemWithAuthority = {
 *   ...baseItem,
 *   numista_url: 'https://en.numista.com/catalogue/pieces12345.html',
 *   authoritySource: 'Numista'
 * };
 * ```
 */
export interface MarketplaceItemWithAuthority extends AuthorityUrls {
  // Core item fields (these should match your existing MarketplaceItem type)
  id: string;
  item_name: string;
  description?: string | null;
  asking_price: number;
  estimated_value?: number | null;
  status: 'active' | 'sold' | 'pending' | 'draft';
  category?: string | null;
  seller_id: string;
  created_at: string;
  updated_at?: string;
  
  // Images
  image_url?: string | null;
  images?: string[];
  
  // Location
  location?: string | null;
  offers_shipping?: boolean;
  offers_local_pickup?: boolean;
  
  // Seller info
  seller?: {
    id: string;
    username?: string;
    avatar_url?: string;
  };
  
  // Analysis metadata
  analysis_id?: string | null;
  confidence_score?: number | null;
}

/**
 * Utility type to add authority URLs to any existing item type
 */
export type WithAuthority<T> = T & AuthorityUrls;

/**
 * Check if an item has any authority URLs
 */
export function hasAuthorityLinks(item: Partial<AuthorityUrls>): boolean {
  return !!(
    item.numista_url ||
    item.googlebooks_url ||
    item.colnect_url ||
    item.tcgplayer_url ||
    item.psa_url ||
    item.beckett_url ||
    item.authority_url
  );
}

/**
 * Get the primary authority source from an item
 */
export function getPrimaryAuthoritySource(item: Partial<AuthorityUrls>): {
  name: string;
  url: string;
} | null {
  if (item.numista_url) {
    return { name: item.authoritySource || 'Numista', url: item.numista_url };
  }
  if (item.googlebooks_url) {
    return { name: item.authoritySource || 'Google Books', url: item.googlebooks_url };
  }
  if (item.colnect_url) {
    return { name: item.authoritySource || 'Colnect', url: item.colnect_url };
  }
  if (item.tcgplayer_url) {
    return { name: item.authoritySource || 'TCGPlayer', url: item.tcgplayer_url };
  }
  if (item.psa_url) {
    return { name: item.authoritySource || 'PSA', url: item.psa_url };
  }
  if (item.beckett_url) {
    return { name: item.authoritySource || 'Beckett', url: item.beckett_url };
  }
  if (item.authority_url) {
    return { name: item.authoritySource || 'Source', url: item.authority_url };
  }
  return null;
}

/**
 * Extract all authority URLs from an item as an array
 */
export function getAllAuthorityLinks(item: Partial<AuthorityUrls>): Array<{
  name: string;
  url: string;
  type: keyof AuthorityUrls;
}> {
  const links: Array<{ name: string; url: string; type: keyof AuthorityUrls }> = [];
  
  if (item.numista_url) {
    links.push({ name: 'Numista', url: item.numista_url, type: 'numista_url' });
  }
  if (item.googlebooks_url) {
    links.push({ name: 'Google Books', url: item.googlebooks_url, type: 'googlebooks_url' });
  }
  if (item.colnect_url) {
    links.push({ name: 'Colnect', url: item.colnect_url, type: 'colnect_url' });
  }
  if (item.tcgplayer_url) {
    links.push({ name: 'TCGPlayer', url: item.tcgplayer_url, type: 'tcgplayer_url' });
  }
  if (item.psa_url) {
    links.push({ name: 'PSA', url: item.psa_url, type: 'psa_url' });
  }
  if (item.beckett_url) {
    links.push({ name: 'Beckett', url: item.beckett_url, type: 'beckett_url' });
  }
  if (item.authority_url) {
    links.push({ name: item.authoritySource || 'Source', url: item.authority_url, type: 'authority_url' });
  }
  
  return links;
}