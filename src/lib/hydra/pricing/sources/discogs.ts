// FILE: src/lib/hydra/pricing/sources/discogs.ts
// Discogs (vinyl/music) data extraction for formatter
// Refactored from monolith v7.3
// FIXED: Defensive array handling to prevent crashes

import type { FormattedAuthorityData } from '../types.js';
import { formatPriceSmart } from '../formatter.js';

/**
 * Extract Discogs specific data from authority data
 * IMPORTANT: Includes defensive checks for arrays vs strings
 */
export function extractDiscogsData(
  details: Record<string, unknown>,
  formatted: FormattedAuthorityData
): void {
  console.log(`🎵 Formatter entering DISCOGS extractor`);
  
  formatted.discogsId = (details.discogsId || details.id) as number;
  formatted.releaseId = (details.releaseId || details.id) as number;
  formatted.masterId = (details.masterId || details.master_id) as number;
  formatted.title = (details.title as string) || formatted.title;
  
  // Defensive artist extraction - handle string, array of objects, or array of strings
  const artists = details.artists;
  if (Array.isArray(artists)) {
    formatted.artistName = artists.map((a: unknown) => 
      typeof a === 'string' ? a : (a as Record<string, string>).name
    ).join(', ');
  } else if (details.artistName) {
    formatted.artistName = details.artistName as string;
  } else if (typeof artists === 'string') {
    formatted.artistName = artists;
  }
  
  // Defensive label extraction
  const labels = details.labels;
  if (Array.isArray(labels)) {
    formatted.label = labels.map((l: unknown) => 
      typeof l === 'string' ? l : (l as Record<string, string>).name
    ).join(', ');
  } else if (details.label) {
    formatted.label = typeof details.label === 'string' ? details.label : undefined;
  }
  
  // Defensive format extraction - can be array of objects, array of strings, or string
  const formats = details.formats;
  const format = details.format;
  if (Array.isArray(formats)) {
    formatted.format = formats.map((f: unknown) => 
      typeof f === 'string' ? f : (f as Record<string, string>).name
    );
  } else if (Array.isArray(format)) {
    formatted.format = format as string[];
  } else if (typeof format === 'string') {
    formatted.format = [format];
  }
  
  formatted.country = details.country as string;
  formatted.released = (details.released || details.year) as string;
  
  // Defensive genre/style extraction
  const genres = details.genres;
  const genre = details.genre;
  if (Array.isArray(genres)) {
    formatted.genres = genres as string[];
  } else if (Array.isArray(genre)) {
    formatted.genres = genre as string[];
  } else if (typeof genre === 'string') {
    formatted.genres = [genre];
  }
  
  const styles = details.styles;
  const style = details.style;
  if (Array.isArray(styles)) {
    formatted.styles = styles as string[];
  } else if (Array.isArray(style)) {
    formatted.styles = style as string[];
  } else if (typeof style === 'string') {
    formatted.styles = [style];
  }
  
  // Defensive tracklist extraction
  const tracklist = details.tracklist;
  if (Array.isArray(tracklist)) {
    formatted.tracklist = tracklist.map((t: unknown) => {
      const track = t as Record<string, string>;
      return {
        position: track.position || '',
        title: track.title || '',
        duration: track.duration,
      };
    });
  }
  
  // Image handling - check multiple locations
  const images = details.images as Array<Record<string, string>> | undefined;
  if (images?.[0]) {
    formatted.imageLinks = { thumbnail: images[0].uri || (images[0] as unknown as string) };
  } else if (details.thumb) {
    formatted.imageLinks = { thumbnail: details.thumb as string };
  } else if (details.coverImage) {
    formatted.imageLinks = { thumbnail: details.coverImage as string };
  }
  
  formatted.externalUrl = (details.uri as string) || formatted.externalUrl;
  
  // Marketplace stats
  const stats = details.stats as Record<string, number> | undefined;
  formatted.lowestPrice = (details.lowestPrice || stats?.lowestPrice) as number;
  formatted.medianPrice = (details.medianPrice || stats?.medianPrice) as number;
  formatted.highestPrice = (details.highestPrice || stats?.highestPrice) as number;
  formatted.numForSale = (details.numForSale || stats?.numForSale) as number;
  
  if (formatted.lowestPrice || formatted.medianPrice || formatted.highestPrice) {
    formatted.marketValue = {
      low: formatPriceSmart(formatted.lowestPrice || 0),
      mid: formatPriceSmart(formatted.medianPrice || 0),
      high: formatPriceSmart(formatted.highestPrice || 0),
    };
  }
  
  console.log(`🎵 Formatter DISCOGS - Extracted: title=${formatted.title}, artist=${formatted.artistName}, format=${formatted.format}`);
}

/**
 * Check if this authority data is Discogs
 */
export function isDiscogsSource(
  source: string,
  details: Record<string, unknown>
): boolean {
  return source === 'discogs' || !!details.discogsId || !!details.releaseId;
}