import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    pong: true, 
    time: Date.now(),
    message: 'Tagnetiq API is alive',
    version: '1.0.0'
  });
}