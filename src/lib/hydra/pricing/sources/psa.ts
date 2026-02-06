// FILE: src/lib/hydra/pricing/sources/psa.ts
// PSA (graded items) data extraction for formatter
// Refactored from monolith v7.3

import type { FormattedAuthorityData } from '../types.js';

/**
 * Extract PSA specific data from authority data
 */
export function extractPsaData(
  details: Record<string, unknown>,
  formatted: FormattedAuthorityData
): void {
  formatted.psaCertNumber = (details.psaCertNumber || details.certNumber) as string;
  formatted.grade = details.grade as string;
  formatted.gradeDescription = details.gradeDescription as string;
  formatted.cardYear = (details.cardYear || details.year) as string;
  formatted.cardBrand = (details.cardBrand || details.brand) as string;
  formatted.cardCategory = (details.cardCategory || details.category) as string;
  formatted.cardSubject = (details.cardSubject || details.subject || details.player) as string;
  formatted.cardVariety = (details.cardVariety || details.variety) as string;
  formatted.cardNumber = details.cardNumber as string;
  formatted.totalPopulation = (details.totalPopulation || details.popTotal) as number;
  formatted.populationHigher = (details.populationHigher || details.popHigher) as number;
  formatted.labelType = details.labelType as string;
  formatted.isCrossedOver = details.isCrossedOver as boolean;
  formatted.certDate = details.certDate as string;
  
  // Build title from components
  const titleParts = [
    formatted.cardYear,
    formatted.cardBrand,
    formatted.cardSubject,
    formatted.grade ? `PSA ${formatted.grade}` : null,
  ].filter(Boolean);
  
  formatted.title = titleParts.join(' ') || formatted.title;
  
  // External URL
  const certNumber = formatted.psaCertNumber;
  formatted.externalUrl = (details.certUrl as string) || 
    (certNumber ? `https://www.psacard.com/cert/${certNumber}` : formatted.externalUrl);
  
  formatted.catalogNumber = certNumber || formatted.catalogNumber;
}

/**
 * Check if this authority data is PSA
 */
export function isPsaSource(
  source: string,
  details: Record<string, unknown>
): boolean {
  return source === 'psa' || !!details.psaCertNumber || !!details.certNumber;
}