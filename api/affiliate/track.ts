// FILE: api/affiliate/track.ts
// RH-011 — Affiliate Click Tracking
// Lightweight endpoint — logs affiliate clicks for revenue analytics
// Fire-and-forget from client, never blocks user navigation

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { partner, itemName, scanId, userId, timestamp } = req.body;

    // Insert click record — non-blocking
    await supabase.from('affiliate_clicks').insert({
      partner,
      item_name:  itemName,
      scan_id:    scanId   || null,
      user_id:    userId   || null,
      clicked_at: timestamp || new Date().toISOString(),
    }).then(() => {}).catch(() => {}); // silent fail

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(200).json({ ok: true }); // always 200 — never fail user flow
  }
}