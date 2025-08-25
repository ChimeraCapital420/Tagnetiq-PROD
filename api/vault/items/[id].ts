// FILE: api/vault/items/[id].ts

// CORRECTED: The import paths are updated to reflect the new file location.
import { supaAdmin } from '../../../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../../../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Item ID is required.' });
  }

  try {
    const user = await verifyUser(req);

    if (req.method === 'PUT') {
      const { notes, serial_number, receipt_url, owner_valuation, provenance_documents } = req.body;
      
      const updates: any = {};
      if (notes !== undefined) updates.notes = notes;
      if (serial_number !== undefined) updates.serial_number = serial_number;
      if (receipt_url !== undefined) updates.receipt_url = receipt_url;
      if (owner_valuation !== undefined) updates.owner_valuation = owner_valuation;
      if (provenance_documents !== undefined) updates.provenance_documents = provenance_documents;
      updates.updated_at = new Date().toISOString();

      const { data: updatedItem, error: updateError } = await supaAdmin
        .from('vault_items')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id) // Ensure user can only update their own items
        .select()
        .single();

      if (updateError) {
        if (updateError.code === 'PGRST116') { // Error code for no rows found
          return res.status(404).json({ error: 'Item not found or you do not have permission to edit it.' });
        }
        throw updateError;
      }

      return res.status(200).json(updatedItem);
    }
    
    if (req.method === 'DELETE') {
        const { error: deleteError } = await supaAdmin
            .from('vault_items')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id); // Ensure user can only delete their own items

        if (deleteError) {
            // PGRST116 means 0 rows were affected, which implies not found or no permission
            if (deleteError.code === 'PGRST116' || deleteError.details?.includes('0 rows')) {
                 return res.status(404).json({ error: 'Item not found or you do not have permission to delete it.' });
            }
            throw deleteError;
        }
        
        return res.status(200).json({ success: true, message: 'Item deleted successfully.' });
    }

    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

  } catch (error: any) {
    console.error(`Error in /api/vault/items/${id}:`, error);
    const message = error.message || 'An internal server error occurred.';
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
}