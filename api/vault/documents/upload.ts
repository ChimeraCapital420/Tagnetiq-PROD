// FILE: api/vault/documents/upload.ts

import { supaAdmin } from '../../_lib/supaAdmin';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../../_lib/security';

const AEGIS_BUCKET = 'aegis-documents';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req); // SECURITY: Verify user authentication
    const { fileName, fileType, itemId } = req.body;
    
    if (!fileName || !fileType || !itemId) {
      return res.status(400).json({ error: 'Missing required fields: fileName, fileType, itemId.' });
    }

    // SECURITY: Verify that the user owns the vault item they are trying to upload to.
    const { data: itemOwner, error: ownerError } = await supaAdmin
      .from('vault_items')
      .select('user_id')
      .eq('id', itemId)
      .single();

    if (ownerError || !itemOwner || itemOwner.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden: You do not own this asset.' });
    }
    
    const filePath = `${user.id}/${itemId}/${Date.now()}-${fileName}`;

    // Generate a pre-signed URL for the upload.
    const { data, error } = await supaAdmin.storage
      .from(AEGIS_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      throw error;
    }

    // The token from the signed URL data is what the client needs to upload.
    return res.status(200).json({ ...data, filePath });

  } catch (error: any) {
    const message = error.message || 'An internal server error occurred.';
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
     if (message.includes('Forbidden')) {
        return res.status(403).json({ error: message });
    }
    console.error('Error creating signed upload URL:', error);
    return res.status(500).json({ error: message });
  }
}