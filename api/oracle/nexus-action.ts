// FILE: api/oracle/nexus-action.ts
// Nexus Decision Action API — log what the user chose after Oracle's suggestion
//
// Sprint M: Oracle-guided post-scan flow
//
// Called when user taps an action in the Nexus decision UI:
//   POST { analysisId: "...", action: "listed", nudgeType: "list_now" }
//
// This data powers Oracle's learning: was the suggestion helpful?

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';

export const config = {
  maxDuration: 10,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { analysisId, action, nudgeType } = req.body;

    if (!analysisId || !action) {
      return res.status(400).json({ error: '"analysisId" and "action" are required.' });
    }

    // Update existing log entry (created during scan) with user's choice
    const { error: updateError } = await supabaseAdmin
      .from('nexus_decision_log')
      .update({
        user_action: action,
        user_chose_at: new Date().toISOString(),
      })
      .eq('analysis_id', analysisId)
      .eq('user_id', user.id);

    // If no existing entry (scan didn't log one), create one
    if (updateError) {
      await supabaseAdmin.from('nexus_decision_log').insert({
        user_id: user.id,
        analysis_id: analysisId,
        nudge_type: nudgeType || 'unknown',
        user_action: action,
        user_chose_at: new Date().toISOString(),
      });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    const errMsg = error.message || 'Unexpected error';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    // Non-critical — don't fail the user
    return res.status(200).json({ success: true, logged: false });
  }
}