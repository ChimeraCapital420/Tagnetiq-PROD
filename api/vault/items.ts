// FILE: api/vault/items.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    switch (req.method) {
      case 'GET':
        const { vaultId, page = '1', limit = '20' } = req.query;

        if (!vaultId || typeof vaultId !== 'string') {
          return res.status(400).json({ error: 'vaultId query parameter is required.' });
        }

        // Parse pagination parameters
        const pageNum = parseInt(page as string, 10);
        const limitNum = Math.min(parseInt(limit as string, 10), 50); // Max 50 items per page
        
        if (isNaN(pageNum) || pageNum < 1) {
          return res.status(400).json({ error: 'Invalid page parameter.' });
        }
        
        if (isNaN(limitNum) || limitNum < 1) {
          return res.status(400).json({ error: 'Invalid limit parameter.' });
        }

        const offset = (pageNum - 1) * limitNum;

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

        // Fetch total count and items with pagination
        const [
          { count: totalCount, error: countError },
          { data: items, error: itemsError }
        ] = await Promise.all([
          // Get total count
          supaAdmin
            .from('vault_items')
            .select('*', { count: 'exact', head: true })
            .eq('vault_id', vaultId),
          // Get paginated items
          supaAdmin
            .from('vault_items')
            .select('*')
            .eq('vault_id', vaultId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limitNum - 1)
        ]);

        if (countError || itemsError) {
          throw countError || itemsError;
        }

        return res.status(200).json({
          items: items || [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount || 0,
            pages: Math.ceil((totalCount || 0) / limitNum)
          }
        });

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