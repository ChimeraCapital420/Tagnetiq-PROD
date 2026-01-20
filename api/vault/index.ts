// FILE: api/vault/index.ts
// Vault management endpoints

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    switch (req.method) {
      case 'GET':
        // Fetch all vaults for the authenticated user
        const { data: vaults, error: vaultsError } = await supaAdmin
          .from('vaults')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (vaultsError) throw vaultsError;

        // Calculate item count and total value for each vault
        const vaultsWithStats = await Promise.all(
          (vaults || []).map(async (vault) => {
            const { data: items, error: itemsError } = await supaAdmin
              .from('vault_items')
              .select('id, valuation_data')
              .eq('vault_id', vault.id);

            if (itemsError) {
              console.error(`Error fetching items for vault ${vault.id}:`, itemsError);
              return {
                ...vault,
                item_count: 0,
                total_value: 0
              };
            }

            const itemCount = items?.length || 0;
            
            const totalValue = items?.reduce((sum, item) => {
              const value = item.valuation_data?.estimatedValue;
              if (value && typeof value === 'string') {
                const numValue = parseFloat(value.replace(/[^0-9.-]+/g, ''));
                return sum + (isNaN(numValue) ? 0 : numValue);
              } else if (value && typeof value === 'number') {
                return sum + value;
              }
              return sum;
            }, 0) || 0;

            return {
              ...vault,
              item_count: itemCount,
              total_value: totalValue
            };
          })
        );

        return res.status(200).json(vaultsWithStats);

      case 'POST':
        // Create a new vault
        const { name, description } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ error: 'Vault name is required.' });
        }

        if (name.length > 100) {
          return res.status(400).json({ error: 'Vault name must be 100 characters or less.' });
        }

        if (description && description.length > 500) {
          return res.status(400).json({ error: 'Description must be 500 characters or less.' });
        }

        const { data: newVault, error: createError } = await supaAdmin
          .from('vaults')
          .insert({
            user_id: user.id,
            name: name.trim(),
            description: description?.trim() || null
          })
          .select()
          .single();

        if (createError) throw createError;

        return res.status(201).json(newVault);

      case 'PUT':
        // Update a vault
        const { id } = req.query;
        const { name: updateName, description: updateDescription } = req.body;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Vault ID is required.' });
        }

        // Verify ownership
        const { data: vault, error: fetchError } = await supaAdmin
          .from('vaults')
          .select('user_id')
          .eq('id', id)
          .single();

        if (fetchError || !vault) {
          return res.status(404).json({ error: 'Vault not found.' });
        }

        if (vault.user_id !== user.id) {
          return res.status(403).json({ error: 'Access denied.' });
        }

        const updates: any = {};
        
        if (updateName !== undefined) {
          if (!updateName || updateName.trim().length === 0) {
            return res.status(400).json({ error: 'Vault name cannot be empty.' });
          }
          if (updateName.length > 100) {
            return res.status(400).json({ error: 'Vault name must be 100 characters or less.' });
          }
          updates.name = updateName.trim();
        }

        if (updateDescription !== undefined) {
          if (updateDescription && updateDescription.length > 500) {
            return res.status(400).json({ error: 'Description must be 500 characters or less.' });
          }
          updates.description = updateDescription?.trim() || null;
        }

        const { data: updatedVault, error: updateError } = await supaAdmin
          .from('vaults')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (updateError) throw updateError;

        return res.status(200).json(updatedVault);

      case 'DELETE':
        // Delete a vault
        const { id: deleteId } = req.query;

        if (!deleteId || typeof deleteId !== 'string') {
          return res.status(400).json({ error: 'Vault ID is required.' });
        }

        // Verify ownership
        const { data: vaultToDelete, error: verifyError } = await supaAdmin
          .from('vaults')
          .select('user_id')
          .eq('id', deleteId)
          .single();

        if (verifyError || !vaultToDelete) {
          return res.status(404).json({ error: 'Vault not found.' });
        }

        if (vaultToDelete.user_id !== user.id) {
          return res.status(403).json({ error: 'Access denied.' });
        }

        // Check if this is the last vault
        const { count } = await supaAdmin
          .from('vaults')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (count === 1) {
          return res.status(400).json({ error: 'Cannot delete your last vault. You must have at least one vault.' });
        }

        const { error: deleteError } = await supaAdmin
          .from('vaults')
          .delete()
          .eq('id', deleteId);

        if (deleteError) throw deleteError;

        return res.status(200).json({ success: true, message: 'Vault deleted successfully.' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

  } catch (error: any) {
    console.error('Error in /api/vault:', error);
    const message = error.message || 'An internal server error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
}