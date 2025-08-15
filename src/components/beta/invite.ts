// FILE: api/beta/invite.ts (MODIFIED)

import { supaAdmin } from '../../src/lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Admin authentication check should be implemented here in a real scenario.

  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  try {
    // Use the Supabase Admin Auth client to invite a new user.
    // This method generates a secure, single-use link and sends it via
    // the configured Supabase SMTP provider.
    const { data, error } = await supaAdmin.auth.admin.inviteUserByEmail(email);

    if (error) {
      // Provide more specific feedback if the user already exists
      if (error.message.includes('unique constraint')) {
          return res.status(409).json({ error: 'A user with this email already exists in the project.' });
      }
      throw error;
    }

    // The 'data' object contains the new user, but the invite is sent by Supabase.
    // We can return a success message to the admin.
    return res.status(200).json({ success: true, message: `Invite successfully sent to ${email}.` });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error sending Supabase invite:', message);
    return res.status(500).json({ error: message });
  }
}