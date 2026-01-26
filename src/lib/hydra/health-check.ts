// FILE: src/lib/hydra/health-check.ts
// HYDRA v6.0 - Comprehensive API Health Check System
// Tests all authority APIs and tracks availability

import { getRateLimitStatus as getUpcRateLimit, healthCheck as upcHealthCheck } from './fetchers/upcitemdb.js';

// ==================== TYPES ====================

export interface APIHealthStatus {
  name: string;
  source: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
  latency: number;
  lastChecked: string;
  rateLimitInfo?: {
    remaining: number;
    limit: number;
    resetTime?: string;
  };
  message: string;
  requiresApiKey: boolean;
  hasApiKey: boolean;
  documentationUrl: string;
}

export interface HealthCheckReport {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  healthyCount: number;
  degradedCount: number;
  unhealthyCount: number;
  disabledCount: number;
  totalApis: number;
  apis: APIHealthStatus[];
  recommendations: string[];
}

// ==================== API CONFIGURATIONS ====================

const API_CONFIGS: Array<{
  name: string;
  source: string;
  envKey: string | null;
  testEndpoint: string;
  testQuery?: string;
  documentationUrl: string;
  requiresApiKey: boolean;
  customHealthCheck?: () => Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency: number; message: string }>;
}> = [
  {
    name: 'eBay Browse API',
    source: 'ebay',
    envKey: 'EBAY_APP_ID',
    testEndpoint: 'https://api.ebay.com/buy/browse/v1/item_summary/search',
    documentationUrl: 'https://developer.ebay.com/api-docs/buy/browse/overview.html',
    requiresApiKey: true,
  },
  {
    name: 'Numista (Coins)',
    source: 'numista',
    envKey: 'NUMISTA_API_KEY',
    testEndpoint: 'https://api.numista.com/api/v3/types',
    testQuery: '?q=morgan+dollar&count=1',
    documentationUrl: 'https://en.numista.com/api/doc/index.php',
    requiresApiKey: true,
  },
  {
    name: 'Pokemon TCG',
    source: 'pokemon_tcg',
    envKey: 'POKEMON_TCG_API_KEY',
    testEndpoint: 'https://api.pokemontcg.io/v2/cards',
    testQuery: '?q=name:pikachu&pageSize=1',
    documentationUrl: 'https://docs.pokemontcg.io/',
    requiresApiKey: false, // Optional but recommended
  },
  {
    name: 'Brickset (LEGO)',
    source: 'brickset',
    envKey: 'BRICKSET_API_KEY',
    testEndpoint: 'https://brickset.com/api/v3.asmx/getSets',
    documentationUrl: 'https://brickset.com/article/52664/api-version-3-documentation',
    requiresApiKey: true,
  },
  {
    name: 'Google Books',
    source: 'google_books',
    envKey: 'GOOGLE_BOOKS_API_KEY',
    testEndpoint: 'https://www.googleapis.com/books/v1/volumes',
    testQuery: '?q=isbn:9780134685991&maxResults=1',
    documentationUrl: 'https://developers.google.com/books/docs/v1/using',
    requiresApiKey: false, // Works without key but with limits
  },
  {
    name: 'Discogs (Music)',
    source: 'discogs',
    envKey: 'DISCOGS_TOKEN',
    testEndpoint: 'https://api.discogs.com/database/search',
    testQuery: '?q=beatles+abbey+road&type=release&per_page=1',
    documentationUrl: 'https://www.discogs.com/developers/',
    requiresApiKey: true,
  },
  {
    name: 'Retailed (Sneakers)',
    source: 'retailed',
    envKey: 'RETAILED_API_KEY',
    testEndpoint: 'https://api.retailed.io/v1/products',
    documentationUrl: 'https://docs.retailed.io/',
    requiresApiKey: true,
  },
  {
    name: 'PSA (Graded Cards)',
    source: 'psa',
    envKey: null, // PSA uses public cert lookup
    testEndpoint: 'https://www.psacard.com/cert',
    documentationUrl: 'https://www.psacard.com/services/psaverify',
    requiresApiKey: false,
  },
  {
    name: 'NHTSA (Vehicles)',
    source: 'nhtsa',
    envKey: null, // FREE - no key needed
    testEndpoint: 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/1HGBH41JXMN109186',
    testQuery: '?format=json',
    documentationUrl: 'https://vpic.nhtsa.dot.gov/api/',
    requiresApiKey: false,
  },
  {
    name: 'UPCitemdb (Barcodes)',
    source: 'upcitemdb',
    envKey: null, // FREE tier - no key needed
    testEndpoint: 'https://api.upcitemdb.com/prod/trial/lookup',
    documentationUrl: 'https://www.upcitemdb.com/wp/docs/main/development/api/',
    requiresApiKey: false,
    customHealthCheck: upcHealthCheck,
  },
  {
    name: 'Colnect (Collectibles)',
    source: 'colnect',
    envKey: 'COLNECT_API_KEY',
    testEndpoint: 'https://api.colnect.net/api/',
    documentationUrl: 'https://colnect.com/en/api',
    requiresApiKey: true,
  },
];

