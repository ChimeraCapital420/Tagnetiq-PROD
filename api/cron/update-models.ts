// FILE: api/cron/update-models.ts
// Weekly cron job — syncs ai_providers model strings to latest versions
//
// Vercel Cron Schedule: 0 9 * * 1  (every Monday at 9am UTC)
// Add to vercel.json:
//   "crons": [{ "path": "/api/cron/update-models", "schedule": "0 9 * * 1" }]
//
// Also callable manually: GET /api/cron/update-models
// Secured with CRON_SECRET env var

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HydraEngine } from '../../src/lib/hydra-engine.js';

export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security — require cron secret or Vercel cron header
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !hasValidSecret && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('🔄 === WEEKLY MODEL SYNC ===');

  try {
    const engine = new HydraEngine();
    const result = await engine.syncProviderModels();

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        updated: result.updated.length,
        current: result.current.length,
        errors: result.errors.length,
      },
      details: result,
    });
  } catch (error: any) {
    console.error('Model sync failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}