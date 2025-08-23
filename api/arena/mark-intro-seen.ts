// FILE: api/arena/mark-intro-seen.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security'; // CORRECTED: Use standard user verification

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req); // SECURITY: Verify user authentication

    const { error } = await supaAdmin
      .from('profiles')
      .update({ has_seen_arena_intro: true })
      .eq('id', user.id);

    if (error) throw error;

    return res.status(200).json({ success: true });

  } catch (error: any) {
    const message = error.message || 'An internal server error occurred.';
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    console.error('Error marking intro as seen:', message);
    return res.status(500).json({ error: message });
  }
}