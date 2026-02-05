// ============================================
// FILE: api/test-individual-datasources.ts
// HYDRA v6.3 - Market Data API Connection Tester
// 
// Mirrors /api/test-individual-providers for AI providers
// Tests all external datasource API connections:
//   Pokemon TCG, Numista, Google Books, NHTSA, Discogs,
//   Brickset, eBay, Retailed, PSA, UPCitemdb, Colnect,
//   Entrupy, Comic Vine
//
// Usage: GET /api/test-individual-datasources
// Optional: ?source=numista  (test single source)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';

export const config = {
  maxDuration: 60,
};

// ============================================
// TYPES
// ============================================

interface DatasourceResult {
  source: string;
  displayName: string;
  category: string;
  hasApiKey: boolean;
  keyLength: number;
  requiresKey: boolean;
  success: boolean;
  responseTime: number;
  error: string | null;
  response: {
    httpStatus: number | null;
    dataReturned: boolean;
    sampleField: string | null;
    resultCount: number | null;
  } | null;
  documentation: string;
}

// ============================================
// DATASOURCE CONFIGURATIONS
// ============================================

interface DatasourceConfig {
  name: string;
  displayName: string;
  category: string;
  envKeys: string[];
  requiresKey: boolean;
  documentation: string;
  test: (apiKey: string | null) => Promise<{
    httpStatus: number;
    dataReturned: boolean;
    sampleField: string | null;
    resultCount: number | null;
  }>;
}

function getFirstAvailableKey(envKeys: string[]): string | null {
  for (const key of envKeys) {
    const val = process.env[key];
    if (val && val.length > 0 && val !== 'your_key_here') {
      return val;
    }
  }
  return null;
}

function getKeyLength(envKeys: string[]): number {
  const key = getFirstAvailableKey(envKeys);
  return key ? key.length : 0;
}

// ============================================
// INDIVIDUAL API TEST FUNCTIONS
// ============================================

