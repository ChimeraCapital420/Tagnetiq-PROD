import { supaAdmin } from '../src/lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// This endpoint is for admins to get and set feature flags.
// It must be protected to ensure only admins can use it.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // TODO: Add robust admin authentication check here.

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

  return res.status(405).json({ error: 'Method Not Allowed' });
}