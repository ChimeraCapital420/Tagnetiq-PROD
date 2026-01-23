// FILE: api/ebay/health-check.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const appId = process.env.EBAY_APP_ID || process.env.EBAY_API_TOKEN || process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  
  const checks: any = {
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
        'keywords': 'iPhone',
        'paginationInput.entriesPerPage': '1'
      });

      const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params}`;
      const response = await fetch(url);
      const responseText = await response.text();
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        checks.findingApi = {
          status: 'fail',
          message: 'Invalid JSON response',
          rawResponse: responseText.substring(0, 500),
          latencyMs: Date.now() - startTime
        };
        return res.status(200).json({ status: 'unhealthy', timestamp: new Date().toISOString(), checks });
      }

      const ack = data.findItemsByKeywordsResponse?.[0]?.ack?.[0];
      const errorMsg = data.findItemsByKeywordsResponse?.[0]?.errorMessage?.[0]?.error?.[0]?.message?.[0];
      const totalEntries = data.findItemsByKeywordsResponse?.[0]?.paginationOutput?.[0]?.totalEntries?.[0];

      if (ack === 'Success' || ack === 'Warning') {
        checks.findingApi = {
          status: 'pass',
          message: `Finding API working! Found ${totalEntries} items`,
          ack,
          latencyMs: Date.now() - startTime
        };
      } else {
        checks.findingApi = {
          status: 'fail',
          message: errorMsg || `Unexpected ack: ${ack}`,
          ack,
          rawResponse: JSON.stringify(data).substring(0, 500),
          latencyMs: Date.now() - startTime
        };
      }
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