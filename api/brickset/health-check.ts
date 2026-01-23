import type { VercelRequest, VercelResponse } from '@vercel/node';

// Brickset API Health Check
// Tests API key validity and basic connectivity
// Note: Brickset requires login to get userHash for most API calls

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
  const username = process.env.BRICKSET_USERNAME;
  const password = process.env.BRICKSET_PASSWORD;

  const checks = {
    credentials: { status: 'unknown', message: '' },
    keyValidation: { status: 'unknown', message: '', latencyMs: 0 },
    loginTest: { status: 'unknown', message: '', latencyMs: 0 },
    searchTest: { status: 'unknown', message: '', latencyMs: 0 },
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

  const hasLoginCreds = username && password;
  checks.credentials = { 
    status: 'pass', 
    message: `API key configured${hasLoginCreds ? ', login credentials available' : ' (no login creds - limited functionality)'}` 
  };

  // Check 2: Test API key validation
  try {
    const startTime = Date.now();
    const checkUrl = `${BRICKSET_API_URL}/checkKey?apiKey=${encodeURIComponent(apiKey)}`;
    
    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
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

  // Check 3: Test login (if credentials provided)
  let userHash = '';
  if (hasLoginCreds) {
    try {
      const startTime = Date.now();
      const loginUrl = `${BRICKSET_API_URL}/login?apiKey=${encodeURIComponent(apiKey)}&username=${encodeURIComponent(username!)}&password=${encodeURIComponent(password!)}`;
      
      const response = await fetch(loginUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const latency = Date.now() - startTime;
      const data = await response.json();

      if (data.status === 'success' && data.hash) {
        userHash = data.hash;
        checks.loginTest = {
          status: 'pass',
          message: 'Login successful, userHash obtained',
          latencyMs: latency,
        };
      } else {
        checks.loginTest = {
          status: 'fail',
          message: `Login failed: ${data.message || 'Unknown error'}`,
          latencyMs: latency,
        };
      }
    } catch (error: any) {
      checks.loginTest = {
        status: 'fail',
        message: `Login failed: ${error.message}`,
        latencyMs: 0,
      };
    }
  } else {
    checks.loginTest = {
      status: 'skip',
      message: 'No login credentials configured (BRICKSET_USERNAME, BRICKSET_PASSWORD)',
      latencyMs: 0,
    };
  }

  // Check 4: Test search (requires userHash)
  if (userHash) {
    try {
      const startTime = Date.now();
      const searchParams = JSON.stringify({ query: 'millennium falcon', pageSize: 1 });
      const searchUrl = `${BRICKSET_API_URL}/getSets?apiKey=${encodeURIComponent(apiKey)}&userHash=${encodeURIComponent(userHash)}&params=${encodeURIComponent(searchParams)}`;
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const latency = Date.now() - startTime;
      const data = await response.json();

      if (data.status === 'success') {
        checks.searchTest = {
          status: 'pass',
          message: `Search API working! Found ${data.matches || 0} total matches`,
          latencyMs: latency,
        };
      } else {
        checks.searchTest = {
          status: 'fail',
          message: `Search failed: ${data.message || 'Unknown error'}`,
          latencyMs: latency,
        };
      }
    } catch (error: any) {
      checks.searchTest = {
        status: 'fail',
        message: `Search failed: ${error.message}`,
        latencyMs: 0,
      };
    }
  } else {
    checks.searchTest = {
      status: 'skip',
      message: 'Skipped - requires successful login first',
      latencyMs: 0,
    };
  }

  // Determine overall health
  const criticalPassed = checks.credentials.status === 'pass' && checks.keyValidation.status === 'pass';
  const fullyOperational = criticalPassed && checks.loginTest.status === 'pass' && checks.searchTest.status === 'pass';

  return res.status(criticalPassed ? 200 : 500).json({
    status: fullyOperational ? 'healthy' : (criticalPassed ? 'partial' : 'unhealthy'),
    service: 'Brickset LEGO API',
    message: fullyOperational 
      ? 'All systems operational' 
      : (criticalPassed ? 'API key valid but login required for full functionality' : 'Configuration error'),
    setupRequired: !hasLoginCreds ? {
      instructions: 'Add BRICKSET_USERNAME and BRICKSET_PASSWORD to environment variables',
      note: 'Use your Brickset account credentials (same as website login)',
    } : undefined,
    checks,
    timestamp: new Date().toISOString(),
  });
}