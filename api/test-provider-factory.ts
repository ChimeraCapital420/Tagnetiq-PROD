import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Test importing ProviderFactory step by step
    const { ProviderFactory } = await import('../src/lib/ai-providers/provider-factory');
    
    return res.status(200).json({
      status: 'ProviderFactory import successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      error: 'ProviderFactory import failed',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}