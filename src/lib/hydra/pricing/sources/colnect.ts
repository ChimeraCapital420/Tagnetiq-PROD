// FILE: src/lib/hydra/pricing/sources/colnect.ts
// Colnect (multi-category collectibles) data extraction for formatter
// Refactored from monolith v7.3

import type { FormattedAuthorityData } from '../types.js';

/**
 * Extract Colnect specific data from authority data
 */
export function extractColnectData(
  details: Record<string, unknown>,
  formatted: FormattedAuthorityData
): void {
  formatted.colnectId = (details.colnectId || details.id) as number;
  formatted.colnectCategory = (details.colnectCategory || details.category) as string;
  formatted.title = (details.itemName || details.name || formatted.title) as string;
  formatted.seriesName = (details.seriesName || details.series) as string;
  formatted.producerName = (details.producerName || details.producer || details.issuer) as string;
  formatted.catalogCodes = details.catalogCodes as string;
  formatted.year = details.year as number;
  formatted.country = details.country as string;
  
  // Build image URLs from picture IDs
  const frontPictureId = details.frontPictureId;
  if (frontPictureId) {
    const idStr = String(frontPictureId);
    const thousands = idStr.slice(0, -3) || '0';
    const remainder = idStr.slice(-3);
    const safeName = formatted.title?.replace(/\s+/g, '_') || 'item';
    formatted.frontImageUrl = `https://i.colnect.net/images/t/${thousands}/${remainder}/${safeName}.jpg`;
  }
  
  const backPictureId = details.backPictureId;
  if (backPictureId) {
    const idStr = String(backPictureId);
    const thousands = idStr.slice(0, -3) || '0';
    const remainder = idStr.slice(-3);
    const safeName = formatted.title?.replace(/\s+/g, '_') || 'item';
    formatted.backImageUrl = `https://i.colnect.net/images/t/${thousands}/${remainder}/${safeName}.jpg`;
  }
  
  formatted.externalUrl = (details.url as string) || formatted.externalUrl;
}

/**
 * Check if this authority data is Colnect
 */
export function isColnectSource(
  source: string,
  details: Record<string, unknown>
): boolean {
  return source === 'colnect' || !!details.colnectId;
}