// FILE: api/admin/partnerships/[id].ts

import { supaAdmin } from '../../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await verifyUserIsAdmin(req);
    const { id } = req.query;

    if (req.method === 'PUT') {
      const { status, notes, monetization_details } = req.body;
      const updates: any = {};
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (monetization_details) updates.monetization_details = monetization_details;

      const { data, error } = await supaAdmin
        .from('partnership_opportunities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return res.status(200).json(data);
    }

    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authorization')) return res.status(403).json({ error: message });
    if (message.includes('Authentication')) return res.status(401).json({ error: message });
    console.error(`Error updating partnership opportunity ${req.query.id}:`, message);
    return res.status(500).json({ error: message });
  }
}