// FILE: src/lib/hydra/pricing/sources/numista.ts
// Numista (coins/banknotes) data extraction for formatter
// Refactored from monolith v7.3

import type { FormattedAuthorityData } from '../types.js';

/**
 * Extract Numista specific data from authority data
 */
export function extractNumistaData(
  details: Record<string, unknown>,
  formatted: FormattedAuthorityData
): void {
  formatted.numistaId = details.numistaId as number;
  formatted.title = (details.title as string) || formatted.title;
  formatted.issuer = details.issuer as string;
  formatted.minYear = details.minYear as number;
  formatted.maxYear = details.maxYear as number;
  formatted.value = details.value as string;
  formatted.composition = details.composition as string;
  formatted.weight = details.weight as number;
  formatted.size = details.size as number;
  formatted.thickness = details.thickness as number;
  formatted.shape = details.shape as string;
  formatted.orientation = details.orientation as string;
  formatted.references = details.references as string;
  formatted.obverseThumb = details.obverseThumb as string;
  formatted.reverseThumb = details.reverseThumb as string;
  formatted.externalUrl = (details.url as string) || formatted.externalUrl;
}

/**
 * Check if this authority data is Numista
 */
export function isNumistaSource(
  source: string,
  details: Record<string, unknown>
): boolean {
  return source === 'numista' || !!details.numistaId;
}