import type { VercelRequest, VercelResponse } from '@vercel/node';

// Numista API Health Check
// Tests API key validity and basic connectivity
// Quota: 2000 requests/month

const NUMISTA_API_URL = 'https://api.numista.com/v3';

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

  const apiKey = process.env.NUMISTA_API_KEY;
  const clientId = process.env.NUMISTA_CLIENT_ID;

  const checks = {
    credentials: { status: 'unknown', message: '' },
    catalogueApi: { status: 'unknown', message: '', latencyMs: 0 },
    issuersApi: { status: 'unknown', message: '', latencyMs: 0 },
  };

  // Check 1: Credentials exist
  if (!apiKey) {
    checks.credentials = { status: 'fail', message: 'NUMISTA_API_KEY not configured' };
    return res.status(500).json({
      status: 'unhealthy',
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  checks.credentials = { 
    status: 'pass', 
    message: `API key configured${clientId ? `, Client ID: ${clientId}` : ''}` 
  };

  // Check 2: Test catalogue search API
  try {
    const startTime = Date.now();
    const searchResponse = await fetch(
      `${NUMISTA_API_URL}/types?q=dollar&count=1`,
      {
        method: 'GET',
        headers: {
          'Numista-API-Key': apiKey,
        },
      }
    );

    const latency = Date.now() - startTime;

    if (searchResponse.ok) {
      const data = await searchResponse.json();
      checks.catalogueApi = {
        status: 'pass',
        message: `Catalogue API working! Found ${data.count} total results`,
        latencyMs: latency,
      };
    } else {
      const errorText = await searchResponse.text();
      checks.catalogueApi = {
        status: 'fail',
        message: `API returned ${searchResponse.status}: ${errorText.substring(0, 100)}`,
        latencyMs: latency,
      };
    }
  } catch (error: any) {
    checks.catalogueApi = {
      status: 'fail',
      message: `Connection failed: ${error.message}`,
      latencyMs: 0,
    };
  }

  // Check 3: Test issuers endpoint
  try {
    const startTime = Date.now();
    const issuersResponse = await fetch(
      `${NUMISTA_API_URL}/issuers?lang=en`,
      {
        method: 'GET',
        headers: {
          'Numista-API-Key': apiKey,
        },
      }
    );

    const latency = Date.now() - startTime;

    if (issuersResponse.ok) {
      const data = await issuersResponse.json();
      checks.issuersApi = {
        status: 'pass',
        message: `Issuers API working! Found ${data.count} issuers`,
        latencyMs: latency,
      };
    } else {
      checks.issuersApi = {
        status: 'fail',
        message: `API returned ${issuersResponse.status}`,
        latencyMs: latency,
      };
    }
  } catch (error: any) {
    checks.issuersApi = {
      status: 'fail',
      message: `Connection failed: ${error.message}`,
      latencyMs: 0,
    };
  }

  // Determine overall health
  const allPassed = Object.values(checks).every(
    (check) => check.status === 'pass'
  );

  return res.status(allPassed ? 200 : 500).json({
    status: allPassed ? 'healthy' : 'unhealthy',
    service: 'Numista Coin API',
    checks,
    quota: '2000 requests/month',
    timestamp: new Date().toISOString(),
  });
}