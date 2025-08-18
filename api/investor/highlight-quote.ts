// FILE: api/investor/highlight-quote.ts (CREATE THIS NEW FILE)

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
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

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error fetching highlight quote:', message);
    return res.status(500).json({ error: message });
  }
}