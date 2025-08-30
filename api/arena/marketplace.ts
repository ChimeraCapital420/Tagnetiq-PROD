// FILE: api/arena/marketplace.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyUser(req); // SECURITY: Verify user is authenticated to view the marketplace
    const { searchQuery } = req.query;

    let query = supaAdmin
      .from('marketplace_listings')
      // HEPHAESTUS NOTE: This query now joins with the challenges table to check its status.
      .select('*, challenge:arena_challenges(status)')
      // HEPHAESTUS NOTE: This filter ensures only listings from ACTIVE challenges are shown.
      .eq('challenge.status', 'active') 
      .order('created_at', { ascending: false });

    // If a search query is provided, filter the results (your existing logic is preserved)
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
    const message = error.message || 'An internal server error occurred.';
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    console.error('Error fetching marketplace listings:', message);
    return res.status(500).json({ error: message });
  }
}