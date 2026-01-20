// FILE: api/investor/highlight-quote.ts

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyUserIsAdmin(req); // SECURITY: Admin-only endpoint

    // Fetch the most recent, active quote from the database
    const { data: quote, error } = await supaAdmin
      .from('highlight_quotes')
      .select('quote, author, source')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // If no quote is found, it's not a server error, just return null
      if (error.code === 'PGRST116') {
        return res.status(200).json(null);
      }
      throw error;
    }

    return res.status(200).json(quote);

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
     if (message.includes('Authorization')) {
        return res.status(403).json({ error: message });
    }
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    console.error('Error fetching highlight quote:', message);
    return res.status(500).json({ error: message });
  }
}