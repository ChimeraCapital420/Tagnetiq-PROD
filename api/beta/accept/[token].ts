// FILE: api/beta/accept/[token].ts
import { supaAdmin } from '../../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing token.' });
  }

  try {
    // Look up the beta invite by token
    const { data: invite, error: inviteError } = await supaAdmin
      .from('beta_invites')
      .select('*')
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      console.error('Beta invite lookup error:', inviteError);
      return res.status(404).json({ error: 'Invite not found or invalid.' });
    }

    // Check if invite is already accepted
    if (invite.accepted_at) {
      return res.status(400).json({ 
        error: 'This invite has already been accepted.',
        accepted_at: invite.accepted_at
      });
    }

    // Check if invite is expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This invite has expired.' });
    }

    // Check if invite is revoked
    if (invite.revoked) {
      return res.status(410).json({ error: 'This invite has been revoked.' });
    }

    // Mark the invite as accepted
    const { error: updateError } = await supaAdmin
      .from('beta_invites')
      .update({ 
        accepted_at: new Date().toISOString(),
        accepted_ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
        accepted_ua: req.headers['user-agent'] || null
      })
      .eq('id', invite.id);

    if (updateError) {
      console.error('Error updating beta invite:', updateError);
      return res.status(500).json({ error: 'Failed to accept invite.' });
    }

    // Log the acceptance event
    await supaAdmin.from('beta_events').insert({
      invite_id: invite.id,
      event_type: 'invite_accepted',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      ua: req.headers['user-agent'],
      metadata: { token }
    }).catch(err => {
      // Don't fail if event logging fails
      console.warn('Failed to log beta acceptance event:', err);
    });

    // Redirect to signup/onboarding or return success
    if (req.method === 'GET') {
      // Browser redirect
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173';
      
      return res.redirect(302, `${baseUrl}/signup?beta_token=${token}&email=${encodeURIComponent(invite.email || '')}`);
    }

    // API response
    return res.status(200).json({ 
      success: true, 
      message: 'Beta invite accepted successfully.',
      email: invite.email,
      invite_id: invite.id
    });

  } catch (error: any) {
    console.error('Error accepting beta invite:', error);
    return res.status(500).json({ 
      error: error.message || 'An unexpected error occurred.' 
    });
  }
}