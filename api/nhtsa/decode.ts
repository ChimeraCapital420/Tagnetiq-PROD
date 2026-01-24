// FILE: api/nhtsa/decode.ts
// NHTSA vPIC VIN Decoder - Returns comprehensive vehicle data

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const NHTSA_BASE_URL = 'https://vpic.nhtsa.dot.gov/api';

interface VehicleData {
  vin: string;
  make: string;
  model: string;
  year: string;
  trim: string;
  vehicleType: string;
  bodyClass: string;
  driveType: string;
  fuelType: string;
  engineCylinders: string;
  engineDisplacement: string;
  engineHP: string;
  transmission: string;
  doors: string;
  manufacturer: string;
  plantCity: string;
  plantCountry: string;
  plantState: string;
  series: string;
  gvwr: string;
  errorCode: string;
  errorText: string;
  // Additional fields for valuation context
  additionalData: Record<string, string>;
}

// Validate VIN format (basic validation)
function validateVIN(vin: string): { valid: boolean; error?: string } {
  if (!vin) {
    return { valid: false, error: 'VIN is required' };
  }

  // Remove spaces and convert to uppercase
  const cleanVIN = vin.replace(/\s/g, '').toUpperCase();

  // Standard VINs are 17 characters (post-1981)
  // Partial VINs are also supported by NHTSA
  if (cleanVIN.length !== 17 && cleanVIN.length < 11) {
    return { valid: false, error: 'VIN must be 17 characters (or at least 11 for partial decode)' };
  }

  // VINs cannot contain I, O, or Q
  if (/[IOQ]/i.test(cleanVIN)) {
    return { valid: false, error: 'VIN cannot contain letters I, O, or Q' };
  }

  // Must be alphanumeric (and * for partial VINs)
  if (!/^[A-HJ-NPR-Z0-9*]+$/.test(cleanVIN)) {
    return { valid: false, error: 'VIN contains invalid characters' };
  }

  return { valid: true };
}

// Parse NHTSA response into our standardized format
function parseNHTSAResponse(result: Record<string, string>, vin: string): VehicleData {
  // Collect all non-empty fields for additional data
  const additionalData: Record<string, string> = {};
  const excludeFields = [
    'Make', 'Model', 'ModelYear', 'Trim', 'VehicleType', 'BodyClass',
    'DriveType', 'FuelTypePrimary', 'EngineCylinders', 'DisplacementL',
    'EngineHP', 'TransmissionStyle', 'Doors', 'Manufacturer', 'PlantCity',
    'PlantCountry', 'PlantState', 'Series', 'GVWR', 'ErrorCode', 'ErrorText'
  ];

  for (const [key, value] of Object.entries(result)) {
    if (value && value.trim() !== '' && !excludeFields.includes(key)) {
      additionalData[key] = value;
    }
  }

  return {
    vin: vin.toUpperCase(),
    make: result.Make || '',
    model: result.Model || '',
    year: result.ModelYear || '',
    trim: result.Trim || '',
    vehicleType: result.VehicleType || '',
    bodyClass: result.BodyClass || '',
    driveType: result.DriveType || '',
    fuelType: result.FuelTypePrimary || result.FuelTypeSecondary || '',
    engineCylinders: result.EngineCylinders || '',
    engineDisplacement: result.DisplacementL ? `${result.DisplacementL}L` : '',
    engineHP: result.EngineHP || '',
    transmission: result.TransmissionStyle || '',
    doors: result.Doors || '',
    manufacturer: result.Manufacturer || '',
    plantCity: result.PlantCity || '',
    plantCountry: result.PlantCountry || '',
    plantState: result.PlantState || '',
    series: result.Series || result.Series2 || '',
    gvwr: result.GVWR || '',
    errorCode: result.ErrorCode || '0',
    errorText: result.ErrorText || '',
    additionalData
  };
}

