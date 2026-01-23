// FILE: api/ebay/health-check.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const appId = process.env.EBAY_APP_ID || process.env.EBAY_API_TOKEN || process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  
  const checks = {
    credentials: {
      status: appId ? 'pass' : 'fail',
      hasAppId: !!appId,
      hasClientSecret: !!clientSecret,
      appIdPrefix: appId ? appId.substring(0, 15) + '...' : null,
      environment: process.env.EBAY_ENVIRONMENT || 'production'
    },
    findingApi: { status: 'pending', message: '', latencyMs: 0 }
  };

  // Test Finding API
  if (appId) {
    const startTime = Date.now();
    try {
      const params = new URLSearchParams({
        'OPERATION-NAME': 'findItemsByKeywords',
        'SERVICE-VERSION': '1.0.0',
        'SECURITY-APPNAME': appId,
        'RESPONSE-DATA-FORMAT': 'JSON',
        'keywords': 'test',
        'paginationInput.entriesPerPage': '1'
      });

      const response = await fetch(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`);
      const data = await response.json();
      const ack = data.findItemsByKeywordsResponse?.[0]?.ack?.[0];

      checks.findingApi = {
        status: ack === 'Success' || ack === 'Warning' ? 'pass' : 'fail',
        message: ack === 'Success' ? 'Finding API working' : `Response: ${ack}`,
        latencyMs: Date.now() - startTime
      };
    } catch (error) {
      checks.findingApi = {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime
      };
    }
  }

  const allPassing = checks.credentials.status === 'pass' && checks.findingApi.status === 'pass';

  return res.status(200).json({
    status: allPassing ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  });
}