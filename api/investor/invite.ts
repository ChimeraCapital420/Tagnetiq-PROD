// FILE: api/investor/invite.ts
import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security'; // Import the standard user verification

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Verify the user is authenticated.
    const inviter = await verifyUser(req);

    // 2. SECURITY: Verify the inviter has the correct role.
    const { data: profile, error: profileError } = await supaAdmin
      .from('profiles')
      .select('role')
      .eq('id', inviter.id)
      .single();
    
    if (profileError || !profile) {
        throw new Error('Could not verify inviter role.');
    }

    if (profile.role !== 'admin' && profile.role !== 'investor') {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to invite investors.' });
    }
    
    // 3. Proceed with invitation logic.
    const { email: invitee_email } = req.body;
    if (!invitee_email || typeof invitee_email !== 'string') {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    
    const { error: insertError } = await supaAdmin
      .from('investor_invites')
      .insert({
        inviter_id: inviter.id,
        invitee_email: invitee_email,
        status: 'sent',
      });

    if (insertError) {
      if (insertError.code === '23505') { 
        return res.status(409).json({ error: `You have already invited ${invitee_email}.` });
      }
      throw insertError;
    }

    const { error: inviteError } = await supaAdmin.auth.admin.inviteUserByEmail(invitee_email);

    if (inviteError) {
      if (inviteError.message.includes('User already registered')) {
          await supaAdmin.from('investor_invites').delete().match({ inviter_id: inviter.id, invitee_email: invitee_email });
          return res.status(409).json({ error: 'A user with this email already exists.' });
      }
      throw inviteError;
    }

    return res.status(200).json({ success: true, message: `Invite successfully sent to ${invitee_email}.` });

  } catch (error: any) {
    console.error('Error in investor invite endpoint:', error);
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) return res.status(401).json({ error: message });
    return res.status(500).json({ error: message });
  }
}
