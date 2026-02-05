// ============================================
// FILE: api/test-individual-datasources.ts
// HYDRA v6.3.1 - Market Data API Connection Tester
// 
// Mirrors /api/test-individual-providers for AI providers
// Tests all external datasource API connections
//
// FIXES v6.3.1 (2026-02-05):
//   - Pokemon TCG: timeout 15s → 30s (slow API + cold start)
//   - eBay: Migrated from dead Finding API to Browse API + OAuth
//   - Retailed: Fixed domain api.retailed.io → app.retailed.io
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
// HELPERS
// ============================================

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
// EBAY OAUTH TOKEN HELPER
// Uses client_credentials grant flow
// Token is valid for 2 hours
// ============================================

async function getEbayOAuthToken(): Promise<string> {
  const clientId = process.env.EBAY_CLIENT_ID || process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('EBAY_CLIENT_ID and EBAY_CLIENT_SECRET required for Browse API');
  }

  // Base64 encode client_id:client_secret
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const isProduction =
    (process.env.EBAY_ENVIRONMENT || 'production').toLowerCase() === 'production';
  const tokenUrl = isProduction
    ? 'https://api.ebay.com/identity/v1/oauth2/token'
    : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay OAuth failed: HTTP ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('eBay OAuth response missing access_token');
  }

  return data.access_token;
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

