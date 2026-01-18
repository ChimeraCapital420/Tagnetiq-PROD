import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readdir } from 'fs/promises';
import { join } from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Try to list what's actually in the ai-providers directory
    const aiProvidersPath = join(process.cwd(), 'src', 'lib', 'ai-providers');
    const files = await readdir(aiProvidersPath);
    
    return res.status(200).json({
      status: 'Directory found',
      path: aiProvidersPath,
      files: files,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Directory check failed',
      message: error.message,
      cwd: process.cwd(),
      timestamp: new Date().toISOString()
    });
  }
}