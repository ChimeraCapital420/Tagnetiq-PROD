// FILE: api/vault/documents/upload.ts

import { supaAdmin } from '../../_lib/supaAdmin';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from '@supabase/supabase-js/dist/module/lib/errors';

const AEGIS_BUCKET = 'aegis-documents';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { fileName, fileType, itemId } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication token is required.' });
    }
    if (!fileName || !fileType || !itemId) {
      return res.status(400).json({ error: 'Missing required fields: fileName, fileType, itemId.' });
    }

    // Authenticate the user with the admin client to get their user ID
    const { data: { user }, error: userError } = await supaAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid user session.' });
    }

    // Verify that the user owns the vault item they are trying to upload to.
    // This is a critical security check.
    const { data: itemOwner, error: ownerError } = await supaAdmin
      .from('vault_items')
      .select('user_id')
      .eq('id', itemId)
      .single();

    if (ownerError || !itemOwner || itemOwner.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden: You do not own this asset.' });
    }
    
    // Create a secure path for the file in the bucket
    const filePath = `${user.id}/${itemId}/${Date.now()}-${fileName}`;

    // Generate a pre-signed URL for the upload.
    // This URL is short-lived and allows a direct, secure upload to the private bucket.
    const { data, error } = await supaAdmin.storage
      .from(AEGIS_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      throw error;
    }

    return res.status(200).json({ ...data, filePath });

  } catch (error: any) {
    console.error('Error creating signed upload URL:', error);
    return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
  }
}
