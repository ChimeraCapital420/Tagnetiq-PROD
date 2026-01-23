import type { VercelRequest, VercelResponse } from '@vercel/node';

// Brickset API Health Check
// Tests API key validity and basic connectivity

const BRICKSET_API_URL = 'https://brickset.com/api/v3.asmx';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.BRICKSET_API_KEY;

  const checks = {
    credentials: { status: 'unknown', message: '' },
    apiConnection: { status: 'unknown', message: '', latencyMs: 0 },
    keyValidation: { status: 'unknown', message: '', latencyMs: 0 },
  };

  // Check 1: Credentials exist
  if (!apiKey) {
    checks.credentials = { status: 'fail', message: 'BRICKSET_API_KEY not configured' };
    return res.status(500).json({
      status: 'unhealthy',
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  checks.credentials = { 
    status: 'pass', 
    message: 'API key configured' 
  };

  // Check 2: Test API key validation
  try {
    const startTime = Date.now();
    
    // Brickset uses JSON endpoints
    const checkUrl = `${BRICKSET_API_URL}/checkKey?apiKey=${encodeURIComponent(apiKey)}`;
    
    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const latency = Date.now() - startTime;
    const data = await response.json();

    if (data.status === 'success') {
      checks.keyValidation = {
        status: 'pass',
        message: 'API key is valid',
        latencyMs: latency,
      };
    } else {
      checks.keyValidation = {
        status: 'fail',
        message: `Key validation failed: ${data.message || 'Unknown error'}`,
        latencyMs: latency,
      };
    }
  } catch (error: any) {
    checks.keyValidation = {
      status: 'fail',
      message: `Connection failed: ${error.message}`,
      latencyMs: 0,
    };
  }

  // Check 3: Test a simple search
  try {
    const startTime = Date.now();
    
    // Search for a known set (LEGO Star Wars Millennium Falcon)
    const searchUrl = `${BRICKSET_API_URL}/getSets?apiKey=${encodeURIComponent(apiKey)}&params={"query":"millennium falcon","pageSize":1}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const latency = Date.now() - startTime;
    const data = await response.json();

    if (data.status === 'success') {
      checks.apiConnection = {
        status: 'pass',
        message: `Search API working! Found ${data.matches || 0} total matches`,
        latencyMs: latency,
      };
    } else {
      checks.apiConnection = {
        status: 'fail',
        message: `Search failed: ${data.message || 'Unknown error'}`,
        latencyMs: latency,
      };
    }
  } catch (error: any) {
    checks.apiConnection = {
      status: 'fail',
      message: `Search failed: ${error.message}`,
      latencyMs: 0,
    };
  }

  // Determine overall health
  const allPassed = Object.values(checks).every(
    (check) => check.status === 'pass'
  );

  return res.status(allPassed ? 200 : 500).json({
    status: allPassed ? 'healthy' : 'unhealthy',
    service: 'Brickset LEGO API',
    checks,
    timestamp: new Date().toISOString(),
  });
}