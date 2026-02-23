// api/test-provider-keys.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const tests = [];

  // Test Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
      });
      tests.push({
        provider: 'Groq',
        status: groqResponse.status,
        statusText: groqResponse.statusText,
        keyPrefix: process.env.GROQ_API_KEY.substring(0, 10) + '...'
      });
    } catch (error: any) {
      tests.push({ provider: 'Groq', error: error.message });
    }
  }

  // Test Mistral
  if (process.env.MISTRAL_API_KEY) {
    try {
      const mistralResponse = await fetch('https://api.mistral.ai/v1/models', {
        headers: { 'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}` }
      });
      tests.push({
        provider: 'Mistral',
        status: mistralResponse.status,
        statusText: mistralResponse.statusText,
        keyPrefix: process.env.MISTRAL_API_KEY.substring(0, 10) + '...'
      });
    } catch (error: any) {
      tests.push({ provider: 'Mistral', error: error.message });
    }
  }

  // Test DeepSeek
  if (process.env.DEEPSEEK_TOKEN) {
    try {
      const deepseekResponse = await fetch('https://api.deepseek.com/v1/models', {
        headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_TOKEN}` }
      });
      tests.push({
        provider: 'DeepSeek',
        status: deepseekResponse.status,
        statusText: deepseekResponse.statusText,
        keyPrefix: process.env.DEEPSEEK_TOKEN.substring(0, 10) + '...'
      });
    } catch (error: any) {
      tests.push({ provider: 'DeepSeek', error: error.message });
    }
  }

  // Test xAI
  if (process.env.XAI_SECRET) {
    try {
      const xaiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${process.env.XAI_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      });
      tests.push({
        provider: 'xAI',
        status: xaiResponse.status,
        statusText: xaiResponse.statusText,
        keyPrefix: process.env.XAI_SECRET.substring(0, 10) + '...'
      });
    } catch (error: any) {
      tests.push({ provider: 'xAI', error: error.message });
    }
  }

  // Test Perplexity
  if (process.env.PERPLEXITY_API_KEY) {
    try {
      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      });
      tests.push({
        provider: 'Perplexity',
        status: perplexityResponse.status,
        statusText: perplexityResponse.statusText,
        keyPrefix: process.env.PERPLEXITY_API_KEY.substring(0, 10) + '...'
      });
    } catch (error: any) {
      tests.push({ provider: 'Perplexity', error: error.message });
    }
  }

  return res.status(200).json({
    tests,
    summary: {
      total: tests.length,
      successful: tests.filter(t => t.status === 200 || t.status === 404).length,
      failed: tests.filter(t => t.status && t.status !== 200 && t.status !== 404).length,
      errors: tests.filter(t => t.error).length
    },
    timestamp: new Date().toISOString()
  });
}