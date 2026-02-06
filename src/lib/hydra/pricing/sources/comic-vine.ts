// FILE: src/lib/hydra/pricing/sources/comic-vine.ts
// Comic Vine data extraction for formatter
// Refactored from monolith v7.3

import type { FormattedAuthorityData } from '../types.js';
import type { AuthorityData } from '../../types.js';

/**
 * Extract Comic Vine specific data from authority data
 */
export function extractComicVineData(
  authority: AuthorityData,
  details: Record<string, unknown>,
  formatted: FormattedAuthorityData
): void {
  console.log(`📚 Formatter entering COMIC VINE extractor`);
  
  formatted.comicVineId = details.comicVineId as number;
  formatted.issueName = details.issueName as string;
  formatted.issueNumber = details.issueNumber as string;
  formatted.volumeName = details.volumeName as string;
  formatted.volumeId = details.volumeId as number;
  formatted.coverDate = details.coverDate as string;
  formatted.storeDate = details.storeDate as string;
  formatted.deck = details.deck as string;
  formatted.description = details.description as string;
  formatted.writers = details.writers as string[];
  formatted.artists = details.artists as string[];
  formatted.coverArtists = details.coverArtists as string[];
  formatted.characterAppearances = details.characterAppearances as string[];
  formatted.characterCount = details.characterCount as number;
  formatted.firstAppearances = details.firstAppearances as string[];
  formatted.hasFirstAppearances = details.hasFirstAppearances as boolean;
  formatted.isKeyIssue = details.isKeyIssue as boolean;
  formatted.coverImage = details.coverImage as string;
  formatted.coverImageLarge = details.coverImageLarge as string;
  formatted.coverImageThumb = details.coverImageThumb as string;
  formatted.comicVineUrl = details.comicVineUrl as string;
  formatted.title = (details.name as string) || formatted.title;
  formatted.externalUrl = (details.comicVineUrl || authority.externalUrl || formatted.externalUrl) as string;
  
  // Image links for consistency
  if (details.coverImage) {
    formatted.imageLinks = { thumbnail: details.coverImage as string };
  }
  
  console.log(`📚 Formatter COMIC VINE - Extracted: issueNumber=${formatted.issueNumber}, volumeName=${formatted.volumeName}, isKeyIssue=${formatted.isKeyIssue}`);
}

/**
 * Check if this authority data is Comic Vine
 */
export function isComicVineSource(
  source: string,
  details: Record<string, unknown>
): boolean {
  return source === 'comicvine' || source === 'Comic Vine' || !!details.comicVineId;
}