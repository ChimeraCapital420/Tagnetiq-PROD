// FILE: src/lib/hydra/fetchers/nhtsa.ts
// HYDRA v5.2 - NHTSA VIN Decoder Fetcher (Vehicles)
// FREE API - No key required!
// Documentation: https://vpic.nhtsa.dot.gov/api/

import type { MarketDataSource, AuthorityData } from '../types.js';

const NHTSA_API_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';

export interface NHTSAVehicleData {
  vin: string;
  make: string;
  model: string;
  year: number;
  trim: string;
  bodyClass: string;
  vehicleType: string;
  driveType: string;
  fuelType: string;
  engineCylinders: number;
  engineDisplacement: string;
  engineHP: number;
  transmissionStyle: string;
  doors: number;
  plantCity: string;
  plantCountry: string;
  plantCompanyName: string;
  series: string;
  gvwr: string;
  manufacturerName: string;
  ncapBodyType: string;
  ncapMake: string;
  ncapModel: string;
  errorCode: string;
  errorText: string;
}

export async function fetchNhtsaData(itemName: string): Promise<MarketDataSource> {
  const startTime = Date.now();

  try {
    // Extract VIN from item name
    const vin = extractVIN(itemName);
    
    if (!vin) {
      console.log('⚠️ NHTSA: No valid VIN found in item name');
      return createFallbackResult(itemName, 'No VIN detected');
    }

    console.log(`🔍 NHTSA VIN decode: "${vin}"`);

    // Use DecodeVinExtended for maximum data
    const decodeUrl = `${NHTSA_API_BASE}/DecodeVinExtended/${vin}?format=json`;

    const response = await fetch(decodeUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Tagnetiq-HYDRA/1.0',
      },
    });

    if (!response.ok) {
      console.error(`❌ NHTSA API error: ${response.status}`);
      return createFallbackResult(itemName, `API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.Results || [];

    if (results.length === 0) {
      console.log('⚠️ NHTSA: No results returned');
      return createFallbackResult(itemName, 'No decode results');
    }

    // Parse NHTSA response into structured data
    const vehicleData = parseNHTSAResponse(results, vin);

    // Check for decode errors
    if (vehicleData.errorCode && vehicleData.errorCode !== '0') {
      console.log(`⚠️ NHTSA decode error: ${vehicleData.errorText}`);
    }

    // Build display title
    const title = buildVehicleTitle(vehicleData);
    console.log(`✅ NHTSA: Decoded "${title}"`);

    // Build authority data
    const authorityData: AuthorityData = {
      source: 'nhtsa',
      verified: true,
      confidence: calculateDecodeConfidence(vehicleData),
      title,
      itemDetails: {
        vin: vehicleData.vin,
        make: vehicleData.make,
        model: vehicleData.model,
        year: vehicleData.year,
        trim: vehicleData.trim,
        bodyClass: vehicleData.bodyClass,
        vehicleType: vehicleData.vehicleType,
        driveType: vehicleData.driveType,
        fuelType: vehicleData.fuelType,
        engineCylinders: vehicleData.engineCylinders,
        engineDisplacement: vehicleData.engineDisplacement,
        engineHP: vehicleData.engineHP,
        transmissionStyle: vehicleData.transmissionStyle,
        doors: vehicleData.doors,
        plantCity: vehicleData.plantCity,
        plantCountry: vehicleData.plantCountry,
        plantCompanyName: vehicleData.plantCompanyName,
        series: vehicleData.series,
        gvwr: vehicleData.gvwr,
        manufacturerName: vehicleData.manufacturerName,
      },
      externalUrl: `https://vpic.nhtsa.dot.gov/decoder/Decoder?VIN=${vin}`,
      lastUpdated: new Date().toISOString(),
    };

    console.log(`✅ NHTSA: Authority data retrieved in ${Date.now() - startTime}ms`);

    return {
      source: 'nhtsa',
      available: true,
      query: vin,
      totalListings: 1,
      authorityData,
      metadata: {
        responseTime: Date.now() - startTime,
        vin,
        decodeSuccess: !vehicleData.errorCode || vehicleData.errorCode === '0',
      },
    };

  } catch (error) {
    console.error('❌ NHTSA fetch error:', error);
    return {
      source: 'nhtsa',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract VIN from item name/description
 * VINs are 17 characters (letters and numbers, excluding I, O, Q)
 */
function extractVIN(itemName: string): string | null {
  // Standard 17-character VIN pattern
  // VINs don't contain I, O, or Q
  const vinPattern = /\b[A-HJ-NPR-Z0-9]{17}\b/gi;
  const matches = itemName.match(vinPattern);
  
  if (matches && matches.length > 0) {
    return matches[0].toUpperCase();
  }

  // Try to find partial VIN mentions
  const vinMention = itemName.match(/vin[:\s#]*([A-HJ-NPR-Z0-9]{17})/i);
  if (vinMention) {
    return vinMention[1].toUpperCase();
  }

  return null;
}

/**
 * Parse NHTSA API response into structured vehicle data
 */
function parseNHTSAResponse(results: any[], vin: string): NHTSAVehicleData {
  // NHTSA returns an array of {Variable, Value} pairs
  const getValue = (variableName: string): string => {
    const item = results.find((r: any) => 
      r.Variable?.toLowerCase() === variableName.toLowerCase() ||
      r.VariableId === variableName
    );
    return item?.Value || '';
  };

  const getNumericValue = (variableName: string): number => {
    const val = getValue(variableName);
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  return {
    vin,
    make: getValue('Make'),
    model: getValue('Model'),
    year: getNumericValue('Model Year'),
    trim: getValue('Trim') || getValue('Trim2'),
    bodyClass: getValue('Body Class'),
    vehicleType: getValue('Vehicle Type'),
    driveType: getValue('Drive Type'),
    fuelType: getValue('Fuel Type - Primary'),
    engineCylinders: getNumericValue('Engine Number of Cylinders'),
    engineDisplacement: getValue('Displacement (L)'),
    engineHP: getNumericValue('Engine Brake (hp) From'),
    transmissionStyle: getValue('Transmission Style'),
    doors: getNumericValue('Doors'),
    plantCity: getValue('Plant City'),
    plantCountry: getValue('Plant Country'),
    plantCompanyName: getValue('Plant Company Name'),
    series: getValue('Series') || getValue('Series2'),
    gvwr: getValue('Gross Vehicle Weight Rating From'),
    manufacturerName: getValue('Manufacturer Name'),
    ncapBodyType: getValue('NCAP Body Type'),
    ncapMake: getValue('NCAP Make'),
    ncapModel: getValue('NCAP Model'),
    errorCode: getValue('Error Code'),
    errorText: getValue('Error Text') || getValue('Additional Error Text'),
  };
}

/**
 * Build a human-readable vehicle title
 */
function buildVehicleTitle(vehicle: NHTSAVehicleData): string {
  const parts: string[] = [];
  
  if (vehicle.year) parts.push(String(vehicle.year));
  if (vehicle.make) parts.push(vehicle.make);
  if (vehicle.model) parts.push(vehicle.model);
  if (vehicle.trim) parts.push(vehicle.trim);
  
  return parts.join(' ') || 'Unknown Vehicle';
}

/**
 * Calculate decode confidence based on data completeness
 */
function calculateDecodeConfidence(vehicle: NHTSAVehicleData): number {
  let score = 0;
  let maxScore = 0;

  // Critical fields (higher weight)
  const criticalFields = ['make', 'model', 'year'];
  for (const field of criticalFields) {
    maxScore += 20;
    if (vehicle[field as keyof NHTSAVehicleData]) score += 20;
  }

  // Important fields (medium weight)
  const importantFields = ['bodyClass', 'vehicleType', 'engineCylinders', 'fuelType'];
  for (const field of importantFields) {
    maxScore += 10;
    if (vehicle[field as keyof NHTSAVehicleData]) score += 10;
  }

  // Optional fields (lower weight)
  const optionalFields = ['trim', 'driveType', 'transmissionStyle', 'doors', 'engineHP'];
  for (const field of optionalFields) {
    maxScore += 5;
    if (vehicle[field as keyof NHTSAVehicleData]) score += 5;
  }

  // Penalty for errors
  if (vehicle.errorCode && vehicle.errorCode !== '0') {
    score = Math.max(0, score - 20);
  }

  return Math.min(0.99, score / maxScore);
}

/**
 * Create fallback result when VIN decode fails
 */
function createFallbackResult(itemName: string, reason: string): MarketDataSource {
  return {
    source: 'nhtsa',
    available: false,
    query: itemName,
    totalListings: 0,
    error: reason,
    metadata: {
      fallback: true,
      reason,
      searchUrl: 'https://vpic.nhtsa.dot.gov/decoder/',
    },
  };
}

/**
 * Validate a VIN checksum (position 9 is check digit)
 */
export function validateVIN(vin: string): boolean {
  if (!vin || vin.length !== 17) return false;

  const transliteration: Record<string, number> = {
    'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
    'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
    'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  };

  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const char = vin[i].toUpperCase();
    const value = transliteration[char];
    if (value === undefined) return false;
    sum += value * weights[i];
  }

  const checkDigit = sum % 11;
  const expectedCheck = checkDigit === 10 ? 'X' : String(checkDigit);

  return vin[8].toUpperCase() === expectedCheck;
}

/**
 * Decode multiple VINs in batch
 */
export async function decodeVINBatch(vins: string[]): Promise<Map<string, NHTSAVehicleData>> {
  const results = new Map<string, NHTSAVehicleData>();

  // NHTSA supports batch decode up to 50 VINs
  const batchSize = 50;
  
  for (let i = 0; i < vins.length; i += batchSize) {
    const batch = vins.slice(i, i + batchSize);
    const vinList = batch.join(';');

    try {
      const response = await fetch(
        `${NHTSA_API_BASE}/DecodeVINValuesBatch/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `DATA=${encodeURIComponent(vinList)}&format=json`,
        }
      );

      if (response.ok) {
        const data = await response.json();
        for (const result of data.Results || []) {
          if (result.VIN) {
            results.set(result.VIN, {
              vin: result.VIN,
              make: result.Make || '',
              model: result.Model || '',
              year: parseInt(result.ModelYear) || 0,
              trim: result.Trim || '',
              bodyClass: result.BodyClass || '',
              vehicleType: result.VehicleType || '',
              driveType: result.DriveType || '',
              fuelType: result.FuelTypePrimary || '',
              engineCylinders: parseInt(result.EngineNumberofCylinders) || 0,
              engineDisplacement: result.DisplacementL || '',
              engineHP: parseInt(result.EngineBrakeHP) || 0,
              transmissionStyle: result.TransmissionStyle || '',
              doors: parseInt(result.Doors) || 0,
              plantCity: result.PlantCity || '',
              plantCountry: result.PlantCountry || '',
              plantCompanyName: result.PlantCompanyName || '',
              series: result.Series || '',
              gvwr: result.GVWR || '',
              manufacturerName: result.ManufacturerName || '',
              ncapBodyType: result.NCSABodyType || '',
              ncapMake: result.NCSAMake || '',
              ncapModel: result.NCSAModel || '',
              errorCode: result.ErrorCode || '',
              errorText: result.ErrorText || '',
            });
          }
        }
      }
    } catch (error) {
      console.error('Batch VIN decode error:', error);
    }
  }

  return results;
}