// FILE: api/investor/invite.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../src/lib/supabase'; // Using client for RLS
import { jwtDecode } from 'jwt-decode';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    
    // Decode token to get the inviter's user ID
    const decodedToken: { sub: string } = jwtDecode(token);
    const inviterId = decodedToken.sub;

    const { email: invitee_email } = req.body;
    if (!invitee_email || typeof invitee_email !== 'string') {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    
    // Step 1: Record the invitation in our tracking table using the admin client
    // We use supaAdmin here to bypass RLS for the insert.
    const { error: insertError } = await supaAdmin
      .from('investor_invites')
      .insert({
        inviter_id: inviterId,
        invitee_email: invitee_email,
        status: 'sent',
      });

    if (insertError) {
      if (insertError.code === '23505') { // unique_constraint violation
        return res.status(409).json({ error: `You have already invited ${invitee_email}.` });
      }
      throw insertError;
    }

    // Step 2: Use Supabase admin to send the actual invitation email.
    const { error: inviteError } = await supaAdmin.auth.admin.inviteUserByEmail(invitee_email);

    if (inviteError) {
      // If the user already exists, we can inform the inviter.
      if (inviteError.message.includes('User already registered')) {
          // It's good practice to roll back the insert if the invite fails, but for this case,
          // we can leave the record to show an attempted invite to an existing user.
          // Or handle it as per business logic. For now, we'll return a specific error.
          await supaAdmin.from('investor_invites').delete().match({ inviter_id: inviterId, invitee_email: invitee_email });
          return res.status(409).json({ error: 'A user with this email already exists.' });
      }
      throw inviteError;
    }

    return res.status(200).json({ success: true, message: `Invite successfully sent to ${invitee_email}.` });

  } catch (error: any) {
    console.error('Error in investor invite endpoint:', error);
    const message = error.message || 'An unexpected error occurred.';
    return res.status(500).json({ error: message });
  }
}