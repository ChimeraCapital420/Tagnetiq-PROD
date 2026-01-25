// Entrupy API Health Check
// Tests connectivity to Entrupy luxury authentication API

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getEntrupyConfig } from './index';

const ENTRUPY_API_TOKEN = process.env.ENTRUPY_API_TOKEN;

export interface EntrupyHealthStatus {
  service: 'entrupy';
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  tokenConfigured: boolean;
  apiReachable: boolean;
  supportedBrands?: string[];
  lastChecked: string;
  error?: string;
}

/**
 * Test Entrupy API connectivity via config endpoint
 */
async function testEntrupyConnection(): Promise<{ 
  reachable: boolean; 
  latency: number; 
  brands?: string[];
  error?: string 
}> {
  if (!ENTRUPY_API_TOKEN) {
    return { reachable: false, latency: 0, error: 'ENTRUPY_API_TOKEN not configured' };
  }

  const startTime = Date.now();
  
  try {
    // Use config endpoint to test connectivity and get supported brands
    const config = await getEntrupyConfig();
    const latency = Date.now() - startTime;
    
    if (!config) {
      return { reachable: false, latency, error: 'Failed to fetch config' };
    }
    
    const brands = config.config?.brands?.map(b => b.display.name) || [];
    
    return { reachable: true, latency, brands };
    
  } catch (error: any) {
    return { 
      reachable: false, 
      latency: Date.now() - startTime, 
      error: error.message || 'Network error' 
    };
  }
}

export async function checkEntrupyHealth(): Promise<EntrupyHealthStatus> {
  const tokenConfigured = !!ENTRUPY_API_TOKEN;
  
  if (!tokenConfigured) {
    return {
      service: 'entrupy',
      status: 'down',
      latency: 0,
      tokenConfigured: false,
      apiReachable: false,
      lastChecked: new Date().toISOString(),
      error: 'ENTRUPY_API_TOKEN environment variable not set',
    };
  }

  const connectionTest = await testEntrupyConnection();

  let status: EntrupyHealthStatus['status'] = 'healthy';
  if (!connectionTest.reachable) {
    status = 'down';
  } else if (connectionTest.error) {
    status = 'degraded';
  }

  return {
    service: 'entrupy',
    status,
    latency: connectionTest.latency,
    tokenConfigured,
    apiReachable: connectionTest.reachable,
    supportedBrands: connectionTest.brands,
    lastChecked: new Date().toISOString(),
    error: connectionTest.error,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const health = await checkEntrupyHealth();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    return res.status(statusCode).json(health);
  } catch (error: any) {
    return res.status(500).json({
      service: 'entrupy',
      status: 'down',
      error: error.message,
      lastChecked: new Date().toISOString(),
    });
  }
}