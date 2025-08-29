// FILE: api/investor/invite.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // SECURITY: Verify the user is an admin before proceeding.
    await verifyUserIsAdmin(req);

    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    // Use the Supabase admin client to invite a new user by email.
    // This handles the secure token generation and email sending process.
    const { data, error } = await supaAdmin.auth.admin.inviteUserByEmail(email);

    if (error) {
      // Provide more specific feedback if the user already exists
      if (error.message.includes('unique constraint') || error.message.includes('User already registered')) {
          return res.status(409).json({ error: 'A user with this email already exists.' });
      }
      throw error;
    }

    return res.status(200).json({ success: true, message: `Invite successfully sent to ${email}.` });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication') || message.includes('Authorization')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error sending Supabase invite:', message);
    return res.status(500).json({ error: message });
  }
}