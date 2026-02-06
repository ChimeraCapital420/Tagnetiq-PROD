// FILE: src/lib/hydra/pricing/sources/google-books.ts
// Google Books data extraction for formatter
// Refactored from monolith v7.3

import type { FormattedAuthorityData } from '../types.js';
import type { AuthorityData } from '../../types.js';

/**
 * Extract Google Books specific data from authority data
 */
export function extractGoogleBooksData(
  authority: AuthorityData,
  details: Record<string, unknown>,
  formatted: FormattedAuthorityData
): void {
  formatted.isbn = (details.isbn13 || details.isbn10) as string;
  formatted.isbn13 = details.isbn13 as string;
  formatted.isbn10 = details.isbn10 as string;
  formatted.authors = details.authors as string[];
  formatted.publisher = details.publisher as string;
  formatted.publishedDate = details.publishedDate as string;
  formatted.pageCount = details.pageCount as number;
  formatted.categories = details.categories as string[];
  formatted.description = details.description as string;
  formatted.language = details.language as string;
  formatted.averageRating = details.averageRating as number;
  formatted.ratingsCount = details.ratingsCount as number;
  formatted.imageLinks = details.imageLinks as { thumbnail?: string; smallThumbnail?: string };
  formatted.title = (details.title as string) || formatted.title;
  formatted.externalUrl = (details.infoLink || details.canonicalVolumeLink || formatted.externalUrl) as string;
  
  // Retail price from priceData
  if (authority.priceData?.retail) {
    formatted.retailPrice = authority.priceData.retail;
  }
}

/**
 * Check if this authority data is Google Books
 */
export function isGoogleBooksSource(
  source: string,
  details: Record<string, unknown>
): boolean {
  return source === 'google_books' || !!details.googleBooksId;
}