const DATASOURCES: DatasourceConfig[] = [

  // ------------------------------------------
  // 1. Pokemon TCG API
  // ------------------------------------------
  {
    name: 'pokemon_tcg',
    displayName: 'Pokemon TCG',
    category: 'Trading Cards',
    envKeys: ['POKEMON_TCG_API_KEY'],
    requiresKey: false, // Works without key but rate-limited
    documentation: 'https://docs.pokemontcg.io/',
    test: async (apiKey) => {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (apiKey) headers['X-Api-Key'] = apiKey;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        'https://api.pokemontcg.io/v2/cards?pageSize=1',
        { headers, signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      const data = await response.json();
      return {
        httpStatus: response.status,
        dataReturned: !!(data.data && data.data.length > 0),
        sampleField: data.data?.[0]?.name || null,
        resultCount: data.totalCount || null,
      };
    },
  },

  // ------------------------------------------
  // 2. Numista (Coins)
  // ------------------------------------------
  {
    name: 'numista',
    displayName: 'Numista',
    category: 'Coins & Currency',
    envKeys: ['NUMISTA_API_KEY'],
    requiresKey: true,
    documentation: 'https://en.numista.com/api/doc/index.php',
    test: async (apiKey) => {
      if (!apiKey) throw new Error('NUMISTA_API_KEY not configured');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        'https://api.numista.com/v2/coins?q=penny&count=1&lang=en',
        {
          headers: {
            'Numista-API-Key': apiKey,
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      return {
        httpStatus: response.status,
        dataReturned: !!(data.coins && data.coins.length > 0),
        sampleField: data.coins?.[0]?.title || data.coins?.[0]?.issuer?.name || null,
        resultCount: data.count || null,
      };
    },
  },

  // ------------------------------------------
  // 3. Google Books
  // ------------------------------------------
  {
    name: 'google_books',
    displayName: 'Google Books',
    category: 'Books',
    envKeys: ['GOOGLE_BOOKS_API_KEY', 'GOOGLEBOT_API_KEY'],
    requiresKey: false, // Works without key but limited
    documentation: 'https://developers.google.com/books/docs/v1/using',
    test: async (apiKey) => {
      let url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:9780134685991&maxResults=1';
      if (apiKey) url += `&key=${apiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      return {
        httpStatus: response.status,
        dataReturned: !!(data.items && data.items.length > 0),
        sampleField: data.items?.[0]?.volumeInfo?.title || null,
        resultCount: data.totalItems || null,
      };
    },
  },

  // ------------------------------------------
  // 4. NHTSA (Vehicles) - FREE
  // ------------------------------------------
  {
    name: 'nhtsa',
    displayName: 'NHTSA (Vehicles)',
    category: 'Vehicles',
    envKeys: [],
    requiresKey: false,
    documentation: 'https://vpic.nhtsa.dot.gov/api/',
    test: async () => {
      const TEST_VIN = '1FA6P8TD5M5100001'; // 2021 Ford Mustang

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${TEST_VIN}?format=json`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'TagnetIQ/1.0.0',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      const result = data.Results?.[0];
      return {
        httpStatus: response.status,
        dataReturned: !!(result && result.Make),
        sampleField: result ? `${result.ModelYear} ${result.Make} ${result.Model}` : null,
        resultCount: data.Results?.length || null,
      };
    },
  },

  // ------------------------------------------
  // 5. Discogs (Vinyl/Music)
  // ------------------------------------------
  {
    name: 'discogs',
    displayName: 'Discogs',
    category: 'Vinyl & Music',
    envKeys: ['DISCOGS_TOKEN', 'DISCOGS_USER_TOKEN'],
    requiresKey: true,
    documentation: 'https://www.discogs.com/developers/',
    test: async (apiKey) => {
      if (!apiKey) throw new Error('DISCOGS_TOKEN not configured');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        'https://api.discogs.com/database/search?q=beatles+abbey+road&type=release&per_page=1',
        {
          headers: {
            'Authorization': `Discogs token=${apiKey}`,
            'User-Agent': 'TagnetIQ/1.0.0',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      return {
        httpStatus: response.status,
        dataReturned: !!(data.results && data.results.length > 0),
        sampleField: data.results?.[0]?.title || null,
        resultCount: data.pagination?.items || null,
      };
    },
  },

  // ------------------------------------------
  // 6. Brickset (LEGO)
  // ------------------------------------------
  {
    name: 'brickset',
    displayName: 'Brickset',
    category: 'LEGO',
    envKeys: ['BRICKSET_API_KEY'],
    requiresKey: true,
    documentation: 'https://brickset.com/article/52664/api-version-3-documentation',
    test: async (apiKey) => {
      if (!apiKey) throw new Error('BRICKSET_API_KEY not configured');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // checkKey is the simplest Brickset endpoint to validate
      const response = await fetch(
        `https://brickset.com/api/v3.asmx/checkKey?apiKey=${apiKey}`,
        {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      return {
        httpStatus: response.status,
        dataReturned: data.status === 'success',
        sampleField: data.status || null,
        resultCount: null,
      };
    },
  },

  // ------------------------------------------
  // 7. eBay (General Marketplace)
  // ------------------------------------------
  {
    name: 'ebay',
    displayName: 'eBay',
    category: 'General Marketplace',
    envKeys: ['EBAY_APP_ID', 'EBAY_CLIENT_ID'],
    requiresKey: true,
    documentation: 'https://developer.ebay.com/develop/apis',
    test: async (apiKey) => {
      if (!apiKey) throw new Error('EBAY_APP_ID / EBAY_CLIENT_ID not configured');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Use the Finding API with simple keyword search
      const response = await fetch(
        `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findItemsByKeywords&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${apiKey}&RESPONSE-DATA-FORMAT=JSON&keywords=test&paginationInput.entriesPerPage=1`,
        {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      const searchResult = data.findItemsByKeywordsResponse?.[0]?.searchResult?.[0];
      const count = parseInt(searchResult?.['@count'] || '0', 10);
      return {
        httpStatus: response.status,
        dataReturned: count > 0,
        sampleField: searchResult?.item?.[0]?.title?.[0] || null,
        resultCount: count,
      };
    },
  },

  // ------------------------------------------
  // 8. Retailed (Sneakers)
  // ------------------------------------------
  {
    name: 'retailed',
    displayName: 'Retailed',
    category: 'Sneakers & Streetwear',
    envKeys: ['RETAILED_API_KEY'],
    requiresKey: true,
    documentation: 'https://docs.retailed.io/',
    test: async (apiKey) => {
      if (!apiKey) throw new Error('RETAILED_API_KEY not configured');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        'https://api.retailed.io/v1/products?limit=1',
        {
          headers: {
            'x-api-key': apiKey,
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      const products = Array.isArray(data) ? data : data.products || data.results || [];
      return {
        httpStatus: response.status,
        dataReturned: products.length > 0,
        sampleField: products[0]?.name || products[0]?.title || null,
        resultCount: products.length,
      };
    },
  },

  // ------------------------------------------
  // 9. PSA (Graded Cards) - Public Cert Lookup
  // ------------------------------------------
  {
    name: 'psa',
    displayName: 'PSA Cert Verify',
    category: 'Graded Cards',
    envKeys: ['PSA_API_KEY'],
    requiresKey: false, // Public cert lookup works without key
    documentation: 'https://www.psacard.com/services/psaverify',
    test: async (apiKey) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Use the public cert verification page - test with known cert number
      // PSA doesn't have a formal public API, so we test reachability
      const testCertNumber = '10000001';
      const url = apiKey 
        ? `https://api.psacard.com/publicapi/cert/GetByCertNumber/${testCertNumber}`
        : `https://www.psacard.com/cert/${testCertNumber}`;
      
      const headers: Record<string, string> = {
        'Accept': apiKey ? 'application/json' : 'text/html',
        'User-Agent': 'TagnetIQ/1.0.0',
      };
      if (apiKey) headers['Authorization'] = `bearer ${apiKey}`;

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // For HTML response, just check reachability (200/301/302 are ok)
      const isReachable = response.ok || response.status === 301 || response.status === 302;
      if (!isReachable) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      if (apiKey && response.headers.get('content-type')?.includes('json')) {
        const data = await response.json();
        return {
          httpStatus: response.status,
          dataReturned: !!data.PSACert,
          sampleField: data.PSACert?.CardGrade || null,
          resultCount: data.PSACert ? 1 : 0,
        };
      }

      return {
        httpStatus: response.status,
        dataReturned: true,
        sampleField: 'Cert page reachable (HTML)',
        resultCount: null,
      };
    },
  },

  // ------------------------------------------
  // 10. UPCitemdb (Barcodes) - FREE
  // ------------------------------------------
  {
    name: 'upcitemdb',
    displayName: 'UPCitemdb',
    category: 'Barcodes & UPC',
    envKeys: [],
    requiresKey: false,
    documentation: 'https://www.upcitemdb.com/wp/docs/main/development/api/',
    test: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Test with a known UPC (Coca-Cola Classic 12oz can)
      const response = await fetch(
        'https://api.upcitemdb.com/prod/trial/lookup?upc=049000006346',
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'TagnetIQ/1.0.0',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      return {
        httpStatus: response.status,
        dataReturned: !!(data.items && data.items.length > 0),
        sampleField: data.items?.[0]?.title || null,
        resultCount: data.total || null,
      };
    },
  },

  // ------------------------------------------
  // 11. Colnect (Collectibles) - HMAC Auth
  // ------------------------------------------
  {
    name: 'colnect',
    displayName: 'Colnect',
    category: 'Collectibles',
    envKeys: ['COLNECT_API_KEY', 'COLNECT_API_SECRET'],
    requiresKey: true,
    documentation: 'https://colnect.com/en/help/api',
    test: async () => {
      const appId = process.env.COLNECT_API_KEY;
      const appSecret = process.env.COLNECT_API_SECRET;
      if (!appId || !appSecret) throw new Error('COLNECT_API_KEY / COLNECT_API_SECRET not configured');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Build the authenticated request per Colnect CAPI spec
      const urlPath = `/en/api/${appId}/categories`;
      const timestamp = Math.floor(Date.now() / 1000);
      const hashInput = `${urlPath}>|<${timestamp}`;
      const hash = createHmac('sha256', appSecret).update(hashInput).digest('hex');

      const response = await fetch(
        `https://api.colnect.net${urlPath}`,
        {
          headers: {
            'Capi-Timestamp': String(timestamp),
            'Capi-Hash': hash,
            'User-Agent': 'TagnetIQ-HYDRA/1.0.0',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      const categories = Array.isArray(data) ? data : [];
      return {
        httpStatus: response.status,
        dataReturned: categories.length > 0,
        sampleField: categories[0] || null,
        resultCount: categories.length,
      };
    },
  },

  // ------------------------------------------
  // 12. Entrupy (Luxury Authentication)
  // ------------------------------------------
  {
    name: 'entrupy',
    displayName: 'Entrupy',
    category: 'Luxury Authentication',
    envKeys: ['ENTRUPY_API_TOKEN'],
    requiresKey: true,
    documentation: 'https://docs.entrupy.com/',
    test: async (apiKey) => {
      if (!apiKey) throw new Error('ENTRUPY_API_TOKEN not configured');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const baseUrl = process.env.ENTRUPY_API_BASE || 'https://api.entrupy.com';
      const response = await fetch(
        `${baseUrl}/v2/config`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({}),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      const brands = data.config?.brands || [];
      return {
        httpStatus: response.status,
        dataReturned: brands.length > 0,
        sampleField: brands[0]?.display?.name || null,
        resultCount: brands.length,
      };
    },
  },

  // ------------------------------------------
  // 13. Comic Vine
  // ------------------------------------------
  {
    name: 'comic_vine',
    displayName: 'Comic Vine',
    category: 'Comics',
    envKeys: ['COMIC_VINE_API_KEY'],
    requiresKey: true,
    documentation: 'https://comicvine.gamespot.com/api/documentation',
    test: async (apiKey) => {
      if (!apiKey) throw new Error('COMIC_VINE_API_KEY not configured');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://comicvine.gamespot.com/api/search/?api_key=${apiKey}&format=json&query=batman&resources=issue&limit=1`,
        {
          headers: {
            'User-Agent': 'TagnetIQ/1.0.0',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      return {
        httpStatus: response.status,
        dataReturned: !!(data.results && data.results.length > 0),
        sampleField: data.results?.[0]?.name || data.results?.[0]?.volume?.name || null,
        resultCount: data.number_of_total_results || null,
      };
    },
  },
];

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: test single source
  const singleSource = req.query.source as string | undefined;

  const datasourcesToTest = singleSource
    ? DATASOURCES.filter(d => d.name === singleSource)
    : DATASOURCES;

  if (singleSource && datasourcesToTest.length === 0) {
    return res.status(400).json({
      error: `Unknown source: ${singleSource}`,
      availableSources: DATASOURCES.map(d => d.name),
    });
  }

  console.log(`\n🔌 === DATASOURCE CONNECTION TEST ===`);
  console.log(`Testing ${datasourcesToTest.length} datasources...\n`);

  const results: DatasourceResult[] = [];

  for (const ds of datasourcesToTest) {
    const apiKey = getFirstAvailableKey(ds.envKeys);
    const startTime = Date.now();

    const result: DatasourceResult = {
      source: ds.name,
      displayName: ds.displayName,
      category: ds.category,
      hasApiKey: ds.envKeys.length === 0 ? true : !!apiKey, // Free APIs always "have" key
      keyLength: getKeyLength(ds.envKeys),
      requiresKey: ds.requiresKey,
      success: false,
      responseTime: 0,
      error: null,
      response: null,
      documentation: ds.documentation,
    };

    // Skip if key required but missing
    if (ds.requiresKey && !apiKey) {
      result.error = `API key not configured. Set ${ds.envKeys.join(' or ')} in environment.`;
      result.responseTime = 0;
      console.log(`  ⚠️  ${ds.displayName}: No API key`);
      results.push(result);
      continue;
    }

    try {
      const testResponse = await ds.test(apiKey);
      result.success = true;
      result.responseTime = Date.now() - startTime;
      result.response = testResponse;
      console.log(`  ✅ ${ds.displayName}: ${result.responseTime}ms`);
    } catch (error: any) {
      result.error = error instanceof Error ? error.message : String(error);
      result.responseTime = Date.now() - startTime;
      console.log(`  ❌ ${ds.displayName}: ${result.error}`);
    }

    results.push(result);
  }

  // ============================================
  // SUMMARY
  // ============================================
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success && r.hasApiKey);
  const notConfigured = results.filter(r => !r.hasApiKey && r.requiresKey);

  const summary = {
    totalDatasources: results.length,
    withApiKeys: results.filter(r => r.hasApiKey).length,
    successful: successful.length,
    failed: failed.length,
    notConfigured: notConfigured.length,
    averageResponseTime: successful.length > 0
      ? Math.round(successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length)
      : 0,
    overallStatus:
      successful.length >= results.length * 0.75 ? 'healthy' :
      successful.length >= results.length * 0.5 ? 'degraded' : 'critical',
  };

  console.log(`\n📊 Results: ${successful.length}/${results.length} successful`);
  console.log(`   Average response time: ${summary.averageResponseTime}ms`);
  console.log(`   Status: ${summary.overallStatus}\n`);

  return res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    summary,
    datasources: results,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    // Quick reference for missing keys
    missingKeys: notConfigured.map(r => ({
      source: r.source,
      displayName: r.displayName,
      requiredEnvVars: DATASOURCES.find(d => d.name === r.source)?.envKeys || [],
    })),
  });
}