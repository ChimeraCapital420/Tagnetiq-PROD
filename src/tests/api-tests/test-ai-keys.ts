// FILE: api/test-ai-keys.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const providers = [
    { name: 'OpenAI', key: 'OPENAI_API_KEY', altKey: 'OPENAI_TOKEN' },
    { name: 'Anthropic', key: 'ANTHROPIC_SECRET', altKey: 'ANTHROPIC_API_KEY' },
    { name: 'Google', key: 'GOOGLE_AI_TOKEN', altKey: 'GOOGLE_API_KEY' },
    { name: 'Mistral', key: 'MISTRAL_API_KEY' },
    { name: 'Groq', key: 'GROQ_API_KEY' },
    { name: 'DeepSeek', key: 'DEEPSEEK_API_KEY' },
    { name: 'xAI', key: 'XAI_API_KEY' },
    { name: 'Perplexity', key: 'PERPLEXITY_API_KEY' }
  ];
  
  const results = providers.map(p => ({
    provider: p.name,
    hasKey: !!process.env[p.key],
    hasAltKey: p.altKey ? !!process.env[p.altKey] : false,
    configured: !!process.env[p.key] || (p.altKey ? !!process.env[p.altKey] : false)
  }));
  
  return res.status(200).json({
    summary: {
      total: results.length,
      configured: results.filter(r => r.configured).length,
      missing: results.filter(r => !r.configured).map(r => r.provider)
    },
    providers: results
  });
}