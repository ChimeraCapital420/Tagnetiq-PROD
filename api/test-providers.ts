// FILE: api/test-providers.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Enable CORS for testing
const allowCors = (fn: Function) => async (req: VercelRequest, res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
  // Log the request for debugging
  console.log('Test providers endpoint called:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query
  });

  // Simple endpoint to test which AI providers are configured
  const providers = [
    { 
      name: 'OpenAI', 
      env: 'OPENAI_API_KEY', 
      altEnv: ['OPEN_AI_API_KEY', 'OPENAI_TOKEN', 'OPEN_AI_TOKEN'] 
    },
    { 
      name: 'Anthropic', 
      env: 'ANTHROPIC_API_KEY', 
      altEnv: ['ANTHROPIC_SECRET'] 
    },
    { 
      name: 'Google', 
      env: 'GOOGLE_API_KEY', 
      altEnv: ['GOOGLE_AI_TOKEN'] 
    },
    { 
      name: 'Mistral', 
      env: 'MISTRAL_API_KEY',
      altEnv: [] 
    },
    { 
      name: 'Groq', 
      env: 'GROQ_API_KEY',
      altEnv: [] 
    },
    { 
      name: 'DeepSeek', 
      env: 'DEEPSEEK_API_KEY',
      altEnv: ['DEEPSEEK_TOKEN'] 
    },
    { 
      name: 'xAI', 
      env: 'XAI_API_KEY',
      altEnv: ['XAI_SECRET', 'GROK_API_KEY'] 
    },
    { 
      name: 'Perplexity', 
      env: 'PERPLEXITY_API_KEY',
      altEnv: [] 
    }
  ];

  const results = providers.map(provider => {
    // Check primary env var
    let configured = !!process.env[provider.env];
    let keyName = provider.env;
    
    // Check alternative env vars if primary not found
    if (!configured && provider.altEnv && provider.altEnv.length > 0) {
      for (const altKey of provider.altEnv) {
        if (process.env[altKey]) {
          configured = true;
          keyName = altKey;
          break;
        }
      }
    }
    
    return {
      provider: provider.name,
      configured,
      keyName: configured ? keyName : null,
      checkedVars: [provider.env, ...(provider.altEnv || [])]
    };
  });

  const summary = {
    total: results.length,
    configured: results.filter(r => r.configured).length,
    missing: results.filter(r => !r.configured).length,
    missingProviders: results.filter(r => !r.configured).map(r => r.provider)
  };

  // Test if we're on production URL
  const isProduction = req.headers.host?.includes('tagnetiq-prod.com') || 
                      process.env.VERCEL_URL?.includes('tagnetiq-prod.com');

  return res.status(200).json({
    success: true,
    message: 'Provider configuration check',
    environment: {
      isProduction,
      host: req.headers.host,
      vercelUrl: process.env.VERCEL_URL,
      nodeEnv: process.env.NODE_ENV
    },
    summary,
    providers: results,
    timestamp: new Date().toISOString(),
    // Add debug info in development
    debug: process.env.NODE_ENV !== 'production' ? {
      totalEnvVars: Object.keys(process.env).length,
      aiRelatedVars: Object.keys(process.env).filter(key => 
        key.includes('AI') || 
        key.includes('ANTHROPIC') || 
        key.includes('OPENAI') ||
        key.includes('GOOGLE') ||
        key.includes('MISTRAL') ||
        key.includes('GROQ') ||
        key.includes('DEEPSEEK') ||
        key.includes('PERPLEXITY')
      ).map(key => key + '=' + (process.env[key] ? '[REDACTED]' : 'undefined'))
    } : undefined
  });
}

export default allowCors(handler);