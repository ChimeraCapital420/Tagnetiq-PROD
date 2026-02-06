// FILE: src/lib/hydra/pricing/sources/nhtsa.ts
// NHTSA (vehicles) data extraction for formatter
// Refactored from monolith v7.3
// FREE API - no key required!

import type { FormattedAuthorityData } from '../types.js';

/**
 * Extract NHTSA specific data from authority data
 */
export function extractNhtsaData(
  details: Record<string, unknown>,
  formatted: FormattedAuthorityData
): void {
  formatted.vin = details.vin as string;
  formatted.make = details.make as string;
  formatted.model = details.model as string;
  formatted.vehicleYear = details.year as number;
  formatted.year = details.year as number;
  formatted.trim = details.trim as string;
  formatted.bodyClass = details.bodyClass as string;
  formatted.vehicleType = details.vehicleType as string;
  formatted.driveType = details.driveType as string;
  formatted.fuelType = details.fuelType as string;
  formatted.engineCylinders = details.engineCylinders as number;
  formatted.engineDisplacement = details.engineDisplacement as string;
  formatted.engineHP = details.engineHP as number;
  formatted.transmissionStyle = details.transmissionStyle as string;
  formatted.doors = details.doors as number;
  formatted.plantCity = details.plantCity as string;
  formatted.plantCountry = details.plantCountry as string;
  formatted.plantCompanyName = details.plantCompanyName as string;
  formatted.series = details.series as string;
  formatted.gvwr = details.gvwr as string;
  formatted.manufacturerName = details.manufacturerName as string;
  
  // Build title from components
  const titleParts = [
    formatted.year,
    formatted.make,
    formatted.model,
    formatted.trim,
  ].filter(Boolean);
  
  formatted.title = titleParts.join(' ') || formatted.title;
  
  // External URL - NHTSA VIN decoder
  const vin = formatted.vin;
  formatted.externalUrl = vin 
    ? `https://vpic.nhtsa.dot.gov/decoder/Decoder?VIN=${vin}` 
    : formatted.externalUrl;
  
  formatted.catalogNumber = vin || formatted.catalogNumber;
}

/**
 * Check if this authority data is NHTSA
 */
export function isNhtsaSource(
  source: string,
  details: Record<string, unknown>
): boolean {
  return source === 'nhtsa' || !!details.vin;
}