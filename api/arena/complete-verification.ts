// FILE: api/arena/complete-verification.ts

import { supaAdmin } from '../_lib/supaAdmin';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security'; // CORRECTED: Use standard user verification

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req); // SECURITY: Verify user authentication
    const { challengeId, photoUrl } = req.body;

    if (!challengeId || !photoUrl) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const { data, error } = await supaAdmin
      .from('arena_challenges')
      .update({
        possession_verified: true,
        verification_photo_url: photoUrl
      })
      .eq('id', challengeId)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) throw error;

    return res.status(200).json(data);

  } catch (error: any) {
    const message = error.message || 'An internal server error occurred.';
     if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    console.error('Error completing verification:', message);
    return res.status(500).json({ error: message });
  }
}