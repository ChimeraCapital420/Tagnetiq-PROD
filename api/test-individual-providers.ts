import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ProviderFactory } from '../src/lib/ai-providers/provider-factory.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const providers = [
    { name: 'OpenAI', key: process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY },
    { name: 'Anthropic', key: process.env.ANTHROPIC_SECRET || process.env.ANTHROPIC_API_KEY },
    { name: 'Google', key: process.env.GOOGLE_AI_TOKEN || process.env.GOOGLE_API_KEY },
    { name: 'Mistral', key: process.env.MISTRAL_API_KEY },
    { name: 'Groq', key: process.env.GROQ_API_KEY },
    { name: 'DeepSeek', key: process.env.DEEPSEEK_TOKEN || process.env.DEEPSEEK_API_KEY },
    { name: 'xAI', key: process.env.XAI_SECRET || process.env.XAI_API_KEY },
    { name: 'Perplexity', key: process.env.PERPLEXITY_API_KEY }
  ];

  const testPrompt = 'Test prompt: What is 2+2? Reply with just the number.';
  const results = [];

  for (const provider of providers) {
    const startTime = Date.now();
    let result = {
      provider: provider.name,
      hasApiKey: !!provider.key,
      keyLength: provider.key ? provider.key.length : 0,
      success: false,
      responseTime: 0,
      error: null as string | null,
      response: null as any
    };

    if (!provider.key) {
      result.error = 'No API key found';
      results.push(result);
      continue;
    }

    try {
      // Create provider instance
      const providerInstance = ProviderFactory.create({
        id: `test-${provider.name}`,
        name: provider.name,
        apiKey: provider.key,
        baseWeight: 1,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Test with simple text prompt (no images)
      const response = await providerInstance.analyze([], testPrompt);
      
      result.success = true;
      result.responseTime = Date.now() - startTime;
      result.response = {
        confidence: response.confidence,
        responseType: typeof response.response,
        hasResponse: !!response.response
      };

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.responseTime = Date.now() - startTime;
      
      // Log detailed error for debugging
      console.error(`${provider.name} test failed:`, error);
    }

    results.push(result);
  }

  const summary = {
    totalProviders: results.length,
    withApiKeys: results.filter(r => r.hasApiKey).length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    averageResponseTime: results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.responseTime, 0) / results.filter(r => r.success).length || 0
  };

  return res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    summary,
    providers: results,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  });
}