const DATASOURCES: DatasourceConfig[] = [
  // ------------------------------------------
  // 1. Pokemon TCG API
  // FIXED: timeout 15s → 30s for slow API + cold starts
  // ------------------------------------------
  {
    name: 'pokemon_tcg',
    displayName: 'Pokemon TCG',
    category: 'Trading Cards',
    envKeys: ['POKEMON_TCG_API_KEY'],
    requiresKey: false,
    documentation: 'https://docs.pokemontcg.io/',
    test: async (apiKey) => {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (apiKey) headers['X-Api-Key'] = apiKey;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(
        'https://api.pokemontcg.io/v2/cards?pageSize=1',
        { headers, signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

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
            Accept: 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      return {
        httpStatus: response.status,
        dataReturned: !!(data.coins && data.coins.length > 0),
        sampleField:
          data.coins?.[0]?.title || data.coins?.[0]?.issuer?.name || null,
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
    requiresKey: false,
    documentation: 'https://developers.google.com/books/docs/v1/using',
    test: async (apiKey) => {
      let url =
        'https://www.googleapis.com/books/v1/volumes?q=isbn:9780134685991&maxResults=1';
      if (apiKey) url += `&key=${apiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

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
      const TEST_VIN = '1FA6P8TD5M5100001';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${TEST_VIN}?format=json`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'TagnetIQ/1.0.0',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      const result = data.Results?.[0];
      return {
        httpStatus: response.status,
        dataReturned: !!(result && result.Make),
        sampleField: result
          ? `${result.ModelYear} ${result.Make} ${result.Model}`
          : null,
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
            Authorization: `Discogs token=${apiKey}`,
            'User-Agent': 'TagnetIQ/1.0.0',
            Accept: 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

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
    documentation:
      'https://brickset.com/article/52664/api-version-3-documentation',
    test: async (apiKey) => {
      if (!apiKey) throw new Error('BRICKSET_API_KEY not configured');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://brickset.com/api/v3.asmx/checkKey?apiKey=${apiKey}`,
        {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

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
  // 7. eBay (Browse API + OAuth)
  // FIXED: Migrated from decommissioned Finding API
  // to Browse API with client_credentials OAuth flow
  // Finding API was decommissioned 2025-02-05
  // ------------------------------------------
  {
    name: 'ebay',
    displayName: 'eBay Browse API',
    category: 'General Marketplace',
    envKeys: ['EBAY_CLIENT_ID', 'EBAY_APP_ID', 'EBAY_CLIENT_SECRET'],
    requiresKey: true,
    documentation: 'https://developer.ebay.com/api-docs/buy/browse/overview.html',
    test: async () => {
      const clientId = process.env.EBAY_CLIENT_ID || process.env.EBAY_APP_ID;
      const clientSecret = process.env.EBAY_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error(
          'EBAY_CLIENT_ID + EBAY_CLIENT_SECRET required for Browse API OAuth'
        );
      }

      // Step 1: Get OAuth token via client_credentials grant
      const token = await getEbayOAuthToken();

      // Step 2: Test Browse API search
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const isProduction =
        (process.env.EBAY_ENVIRONMENT || 'production').toLowerCase() ===
        'production';
      const browseUrl = isProduction
        ? 'https://api.ebay.com/buy/browse/v1/item_summary/search'
        : 'https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search';

      const response = await fetch(
        `${browseUrl}?q=vintage+coin&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      const items = data.itemSummaries || [];
      return {
        httpStatus: response.status,
        dataReturned: items.length > 0,
        sampleField: items[0]?.title || null,
        resultCount: data.total || items.length,
      };
    },
  },

  // ------------------------------------------
  // 8. Retailed (Sneakers)
  // FIXED: Domain was api.retailed.io, correct is app.retailed.io
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

      // FIXED: correct domain is app.retailed.io, not api.retailed.io
      // Using the db/products endpoint which is their primary search
      const response = await fetch(
        'https://app.retailed.io/api/v1/db/products?limit=1',
        {
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      // Retailed returns { docs: [...], totalDocs: N, ... }
      const docs = data.docs || data.products || (Array.isArray(data) ? data : []);
      return {
        httpStatus: response.status,
        dataReturned: docs.length > 0,
        sampleField: docs[0]?.name || docs[0]?.title || docs[0]?.productId || null,
        resultCount: data.totalDocs || docs.length,
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
    requiresKey: false,
    documentation: 'https://www.psacard.com/services/psaverify',
    test: async (apiKey) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const testCertNumber = '10000001';
      const url = apiKey
        ? `https://api.psacard.com/publicapi/cert/GetByCertNumber/${testCertNumber}`
        : `https://www.psacard.com/cert/${testCertNumber}`;

      const headers: Record<string, string> = {
        Accept: apiKey ? 'application/json' : 'text/html',
        'User-Agent': 'TagnetIQ/1.0.0',
      };
      if (apiKey) headers['Authorization'] = `bearer ${apiKey}`;

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const isReachable =
        response.ok || response.status === 301 || response.status === 302;
      if (!isReachable)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      if (
        apiKey &&
        response.headers.get('content-type')?.includes('json')
      ) {
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
    documentation:
      'https://www.upcitemdb.com/wp/docs/main/development/api/',
    test: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        'https://api.upcitemdb.com/prod/trial/lookup?upc=049000006346',
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'TagnetIQ/1.0.0',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

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
      if (!appId || !appSecret)
        throw new Error(
          'COLNECT_API_KEY / COLNECT_API_SECRET not configured'
        );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const urlPath = `/en/api/${appId}/categories`;
      const timestamp = Math.floor(Date.now() / 1000);
      const hashInput = `${urlPath}>|<${timestamp}`;
      const hash = createHmac('sha256', appSecret)
        .update(hashInput)
        .digest('hex');

      const response = await fetch(`https://api.colnect.net${urlPath}`, {
        headers: {
          'Capi-Timestamp': String(timestamp),
          'Capi-Hash': hash,
          'User-Agent': 'TagnetIQ-HYDRA/1.0.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

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

      const baseUrl =
        process.env.ENTRUPY_API_BASE || 'https://api.entrupy.com';
      const response = await fetch(`${baseUrl}/v2/config`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

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
            Accept: 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      return {
        httpStatus: response.status,
        dataReturned: !!(data.results && data.results.length > 0),
        sampleField:
          data.results?.[0]?.name || data.results?.[0]?.volume?.name || null,
        resultCount: data.number_of_total_results || null,
      };
    },
  },
];

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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
    ? DATASOURCES.filter((d) => d.name === singleSource)
    : DATASOURCES;

  if (singleSource && datasourcesToTest.length === 0) {
    return res.status(400).json({
      error: `Unknown source: ${singleSource}`,
      availableSources: DATASOURCES.map((d) => d.name),
    });
  }

  console.log(`\n🔌 === DATASOURCE CONNECTION TEST v6.3.1 ===`);
  console.log(`Testing ${datasourcesToTest.length} datasources...\n`);

  const results: DatasourceResult[] = [];

  for (const ds of datasourcesToTest) {
    const apiKey = getFirstAvailableKey(ds.envKeys);
    const startTime = Date.now();

    const result: DatasourceResult = {
      source: ds.name,
      displayName: ds.displayName,
      category: ds.category,
      hasApiKey: ds.envKeys.length === 0 ? true : !!apiKey,
      keyLength: getKeyLength(ds.envKeys),
      requiresKey: ds.requiresKey,
      success: false,
      responseTime: 0,
      error: null,
      response: null,
      documentation: ds.documentation,
    };

    // Skip if key required but missing
    if (ds.requiresKey && !apiKey && ds.name !== 'ebay') {
      // eBay handles its own key check internally (needs both CLIENT_ID + SECRET)
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
      result.error =
        error instanceof Error ? error.message : String(error);
      result.responseTime = Date.now() - startTime;

      // Provide helpful context for common errors
      if (result.error.includes('aborted')) {
        result.error = `Timeout (API did not respond within time limit)`;
      }

      console.log(`  ❌ ${ds.displayName}: ${result.error}`);
    }

    results.push(result);
  }

  // ============================================
  // SUMMARY
  // ============================================
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success && r.hasApiKey);
  const notConfigured = results.filter(
    (r) => !r.hasApiKey && r.requiresKey
  );

  const summary = {
    totalDatasources: results.length,
    withApiKeys: results.filter((r) => r.hasApiKey).length,
    successful: successful.length,
    failed: failed.length,
    notConfigured: notConfigured.length,
    averageResponseTime:
      successful.length > 0
        ? Math.round(
            successful.reduce((sum, r) => sum + r.responseTime, 0) /
              successful.length
          )
        : 0,
    overallStatus:
      successful.length >= results.length * 0.75
        ? 'healthy'
        : successful.length >= results.length * 0.5
        ? 'degraded'
        : 'critical',
  };

  console.log(
    `\n📊 Results: ${successful.length}/${results.length} successful`
  );
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
    missingKeys: notConfigured.map((r) => ({
      source: r.source,
      displayName: r.displayName,
      requiredEnvVars:
        DATASOURCES.find((d) => d.name === r.source)?.envKeys || [],
    })),
  });
}