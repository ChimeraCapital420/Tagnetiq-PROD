// FILE: api/health-check.ts
// HYDRA v6.3 - Comprehensive Health Check
// Tests AI providers AND market data APIs

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HydraEngine } from '../src/lib/hydra-engine.js';

export const config = {
  maxDuration: 45,
};

interface MarketAPIResult {
  name: string;
  status: 'ok' | 'error' | 'not_configured' | 'timeout';
  responseTime?: number;
  message?: string;
  sampleData?: any;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  console.log('\n🏥 === HYDRA HEALTH CHECK v6.3 ===\n');
  
  try {
    // ==========================================================================
    // PART 1: AI Provider Health Check (existing logic)
    // ==========================================================================
    const hydra = new HydraEngine();
    await hydra.initialize();
    
    const statuses = hydra.getProviderStatuses();
    const activeCount = statuses.filter(s => s.initialized).length;
    const totalCount = statuses.length;
    
    const testPrompt = 'Respond with JSON only: {"itemName": "Test Item", "estimatedValue": 10, "decision": "SELL", "valuation_factors": ["Test"], "summary_reasoning": "Test", "confidence": 0.9}';
    const aiTestResults = [];
    
    const providers = (hydra as any).providers || [];
    
    for (const provider of providers) {
      try {
        const start = Date.now();
        const result = await provider.analyze([], testPrompt);
        aiTestResults.push({
          provider: provider.getProvider().name,
          status: 'healthy',
          responseTime: Date.now() - start,
          confidence: result.confidence
        });
      } catch (error: any) {
        aiTestResults.push({
          provider: provider.getProvider().name,
          status: 'unhealthy',
          error: error.message,
          errorType: error.message.includes('401') ? 'auth' : 
                     error.message.includes('429') ? 'rate_limit' :
                     error.message.includes('404') ? 'not_found' :
                     error.message.includes('400') ? 'bad_request' : 'unknown'
        });
      }
    }
    
    const healthyAI = aiTestResults.filter(r => r.status === 'healthy').length;
    
    // ==========================================================================
    // PART 2: Market Data API Health Check (NEW)
    // ==========================================================================
    console.log('\n📊 Testing Market Data APIs...\n');
    
    const marketResults: MarketAPIResult[] = await Promise.all([
      testPokemonTCG(),
      testNumista(),
      testGoogleBooks(),
      testNHTSA(),
      testDiscogs(),
      testBrickset(),
      testEbay(),
      testRetailed(),
      testPSA(),
    ]);
    
    const healthyMarket = marketResults.filter(r => r.status === 'ok').length;
    const errorMarket = marketResults.filter(r => r.status === 'error' || r.status === 'timeout').length;
    
    // ==========================================================================
    // COMBINED STATUS
    // ==========================================================================
    const overallStatus = 
      healthyAI >= 3 && healthyMarket >= 4 ? 'healthy' :
      healthyAI >= 2 && healthyMarket >= 2 ? 'degraded' : 'critical';
    
    return res.status(200).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      
      // AI Provider Summary
      ai_providers: {
        total: totalCount,
        active: activeCount,
        healthy: healthyAI,
        consensus_capability: healthyAI >= 3 ? 'full' : healthyAI >= 2 ? 'limited' : 'none',
        results: aiTestResults,
      },
      
      // Market Data API Summary
      market_apis: {
        total: marketResults.length,
        healthy: healthyMarket,
        errors: errorMarket,
        not_configured: marketResults.filter(r => r.status === 'not_configured').length,
        results: marketResults,
      },
      
      // Environment Variables Check
      environment: {
        // AI Providers
        ai: {
          OPENAI: !!process.env.OPEN_AI_API_KEY || !!process.env.OPEN_AI_TOKEN || !!process.env.OPENAI_API_KEY,
          ANTHROPIC: !!process.env.ANTHROPIC_SECRET || !!process.env.ANTHROPIC_API_KEY,
          GOOGLE: !!process.env.GOOGLE_AI_TOKEN || !!process.env.GOOGLE_AI_API_KEY,
          MISTRAL: !!process.env.MISTRAL_API_KEY,
          GROQ: !!process.env.GROQ_API_KEY,
          DEEPSEEK: !!process.env.DEEPSEEK_TOKEN,
          XAI: !!process.env.XAI_SECRET || !!process.env.XAI_API_KEY,
          PERPLEXITY: !!process.env.PERPLEXITY_API_KEY,
        },
        // Market Data APIs
        market: {
          POKEMON_TCG: !!process.env.POKEMON_TCG_API_KEY,
          NUMISTA: !!process.env.NUMISTA_API_KEY,
          DISCOGS: !!process.env.DISCOGS_USER_TOKEN,
          BRICKSET: !!process.env.BRICKSET_API_KEY || !!process.env.BRICKSET_PASSWORD,
          EBAY: !!process.env.EBAY_APP_ID || !!process.env.EBAY_CLIENT_ID,
          PSA: !!process.env.PSA_API_KEY,
          RETAILED: !!process.env.RETAILED_API_KEY,
          COMIC_VINE: !!process.env.COMIC_VINE_API_KEY,
          GOOGLE_BOOKS: !!process.env.GOOGLE_BOOKS_API_KEY || !!process.env.GOOGLEBOT_API_KEY,
          NHTSA: true, // Free API, no key needed
        },
      },
      
      providers: statuses,
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// =============================================================================
// MARKET DATA API TESTS
// =============================================================================

async function testPokemonTCG(): Promise<MarketAPIResult> {
  const name = 'Pokemon TCG';
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  
  console.log(`  🔍 Testing ${name}...`);
  
  try {
    const start = Date.now();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (apiKey) headers['X-Api-Key'] = apiKey;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    // Test with simple query - no wildcards, no special chars
    const response = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=name:Pikachu&pageSize=1`,
      { headers, signal: controller.signal }
    );
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;
    
    if (!response.ok) {
      console.log(`    ❌ HTTP ${response.status}`);
      return { name, status: 'error', responseTime, message: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    console.log(`    ✅ ${responseTime}ms - Found ${data.totalCount || 0} cards`);
    return {
      name,
      status: 'ok',
      responseTime,
      message: `Found ${data.totalCount || 0} cards`,
      sampleData: data.data?.[0] ? { name: data.data[0].name, set: data.data[0].set?.name } : null,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`    ⏱️ Timeout`);
      return { name, status: 'timeout', message: 'Request timed out' };
    }
    console.log(`    ❌ ${error.message}`);
    return { name, status: 'error', message: error.message };
  }
}

async function testNumista(): Promise<MarketAPIResult> {
  const name = 'Numista';
  const apiKey = process.env.NUMISTA_API_KEY;
  
  console.log(`  🔍 Testing ${name}...`);
  
  if (!apiKey) {
    console.log(`    ⚠️ Not configured`);
    return { name, status: 'not_configured', message: 'NUMISTA_API_KEY not set' };
  }
  
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    const response = await fetch(
      `https://api.numista.com/api/v3/types?q=quarter&count=1&lang=en`,
      {
        headers: { 'Numista-API-Key': apiKey },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;
    
    if (!response.ok) {
      console.log(`    ❌ HTTP ${response.status}`);
      return { name, status: 'error', responseTime, message: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    console.log(`    ✅ ${responseTime}ms - Found ${data.count || 0} coins`);
    return {
      name,
      status: 'ok',
      responseTime,
      message: `Found ${data.count || 0} coins`,
      sampleData: data.coins?.[0] ? { title: data.coins[0].title, issuer: data.coins[0].issuer?.name } : null,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`    ⏱️ Timeout`);
      return { name, status: 'timeout', message: 'Request timed out' };
    }
    console.log(`    ❌ ${error.message}`);
    return { name, status: 'error', message: error.message };
  }
}

async function testGoogleBooks(): Promise<MarketAPIResult> {
  const name = 'Google Books';
  
  console.log(`  🔍 Testing ${name}...`);
  
  try {
    const start = Date.now();
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY || process.env.GOOGLEBOT_API_KEY;
    let url = `https://www.googleapis.com/books/v1/volumes?q=harry+potter&maxResults=1`;
    if (apiKey) url += `&key=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    const response = await fetch(url, { signal: controller.signal });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;
    
    if (!response.ok) {
      console.log(`    ❌ HTTP ${response.status}`);
      return { name, status: 'error', responseTime, message: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    console.log(`    ✅ ${responseTime}ms - Found ${data.totalItems || 0} books`);
    return {
      name,
      status: 'ok',
      responseTime,
      message: `Found ${data.totalItems || 0} books`,
      sampleData: data.items?.[0]?.volumeInfo ? { title: data.items[0].volumeInfo.title } : null,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`    ⏱️ Timeout`);
      return { name, status: 'timeout', message: 'Request timed out' };
    }
    console.log(`    ❌ ${error.message}`);
    return { name, status: 'error', message: error.message };
  }
}

async function testNHTSA(): Promise<MarketAPIResult> {
  const name = 'NHTSA (Free)';
  const testVIN = '1HGBH41JXMN109186';
  
  console.log(`  🔍 Testing ${name}...`);
  
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${testVIN}?format=json`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;
    
    if (!response.ok) {
      console.log(`    ❌ HTTP ${response.status}`);
      return { name, status: 'error', responseTime, message: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const make = data.Results?.find((r: any) => r.Variable === 'Make')?.Value;
    const model = data.Results?.find((r: any) => r.Variable === 'Model')?.Value;
    
    console.log(`    ✅ ${responseTime}ms - Decoded ${make} ${model}`);
    return {
      name,
      status: 'ok',
      responseTime,
      message: `Decoded: ${make} ${model}`,
      sampleData: { make, model },
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`    ⏱️ Timeout`);
      return { name, status: 'timeout', message: 'Request timed out' };
    }
    console.log(`    ❌ ${error.message}`);
    return { name, status: 'error', message: error.message };
  }
}

async function testDiscogs(): Promise<MarketAPIResult> {
  const name = 'Discogs';
  const token = process.env.DISCOGS_USER_TOKEN;
  
  console.log(`  🔍 Testing ${name}...`);
  
  if (!token) {
    console.log(`    ⚠️ Not configured`);
    return { name, status: 'not_configured', message: 'DISCOGS_USER_TOKEN not set' };
  }
  
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    const response = await fetch(
      `https://api.discogs.com/database/search?q=Beatles&type=release&per_page=1`,
      {
        headers: {
          'Authorization': `Discogs token=${token}`,
          'User-Agent': 'Tagnetiq-HYDRA/6.3',
        },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;
    
    if (!response.ok) {
      console.log(`    ❌ HTTP ${response.status}`);
      return { name, status: 'error', responseTime, message: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    console.log(`    ✅ ${responseTime}ms - Found ${data.pagination?.items || 0} releases`);
    return {
      name,
      status: 'ok',
      responseTime,
      message: `Found ${data.pagination?.items || 0} releases`,
      sampleData: data.results?.[0] ? { title: data.results[0].title } : null,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`    ⏱️ Timeout`);
      return { name, status: 'timeout', message: 'Request timed out' };
    }
    console.log(`    ❌ ${error.message}`);
    return { name, status: 'error', message: error.message };
  }
}

async function testBrickset(): Promise<MarketAPIResult> {
  const name = 'Brickset';
  const apiKey = process.env.BRICKSET_API_KEY;
  const username = process.env.BRICKSET_USERNAME;
  const password = process.env.BRICKSET_PASSWORD;
  
  console.log(`  🔍 Testing ${name}...`);
  
  if (!apiKey && !password) {
    console.log(`    ⚠️ Not configured`);
    return { name, status: 'not_configured', message: 'BRICKSET credentials not set' };
  }
  
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    // First, get a user hash if we have username/password
    let userHash = '';
    if (apiKey && username && password) {
      const loginResponse = await fetch(
        `https://brickset.com/api/v3.asmx/login?apiKey=${apiKey}&username=${username}&password=${password}`,
        { signal: controller.signal }
      );
      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        userHash = loginData.hash || '';
      }
    }
    
    // Test with a simple set lookup
    const response = await fetch(
      `https://brickset.com/api/v3.asmx/getSets?apiKey=${apiKey}&userHash=${userHash}&params={"setNumber":"75192"}`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;
    
    if (!response.ok) {
      console.log(`    ❌ HTTP ${response.status}`);
      return { name, status: 'error', responseTime, message: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    if (data.status === 'error') {
      console.log(`    ❌ ${data.message}`);
      return { name, status: 'error', responseTime, message: data.message };
    }
    
    console.log(`    ✅ ${responseTime}ms - Found ${data.matches || 0} sets`);
    return {
      name,
      status: 'ok',
      responseTime,
      message: `Found ${data.matches || 0} sets`,
      sampleData: data.sets?.[0] ? { name: data.sets[0].name, number: data.sets[0].number } : null,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`    ⏱️ Timeout`);
      return { name, status: 'timeout', message: 'Request timed out' };
    }
    console.log(`    ❌ ${error.message}`);
    return { name, status: 'error', message: error.message };
  }
}

async function testEbay(): Promise<MarketAPIResult> {
  const name = 'eBay';
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const appId = process.env.EBAY_APP_ID;
  const environment = process.env.EBAY_ENVIRONMENT || 'PRODUCTION';
  
  console.log(`  🔍 Testing ${name} (${environment})...`);
  
  if (!clientId && !appId) {
    console.log(`    ⚠️ Not configured`);
    return { name, status: 'not_configured', message: 'eBay credentials not set' };
  }
  
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    // Determine which API base to use
    const isProduction = environment === 'PRODUCTION';
    const tokenUrl = isProduction 
      ? 'https://api.ebay.com/identity/v1/oauth2/token'
      : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';
    
    if (clientId && clientSecret) {
      // Try OAuth2 token
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - start;
      
      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        console.log(`    ❌ OAuth HTTP ${tokenResponse.status}: ${errorBody.substring(0, 100)}`);
        return { 
          name, 
          status: 'error', 
          responseTime, 
          message: `OAuth failed: HTTP ${tokenResponse.status} - Check client credentials and environment (${environment})`,
        };
      }
      
      const tokenData = await tokenResponse.json();
      console.log(`    ✅ ${responseTime}ms - OAuth token obtained`);
      return {
        name,
        status: 'ok',
        responseTime,
        message: `OAuth token obtained (${environment})`,
        sampleData: { tokenType: tokenData.token_type, expiresIn: tokenData.expires_in },
      };
    }
    
    // Fallback to Finding API with App ID
    if (appId) {
      const findingUrl = isProduction
        ? `https://svcs.ebay.com/services/search/FindingService/v1`
        : `https://svcs.sandbox.ebay.com/services/search/FindingService/v1`;
      
      const response = await fetch(
        `${findingUrl}?OPERATION-NAME=findItemsByKeywords&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${appId}&RESPONSE-DATA-FORMAT=JSON&keywords=test&paginationInput.entriesPerPage=1`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - start;
      
      if (!response.ok) {
        console.log(`    ❌ HTTP ${response.status}`);
        return { name, status: 'error', responseTime, message: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      const ack = data.findItemsByKeywordsResponse?.[0]?.ack?.[0];
      
      if (ack === 'Success') {
        console.log(`    ✅ ${responseTime}ms - Finding API working`);
        return { name, status: 'ok', responseTime, message: 'Finding API working' };
      } else {
        const errorMsg = data.findItemsByKeywordsResponse?.[0]?.errorMessage?.[0]?.error?.[0]?.message?.[0] || 'Unknown error';
        console.log(`    ❌ ${errorMsg}`);
        return { name, status: 'error', responseTime, message: errorMsg };
      }
    }
    
    clearTimeout(timeoutId);
    return { name, status: 'error', message: 'No valid credentials' };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`    ⏱️ Timeout`);
      return { name, status: 'timeout', message: 'Request timed out' };
    }
    console.log(`    ❌ ${error.message}`);
    return { name, status: 'error', message: error.message };
  }
}

async function testRetailed(): Promise<MarketAPIResult> {
  const name = 'Retailed';
  const apiKey = process.env.RETAILED_API_KEY;
  
  console.log(`  🔍 Testing ${name}...`);
  
  if (!apiKey) {
    console.log(`    ⚠️ Not configured`);
    return { name, status: 'not_configured', message: 'RETAILED_API_KEY not set' };
  }
  
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(
      `https://api.retailed.io/v1/products/search?query=jordan`,
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;
    
    if (!response.ok) {
      console.log(`    ❌ HTTP ${response.status}`);
      return { name, status: 'error', responseTime, message: `HTTP ${response.status} - API may be offline` };
    }
    
    const data = await response.json();
    console.log(`    ✅ ${responseTime}ms`);
    return {
      name,
      status: 'ok',
      responseTime,
      message: 'API responded',
      sampleData: data.products?.[0] ? { name: data.products[0].name } : null,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`    ⏱️ Timeout (API may be slow/offline)`);
      return { name, status: 'timeout', message: 'Timeout - API may be offline' };
    }
    console.log(`    ❌ ${error.message}`);
    return { name, status: 'error', message: error.message };
  }
}

async function testPSA(): Promise<MarketAPIResult> {
  const name = 'PSA';
  const apiKey = process.env.PSA_API_KEY;
  
  console.log(`  🔍 Testing ${name}...`);
  
  if (!apiKey) {
    console.log(`    ⚠️ Not configured`);
    return { name, status: 'not_configured', message: 'PSA_API_KEY not set' };
  }
  
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    // PSA cert lookup requires a valid cert number
    // Using a known cert for testing
    const response = await fetch(
      `https://api.psacard.com/publicapi/cert/GetByCertNumber/10000001`,
      {
        headers: {
          'Authorization': `bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;
    
    // PSA returns 400 for invalid cert numbers, but that means the API is working
    if (response.status === 400) {
      console.log(`    ✅ ${responseTime}ms - API responding (cert not found is expected)`);
      return {
        name,
        status: 'ok',
        responseTime,
        message: 'API responding (test cert not found is expected)',
      };
    }
    
    if (!response.ok) {
      console.log(`    ❌ HTTP ${response.status}`);
      return { name, status: 'error', responseTime, message: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    console.log(`    ✅ ${responseTime}ms`);
    return {
      name,
      status: 'ok',
      responseTime,
      message: 'API responding',
      sampleData: data,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`    ⏱️ Timeout`);
      return { name, status: 'timeout', message: 'Request timed out' };
    }
    console.log(`    ❌ ${error.message}`);
    return { name, status: 'error', message: error.message };
  }
}


