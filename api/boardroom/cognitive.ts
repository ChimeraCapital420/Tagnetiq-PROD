// FILE: api/boardroom/cognitive.ts
// Sprint 8: Cognitive Dashboard API
//
// GET  → Full cognitive dashboard (room energy, routing, trust summary)
// POST → Cognitive pre-analysis for a specific message (routing + context)
//
// Used by:
//   - Sprint 7 frontend (EnergyIndicator, TrustMeter, ExpertiseRouter display)
//   - Boardroom chat endpoint (pre/post response hooks)
//   - Admin dashboard (trust overview, signal history)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getCognitiveDashboard, preResponse, type PreResponseInput } from '../../src/lib/boardroom/cognitive-bridge.js';
import { getMemberTrustProfile } from '../../src/lib/boardroom/board-trust.js';
import { routeQuestion, detectTopic } from '../../src/lib/boardroom/expertise-router.js';
import type { BoardMember } from '../../src/lib/boardroom/evolution.js';

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

// =============================================================================
// AUTH HELPER
// =============================================================================

async function verifyUser(req: VercelRequest): Promise<{ id: string }> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('No auth token');

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error('Invalid token');

  return { id: user.id };
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // Verify boardroom access
    const { data: access } = await supabaseAdmin
      .from('boardroom_access')
      .select('access_level')
      .eq('user_id', user.id)
      .single();

    if (!access) {
      return res.status(403).json({ error: 'Boardroom access required.' });
    }

    // ── GET: Full cognitive dashboard ────────────────────
    if (req.method === 'GET') {
      const message = req.query.message as string | undefined;
      const dashboard = await getCognitiveDashboard(supabaseAdmin, user.id, message);

      return res.status(200).json(dashboard);
    }

    // ── POST: Specific cognitive operations ──────────────
    if (req.method === 'POST') {
      const { action } = req.body;

      // Route a message to best-fit member
      if (action === 'route') {
        const { message } = req.body;
        if (!message) {
          return res.status(400).json({ error: 'Message required for routing.' });
        }

        const { data: members } = await supabaseAdmin
          .from('boardroom_members')
          .select('slug, name, title, role, ai_provider, trust_level, current_energy, expertise, total_interactions, cross_domain_assists, ai_dna, dominant_provider, personality, personality_evolution, system_prompt, evolved_prompt, ai_model, voice_style, provider_affinity, last_active_at')
          .order('display_order');

        const boardMembers = (members || []) as BoardMember[];
        const routing = routeQuestion(message, boardMembers);

        return res.status(200).json({
          routing,
          topic: detectTopic(message),
        });
      }

      // Get trust profile for a specific member
      if (action === 'trust_profile') {
        const { memberSlug } = req.body;
        if (!memberSlug) {
          return res.status(400).json({ error: 'memberSlug required.' });
        }

        const profile = await getMemberTrustProfile(supabaseAdmin, memberSlug);
        return res.status(200).json(profile);
      }

      // Detect topic from a message (lightweight)
      if (action === 'detect_topic') {
        const { message } = req.body;
        if (!message) {
          return res.status(400).json({ error: 'Message required.' });
        }

        const topic = detectTopic(message);
        return res.status(200).json(topic);
      }

      return res.status(400).json({ error: 'Unknown action. Use: route, trust_profile, detect_topic.' });
    }

    return res.status(405).json({ error: 'Method not allowed.' });

  } catch (err: any) {
    console.error('[cognitive] Error:', err.message);

    if (err.message.includes('auth') || err.message.includes('token')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    return res.status(500).json({ error: 'Internal server error.' });
  }
}