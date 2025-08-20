// FILE: api/vault/certificate/[id].ts

import { supaAdmin } from '../../../_lib/supaAdmin';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'A valid asset ID is required.' });
    }

    // Use the admin client to fetch specific, non-sensitive details for the public certificate.
    // This bypasses RLS for read-only public access.
    const { data, error } = await supaAdmin
      .from('vault_items')
      .select(`
        id,
        asset_name,
        photos,
        valuation_data,
        owner_valuation,
        created_at,
        users ( email ) 
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Asset not found.' });
      }
      throw error;
    }

    // We can choose to redact or simplify data here if needed.
    // For now, we return the selected fields.
    return res.status(200).json(data);

  } catch (error: any) {
    console.error(`Error fetching asset certificate for ID ${req.query.id}:`, error);
    return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
  }
}
