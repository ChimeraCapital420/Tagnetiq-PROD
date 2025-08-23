// FILE: api/beta/invite.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // SECURITY: Verify the user is an admin before proceeding
    await verifyUserIsAdmin(req);

    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    const { data, error } = await supaAdmin.auth.admin.inviteUserByEmail(email);

    if (error) {
      if (error.message.includes('unique constraint')) {
        return res.status(409).json({ error: 'A user with this email already exists in the project.' });
      }
      throw error;
    }

    return res.status(200).json({ success: true, message: `Invite successfully sent to ${email}.` });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    // SECURITY: Return 401 for auth errors, 500 for others
    if (message.includes('Authentication') || message.includes('Authorization')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error sending Supabase invite:', message);
    return res.status(500).json({ error: message });
  }
}