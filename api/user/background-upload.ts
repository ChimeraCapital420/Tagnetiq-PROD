// FILE: api/user/background-upload.ts

import { supaAdmin } from '../_lib/supaAdmin';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

const BACKGROUNDS_BUCKET = 'backgrounds';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'fileName and fileType are required.' });
    }

    const filePath = `${user.id}/${Date.now()}-${fileName}`;

    const { data, error } = await supaAdmin.storage
      .from(BACKGROUNDS_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) throw error;

    return res.status(200).json({ ...data, filePath });

  } catch (error: any) {
    const message = error.message || 'An internal server error occurred.';
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    console.error('Error creating signed upload URL for background:', message);
    return res.status(500).json({ error: message });
  }
}