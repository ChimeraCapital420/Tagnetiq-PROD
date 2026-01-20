// FILE: api/investor/request-meeting.ts (CREATE THIS NEW FILE)

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { fullName, email, company, message } = req.body;

  if (!fullName || !email) {
    return res.status(400).json({ error: 'Full name and email are required.' });
  }

  try {
    const { error } = await supaAdmin
      .from('investor_leads')
      .insert({
        full_name: fullName,
        email: email,
        company: company || null,
        message: message || null,
      });

    if (error) {
        // Handle potential database errors, like unique constraint violations if any
        console.error('Supabase insert error:', error);
        throw new Error('Failed to submit request to the database.');
    }

    // Optionally, you could trigger an email notification to yourself here.

    return res.status(200).json({ success: true, message: 'Your meeting request has been submitted successfully.' });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error in request-meeting handler:', errorMessage);
    return res.status(500).json({ error: errorMessage });
  }
}