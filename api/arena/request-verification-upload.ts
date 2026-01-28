// FILE: api/arena/request-verification-upload.ts
// Fixed to check arena_listings instead of arena_challenges

import { supaAdmin } from '../_lib/supaAdmin.js';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { challengeId, fileName, fileType } = req.body;

    if (!challengeId || !fileName || !fileType) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Check ownership in arena_listings (not arena_challenges)
    const { data: listing, error: listingError } = await supaAdmin
      .from('arena_listings')
      .select('seller_id')
      .eq('id', challengeId)
      .single();

    if (listingError || !listing) {
      // Fallback: try arena_challenges for backwards compatibility
      const { data: challenge, error: challengeError } = await supaAdmin
        .from('arena_challenges')
        .select('user_id')
        .eq('id', challengeId)
        .single();

      if (challengeError || !challenge || challenge.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden: You do not own this listing.' });
      }
    } else if (listing.seller_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this listing.' });
    }

    const filePath = `${user.id}/${challengeId}/${Date.now()}-${fileName}`;
    
    const { data, error } = await supaAdmin.storage
      .from('arena-verification-photos')
      .createSignedUploadUrl(filePath);

    if (error) throw error;

    return res.status(200).json({ ...data, filePath });
  } catch (error: any) {
    const message = error.message || 'An internal server error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error creating signed upload URL:', message);
    return res.status(500).json({ error: message });
  }
}