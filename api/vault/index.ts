// FILE: api/vault/index.ts

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// This function retrieves all vault items for the authenticated user.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication token is required.' });
    }

    // Create a Supabase client with the user's access token
    const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid user session.' });
    }

    // Fetch all items from the user's vault
    const { data: items, error: itemsError } = await supabase
      .from('vault_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (itemsError) {
      throw itemsError;
    }

    return res.status(200).json(items || []);

  } catch (error: any) {
    console.error('Error in GET /api/vault:', error);
    return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
  }
}
