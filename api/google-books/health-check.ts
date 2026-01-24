import type { VercelRequest, VercelResponse } from '@vercel/node';

// Google Books API Health Check
// Tests API key validity and basic connectivity

const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1';

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

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  const checks = {
    credentials: { status: 'unknown', message: '' },
    searchApi: { status: 'unknown', message: '', latencyMs: 0 },
    isbnLookup: { status: 'unknown', message: '', latencyMs: 0 },
  };

  // Check 1: Credentials exist
  if (!apiKey) {
    checks.credentials = { status: 'fail', message: 'GOOGLE_BOOKS_API_KEY not configured' };
    return res.status(500).json({
      status: 'unhealthy',
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  checks.credentials = { 
    status: 'pass', 
    message: 'API key configured',
  };

  // Check 2: Test search API
  try {
    const startTime = Date.now();
    const searchUrl = `${GOOGLE_BOOKS_API_URL}/volumes?q=harry+potter&maxResults=1&key=${apiKey}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      checks.searchApi = {
        status: 'pass',
        message: `Search API working! Found ${data.totalItems} total results`,
        latencyMs: latency,
      };
    } else {
      const errorData = await response.json();
      checks.searchApi = {
        status: 'fail',
        message: `API returned ${response.status}: ${errorData.error?.message || 'Unknown error'}`,
        latencyMs: latency,
      };
    }
  } catch (error: any) {
    checks.searchApi = {
      status: 'fail',
      message: `Connection failed: ${error.message}`,
      latencyMs: 0,
    };
  }

  // Check 3: Test ISBN lookup
  try {
    const startTime = Date.now();
    // Test with a known ISBN (Harry Potter)
    const isbnUrl = `${GOOGLE_BOOKS_API_URL}/volumes?q=isbn:9780439708180&key=${apiKey}`;
    
    const response = await fetch(isbnUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      const found = data.totalItems > 0;
      checks.isbnLookup = {
        status: found ? 'pass' : 'warn',
        message: found ? 'ISBN lookup working!' : 'ISBN lookup returned no results',
        latencyMs: latency,
      };
    } else {
      checks.isbnLookup = {
        status: 'fail',
        message: `API returned ${response.status}`,
        latencyMs: latency,
      };
    }
  } catch (error: any) {
    checks.isbnLookup = {
      status: 'fail',
      message: `Connection failed: ${error.message}`,
      latencyMs: 0,
    };
  }

  // Determine overall health
  const allPassed = checks.credentials.status === 'pass' && 
                    checks.searchApi.status === 'pass';

  return res.status(allPassed ? 200 : 500).json({
    status: allPassed ? 'healthy' : 'unhealthy',
    service: 'Google Books API',
    checks,
    timestamp: new Date().toISOString(),
  });
}