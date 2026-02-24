// FILE: api/investor/request-meeting.ts
// Meeting request endpoint for investor portal
//
// SECURITY: Dual-path auth (admin JWT or invite token)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin.js';
import { verifyInvestorAccess, setInvestorCORS } from '../_lib/investorAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setInvestorCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const access = await verifyInvestorAccess(req);

    const { fullName, email, company, message } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({ error: 'Full name and email are required.' });
    }

    const { error } = await supaAdmin
      .from('investor_leads')
      .insert({
        full_name: fullName,
        email: email,
        company: company || null,
        message: message || null,
        source: access.accessType, // Track whether admin or token-holder
      });

    if (error) {
      console.error('Supabase insert error:', error);
      throw new Error('Failed to submit request to the database.');
    }

    return res.status(200).json({ success: true, message: 'Your meeting request has been submitted successfully.' });

  } catch (error: any) {
    const msg = error.message || 'An unexpected error occurred.';
    if (msg.includes('Authentication') || msg.includes('Authorization')) {
      return res.status(401).json({ error: msg });
    }
    console.error('Error in request-meeting handler:', msg);
    return res.status(500).json({ error: msg });
  }
}