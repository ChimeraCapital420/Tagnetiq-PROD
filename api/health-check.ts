// api/health-check.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HydraEngine } from '../src/lib/hydra-engine.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  try {
    const hydra = new HydraEngine();
    await hydra.initialize();
    
    const statuses = hydra.getProviderStatuses();
    const activeCount = statuses.filter(s => s.initialized).length;
    const totalCount = statuses.length;
    
    // Test each provider with a simple prompt
    const testPrompt = 'Respond with JSON only: {"itemName": "Test Item", "estimatedValue": 10, "decision": "SELL", "valuation_factors": ["Test 1", "Test 2", "Test 3", "Test 4", "Test 5"], "summary_reasoning": "This is a test response", "confidence": 0.9}';
    const testResults = [];
    
    // Access providers through a getter or make them public for testing
    const providers = (hydra as any).providers || [];
    
    for (const provider of providers) {
      try {
        const start = Date.now();
        const result = await provider.analyze([], testPrompt);
        testResults.push({
          provider: provider.getProvider().name,
          status: 'healthy',
          responseTime: Date.now() - start,
          confidence: result.confidence
        });
      } catch (error: any) {
        testResults.push({
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
    
    const healthy = testResults.filter(r => r.status === 'healthy').length;
    
    return res.status(200).json({
      status: healthy >= 3 ? 'healthy' : healthy > 0 ? 'degraded' : 'critical',
      summary: {
        total_providers: totalCount,
        active_providers: activeCount,
        healthy_providers: healthy,
        consensus_capability: healthy >= 3 ? 'full' : healthy >= 2 ? 'limited' : 'none'
      },
      providers: statuses,
      test_results: testResults,
      environment: {
        has_openai: !!process.env.OPEN_AI_API_KEY || !!process.env.OPEN_AI_TOKEN,
        has_anthropic: !!process.env.ANTHROPIC_SECRET,
        has_google: !!process.env.GOOGLE_AI_TOKEN,
        has_mistral: !!process.env.MISTRAL_API_KEY,
        has_groq: !!process.env.GROQ_API_KEY,
        has_deepseek: !!process.env.DEEPSEEK_TOKEN,
        has_xai: !!process.env.XAI_SECRET,
        has_perplexity: !!process.env.PERPLEXITY_API_KEY
      },
      timestamp: new Date().toISOString()
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