// Generate a description string for the vehicle
function generateDescription(vehicle: VehicleData): string {
  const parts: string[] = [];

  if (vehicle.year) parts.push(vehicle.year);
  if (vehicle.make) parts.push(vehicle.make);
  if (vehicle.model) parts.push(vehicle.model);
  if (vehicle.trim) parts.push(vehicle.trim);

  let desc = parts.join(' ');

  // Add engine info if available
  if (vehicle.engineDisplacement || vehicle.engineCylinders) {
    const engineParts: string[] = [];
    if (vehicle.engineDisplacement) engineParts.push(vehicle.engineDisplacement);
    if (vehicle.engineCylinders) engineParts.push(`${vehicle.engineCylinders}-cyl`);
    if (vehicle.engineHP) engineParts.push(`${vehicle.engineHP}hp`);
    desc += ` (${engineParts.join(', ')})`;
  }

  return desc;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow both GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const startTime = Date.now();

  try {
    // Get VIN from query params (GET) or body (POST)
    let vin: string;
    let modelYear: string | undefined;

    if (req.method === 'GET') {
      vin = typeof req.query.vin === 'string' ? req.query.vin : '';
      modelYear = typeof req.query.year === 'string' ? req.query.year : undefined;
    } else {
      vin = req.body?.vin || '';
      modelYear = req.body?.year;
    }

    // Validate VIN
    const validation = validateVIN(vin);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        hint: 'VIN should be 17 characters. Example: 1FA6P8TD5M5100001'
      });
    }

    const cleanVIN = vin.replace(/\s/g, '').toUpperCase();

    // Build API URL
    let url = `${NHTSA_BASE_URL}/vehicles/DecodeVinValues/${cleanVIN}?format=json`;
    if (modelYear) {
      url += `&modelyear=${modelYear}`;
    }

    // Call NHTSA API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TagnetIQ/1.0.0'
      }
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      console.error(`NHTSA API error: ${response.status}`);
      return res.status(502).json({
        error: 'Failed to decode VIN',
        message: `NHTSA API returned ${response.status}`,
        responseTime
      });
    }

    const data = await response.json();

    // Validate response
    if (!data.Results || !Array.isArray(data.Results) || data.Results.length === 0) {
      return res.status(502).json({
        error: 'Invalid response from NHTSA',
        message: 'No results returned',
        responseTime
      });
    }

    const result = data.Results[0];
    const vehicle = parseNHTSAResponse(result, cleanVIN);

    // Check for decode errors
    const errorCode = vehicle.errorCode;
    const hasError = errorCode !== '0' && !errorCode.startsWith('0');

    // Build response
    return res.status(200).json({
      success: !hasError,
      vin: vehicle.vin,
      vehicle: {
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        series: vehicle.series,
        vehicleType: vehicle.vehicleType,
        bodyClass: vehicle.bodyClass
      },
      engine: {
        cylinders: vehicle.engineCylinders,
        displacement: vehicle.engineDisplacement,
        horsepower: vehicle.engineHP,
        fuelType: vehicle.fuelType
      },
      drivetrain: {
        driveType: vehicle.driveType,
        transmission: vehicle.transmission
      },
      specs: {
        doors: vehicle.doors,
        gvwr: vehicle.gvwr
      },
      manufacturing: {
        manufacturer: vehicle.manufacturer,
        plantCity: vehicle.plantCity,
        plantState: vehicle.plantState,
        plantCountry: vehicle.plantCountry
      },
      description: generateDescription(vehicle),
      // Include for Hydra integration
      valuationContext: {
        itemName: generateDescription(vehicle),
        category: 'vehicles',
        identifiers: {
          vin: vehicle.vin,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model
        }
      },
      // Raw data for advanced use
      raw: vehicle.additionalData,
      // Error info if any
      ...(hasError && {
        warning: {
          code: vehicle.errorCode,
          message: vehicle.errorText
        }
      }),
      // Metadata
      responseTime,
      source: 'NHTSA vPIC',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('NHTSA decode error:', error);

    return res.status(500).json({
      error: 'Failed to decode VIN',
      message: error.message || 'Internal server error',
      responseTime,
      timestamp: new Date().toISOString()
    });
  }
}