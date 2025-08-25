// FILE: api/vault/index.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

// This function retrieves all vault items for the authenticated user.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);

    // Fetch all items from the user's vault
    const { data: items, error: itemsError } = await supaAdmin
      .from('vault_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (itemsError) {
      throw itemsError;
    }

    return res.status(200).json(items || []);

  } catch (error: any) {
    console.error('Error in GET /api/vault:', error);
    const message = error.message || 'An internal server error occurred.';
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
}