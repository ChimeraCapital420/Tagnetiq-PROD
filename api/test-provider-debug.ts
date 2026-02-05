// FILE: api/test-provider-debug.ts
// Raw HTTP debug tester - bypasses ProviderFactory entirely
// Tests each AI provider with direct fetch to their API
//
// Usage: GET /api/test-provider-debug?provider=OpenAI
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

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

  const providerName = (req.query.provider as string) || 'OpenAI';

  // ============================================
  // PROVIDER CONFIGURATIONS
  // Models last updated: 2026-02-05
  // ============================================
  const providers: Record<string, any> = {
    OpenAI: {
      apiKey: process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY,
      endpoint: 'https://api.openai.com/v1/chat/completions',
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      }),
      body: {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 50,
      },
    },
    Anthropic: {
      apiKey: process.env.ANTHROPIC_SECRET || process.env.ANTHROPIC_API_KEY,
      endpoint: 'https://api.anthropic.com/v1/messages',
      headers: (key: string) => ({
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      }),
      body: {
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 50,
      },
    },
    Google: {
      apiKey: process.env.GOOGLE_AI_TOKEN || process.env.GOOGLE_API_KEY,
      // FIXED: Use v1beta endpoint with gemini-2.0-flash (matching production google-provider.ts)
      endpoint: (key: string) =>
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      headers: () => ({
        'Content-Type': 'application/json',
      }),
      body: {
        contents: [
          {
            parts: [{ text: 'Say hello' }],
          },
        ],
      },
    },
    Mistral: {
      apiKey: process.env.MISTRAL_API_KEY,
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      }),
      body: {
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: 'Say hello' }],
      },
    },
    Groq: {
      apiKey: process.env.GROQ_API_KEY,
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      }),
      body: {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Say hello' }],
      },
    },
    DeepSeek: {
      apiKey: process.env.DEEPSEEK_TOKEN || process.env.DEEPSEEK_API_KEY,
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      }),
      body: {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Say hello' }],
      },
    },
    xAI: {
      apiKey: process.env.XAI_SECRET || process.env.XAI_API_KEY,
      endpoint: 'https://api.x.ai/v1/chat/completions',
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      }),
      body: {
        model: 'grok-2-vision-1212',
        messages: [{ role: 'user', content: 'Say hello' }],
      },
    },
    Perplexity: {
      apiKey: process.env.PERPLEXITY_API_KEY,
      endpoint: 'https://api.perplexity.ai/chat/completions',
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      }),
      body: {
        model: 'sonar-pro',
        messages: [{ role: 'user', content: 'Say hello' }],
      },
    },
  };

  const provider = providers[providerName];
  if (!provider) {
    return res.status(400).json({
      error: `Unknown provider: ${providerName}`,
      availableProviders: Object.keys(providers),
    });
  }

  if (!provider.apiKey) {
    return res.status(400).json({
      error: `No API key found for ${providerName}`,
      checkedVars:
        providerName === 'OpenAI'
          ? ['OPEN_AI_API_KEY', 'OPENAI_API_KEY']
          : providerName === 'Anthropic'
          ? ['ANTHROPIC_SECRET', 'ANTHROPIC_API_KEY']
          : providerName === 'Google'
          ? ['GOOGLE_AI_TOKEN', 'GOOGLE_API_KEY']
          : providerName === 'DeepSeek'
          ? ['DEEPSEEK_TOKEN', 'DEEPSEEK_API_KEY']
          : providerName === 'xAI'
          ? ['XAI_SECRET', 'XAI_API_KEY']
          : [`${providerName.toUpperCase()}_API_KEY`],
    });
  }

  try {
    const startTime = Date.now();

    const endpoint =
      typeof provider.endpoint === 'function'
        ? provider.endpoint(provider.apiKey)
        : provider.endpoint;

    const headers =
      typeof provider.headers === 'function'
        ? provider.headers(provider.apiKey)
        : provider.headers;

    console.log(`Testing ${providerName} with endpoint:`, endpoint);
    console.log('Headers:', Object.keys(headers));
    console.log('Model:', provider.body.model || provider.body.contents ? 'Gemini (in body)' : 'unknown');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(provider.body),
    });

    const responseTime = Date.now() - startTime;
    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    return res.status(200).json({
      provider: providerName,
      model: provider.body.model || 'gemini-2.0-flash',
      status: response.status,
      statusText: response.statusText,
      success: response.ok,
      responseTime,
      endpoint,
      requestBody: provider.body,
      response: responseData,
      headers: Object.fromEntries(response.headers.entries()),
    });
  } catch (error) {
    return res.status(500).json({
      provider: providerName,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}