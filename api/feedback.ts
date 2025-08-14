// FILE: api/feedback.ts
// Endpoint for submitting feedback from within the app.

import { supaAdmin } from '../../src/lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // TODO: Add user authentication check
  const { tester_id, category, severity, message, screenshot_url, app_version, route, device, flags } = req.body;
  
  try {
    const { error } = await supaAdmin.from('feedback').insert({
      tester_id, category, severity, message, screenshot_url, app_version, route, device, flags, status: 'new'
    });
    if (error) throw error;
    return res.status(201).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
}