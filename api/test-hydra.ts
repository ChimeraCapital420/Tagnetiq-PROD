import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Test if we can import HydraEngine
    const { HydraEngine } = await import('../src/lib/hydra-engine');
    
    return res.status(200).json({
      status: 'HydraEngine import successful',
      timestamp: new Date().toISOString()
    });
  } catch (importError) {
    try {
      // Test alternative import path
      const { HydraEngine } = await import('../src/lib/hydra-engine.js');
      
      return res.status(200).json({
        status: 'HydraEngine import successful with .js',
        timestamp: new Date().toISOString()
      });
    } catch (jsImportError) {
      return res.status(500).json({
        error: 'Both import attempts failed',
        importError: importError.message,
        jsImportError: jsImportError.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}