// FILE: api/beta/accept/[token].ts
// Handles a user clicking an invite link.

import { supaAdmin } from '../../src/lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { token } = req.query;
  if (!token || typeof token !== 'string') return res.status(400).send('Invalid invite token.');

  try {
    const { data: invite, error } = await supaAdmin.from('beta_invites').select('*').eq('token', token).single();
    if (error || !invite || invite.revoked || new Date() > new Date(invite.expires_at)) {
      return res.status(404).send('Invite not found or has expired.');
    }
    
    // Set cookie and redirect to sign-up page, pre-filling email
    res.setHeader('Set-Cookie', `tq_beta_invite=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173';
    res.redirect(302, `${baseUrl}/signup?email=${encodeURIComponent(invite.email)}`);

  } catch (error) {
    res.status(500).send('An error occurred.');
  }
}