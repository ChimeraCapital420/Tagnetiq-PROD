// FILE: api/arena/marketplace.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { searchQuery } = req.query;

    let query = supaAdmin
      .from('marketplace_listings')
      .select('*')
      .order('created_at', { ascending: false });

    // If a search query is provided, filter the results
    if (searchQuery && typeof searchQuery === 'string') {
      query = query.textSearch('item_name', searchQuery, {
        type: 'websearch',
        config: 'english'
      });
    }

    const { data: listings, error } = await query;

    if (error) throw error;

    return res.status(200).json(listings);

  } catch (error: any) {
    console.error('Error fetching marketplace listings:', error);
    return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
  }
}