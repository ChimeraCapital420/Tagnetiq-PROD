// FILE: api/beta/invite.ts
// Admin-only endpoint to create a new beta tester invite.

import { supaAdmin } from '../../src/lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  // TODO: Add robust admin auth check here.

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const token = `tq-beta-${crypto.randomUUID()}`;
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const { data: invite, error } = await supaAdmin
      .from('beta_invites')
      .insert({ email, token, expires_at })
      .select('id, token')
      .single();
    
    if (error) throw error;

    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173';
    const acceptUrl = `${baseUrl}/api/beta/accept/${invite.token}`;

    return res.status(200).json({ success: true, acceptUrl });

  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
}