// FILE: api/nhtsa/health-check.ts
// NHTSA vPIC API Health Check - Free VIN Decoder

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

const NHTSA_BASE_URL = 'https://vpic.nhtsa.dot.gov/api';

// Test VIN - 2021 Ford Mustang (known valid VIN for testing)
const TEST_VIN = '1FA6P8TD5M5100001';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const startTime = Date.now();

  try {
    // Test the DecodeVinValues endpoint with a known VIN
    const response = await fetch(
      `${NHTSA_BASE_URL}/vehicles/DecodeVinValues/${TEST_VIN}?format=json`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TagnetIQ/1.0.0'
        }
      }
    );

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return res.status(200).json({
        provider: 'nhtsa',
        status: 'unhealthy',
        message: `NHTSA API returned ${response.status}`,
        responseTime,
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();

    // Validate response structure
    if (!data.Results || !Array.isArray(data.Results) || data.Results.length === 0) {
      return res.status(200).json({
        provider: 'nhtsa',
        status: 'unhealthy',
        message: 'Invalid response structure from NHTSA',
        responseTime,
        timestamp: new Date().toISOString()
      });
    }

    const result = data.Results[0];
    
    // Check for successful decode (ErrorCode 0 means clean decode)
    const errorCode = result.ErrorCode || '0';
    const isHealthy = errorCode === '0' || errorCode.startsWith('0');

    return res.status(200).json({
      provider: 'nhtsa',
      status: isHealthy ? 'healthy' : 'degraded',
      message: isHealthy ? 'NHTSA vPIC API is operational' : `API returned error: ${result.ErrorText}`,
      responseTime,
      timestamp: new Date().toISOString(),
      testDecode: {
        vin: TEST_VIN,
        make: result.Make,
        model: result.Model,
        year: result.ModelYear,
        vehicleType: result.VehicleType
      },
      capabilities: {
        vinDecode: true,
        batchDecode: true,
        manufacturerLookup: true,
        recallLookup: true,
        rateLimited: false,
        authRequired: false
      },
      documentation: 'https://vpic.nhtsa.dot.gov/api'
    });

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('NHTSA health check failed:', error);

    return res.status(200).json({
      provider: 'nhtsa',
      status: 'unhealthy',
      message: error.message || 'Failed to connect to NHTSA API',
      responseTime,
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}