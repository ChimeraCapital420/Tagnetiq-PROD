// FILE: api/flags.ts (REVISED FOR SECURITY)

import { supaAdmin } from './_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from './_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // SECURITY: Verify the user is an admin before proceeding
    await verifyUserIsAdmin(req);

    if (req.method === 'GET') {
      const { data, error } = await supaAdmin.from('feature_flags').select('*');
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { key, enabled } = req.body;
      if (typeof key !== 'string' || typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Invalid payload. "key" (string) and "enabled" (boolean) are required.' });
      }
      
      const { data, error } = await supaAdmin
        .from('feature_flags')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('key', key)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(401).json({ error: message });
  }
}