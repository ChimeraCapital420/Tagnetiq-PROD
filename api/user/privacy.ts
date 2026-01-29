// FILE: api/user/privacy.ts
// Manage user privacy settings

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

const VALID_VISIBILITY = ['public', 'friends_only', 'private'];
const VALID_MESSAGING = ['everyone', 'friends_only', 'nobody'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // GET - Fetch current privacy settings
    if (req.method === 'GET') {
      const { data: profile, error } = await supaAdmin
        .from('profiles')
        .select('profile_visibility, allow_messages_from')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      return res.status(200).json({
        profile_visibility: profile?.profile_visibility || 'public',
        allow_messages_from: profile?.allow_messages_from || 'everyone',
        options: {
          visibility: [
            { value: 'public', label: 'Public', description: 'Anyone can view your profile' },
            { value: 'friends_only', label: 'Friends Only', description: 'Only friends can view your full profile' },
            { value: 'private', label: 'Private', description: 'Only you can view your profile details' },
          ],
          messaging: [
            { value: 'everyone', label: 'Everyone', description: 'Anyone can send you messages' },
            { value: 'friends_only', label: 'Friends Only', description: 'Only friends can message you' },
            { value: 'nobody', label: 'Nobody', description: 'Disable all direct messages' },
          ],
        },
      });
    }

    // PATCH - Update privacy settings
    if (req.method === 'PATCH') {
      const { profile_visibility, allow_messages_from } = req.body;

      const updates: Record<string, string> = {};

      if (profile_visibility !== undefined) {
        if (!VALID_VISIBILITY.includes(profile_visibility)) {
          return res.status(400).json({ 
            error: `Invalid profile_visibility. Must be one of: ${VALID_VISIBILITY.join(', ')}` 
          });
        }
        updates.profile_visibility = profile_visibility;
      }

      if (allow_messages_from !== undefined) {
        if (!VALID_MESSAGING.includes(allow_messages_from)) {
          return res.status(400).json({ 
            error: `Invalid allow_messages_from. Must be one of: ${VALID_MESSAGING.join(', ')}` 
          });
        }
        updates.allow_messages_from = allow_messages_from;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update.' });
      }

      const { data: updated, error: updateError } = await supaAdmin
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select('profile_visibility, allow_messages_from')
        .single();

      if (updateError) throw updateError;

      return res.status(200).json({
        message: 'Privacy settings updated',
        profile_visibility: updated.profile_visibility,
        allow_messages_from: updated.allow_messages_from,
      });
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error in privacy handler:', message);
    return res.status(500).json({ error: message });
  }
}