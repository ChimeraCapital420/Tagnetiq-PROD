// FILE: src/components/authority/helpers/data-extractor.ts
// Bulletproof data extraction for authority sections
// Handles both flat and nested itemDetails structures
// v7.5 - Mobile-first defensive coding

import type { AuthorityData } from '../types';

/**
 * Extract a field from authority data, checking both flat and nested locations
 */
export function extractField<T>(
  data: AuthorityData | null | undefined,
  key: string
): T | undefined {
  if (!data) return undefined;
  
  // Check flat/top-level first (preferred)
  const flatValue = (data as Record<string, unknown>)[key];
  if (flatValue !== undefined && flatValue !== null) {
    return flatValue as T;
  }
  
  // Check nested itemDetails (fallback)
  const details = data.itemDetails || {};
  const nestedValue = (details as Record<string, unknown>)[key];
  if (nestedValue !== undefined && nestedValue !== null) {
    return nestedValue as T;
  }
  
  return undefined;
}

/**
 * Create a field extractor bound to specific authority data
 */
export function createFieldExtractor(data: AuthorityData | null | undefined) {
  return function get<T>(key: string): T | undefined {
    return extractField<T>(data, key);
  };
}

/**
 * Extract multiple fields at once
 */
export function extractFields<T extends Record<string, unknown>>(
  data: AuthorityData | null | undefined,
  keys: string[]
): Partial<T> {
  const result: Partial<T> = {};
  
  for (const key of keys) {
    const value = extractField(data, key);
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  
  return result;
}

/**
 * Check if authority data has a specific field
 */
export function hasField(
  data: AuthorityData | null | undefined,
  key: string
): boolean {
  return extractField(data, key) !== undefined;
}

/**
 * Get external URL from various possible field names
 */
export function getExternalUrl(data: AuthorityData | null | undefined): string | undefined {
  return (
    extractField<string>(data, 'externalUrl') ||
    extractField<string>(data, 'url') ||
    extractField<string>(data, 'infoLink') ||
    extractField<string>(data, 'canonicalVolumeLink') ||
    extractField<string>(data, 'bricksetURL') ||
    extractField<string>(data, 'comicVineUrl') ||
    extractField<string>(data, 'uri') ||
    data?.externalUrl
  );
}

/**
 * Get thumbnail image URL from various possible structures
 */
export function getThumbnailUrl(data: AuthorityData | null | undefined): string | undefined {
  const imageLinks = extractField<{ thumbnail?: string; smallThumbnail?: string }>(data, 'imageLinks');
  if (imageLinks?.thumbnail) return imageLinks.thumbnail;
  if (imageLinks?.smallThumbnail) return imageLinks.smallThumbnail;
  
  return (
    extractField<string>(data, 'thumbnail') ||
    extractField<string>(data, 'thumb') ||
    extractField<string>(data, 'image') ||
    extractField<string>(data, 'coverImage') ||
    extractField<string>(data, 'coverImageThumb') ||
    extractField<string>(data, 'obverseThumb')
  );
}