import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return res.status(200).json({
      status: 'Basic API working',
      message: 'No imports, just testing basic functionality',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Basic test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}