// ==================== HEALTH CHECK FUNCTIONS ====================

/**
 * Check if an API key is configured
 */
function hasApiKey(envKey: string | null): boolean {
  if (!envKey) return true; // No key required
  const key = process.env[envKey];
  return !!key && key.length > 0 && key !== 'your_key_here';
}

/**
 * Test a single API endpoint
 */
async function testApiEndpoint(config: typeof API_CONFIGS[0]): Promise<APIHealthStatus> {
  const startTime = Date.now();
  const hasKey = hasApiKey(config.envKey);
  
  // If custom health check exists, use it
  if (config.customHealthCheck) {
    try {
      const result = await config.customHealthCheck();
      return {
        name: config.name,
        source: config.source,
        status: result.status,
        latency: result.latency,
        lastChecked: new Date().toISOString(),
        message: result.message,
        requiresApiKey: config.requiresApiKey,
        hasApiKey: hasKey,
        documentationUrl: config.documentationUrl,
      };
    } catch (error) {
      return {
        name: config.name,
        source: config.source,
        status: 'unhealthy',
        latency: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Health check failed',
        requiresApiKey: config.requiresApiKey,
        hasApiKey: hasKey,
        documentationUrl: config.documentationUrl,
      };
    }
  }
  
  // Check if API key is required but missing
  if (config.requiresApiKey && !hasKey) {
    return {
      name: config.name,
      source: config.source,
      status: 'disabled',
      latency: 0,
      lastChecked: new Date().toISOString(),
      message: `API key not configured. Set ${config.envKey} in environment.`,
      requiresApiKey: config.requiresApiKey,
      hasApiKey: false,
      documentationUrl: config.documentationUrl,
    };
  }
  
  try {
    const url = config.testEndpoint + (config.testQuery || '');
    const headers: Record<string, string> = {
      'User-Agent': 'Tagnetiq-HYDRA-HealthCheck/1.0',
      'Accept': 'application/json',
    };
    
    // Add API key to headers based on service
    if (config.envKey && process.env[config.envKey]) {
      const key = process.env[config.envKey]!;
      switch (config.source) {
        case 'numista':
          headers['Numista-API-Key'] = key;
          break;
        case 'pokemon_tcg':
          headers['X-Api-Key'] = key;
          break;
        case 'discogs':
          headers['Authorization'] = `Discogs token=${key}`;
          break;
        case 'retailed':
          headers['x-api-key'] = key;
          break;
        case 'ebay':
          headers['Authorization'] = `Bearer ${key}`;
          break;
        case 'google_books':
          // Key is added as query param
          break;
      }
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      return {
        name: config.name,
        source: config.source,
        status: 'healthy',
        latency,
        lastChecked: new Date().toISOString(),
        message: `API responding normally (${response.status})`,
        requiresApiKey: config.requiresApiKey,
        hasApiKey: hasKey,
        documentationUrl: config.documentationUrl,
      };
    }
    
    // Handle rate limiting
    if (response.status === 429) {
      return {
        name: config.name,
        source: config.source,
        status: 'degraded',
        latency,
        lastChecked: new Date().toISOString(),
        message: 'Rate limited - too many requests',
        requiresApiKey: config.requiresApiKey,
        hasApiKey: hasKey,
        documentationUrl: config.documentationUrl,
      };
    }
    
    // Handle auth errors
    if (response.status === 401 || response.status === 403) {
      return {
        name: config.name,
        source: config.source,
        status: 'unhealthy',
        latency,
        lastChecked: new Date().toISOString(),
        message: `Authentication failed (${response.status}). Check API key.`,
        requiresApiKey: config.requiresApiKey,
        hasApiKey: hasKey,
        documentationUrl: config.documentationUrl,
      };
    }
    
    return {
      name: config.name,
      source: config.source,
      status: 'degraded',
      latency,
      lastChecked: new Date().toISOString(),
      message: `API returned status ${response.status}`,
      requiresApiKey: config.requiresApiKey,
      hasApiKey: hasKey,
      documentationUrl: config.documentationUrl,
    };
    
  } catch (error: any) {
    const latency = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      return {
        name: config.name,
        source: config.source,
        status: 'unhealthy',
        latency,
        lastChecked: new Date().toISOString(),
        message: 'Request timed out (>10s)',
        requiresApiKey: config.requiresApiKey,
        hasApiKey: hasApiKey(config.envKey),
        documentationUrl: config.documentationUrl,
      };
    }
    
    return {
      name: config.name,
      source: config.source,
      status: 'unhealthy',
      latency,
      lastChecked: new Date().toISOString(),
      message: error.message || 'Connection failed',
      requiresApiKey: config.requiresApiKey,
      hasApiKey: hasApiKey(config.envKey),
      documentationUrl: config.documentationUrl,
    };
  }
}

