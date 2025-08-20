// FILE: api/arena/request-verification-upload.ts

import { supaAdmin } from '../_lib/supaAdmin';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../_lib/security';

const VERIFICATION_BUCKET = 'arena-verification-photos';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUserIsAdmin(req);
    const { challengeId, fileName, fileType } = req.body;

    if (!challengeId || !fileName || !fileType) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const { data: challengeOwner, error: ownerError } = await supaAdmin
      .from('arena_challenges')
      .select('user_id')
      .eq('id', challengeId)
      .single();

    if (ownerError || !challengeOwner || challengeOwner.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden: You do not own this challenge.' });
    }
    
    const filePath = `${user.id}/${challengeId}/${Date.now()}-${fileName}`;

    const { data, error } = await supaAdmin.storage
      .from(VERIFICATION_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) throw error;

    return res.status(200).json({ ...data, filePath });

  } catch (error: any) {
    console.error('Error creating signed upload URL:', error);
    return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
  }
}