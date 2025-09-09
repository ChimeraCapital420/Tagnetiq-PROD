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

  const providerName = req.query.provider as string || 'OpenAI';
  
  const providers: Record<string, any> = {
    OpenAI: {
      apiKey: process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY,
      endpoint: 'https://api.openai.com/v1/chat/completions',
      headers: (key: string) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }),
      body: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 50
      }
    },
    Anthropic: {
      apiKey: process.env.ANTHROPIC_SECRET || process.env.ANTHROPIC_API_KEY,
      endpoint: 'https://api.anthropic.com/v1/messages',
      headers: (key: string) => ({
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }),
      body: {
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 50
      }
    },
    Google: {
      apiKey: process.env.GOOGLE_AI_TOKEN || process.env.GOOGLE_API_KEY,
      endpoint: (key: string) => `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`,
      headers: () => ({
        'Content-Type': 'application/json'
      }),
      body: {
        contents: [{
          parts: [{ text: 'Say hello' }]
        }]
      }
    },
    Mistral: {
      apiKey: process.env.MISTRAL_API_KEY,
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      headers: (key: string) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }),
      body: {
        model: 'mistral-tiny',
        messages: [{ role: 'user', content: 'Say hello' }]
      }
    },
    Groq: {
      apiKey: process.env.GROQ_API_KEY,
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      headers: (key: string) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }),
      body: {
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: 'Say hello' }]
      }
    },
    DeepSeek: {
      apiKey: process.env.DEEPSEEK_TOKEN || process.env.DEEPSEEK_API_KEY,
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      headers: (key: string) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }),
      body: {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Say hello' }]
      }
    },
    xAI: {
      apiKey: process.env.XAI_SECRET || process.env.XAI_API_KEY,
      endpoint: 'https://api.x.ai/v1/chat/completions',
      headers: (key: string) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }),
      body: {
        model: 'grok-beta',
        messages: [{ role: 'user', content: 'Say hello' }]
      }
    },
    Perplexity: {
      apiKey: process.env.PERPLEXITY_API_KEY,
      endpoint: 'https://api.perplexity.ai/chat/completions',
      headers: (key: string) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }),
      body: {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: 'Say hello' }]
      }
    }
  };

  const provider = providers[providerName];
  if (!provider) {
    return res.status(400).json({ error: `Unknown provider: ${providerName}` });
  }

  if (!provider.apiKey) {
    return res.status(400).json({ 
      error: `No API key found for ${providerName}`,
      checkedVars: providerName === 'OpenAI' ? ['OPEN_AI_API_KEY', 'OPENAI_API_KEY'] : 
                   providerName === 'Anthropic' ? ['ANTHROPIC_SECRET', 'ANTHROPIC_API_KEY'] :
                   providerName === 'Google' ? ['GOOGLE_AI_TOKEN', 'GOOGLE_API_KEY'] :
                   providerName === 'DeepSeek' ? ['DEEPSEEK_TOKEN', 'DEEPSEEK_API_KEY'] :
                   providerName === 'xAI' ? ['XAI_SECRET', 'XAI_API_KEY'] :
                   [`${providerName.toUpperCase()}_API_KEY`]
    });
  }

  try {
    const endpoint = typeof provider.endpoint === 'function' 
      ? provider.endpoint(provider.apiKey) 
      : provider.endpoint;
      
    const headers = typeof provider.headers === 'function'
      ? provider.headers(provider.apiKey)
      : provider.headers;

    console.log(`Testing ${providerName} with endpoint:`, endpoint);
    console.log('Headers:', Object.keys(headers));
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(provider.body)
    });

    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    return res.status(200).json({
      provider: providerName,
      status: response.status,
      statusText: response.statusText,
      success: response.ok,
      endpoint,
      requestBody: provider.body,
      response: responseData,
      headers: response.headers.raw ? response.headers.raw() : Object.fromEntries(response.headers.entries())
    });

  } catch (error) {
    return res.status(500).json({
      provider: providerName,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}