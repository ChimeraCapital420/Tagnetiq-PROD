import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Import the compiled .js file, not the .ts source
    const { ProviderFactory } = await import('../src/lib/ai-providers/provider-factory.js');
    
    return res.status(200).json({
      status: 'ProviderFactory import successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      error: 'ProviderFactory import failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}