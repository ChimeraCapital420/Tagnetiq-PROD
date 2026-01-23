// FILE: api/ebay/health-check.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.EBAY_APP_ID || process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  
  const checks: any = {
    credentials: {
      status: clientId && clientSecret ? 'pass' : 'fail',
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdPrefix: clientId ? clientId.substring(0, 20) + '...' : null
    },
    oauth: { status: 'pending' },
    browseApi: { status: 'pending' }
  };

  // Test OAuth
  let accessToken: string | null = null;
  if (clientId && clientSecret) {
    const startTime = Date.now();
    try {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
      });

      if (response.ok) {
        const data = await response.json();
        accessToken = data.access_token;
        checks.oauth = {
          status: 'pass',
          message: 'OAuth token generated',
          expiresIn: data.expires_in,
          latencyMs: Date.now() - startTime
        };
      } else {
        const error = await response.text();
        checks.oauth = {
          status: 'fail',
          message: `OAuth failed: ${response.status}`,
          error: error.substring(0, 200),
          latencyMs: Date.now() - startTime
        };
      }
    } catch (error) {
      checks.oauth = {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime
      };
    }
  }

  // Test Browse API
  if (accessToken) {
    const startTime = Date.now();
    try {
      const response = await fetch(
        'https://api.ebay.com/buy/browse/v1/item_summary/search?q=pokemon&limit=1',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        checks.browseApi = {
          status: 'pass',
          message: `Browse API working! Found ${data.total || 0} items`,
          itemsReturned: data.itemSummaries?.length || 0,
          latencyMs: Date.now() - startTime
        };
      } else {
        const error = await response.text();
        checks.browseApi = {
          status: 'fail',
          message: `Browse API failed: ${response.status}`,
          error: error.substring(0, 300),
          latencyMs: Date.now() - startTime
        };
      }
    } catch (error) {
      checks.browseApi = {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime
      };
    }
  }

  const allPassing = checks.credentials.status === 'pass' && 
                     checks.oauth.status === 'pass' && 
                     checks.browseApi.status === 'pass';

  return res.status(200).json({
    status: allPassing ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    apiType: 'Browse API (Active Listings)',
    checks
  });
}