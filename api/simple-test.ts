import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Test basic environment variables
    const envCheck = {
      supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      openai: !!process.env.OPEN_AI_API_KEY || !!process.env.OPEN_AI_TOKEN,
      anthropic: !!process.env.ANTHROPIC_SECRET,
      google: !!process.env.GOOGLE_AI_TOKEN,
      node_env: process.env.NODE_ENV
    };

    return res.status(200).json({
      status: 'working',
      environment: envCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}