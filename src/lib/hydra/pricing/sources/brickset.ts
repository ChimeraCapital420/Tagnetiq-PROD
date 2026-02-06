// FILE: src/lib/hydra/pricing/sources/brickset.ts
// Brickset (LEGO) data extraction for formatter
// Refactored from monolith v7.3
// Includes smart retirement detection

import type { FormattedAuthorityData } from '../types.js';
import type { AuthorityData } from '../../types.js';
import { formatPriceSmart } from '../formatter.js';

/**
 * Extract Brickset specific data from authority data
 */
export function extractBricksetData(
  authority: AuthorityData,
  details: Record<string, unknown>,
  formatted: FormattedAuthorityData
): void {
  console.log(`📦 Formatter entering BRICKSET extractor`);
  
  formatted.bricksetId = (details.bricksetId || details.setID) as number;
  formatted.setNumber = (details.setNumber || details.number) as string;
  formatted.title = (details.name || details.title || formatted.title) as string;
  formatted.year = details.year as number;
  formatted.theme = details.theme as string;
  formatted.themeGroup = details.themeGroup as string;
  formatted.subtheme = details.subtheme as string;
  formatted.pieces = details.pieces as number;
  formatted.minifigs = details.minifigs as number;
  
  // Age range - handle multiple formats
  const ageMin = details.ageMin as number | undefined;
  const ageMax = details.ageMax as number | undefined;
  formatted.ageRange = (details.ageRange as string) || 
    (ageMin && ageMax ? `${ageMin}-${ageMax}` : undefined);
  
  formatted.packagingType = details.packagingType as string;
  formatted.availability = details.availability as string;
  formatted.instructionsCount = details.instructionsCount as number;
  
  // Handle both image formats: object { thumbnail, smallThumbnail } OR string
  if (details.imageLinks) {
    formatted.imageLinks = details.imageLinks as { thumbnail?: string; smallThumbnail?: string };
  } else if (details.image) {
    const img = details.image;
    formatted.imageLinks = typeof img === 'string' 
      ? { thumbnail: img }
      : img as { thumbnail?: string };
  }
  
  // External URL - check multiple locations
  formatted.externalUrl = (
    details.bricksetURL || 
    details.externalUrl || 
    authority.externalUrl || 
    formatted.externalUrl
  ) as string;
  
  // LEGO pricing - handle both nested LEGOCom and flat rrp
  const legoCom = details.LEGOCom as Record<string, Record<string, number>> | undefined;
  if (legoCom?.US?.retailPrice) {
    formatted.rrp = legoCom.US.retailPrice;
    formatted.retailPrice = legoCom.US.retailPrice;
  } else if (details.rrp) {
    formatted.rrp = details.rrp as number;
    formatted.retailPrice = details.rrp as number;
  }
  
  // Price per piece
  if (details.pricePerPiece) {
    formatted.pricePerPiece = details.pricePerPiece as number;
  } else if (formatted.pieces && formatted.retailPrice) {
    formatted.pricePerPiece = parseFloat((formatted.retailPrice / formatted.pieces).toFixed(3));
  }
  
  // Retirement status
  if (details.isRetired !== undefined) {
    formatted.isRetired = details.isRetired as boolean;
  }
  if (details.dateFirstAvailable) {
    formatted.dateFirstAvailable = details.dateFirstAvailable as string;
  }
  if (details.dateLastAvailable) {
    formatted.dateLastAvailable = details.dateLastAvailable as string;
  }
  
  // Current market value
  const priceGuide = details.priceGuide as Record<string, number> | undefined;
  const marketValue = details.marketValue as Record<string, number> | undefined;
  
  if (priceGuide || details.currentValue || marketValue) {
    const pg = priceGuide || marketValue || {};
    formatted.marketValue = {
      low: formatPriceSmart(pg.minNew || pg.minUsed || pg.low || 0),
      mid: formatPriceSmart(pg.avgNew || (details.currentValue as number) || pg.mid || 0),
      high: formatPriceSmart(pg.maxNew || pg.high || 0),
    };
  }
  
  console.log(`📦 Formatter BRICKSET - Extracted: setNumber=${formatted.setNumber}, year=${formatted.year}, pieces=${formatted.pieces}, theme=${formatted.theme}, isRetired=${formatted.isRetired}`);
}

/**
 * Check if this authority data is Brickset
 */
export function isBricksetSource(
  source: string,
  details: Record<string, unknown>
): boolean {
  return source === 'brickset' || !!details.bricksetId || !!details.setID;
}