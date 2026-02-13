// FILE: api/oracle/onboarding.ts
// Onboarding + Engagement API
//
// Sprint E: Tours, share prompts, daily digest, community moments
//
// AUTHENTICATED:
//   POST { action: 'tour_status' }                  → Current tour progress
//   POST { action: 'start_tour', tourId }            → Start a specific tour
//   POST { action: 'advance_step', stepId, tourId }  → Complete a tour step
//   POST { action: 'dismiss_tour', tourId }          → Don't show this tour again
//   POST { action: 'available_tours' }               → All tours and their status
//   POST { action: 'share_prompt', trigger, context } → Check for share prompt
//   POST { action: 'share_response', promptId, shared, platform }
//   POST { action: 'digest' }                        → Build daily digest
//   POST { action: 'moments', limit? }               → Community moments feed
//   POST { action: 'suggest_moment', ... }            → Submit a moment for review

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import {
  getTourProgress,
  advanceTourStep,
  dismissTour,
  startTour,
  getAvailableTours,
  shouldShowTour,
  TOURS,
} from '../../src/lib/onboarding/tour.js';
import {
  getSharePrompt,
  trackShareResponse,
  buildDailyDigest,
  getCommunityMoments,
  suggestCommunityMoment,
  type ShareTrigger,
} from '../../src/lib/onboarding/engagement.js';

export const config = {
  maxDuration: 15,
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
    const { action } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'An "action" is required.' });
    }

    switch (action) {
      // ── Tour status ───────────────────────────────────
      case 'tour_status': {
        const progress = await getTourProgress(supabaseAdmin, user.id);
        const shouldShow = await shouldShowTour(supabaseAdmin, user.id, 'first_visit');

        return res.status(200).json({
          ...progress,
          shouldShowFirstVisit: shouldShow,
          tourDefinition: shouldShow ? TOURS.first_visit : undefined,
        });
      }

      // ── Start a tour ──────────────────────────────────
      case 'start_tour': {
        const { tourId = 'first_visit' } = req.body;
        const tour = await startTour(supabaseAdmin, user.id, tourId);

        if (!tour) {
          return res.status(404).json({ error: `Tour "${tourId}" not found.` });
        }

        return res.status(200).json({ tour });
      }

      // ── Advance tour step ─────────────────────────────
      case 'advance_step': {
        const { stepId, tourId = 'first_visit' } = req.body;
        if (!stepId) return res.status(400).json({ error: '"stepId" required.' });

        const result = await advanceTourStep(supabaseAdmin, user.id, stepId, tourId);
        return res.status(200).json(result);
      }

      // ── Dismiss tour ──────────────────────────────────
      case 'dismiss_tour': {
        const { tourId: dismissId = 'first_visit' } = req.body;
        await dismissTour(supabaseAdmin, user.id, dismissId);
        return res.status(200).json({ success: true, message: "Tour won't show again." });
      }

      // ── Available tours ───────────────────────────────
      case 'available_tours': {
        const tours = await getAvailableTours(supabaseAdmin, user.id);
        return res.status(200).json({ tours });
      }

      // ── Share prompt ──────────────────────────────────
      case 'share_prompt': {
        const { trigger, context = {} } = req.body;
        if (!trigger) return res.status(400).json({ error: '"trigger" required.' });

        const prompt = await getSharePrompt(supabaseAdmin, user.id, trigger as ShareTrigger, context);
        return res.status(200).json({ prompt });
      }

      // ── Share response ────────────────────────────────
      case 'share_response': {
        const { promptId, shared = false, platform } = req.body;
        if (!promptId) return res.status(400).json({ error: '"promptId" required.' });

        await trackShareResponse(supabaseAdmin, promptId, shared, platform);
        return res.status(200).json({ success: true });
      }

      // ── Daily digest ──────────────────────────────────
      case 'digest': {
        const digest = await buildDailyDigest(supabaseAdmin, user.id);
        return res.status(200).json(digest);
      }

      // ── Community moments ─────────────────────────────
      case 'moments': {
        const { limit = 20 } = req.body;
        const moments = await getCommunityMoments(supabaseAdmin, limit);
        return res.status(200).json({ moments, count: moments.length });
      }

      // ── Suggest a moment ──────────────────────────────
      case 'suggest_moment': {
        const { type: momentType, headline, description: desc, category: cat, valueFound, valuePaid } = req.body;
        if (!momentType || !headline) {
          return res.status(400).json({ error: '"type" and "headline" required.' });
        }

        const momentId = await suggestCommunityMoment(supabaseAdmin, user.id, {
          type: momentType,
          headline,
          description: desc,
          category: cat,
          valueFound,
          valuePaid,
        });

        return res.status(200).json({
          success: !!momentId,
          momentId,
          message: 'Submitted for review. If approved, it will appear anonymized in the community feed.',
        });
      }

      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid: tour_status, start_tour, advance_step, dismiss_tour, available_tours, share_prompt, share_response, digest, moments, suggest_moment`,
        });
    }

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Onboarding API error:', errMsg);
    return res.status(500).json({ error: errMsg });
  }
}