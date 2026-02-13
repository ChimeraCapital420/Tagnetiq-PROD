// FILE: api/oracle/hunt.ts
// Hunt Mode API — instant item triage from any device
//
// Sprint G: Argos Active Scanning
//
// POST /api/oracle/hunt
//   { image: "base64...", hint?: "estate sale", askingPrice?: 25, deviceType?: "glasses" }
//
// Returns:
//   { verdict: "BUY", itemName: "...", estimatedValue: {...}, reason: "...", ... }
//
// Optimized for speed: ~1 second response time.
// Works from phone camera, tablet camera, or smart glasses.
// Gated to Elite tier (bypassed in beta mode).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import { checkOracleAccess } from '../../src/lib/oracle/tier.js';
import { getOrCreateIdentity } from '../../src/lib/oracle/identity/manager.js';
import { huntTriage, huntBatch } from '../../src/lib/oracle/argos/index.js';

export const config = {
  maxDuration: 15, // Hunt mode should be FAST — 15s hard cap
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

    // ── Tier gate (counts as Oracle message) ──────────────
    const access = await checkOracleAccess(supabaseAdmin, user.id);

    if (!access.allowed) {
      return res.status(429).json({
        error: 'message_limit_reached',
        message: access.blockedReason,
        upgradeCta: access.upgradeCta,
        tier: {
          current: access.tier.current,
          messagesUsed: access.usage.messagesUsed,
          messagesLimit: access.usage.messagesLimit,
          messagesRemaining: 0,
        },
      });
    }

    const { image, images, hint, askingPrice, deviceType } = req.body;

    // ── Batch mode (multiple images from glasses sweep) ───
    if (Array.isArray(images) && images.length > 0) {
      const identity = await getOrCreateIdentity(supabaseAdmin, user.id);

      const results = await huntBatch(images, identity, {
        hint,
        deviceType: deviceType || 'unknown',
      });

      return res.status(200).json({
        mode: 'batch',
        results,
        count: results.length,
        tier: {
          current: access.tier.current,
          messagesUsed: access.usage.messagesUsed,
          messagesLimit: access.usage.messagesLimit,
          messagesRemaining: access.usage.messagesRemaining,
        },
      });
    }

    // ── Single image mode ─────────────────────────────────
    if (!image || typeof image !== 'string') {
      return res.status(400).json({
        error: 'An "image" (base64 string) or "images" (array) is required.',
      });
    }

    // Get identity for AI DNA routing influence
    const identity = await getOrCreateIdentity(supabaseAdmin, user.id);

    const result = await huntTriage(image, identity, {
      hint,
      askingPrice: askingPrice ? parseFloat(askingPrice) : undefined,
      deviceType: deviceType || 'unknown',
    });

    return res.status(200).json({
      mode: 'single',
      ...result,
      tier: {
        current: access.tier.current,
        messagesUsed: access.usage.messagesUsed,
        messagesLimit: access.usage.messagesLimit,
        messagesRemaining: access.usage.messagesRemaining,
      },
    });

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Hunt mode error:', errMsg);
    return res.status(500).json({
      verdict: 'SCAN',
      reason: 'Something went wrong — try a full scan instead.',
      error: 'Hunt mode hiccup. Try again.',
    });
  }
}