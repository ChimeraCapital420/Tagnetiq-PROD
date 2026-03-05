// api/nexus/feedback.ts
// Logs user feedback on analysis accuracy to analysis_feedback table.
// Data feeds Judicium weighted consensus engine.
//
// v1.1: CI Engine — 4+ star ratings fire recordConfirmation() fire-and-forget.
//   item_context accepted in body (itemName, category, estimatedValue,
//   hydraConsensus). Client already has this data from the analysis result.
//   Server never awaits confirmation write — user response is unaffected.

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin.js';
import { verifyUser } from '../_lib/security.js';
// v1.1: CI Engine positive signal
import { recordConfirmation } from '../../src/lib/hydra/knowledge/index.js';

/**
 * POST /api/nexus/feedback
 *
 * Body:
 *   analysis_id  string   required
 *   rating       number   required (1–5)
 *   comments     string   optional
 *   item_context object   optional — enables CI Engine confirmation on 4+ stars
 *     itemName        string
 *     category        string
 *     estimatedValue  number
 *     hydraConsensus  object  { votes, agreementScore }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const user = await verifyUser(req);
    const { analysis_id, rating, comments, item_context } = req.body;

    // --- Validation ---
    if (!analysis_id || typeof rating !== 'number') {
      return res.status(400).json({
        error: 'Invalid request body. Required: analysis_id (string) and rating (number).',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    // --- Database Insertion ---
    const { data, error } = await supaAdmin
      .from('analysis_feedback')
      .insert([
        {
          analysis_id,
          user_id: user.id,
          accuracy_rating: rating,
          user_comments: comments || null,
        },
      ])
      .select('id');

    if (error) {
      console.error('Supabase error inserting analysis feedback:', error);
      return res.status(500).json({
        error: 'Failed to log analysis feedback.',
        details: error.message,
      });
    }

    console.log('Successfully logged analysis feedback:', data);

    // =========================================================================
    // v1.1: CI ENGINE — Positive confirmation signal
    //
    // 4+ stars = "HYDRA got this right." Record anonymously so the pattern
    // aggregator can weigh confirmations alongside corrections.
    //
    // 5★ = confidence 0.95 (explicit: user is saying this is excellent)
    // 4★ = confidence 0.85 (implicit: user is satisfied)
    // 1–3★ = no confirmation recorded (neutral to negative — not a trust signal)
    //
    // Fire-and-forget: .catch() ensures any DB failure is completely silent
    // to the user. The feedback response is ALREADY sent above.
    //
    // item_context is optional — if the client didn't send it, we skip
    // gracefully. The feedback still saves; we just lose the CI signal.
    // =========================================================================
    if (rating >= 4 && item_context?.itemName && item_context?.category) {
      recordConfirmation({
        itemName: item_context.itemName,
        category: item_context.category,
        estimatedValue: item_context.estimatedValue ?? null,
        providerVotes: item_context.hydraConsensus?.votes ?? null,
        consensusAgreement: item_context.hydraConsensus?.agreementScore ?? null,
        confirmationSource: 'user_rating',
        rating,
      }).catch(err =>
        console.warn('[CI-Engine] Confirmation recording failed (non-fatal):', err)
      );
    }

    return res.status(201).json({ success: true, feedback_id: data[0].id });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Unexpected error in /api/nexus/feedback:', message);
    return res.status(500).json({ error: message });
  }
}