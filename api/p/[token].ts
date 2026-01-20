// FILE: api/p/[token].ts
// Public redirector that logs link clicks.

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).send('Invalid token.');
  }

  try {
    const { data: invite, error } = await supaAdmin
      .from('investor_invites')
      .select('id, expires_at, revoked')
      .eq('token', token)
      .single();

    if (error || !invite || invite.revoked || new Date() > new Date(invite.expires_at)) {
      return res.status(404).send('Invite not found or has expired.');
    }

    // Log the click event
    await supaAdmin.from('investor_events').insert({
      invite_id: invite.id,
      event_type: 'link_click',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      ua: req.headers['user-agent'],
    });

    // Set a cookie to identify the user on the portal page
    res.setHeader('Set-Cookie', `tq_invite_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`); // 1 day expiry

    // Redirect to the investor portal
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173';
    res.redirect(302, `${baseUrl}/investor`);

  } catch (error) {
    console.error(error);
    return res.status(500).send('An error occurred.');
  }
}