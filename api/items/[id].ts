// FILE: api/vault/items/[id].ts

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { id } = req.query;
    const { notes, serial_number, receipt_url, owner_valuation, provenance_documents } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Item ID is required.' });
    }
    if (!token) {
      return res.status(401).json({ error: 'Authentication token is required.' });
    }

    const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid user session.' });
    }

    // Construct the update object with only the fields that are provided
    const updates: any = {};
    if (notes !== undefined) updates.notes = notes;
    if (serial_number !== undefined) updates.serial_number = serial_number;
    if (receipt_url !== undefined) updates.receipt_url = receipt_url;
    if (owner_valuation !== undefined) updates.owner_valuation = owner_valuation;
    if (provenance_documents !== undefined) updates.provenance_documents = provenance_documents;
    updates.updated_at = new Date().toISOString();

    const { data: updatedItem, error: updateError } = await supabase
      .from('vault_items')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Item not found or you do not have permission to edit it.' });
      }
      throw updateError;
    }

    return res.status(200).json(updatedItem);

  } catch (error: any) {
    console.error(`Error in PUT /api/vault/items/${req.query.id}:`, error);
    return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
  }
}
