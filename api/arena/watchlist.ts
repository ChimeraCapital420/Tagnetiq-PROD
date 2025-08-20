// FILE: api/arena/watchlist.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../_lib/security'; // Assuming this verifies a logged-in user, not just admin for this route

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUserIsAdmin(req);

    if (req.method === 'GET') {
      const { data, error } = await supaAdmin
        .from('watchlists')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { keywords } = req.body;
      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: 'Keywords array is required.' });
      }
      const { data, error } = await supaAdmin
        .from('watchlists')
        .insert({ user_id: user.id, keywords })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'Watchlist ID is required.' });
        }
        const { error } = await supaAdmin
            .from('watchlists')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
        if (error) throw error;
        return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (message.includes('Authentication') || message.includes('Authorization')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error in watchlist handler:', message);
    return res.status(500).json({ error: message });
  }
}