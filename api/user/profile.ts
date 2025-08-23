// FILE: api/user/profile.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { fullName } = req.body;

    const { data, error } = await supaAdmin
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error updating profile:', message);
    return res.status(500).json({ error: message });
  }
}