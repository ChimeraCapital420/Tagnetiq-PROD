// FILE: api/oracle/dismiss-greeting.ts
// Persists "don't show again" for the Oracle greeting banner.
// Called when user checks the checkbox and dismisses.
// Writes has_seen_oracle_greeting = true to profiles table.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';
import { supaAdmin } from '../_lib/supaAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const user = await verifyUser(req);

    const { error } = await supaAdmin
      .from('profiles')
      .update({ has_seen_oracle_greeting: true })
      .eq('id', user.id);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err: any) {
    const msg = err.message || 'Internal server error';
    if (msg.includes('Authentication')) return res.status(401).json({ error: msg });
    console.error('[dismiss-greeting] Error:', msg);
    return res.status(500).json({ error: msg });
  }
}