// FILE: api/vault/items.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { asset_name, valuation_data, photos } = req.body;

    if (!asset_name || !valuation_data) {
        return res.status(400).json({ error: 'Missing required fields: asset_name and valuation_data.' });
    }

    const { data: newItem, error: itemError } = await supaAdmin
      .from('vault_items')
      .insert({
        user_id: user.id,
        asset_name,
        valuation_data,
        photos: photos || [],
      })
      .select()
      .single();

    if (itemError) {
      throw itemError;
    }

    return res.status(201).json(newItem);

  } catch (error: any) {
    console.error('Error in POST /api/vault/items:', error);
    const message = error.message || 'An internal server error occurred.';
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
}