import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Simple endpoint to test which AI providers are configured
  
  const providers = [
    { name: 'OpenAI', env: 'OPENAI_API_KEY', altEnv: 'OPENAI_TOKEN' },
    { name: 'Anthropic', env: 'ANTHROPIC_SECRET', altEnv: 'ANTHROPIC_API_KEY' },
    { name: 'Google', env: 'GOOGLE_AI_TOKEN', altEnv: 'GOOGLE_API_KEY' },
    { name: 'Mistral', env: 'MISTRAL_API_KEY' },
    { name: 'Groq', env: 'GROQ_API_KEY' },
    { name: 'DeepSeek', env: 'DEEPSEEK_API_KEY' },
    { name: 'xAI', env: 'XAI_API_KEY' },
    { name: 'Perplexity', env: 'PERPLEXITY_API_KEY' }
  ];

  const results = providers.map(provider => ({
    provider: provider.name,
    configured: !!(process.env[provider.env] || (provider.altEnv && process.env[provider.altEnv])),
    keyName: process.env[provider.env] ? provider.env : provider.altEnv
  }));

  const summary = {
    total: results.length,
    configured: results.filter(r => r.configured).length,
    missing: results.filter(r => !r.configured).length
  };

  return res.status(200).json({
    success: true,
    message: 'Provider configuration check',
    summary,
    providers: results,
    timestamp: new Date().toISOString()
  });
}