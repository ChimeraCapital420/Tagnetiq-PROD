// FILE: api/vault/items.ts

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// This function handles creating a user's vault if it doesn't exist,
// and then adds a new item to that vault.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { asset_name, valuation_data, photos } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication token is required.' });
    }

    if (!asset_name || !valuation_data) {
        return res.status(400).json({ error: 'Missing required fields: asset_name and valuation_data.' });
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

    // 1. Find or create the user's vault.
    let { data: vault, error: vaultError } = await supabase
      .from('insurance_vaults')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (vaultError && vaultError.code !== 'PGRST116') { // PGRST116 means no rows found
      throw vaultError;
    }

    if (!vault) {
      const { data: newVault, error: newVaultError } = await supabase
        .from('insurance_vaults')
        .insert({ user_id: user.id })
        .select('id')
        .single();
      
      if (newVaultError) throw newVaultError;
      vault = newVault;
    }

    // 2. Add the new item to the vault.
    const { data: newItem, error: itemError } = await supabase
      .from('vault_items')
      .insert({
        user_id: user.id,
        vault_id: vault.id,
        asset_name,
        valuation_data,
        photos: photos || [], // Default to empty array if not provided
      })
      .select()
      .single();

    if (itemError) {
      throw itemError;
    }

    return res.status(201).json(newItem);

  } catch (error: any) {
    console.error('Error in POST /api/vault/items:', error);
    return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
  }
}
