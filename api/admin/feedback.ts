// FILE: api/admin/feedback.ts (CREATE THIS NEW FILE)

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await verifyUserIsAdmin(req); // SECURITY: Admin-only endpoint

    if (req.method === 'GET') {
      const { data, error } = await supaAdmin
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const { id, status } = req.body;
      if (!id || !status) {
        return res.status(400).json({ error: 'Feedback ID and new status are required.' });
      }
      const { data, error } = await supaAdmin
        .from('feedback')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authorization') || message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error in admin feedback handler:', message);
    return res.status(500).json({ error: message });
  }
}