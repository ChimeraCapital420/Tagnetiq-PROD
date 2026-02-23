import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Test environment variables directly
    const envCheck = {
      openai: !!process.env.OPEN_AI_API_KEY || !!process.env.OPEN_AI_TOKEN,
      anthropic: !!process.env.ANTHROPIC_SECRET,
      google: !!process.env.GOOGLE_AI_TOKEN,
      groq: !!process.env.GROQ_API_KEY,
      mistral: !!process.env.MISTRAL_API_KEY,
      deepseek: !!process.env.DEEPSEEK_TOKEN,
      xai: !!process.env.XAI_SECRET,
      perplexity: !!process.env.PERPLEXITY_API_KEY
    };

    const availableProviders = Object.entries(envCheck)
      .filter(([_, hasKey]) => hasKey)
      .map(([name, _]) => name);

    return res.status(200).json({
      status: 'Environment check complete',
      available_providers: availableProviders,
      total_available: availableProviders.length,
      message: availableProviders.length >= 3 ? 'Sufficient providers for consensus' : 'Need more providers',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}