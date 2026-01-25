// PSA API Health Check
// Tests connectivity to PSA Public API

import type { VercelRequest, VercelResponse } from '@vercel/node';

const PSA_API_BASE = 'https://api.psacard.com/publicapi';
const PSA_API_TOKEN = process.env.PSA_API_TOKEN;

export interface PSAHealthStatus {
  service: 'psa';
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  tokenConfigured: boolean;
  apiReachable: boolean;
  lastChecked: string;
  error?: string;
  dailyLimitInfo?: string;
}

/**
 * Test PSA API connectivity with a known cert number
 * Uses a well-known cert to verify API is responding
 */
async function testPSAConnection(): Promise<{ reachable: boolean; latency: number; error?: string }> {
  if (!PSA_API_TOKEN) {
    return { reachable: false, latency: 0, error: 'PSA_API_TOKEN not configured' };
  }

  const startTime = Date.now();
  
  try {
    // Test with a simple cert lookup (this cert may or may not exist, but we're testing connectivity)
    const testCert = '00000001'; // Use a minimal cert number to test
    const url = `${PSA_API_BASE}/cert/GetByCertNumber/${testCert}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PSA_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const latency = Date.now() - startTime;

    // PSA returns 200 even for "not found" - check for auth errors
    if (response.status === 401) {
      return { reachable: false, latency, error: 'Invalid API token (401 Unauthorized)' };
    }
    
    if (response.status === 403) {
      return { reachable: false, latency, error: 'API access forbidden (403)' };
    }

    if (response.status === 429) {
      return { reachable: true, latency, error: 'Rate limited (429) - daily limit may be reached' };
    }

    // Any 2xx or even 4xx (except auth errors) means the API is reachable
    if (response.status >= 200 && response.status < 500) {
      return { reachable: true, latency };
    }

    return { reachable: false, latency, error: `Unexpected status: ${response.status}` };

  } catch (error: any) {
    return { 
      reachable: false, 
      latency: Date.now() - startTime, 
      error: error.message || 'Network error' 
    };
  }
}

export async function checkPSAHealth(): Promise<PSAHealthStatus> {
  const tokenConfigured = !!PSA_API_TOKEN;
  
  if (!tokenConfigured) {
    return {
      service: 'psa',
      status: 'down',
      latency: 0,
      tokenConfigured: false,
      apiReachable: false,
      lastChecked: new Date().toISOString(),
      error: 'PSA_API_TOKEN environment variable not set',
    };
  }

  const connectionTest = await testPSAConnection();

  let status: PSAHealthStatus['status'] = 'healthy';
  if (!connectionTest.reachable) {
    status = 'down';
  } else if (connectionTest.error) {
    status = 'degraded';
  }

  return {
    service: 'psa',
    status,
    latency: connectionTest.latency,
    tokenConfigured,
    apiReachable: connectionTest.reachable,
    lastChecked: new Date().toISOString(),
    error: connectionTest.error,
    dailyLimitInfo: 'Free tier: 100 calls/day',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const health = await checkPSAHealth();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    return res.status(statusCode).json(health);
  } catch (error: any) {
    return res.status(500).json({
      service: 'psa',
      status: 'down',
      error: error.message,
      lastChecked: new Date().toISOString(),
    });
  }
}