// FILE: api/feedback.ts

import { supaAdmin } from './_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from './_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { tester_id, ...feedbackData } = req.body;

    // Ensure the user submitting feedback is the authenticated user
    if (user.id !== tester_id) {
      return res.status(403).json({ error: 'User ID mismatch. Cannot submit feedback for another user.' });
    }

    const { error } = await supaAdmin.from('feedback').insert({
      tester_id: user.id,
      ...feedbackData,
    });

    if (error) throw error;

    return res.status(201).json({ success: true, message: 'Feedback submitted successfully.' });
  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error submitting feedback:', message);
    return res.status(500).json({ error: message });
  }
}