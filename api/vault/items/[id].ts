// FILE: api/vault/items/[id].ts
// Updated to verify ownership through vaults

import { supaAdmin } from '../../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Item ID is required and must be a valid string.' });
  }

  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid item ID format.' });
  }

  try {
    const user = await verifyUser(req);

    // Verify ownership through vault
    const { data: ownershipCheck, error: ownershipError } = await supaAdmin
      .from('vault_items')
      .select(`
        id,
        vault:vaults!inner(
          user_id
        )
      `)
      .eq('id', id)
      .single();

    if (ownershipError || !ownershipCheck) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    if (ownershipCheck.vault.user_id !== user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this item.' });
    }

    if (req.method === 'GET') {
      const { data: item, error: fetchError } = await supaAdmin
        .from('vault_items')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !item) {
        return res.status(404).json({ error: 'Item not found.' });
      }

      return res.status(200).json(item);
    }

    if (req.method === 'PUT') {
      const { notes, serial_number, receipt_url, owner_valuation, provenance_documents } = req.body;
      
      const updates: any = { updated_at: new Date().toISOString() };
      
      // Validate inputs (same as before)
      if (notes !== undefined) {
        if (typeof notes !== 'string' || notes.length > 10000) {
          return res.status(400).json({ error: 'Notes must be a string with maximum 10,000 characters.' });
        }
        updates.notes = notes.trim();
      }
      
      if (serial_number !== undefined) {
        if (typeof serial_number !== 'string' || serial_number.length > 500) {
          return res.status(400).json({ error: 'Serial number must be a string with maximum 500 characters.' });
        }
        updates.serial_number = serial_number.trim();
      }
      
      if (receipt_url !== undefined) {
        if (typeof receipt_url !== 'string' || receipt_url.length > 2000) {
          return res.status(400).json({ error: 'Receipt URL must be a string with maximum 2,000 characters.' });
        }
        if (receipt_url && !receipt_url.match(/^https?:\/\/.+/)) {
          return res.status(400).json({ error: 'Receipt URL must be a valid HTTP/HTTPS URL.' });
        }
        updates.receipt_url = receipt_url.trim();
      }
      
      if (owner_valuation !== undefined) {
        const valuation = Number(owner_valuation);
        if (isNaN(valuation) || valuation < 0 || valuation > 999999999) {
          return res.status(400).json({ error: 'Owner valuation must be a valid number between 0 and 999,999,999.' });
        }
        updates.owner_valuation = valuation;
      }
      
      if (provenance_documents !== undefined) {
        if (!Array.isArray(provenance_documents)) {
          return res.status(400).json({ error: 'Provenance documents must be an array.' });
        }
        if (provenance_documents.length > 50) {
          return res.status(400).json({ error: 'Maximum 50 provenance documents allowed.' });
        }
        for (const doc of provenance_documents) {
          if (typeof doc !== 'string' || doc.length > 1000) {
            return res.status(400).json({ error: 'Each document path must be a string with maximum 1,000 characters.' });
          }
        }
        updates.provenance_documents = provenance_documents;
      }

      const { data: updatedItem, error: updateError } = await supaAdmin
        .from('vault_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error(`Update error for item ${id}:`, updateError);
        return res.status(500).json({ error: 'Failed to update item.' });
      }

      return res.status(200).json(updatedItem);
    }
    
    if (req.method === 'DELETE') {
      const { confirm } = req.body;
      if (confirm !== 'DELETE') {
        return res.status(400).json({ error: 'Deletion requires confirmation. Send { "confirm": "DELETE" } in request body.' });
      }

      const { error: deleteError } = await supaAdmin
        .from('vault_items')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error(`Delete error for item ${id}:`, deleteError);
        return res.status(500).json({ error: 'Failed to delete item.' });
      }
        
      return res.status(200).json({ success: true, message: 'Item permanently deleted.' });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

  } catch (error: any) {
    console.error(`Error in /api/vault/items/${id}:`, error);
    const message = error.message || 'An internal server error occurred.';
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}