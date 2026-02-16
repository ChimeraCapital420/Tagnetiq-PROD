// FILE: api/oracle/introductions.ts
// Oracle-mediated user introductions — double opt-in, privacy-first
// Flow: Oracle notices overlap → asks User A → asks User B → connects if both agree
//
// GET  /api/oracle/introductions — get pending introductions for user
// POST /api/oracle/introductions — create or respond to introduction
//
// Privacy: No personal info shared until BOTH users explicitly consent

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  findPotentialMatches,
  createIntroduction,
  respondToIntroduction,
  getPendingIntroductions,
} from '../../src/lib/oracle/community/matchmaker.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// =============================================================================
// AUTH
// =============================================================================

async function verifyUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  return user;
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'GET') {
      return await handleGet(req, res, user.id);
    }

    if (req.method === 'POST') {
      return await handlePost(req, res, user.id);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err: any) {
    console.error('[Oracle/Introductions] Error:', err);
    return res.status(500).json({ error: 'Introduction service failed' });
  }
}

// =============================================================================
// GET — Pending introductions + potential matches
// =============================================================================

async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
) {
  const pending = await getPendingIntroductions(userId);
  const potentialMatches = await findPotentialMatches(userId, 3);

  return res.status(200).json({
    pending,
    suggestions: potentialMatches.map(match => ({
      sharedInterests: match.sharedInterests,
      matchReason: match.matchReason,
      compatibilityScore: match.compatibilityScore,
      // NO user ID or personal info exposed until consent
    })),
  });
}

// =============================================================================
// POST — Create or respond to introduction
// =============================================================================

async function handlePost(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
) {
  const { action } = req.body;

  switch (action) {
    case 'find_matches': {
      // Oracle asks: "Want me to find other collectors like you?"
      const matches = await findPotentialMatches(userId, 5);
      return res.status(200).json({
        matches: matches.map(m => ({
          sharedInterests: m.sharedInterests,
          matchReason: m.matchReason,
          compatibilityScore: m.compatibilityScore,
          matchId: m.matchUserId, // Internal only — not shown to user
        })),
        message: matches.length > 0
          ? `Found ${matches.length} collectors with similar interests!`
          : 'No strong matches found yet. Keep scanning and chatting — the Oracle learns!',
      });
    }

    case 'initiate': {
      // User says yes to connecting with a match
      const { matchId, sharedInterests, matchReason } = req.body;
      if (!matchId) {
        return res.status(400).json({ error: 'matchId required' });
      }

      const intro = await createIntroduction(userId, matchId, sharedInterests || [], matchReason || 'Shared collecting interests');
      if (!intro) {
        return res.status(500).json({ error: 'Failed to create introduction' });
      }

      // TODO: Trigger push notification to target user's Oracle
      // "Your Oracle has found someone who shares your interests..."

      return res.status(200).json({
        introduction: intro,
        message: 'Introduction sent! The other collector\'s Oracle will ask them if they\'re open to connecting.',
      });
    }

    case 'respond': {
      // Target user responds to introduction
      const { introId, accepted } = req.body;
      if (!introId || accepted === undefined) {
        return res.status(400).json({ error: 'introId and accepted required' });
      }

      const success = await respondToIntroduction(introId, userId, accepted);
      if (!success) {
        return res.status(400).json({ error: 'Failed to respond to introduction' });
      }

      if (accepted) {
        // TODO: Create shared conversation space or exchange usernames
        return res.status(200).json({
          message: 'Connection accepted! You can now find each other in the community.',
          status: 'accepted',
        });
      }

      return res.status(200).json({
        message: 'No worries — your privacy is maintained.',
        status: 'declined',
      });
    }

    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
