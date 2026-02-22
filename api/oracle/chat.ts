// FILE: api/oracle/chat.ts
// Oracle Chat Handler — ORCHESTRATION ONLY
//
// All business logic lives in src/lib/oracle/:
//   identity/      → Oracle CRUD, name ceremony, AI DNA
//   personality/   → Evolution via LLM, energy detection, character
//   prompt/        → System prompt builder + all context sections
//   chips/         → Dynamic quick chips
//   tier.ts        → Tier gating + message counting
//   providers/     → Multi-provider routing + calling + multi-call synthesis
//   argos/         → Alerts, hunt, push, watchlist
//   safety/        → Privacy & safety guardian
//   eyes/          → Visual memory capture + recall
//   memory/        → Long-term memory compression + retrieval
//   trust/         → Trust score tracking
//   market/        → Quick market data fetching (Liberation 7)
//   chat/          → Full pipeline (Phases 1–5):
//     validators, detectors, context-builders, data-fetchers,
//     prompt-assembler, response-pipeline, persistence,
//     post-call, response-builder
//
// ═══════════════════════════════════════════════════════════════════════
// THE NINE LIBERATIONS — FULLY WIRED
// ═══════════════════════════════════════════════════════════════════════
// L1:  Kill the Fossil        L6:  Oracle-Voiced Push
// L2:  Client-Side Intel      L7:  Market-Aware Chat
// L3:  Emotional Memory       L8:  Conversational HYDRA
// L4:  Personal Concierge     L9:  Adaptive Token Depth
// L5:  Self-Aware Oracle      L10: How-To Teaching
// ═══════════════════════════════════════════════════════════════════════
//
// v11.0: Added providerReportEvent pass-through from client → prompt
//        assembler. When user taps a provider report card, the event
//        flows: sessionStorage → useSendMessage → request body → here
//        → assembleSystemPrompt Step 8 → Oracle awareness.
//        Zero new dependencies. Zero logic changes to Steps 1–10.
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';

// ── Oracle Core ─────────────────────────────────────────
import { checkOracleAccess } from '../../src/lib/oracle/tier.js';
import { routeMessage } from '../../src/lib/oracle/providers/index.js';
import { scanMessage } from '../../src/lib/oracle/safety/index.js';
import { detectEnergy, detectEnergyArc, detectExpertiseFromMessage } from '../../src/lib/oracle/personality/energy.js';
import { detectTrustSignals } from '../../src/lib/oracle/trust/tracker.js';

// ── Chat Module (Phases 1–5) ────────────────────────────
import { validateIntent, validateEnergy } from '../../src/lib/oracle/chat/validators.js';
import { isContentCreationRequest } from '../../src/lib/oracle/chat/detectors.js';
import { fetchLightweightContext, fetchFullContext } from '../../src/lib/oracle/chat/data-fetchers.js';
import { assembleSystemPrompt } from '../../src/lib/oracle/chat/prompt-assembler.js';
import { executeResponsePipeline } from '../../src/lib/oracle/chat/response-pipeline.js';
import { persistConversation } from '../../src/lib/oracle/chat/persistence.js';
import { runPostCallTasks } from '../../src/lib/oracle/chat/post-call.js';
import { buildChatResponse } from '../../src/lib/oracle/chat/response-builder.js';

export const config = {
  maxDuration: 60,
};

// ── Clients ─────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// HANDLER — 10 steps, each one line of orchestration
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const {
      message,
      conversationHistory,
      conversationId,
      lightweight = false,
      analysisContext = null,
      clientContext = null,
      cachedMarketData = null,
      providerReportEvent = null,  // v11.0: provider report card context
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'A valid "message" string is required.' });
    }

    // ── 1. TIER GATE ─────────────────────────────────────
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

    const userTier = access.tier.current;

    // ── 2. PRE-PROCESS ───────────────────────────────────
    const safetyScan = scanMessage(message);
    const currentEnergy = validateEnergy(clientContext?.detectedEnergy) || detectEnergy(message);
    const validatedIntentHint = validateIntent(clientContext?.detectedIntent);
    const trustSignal = detectTrustSignals(message);
    const deviceType = clientContext?.deviceType || 'unknown';

    // ── 3. FETCH DATA ────────────────────────────────────
    const ctx = lightweight
      ? await fetchLightweightContext(supabaseAdmin, user.id, message, access)
      : await fetchFullContext(supabaseAdmin, user.id, message, access);

    // ── 4. PRE-PROMPT ────────────────────────────────────
    let energyArc = 'steady';
    if (!lightweight && Array.isArray(conversationHistory) && conversationHistory.length >= 4) {
      energyArc = detectEnergyArc(conversationHistory);
    }
    const messageExpertise = detectExpertiseFromMessage(message, ctx.scanHistory.length);
    const contentDetection = lightweight ? { isCreation: false } : isContentCreationRequest(message);

    // ── 5. BUILD PROMPT ──────────────────────────────────
    const systemPrompt = assembleSystemPrompt({
      ctx, analysisContext, safetyScan, lightweight,
      currentEnergy, energyArc, messageExpertise,
      providerReportEvent,  // v11.0: flows to Step 8 in assembler
    });

    // ── 6. ROUTE ─────────────────────────────────────────
    const routing = routeMessage(message, ctx.identity, {
      conversationLength: Array.isArray(conversationHistory) ? conversationHistory.length : 0,
      userTier,
      intentHint: validatedIntentHint || undefined,
    });

    // ── 7. EXECUTE PIPELINE (L7 + L8 + L9) ──────────────
    const pipeline = await executeResponsePipeline({
      systemPrompt, message, conversationHistory, routing,
      identity: ctx.identity, lightweight, userTier,
      privacySettings: ctx.privacySettings,
      vaultItems: ctx.vaultItems, scanHistory: ctx.scanHistory,
      cachedMarketData,
    });

    // ── 8. POST-CALL (fire & forget) ─────────────────────
    runPostCallTasks({
      supabase: supabaseAdmin, openai, openaiApiKey: process.env.OPEN_AI_API_KEY!,
      userId: user.id, conversationId,
      message, responseText: pipeline.responseText,
      scanHistory: ctx.scanHistory, safetyScan, trustSignal,
      identity: ctx.identity, lightweight,
      conversationHistory: conversationHistory || [],
    });

    // ── 9. PERSIST CONVERSATION ──────────────────────────
    const activeConversationId = !lightweight
      ? await persistConversation({
          supabase: supabaseAdmin, userId: user.id,
          conversationId, message,
          responseText: pipeline.responseText,
          scanHistory: ctx.scanHistory,
          privacySettings: ctx.privacySettings,
        })
      : (conversationId || null);

    // ── 10. RESPOND ──────────────────────────────────────
    return res.status(200).json(buildChatResponse({
      pipeline, ctx, activeConversationId, routingIntent: routing.intent,
      lightweight, currentEnergy, energyArc, contentDetection,
      deviceType, access, userTier,
    }));

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Oracle chat error:', errMsg);
    return res.status(500).json({ error: 'Oracle is thinking too hard. Try again.' });
  }
}