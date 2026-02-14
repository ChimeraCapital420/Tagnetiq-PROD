// FILE: api/oracle/visual-memory.ts
// Oracle Eyes API — capture, recall, forget visual memories
//
// Sprint M: Oracle Eyes
//
// Endpoints (single handler, action-based):
//   POST { action: 'capture', image: "base64...", ... }  → Store a manual memory (Tier 2)
//   POST { action: 'recall', question: "where are..." }  → Search memories
//   POST { action: 'forget', memoryId: "..." }           → Forget a specific memory
//   POST { action: 'forget_query', query: "..." }        → Forget memories matching query
//   POST { action: 'list' }                              → List recent memories
//
// All actions require authentication.
// Tier 2 capture (manual) is gated to Pro+ tier.
// Recall is available to all tiers (you can always ask).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import { getUserTier, hasFeature } from '../../src/lib/oracle/tier.js';
import {
  captureManual,
  forgetMemory,
  forgetByQuery,
  recallMemories,
} from '../../src/lib/oracle/eyes/index.js';

export const config = {
  maxDuration: 20,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { action } = req.body;

    if (!action || typeof action !== 'string') {
      return res.status(400).json({ error: 'An "action" string is required.' });
    }

    switch (action) {
      // ── CAPTURE (Tier 2: Manual "remember this") ──────
      case 'capture': {
        // Gate to Pro+ tier
        const tier = await getUserTier(supabaseAdmin, user.id);
        if (!hasFeature(tier, 'oracle_eyes')) {
          return res.status(403).json({
            error: 'oracle_eyes_locked',
            message: 'Oracle Eyes is available on Pro and Elite plans.',
            upgradeCta: 'Upgrade to let Oracle remember what you see.',
          });
        }

        const { image, deviceCaption, location, locationHint, source, tags } = req.body;

        const result = await captureManual(supabaseAdmin, user.id, {
          imageBase64: image,
          deviceCaption,
          location,
          locationHint,
          source: source || 'phone_camera',
          tags,
        });

        return res.status(200).json({
          success: true,
          memory: result,
        });
      }

      // ── RECALL (All tiers) ────────────────────────────
      case 'recall': {
        const { question, searchTerms, timeRange, location: queryLocation, limit } = req.body;

        if (!question || typeof question !== 'string') {
          return res.status(400).json({ error: 'A "question" string is required for recall.' });
        }

        const results = await recallMemories(supabaseAdmin, user.id, {
          question,
          searchTerms,
          timeRange,
          location: queryLocation,
          limit: Math.min(limit || 10, 20),
        });

        return res.status(200).json({
          success: true,
          results,
        });
      }

      // ── FORGET (specific memory) ─────────────────────
      case 'forget': {
        const { memoryId } = req.body;

        if (!memoryId || typeof memoryId !== 'string') {
          return res.status(400).json({ error: 'A "memoryId" is required.' });
        }

        const forgotten = await forgetMemory(supabaseAdmin, user.id, memoryId);

        return res.status(200).json({
          success: forgotten,
          message: forgotten ? 'Memory forgotten.' : 'Memory not found or already forgotten.',
        });
      }

      // ── FORGET BY QUERY ───────────────────────────────
      case 'forget_query': {
        const { query } = req.body;

        if (!query || typeof query !== 'string') {
          return res.status(400).json({ error: 'A "query" string is required.' });
        }

        const count = await forgetByQuery(supabaseAdmin, user.id, query);

        return res.status(200).json({
          success: true,
          forgottenCount: count,
          message: count > 0
            ? `Forgot ${count} memor${count === 1 ? 'y' : 'ies'}.`
            : 'No matching memories found.',
        });
      }

      // ── LIST (recent memories) ────────────────────────
      case 'list': {
        const page = Math.max(1, Number(req.body.page) || 1);
        const pageSize = Math.min(30, Math.max(1, Number(req.body.limit) || 20));
        const offset = (page - 1) * pageSize;

        const { data: memories, error, count } = await supabaseAdmin
          .from('oracle_visual_memory')
          .select('id, mode, description, objects, tags, location_hint, observed_at, source, analysis_id', { count: 'exact' })
          .eq('user_id', user.id)
          .is('forgotten_at', null)
          .order('observed_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) {
          throw new Error(`Failed to fetch memories: ${error.message}`);
        }

        return res.status(200).json({
          success: true,
          memories: memories || [],
          pagination: {
            page,
            limit: pageSize,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / pageSize),
          },
        });
      }

      default:
        return res.status(400).json({ error: `Unknown action: "${action}"` });
    }
  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Visual memory error:', errMsg);
    return res.status(500).json({ error: 'Oracle Eyes encountered an error. Try again.' });
  }
}