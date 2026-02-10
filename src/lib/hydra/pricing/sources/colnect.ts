// FILE: src/lib/hydra/pricing/sources/colnect.ts
// Colnect-specific data extraction for formatter
// v8.0: Extracts catalog info, images, conditions, and attribution
// Pattern matches existing extractors (numista, brickset, etc.)

import type { FormattedAuthorityData } from '../types.js';

/**
 * Check if this authority data is from Colnect
 */
export function isColnectSource(
  source: string,
  details: Record<string, unknown>
): boolean {
  return source === 'colnect' || 
         !!details.colnectId || 
         !!details.colnectItemId ||
         !!details.colnectCategory;
}

/**
 * Extract Colnect-specific fields into formatted authority response
 */
export function extractColnectData(
  details: Record<string, unknown>,
  formatted: FormattedAuthorityData
): void {
  // Core identification
  formatted.colnectId = (details.colnectId ?? details.colnectItemId) as number | undefined;
  formatted.colnectCategory = details.colnectCategory as string | undefined;
  formatted.categoryDisplay = details.categoryDisplay as string | undefined;
  formatted.colnectItemName = details.itemName as string | undefined;
  
  // Series & producer
  formatted.seriesName = details.seriesName as string | undefined;
  formatted.producerName = (details.producerName ?? details.producer) as string | undefined;
  
  // Catalog codes (Scott, Michel, Yvert, etc.)
  formatted.catalogCodes = details.catalogCodes as string | undefined;
  
  // Images
  if (details.frontImageUrl || details.frontPictureId) {
    formatted.frontImageUrl = details.frontImageUrl as string | undefined;
  }
  if (details.backImageUrl || details.backPictureId) {
    formatted.backImageUrl = details.backImageUrl as string | undefined;
  }
  
  // Condition-based pricing (e.g., { "mint": 12.50, "used": 3.00, "fine": 7.50 })
  if (details.conditionPrices && typeof details.conditionPrices === 'object') {
    formatted.conditionPrices = details.conditionPrices as Record<string, number>;
  }
  
  // Description (if provided by CAPI)
  if (details.description) {
    formatted.description = details.description as string;
  }
  
  // Attribution - REQUIRED by Colnect Terms of Service
  // Must be visible wherever Colnect data is displayed
  formatted.colnectAttribution = (details.attribution as string) ||
    'Catalog information courtesy of Colnect, an online collectors community.';
  formatted.colnectAttributionUrl = (details.attributionUrl as string) ||
    'https://colnect.com';
}