/**
 * Run comprehensive health check on all APIs
 */
export async function runHealthCheck(): Promise<HealthCheckReport> {
  console.log('\n🏥 === HYDRA API HEALTH CHECK ===\n');
  
  const results = await Promise.all(
    API_CONFIGS.map(config => testApiEndpoint(config))
  );
  
  // Count statuses
  const healthyCount = results.filter(r => r.status === 'healthy').length;
  const degradedCount = results.filter(r => r.status === 'degraded').length;
  const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
  const disabledCount = results.filter(r => r.status === 'disabled').length;
  
  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthyCount > 0 || disabledCount > results.length / 2) {
    overallStatus = 'unhealthy';
  } else if (degradedCount > 0 || disabledCount > 0) {
    overallStatus = 'degraded';
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  for (const result of results) {
    if (result.status === 'disabled') {
      recommendations.push(`Configure ${result.name}: Add ${API_CONFIGS.find(c => c.source === result.source)?.envKey} to your environment`);
    }
    if (result.status === 'unhealthy' && result.hasApiKey) {
      recommendations.push(`Check ${result.name}: ${result.message}`);
    }
    if (result.latency > 5000) {
      recommendations.push(`${result.name} is slow (${result.latency}ms). Consider caching responses.`);
    }
  }
  
  // Log results
  console.log('📊 Results:\n');
  for (const result of results) {
    const icon = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '❌',
      disabled: '⏸️',
    }[result.status];
    
    console.log(`${icon} ${result.name}`);
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Latency: ${result.latency}ms`);
    console.log(`   Message: ${result.message}`);
    console.log('');
  }
  
  console.log('📈 Summary:');
  console.log(`   Healthy: ${healthyCount}/${results.length}`);
  console.log(`   Degraded: ${degradedCount}`);
  console.log(`   Unhealthy: ${unhealthyCount}`);
  console.log(`   Disabled: ${disabledCount}`);
  console.log(`   Overall: ${overallStatus.toUpperCase()}\n`);
  
  if (recommendations.length > 0) {
    console.log('💡 Recommendations:');
    recommendations.forEach((r, i) => console.log(`   ${i + 1}. ${r}`));
  }
  
  return {
    timestamp: new Date().toISOString(),
    overallStatus,
    healthyCount,
    degradedCount,
    unhealthyCount,
    disabledCount,
    totalApis: results.length,
    apis: results,
    recommendations,
  };
}

/**
 * Quick health check - just returns status without detailed logging
 */
export async function quickHealthCheck(): Promise<{ 
  status: 'healthy' | 'degraded' | 'unhealthy';
  availableApis: string[];
  unavailableApis: string[];
}> {
  const results = await Promise.all(
    API_CONFIGS.map(config => testApiEndpoint(config))
  );
  
  const availableApis = results
    .filter(r => r.status === 'healthy' || r.status === 'degraded')
    .map(r => r.source);
  
  const unavailableApis = results
    .filter(r => r.status === 'unhealthy' || r.status === 'disabled')
    .map(r => r.source);
  
  const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
  const disabledCount = results.filter(r => r.status === 'disabled').length;
  const degradedCount = results.filter(r => r.status === 'degraded').length;
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthyCount > 0 || disabledCount > results.length / 2) {
    status = 'unhealthy';
  } else if (degradedCount > 0 || disabledCount > 0) {
    status = 'degraded';
  }
  
  return { status, availableApis, unavailableApis };
}

/**
 * Check a specific API by source name
 */
export async function checkApi(source: string): Promise<APIHealthStatus | null> {
  const config = API_CONFIGS.find(c => c.source === source);
  if (!config) {
    console.error(`Unknown API source: ${source}`);
    return null;
  }
  return testApiEndpoint(config);
}

/**
 * Get list of all configured APIs
 */
export function getApiList(): Array<{
  name: string;
  source: string;
  requiresApiKey: boolean;
  hasApiKey: boolean;
  documentationUrl: string;
}> {
  return API_CONFIGS.map(config => ({
    name: config.name,
    source: config.source,
    requiresApiKey: config.requiresApiKey,
    hasApiKey: hasApiKey(config.envKey),
    documentationUrl: config.documentationUrl,
  }));
}

// ==================== EXPORTS ====================

export default {
  runHealthCheck,
  quickHealthCheck,
  checkApi,
  getApiList,
};