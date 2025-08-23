// FILE: api/investors/invite.ts

import { supaAdmin } from '../_lib/supaAdmin';
import { createSignature } from '../_lib/crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import QRCode from 'qrcode'; // Import the new library
import { verifyUserIsAdmin } from '../_lib/security'; // CORRECTED: Import admin verification

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // SECURITY: Verify the user is an admin before proceeding.
    await verifyUserIsAdmin(req);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { name, email, company, expires_at, mode } = req.body;

    if (!name || !email || !expires_at || !mode) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    let { data: investor, error: investorError } = await supaAdmin
      .from('investors')
      .select('id')
      .eq('email', email)
      .single();

    if (investorError && investorError.code !== 'PGRST116') {
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

    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173';
    const signedUrl = `${baseUrl}/investor?token=${token}`;
    const pixelSignature = createSignature(invite.id);
    const pixelUrl = `${baseUrl}/api/pixel?i=${invite.id}&sig=${pixelSignature}`;

    const qrCodeDataUrl = await QRCode.toDataURL(signedUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        scale: 6,
        color: {
            dark: '#0A0A0A',
            light: '#F5F5F5'
        }
    });


    return res.status(200).json({
      success: true,
      inviteId: invite.id,
      signedUrl,
      pixelUrl,
      qrCodeDataUrl,
    });

  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('Authorization')) {
        return res.status(403).json({ error: message });
    }
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    console.error(error);
    return res.status(500).json({ error: message });
  }
}