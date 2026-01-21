// FILE: api/vault/items.ts

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

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

        // Fetch all items for this vault
        const { data: items, error: itemsError } = await supaAdmin
          .from('vault_items')
          .select('*')
          .eq('vault_id', vaultId)
          .order('created_at', { ascending: false });

        if (itemsError) throw itemsError;

        return res.status(200).json(items || []);

      case 'POST':
        const { 
          vault_id, 
          asset_name, 
          valuation_data, 
          photos, 
          notes, 
          serial_number,
          category: providedCategory 
        } = req.body;

        if (!vault_id || !asset_name) {
          return res.status(400).json({ 
            error: 'Missing required fields: vault_id and asset_name are required.' 
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

        // Extract category from valuation_data if not provided directly
        const category = providedCategory || 
                        valuation_data?.category || 
                        valuation_data?.primaryCategory ||
                        valuation_data?.item_category ||
                        'Uncategorized';

        // Insert with all required fields
        const { data: newItem, error: itemError } = await supaAdmin
          .from('vault_items')
          .insert({
            vault_id,
            user_id: user.id,
            asset_name,
            category,  // <-- NOW INCLUDED
            valuation_data: valuation_data || null,
            photos: photos || [],
            notes: notes || null,
            serial_number: serial_number || null,
            currency: 'USD',
          })
          .select()
          .single();

        if (itemError) {
          console.error('Insert error:', itemError);
          throw itemError;
        }

        return res.status(201).json(newItem);

      case 'PUT':
        const { id } = req.query;
        const updateData = req.body;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Item ID is required.' });
        }

        // Verify item ownership
        const { data: existingItem, error: fetchItemError } = await supaAdmin
          .from('vault_items')
          .select('user_id')
          .eq('id', id)
          .single();

        if (fetchItemError || !existingItem) {
          return res.status(404).json({ error: 'Item not found.' });
        }

        if (existingItem.user_id !== user.id) {
          return res.status(403).json({ error: 'Access denied.' });
        }

        // Build update object with only allowed fields
        const allowedFields = [
          'asset_name', 
          'category',
          'valuation_data', 
          'photos', 
          'notes', 
          'serial_number', 
          'receipt_url', 
          'owner_valuation', 
          'provenance_documents',
          'currency',
          'is_insured',
          'insurance_details'
        ];
        const updates: Record<string, any> = {};
        
        for (const field of allowedFields) {
          if (updateData[field] !== undefined) {
            updates[field] = updateData[field];
          }
        }

        updates.updated_at = new Date().toISOString();

        const { data: updatedItem, error: updateError } = await supaAdmin
          .from('vault_items')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (updateError) throw updateError;

        return res.status(200).json(updatedItem);

      case 'DELETE':
        const { id: deleteId } = req.query;

        if (!deleteId || typeof deleteId !== 'string') {
          return res.status(400).json({ error: 'Item ID is required.' });
        }

        // Verify item ownership
        const { data: itemToDelete, error: verifyItemError } = await supaAdmin
          .from('vault_items')
          .select('user_id')
          .eq('id', deleteId)
          .single();

        if (verifyItemError || !itemToDelete) {
          return res.status(404).json({ error: 'Item not found.' });
        }

        if (itemToDelete.user_id !== user.id) {
          return res.status(403).json({ error: 'Access denied.' });
        }

        const { error: deleteError } = await supaAdmin
          .from('vault_items')
          .delete()
          .eq('id', deleteId);

        if (deleteError) throw deleteError;

        return res.status(200).json({ success: true, message: 'Item deleted successfully.' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
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