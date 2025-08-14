// FILE: api/investors/invite.ts
// Admin-only endpoint to create a new investor invite.

import { supaAdmin } from '../../src/lib/supaAdmin';
import { createSignature } from '../../src/lib/crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // TODO: Add proper admin authentication check here
  // For now, we will assume the request is authenticated.

  const { name, email, company, expires_at, mode } = req.body;

  if (!name || !email || !expires_at || !mode) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // 1. Create or find the investor
    let { data: investor, error: investorError } = await supaAdmin
      .from('investors')
      .select('id')
      .eq('email', email)
      .single();

    if (investorError && investorError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw investorError;
    }

    if (!investor) {
      const { data: newInvestor, error: newInvestorError } = await supaAdmin
        .from('investors')
        .insert({ name, email, company })
        .select('id')
        .single();
      if (newInvestorError) throw newInvestorError;
      investor = newInvestor;
    }

    // 2. Create the invite
    const token = `tq_${crypto.randomUUID()}`;
    const { data: invite, error: inviteError } = await supaAdmin
      .from('investor_invites')
      .insert({
        investor_id: investor.id,
        token,
        expires_at,
        mode,
      })
      .select('id')
      .single();

    if (inviteError) throw inviteError;

    // 3. Generate URLs
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173';
    const signedUrl = `${baseUrl}/investor?token=${token}`;
    const pixelSignature = createSignature(invite.id);
    const pixelUrl = `${baseUrl}/api/pixel?i=${invite.id}&sig=${pixelSignature}`;

    return res.status(200).json({
      success: true,
      inviteId: invite.id,
      signedUrl,
      pixelUrl,
      // QR code generation would happen here on the client or server
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: (error as Error).message });
  }
}