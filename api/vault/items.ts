// FILE: api/vault/items.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    switch (req.method) {
      case 'GET':
        const { vaultId } = req.query;

        if (!vaultId || typeof vaultId !== 'string') {
          return res.status(400).json({ error: 'vaultId query parameter is required.' });
        }

        // Verify vault ownership
        const { data: vault, error: vaultError } = await supaAdmin
          .from('vaults')
          .select('user_id')
          .eq('id', vaultId)
          .single();

        if (vaultError || !vault) {
          return res.status(404).json({ error: 'Vault not found.' });
        }

        if (vault.user_id !== user.id) {
          return res.status(403).json({ error: 'Access denied.' });
        }

        // Fetch items from the specified vault
        const { data: items, error: itemsError } = await supaAdmin
          .from('vault_items')
          .select('*')
          .eq('vault_id', vaultId)
          .order('created_at', { ascending: false });

        if (itemsError) throw itemsError;

        return res.status(200).json(items || []);

      case 'POST':
        const { vault_id, asset_name, valuation_data, photos } = req.body;

        if (!vault_id || !asset_name || !valuation_data) {
          return res.status(400).json({ 
            error: 'Missing required fields: vault_id, asset_name, and valuation_data.' 
          });
        }

        // Verify vault ownership
        const { data: targetVault, error: targetVaultError } = await supaAdmin
          .from('vaults')
          .select('user_id')
          .eq('id', vault_id)
          .single();

        if (targetVaultError || !targetVault) {
          return res.status(404).json({ error: 'Target vault not found.' });
        }

        if (targetVault.user_id !== user.id) {
          return res.status(403).json({ error: 'Cannot add items to a vault you do not own.' });
        }

        const { data: newItem, error: itemError } = await supaAdmin
          .from('vault_items')
          .insert({
            vault_id,
            asset_name,
            valuation_data,
            photos: photos || [],
          })
          .select()
          .single();

        if (itemError) throw itemError;

        return res.status(201).json(newItem);

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

  } catch (error: any) {
    console.error('Error in /api/vault/items:', error);
    const message = error.message || 'An internal server error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
}