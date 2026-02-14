// FILE: api/oracle/chat.ts
// Oracle Chat Handler — ORCHESTRATION ONLY
//
// All business logic lives in src/lib/oracle/:
//   identity/   → Oracle CRUD, name ceremony, AI DNA
//   personality/ → Evolution via LLM, energy detection
//   prompt/      → System prompt builder + all context sections
//   chips/       → Dynamic quick chips
//   tier.ts      → Sprint D: Tier gating + message counting
//   providers/   → Sprint F: Multi-provider routing + calling
//   argos/       → Sprint G/H/I/J: Alerts, hunt, push, watchlist
//   safety/      → Sprint L: Privacy & safety guardian
//
// Sprint C:   Identity, name ceremony, personality evolution
// Sprint C.1: AI DNA (provider affinity → personality)
// Sprint D:   Tier-gated Oracle
// Sprint F:   Provider registry + hot-loading
// Sprint G+:  Argos integration
// Sprint K:   True Oracle — full-spectrum knowledge
// Sprint L:   Privacy & safety — crisis detection, care responses
// Sprint M:   Oracle Eyes — visual memory recall in chat

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';

// ── Oracle Modules ──────────────────────────────────────
import {
  getOrCreateIdentity,
  updateIdentityAfterChat,
  checkForNameCeremony,
  buildSystemPrompt,
  getQuickChips,
  evolvePersonality,
} from '../../src/lib/oracle/index.js';

import { checkOracleAccess } from '../../src/lib/oracle/tier.js';
import { routeMessage, callOracle } from '../../src/lib/oracle/providers/index.js';
import type { OracleMessage } from '../../src/lib/oracle/providers/index.js';
import { fetchArgosContext } from '../../src/lib/oracle/prompt/argos-context.js';

// ── Safety & Privacy (Sprint L) ─────────────────────────
import {
  scanMessage,
  buildSafetyPromptBlock,
  logSafetyEvent,
  getRecentSafetyContext,
  buildFollowUpBlock,
  getPrivacySettings,
} from '../../src/lib/oracle/safety/index.js';

export const config = {
  maxDuration: 30,
};

// ── Clients ─────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// TITLE GENERATOR
// =============================================================================

function generateTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\n/g, ' ');
  if (clean.length <= 50) return clean;
  return clean.substring(0, 47) + '...';
}

// =============================================================================
// VISUAL MEMORY CONTEXT BUILDER (Sprint M: Oracle Eyes)
// =============================================================================

/**
 * Build a system prompt section from Oracle's visual memories.
 * Enables recall: "where did I leave my keys?", "what did that article say?"
 * Only includes non-forgotten memories from the last 7 days by default.
 */
function buildVisualMemoryContext(visualMemories: any[]): string {
  if (!visualMemories || visualMemories.length === 0) return '';

  let context = '\n\n## ORACLE VISUAL MEMORY — What You Have Seen\n';
  context += 'You have visual memories from looking through the user\'s camera/glasses. ';
  context += 'Use these to answer questions like "where did I put X?", "what did that article say?", ';
  context += '"what was in that room?". Reference specific details — timestamps, positions, descriptions.\n\n';

  for (const mem of visualMemories) {
    const when = new Date(mem.observed_at).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

    context += `---\n`;
    context += `SEEN: ${when}\n`;
    context += `MODE: ${mem.mode}\n`;
    context += `DESCRIPTION: ${mem.description}\n`;

    if (mem.location_hint) {
      context += `LOCATION: ${mem.location_hint}\n`;
    }

    if (mem.objects && Array.isArray(mem.objects) && mem.objects.length > 0) {
      context += `OBJECTS: ${mem.objects.map((o: any) =>
        `${o.name}${o.position_hint ? ` [${o.position_hint}]` : ''}${o.estimated_value ? ` ~$${o.estimated_value}` : ''}`
      ).join(', ')}\n`;
    }

    if (mem.extracted_text) {
      // Truncate long text but keep enough for recall
      const textPreview = mem.extracted_text.length > 500
        ? mem.extracted_text.substring(0, 500) + '... [truncated]'
        : mem.extracted_text;
      context += `TEXT CONTENT: ${textPreview}\n`;
    }

    context += `SOURCE: ${mem.source || 'phone_camera'}\n`;
    context += '\n';
  }

  if (visualMemories.length >= 30) {
    context += '(Showing most recent 30 visual memories. Older ones exist but are not shown.)\n';
  }

  return context;
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { message, conversationHistory, conversationId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'A valid "message" string is required.' });
    }

    // ── 0. TIER GATE — check access before anything expensive ──
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

    // ── 0.5 SAFETY SCAN — pre-scan message for crisis signals ──
    // Runs in microseconds (regex only, no LLM call).
    // If signal detected, safety context is injected into system prompt.
    const safetyScan = scanMessage(message);

    // ── 1. Fetch ALL data in parallel ─────────────────────
    const [identity, scanResult, vaultResult, profileResult, argosData, privacySettings, recentSafety, visualMemoryResult] = await Promise.all([
      getOrCreateIdentity(supabaseAdmin, user.id),
      supabaseAdmin
        .from('analysis_history')
        .select('id, item_name, estimated_value, category, confidence, decision, created_at, analysis_result, consensus_data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('vault_items')
        .select('id, item_name, estimated_value, category, condition, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseAdmin
        .from('profiles')
        .select('display_name, settings')
        .eq('id', user.id)
        .single(),
      fetchArgosContext(supabaseAdmin, user.id),
      getPrivacySettings(supabaseAdmin, user.id).catch(() => null),
      getRecentSafetyContext(supabaseAdmin, user.id).catch(() => ({
        hasRecentEvents: false,
        lastEventType: null,
        daysSinceLastEvent: null,
      })),
      // ── Sprint M: Oracle Eyes — fetch visual memories for recall ──
      supabaseAdmin
        .from('oracle_visual_memory')
        .select('id, mode, description, objects, extracted_text, location_hint, source, observed_at')
        .eq('user_id', user.id)
        .is('forgotten_at', null)
        .order('observed_at', { ascending: false })
        .limit(30)
        .then(res => res)
        .catch(() => ({ data: [], error: null })),  // Graceful: table may not exist yet
    ]);

    const scanHistory = scanResult.data || [];
    const vaultItems = vaultResult.data || [];
    const profile = profileResult.data;
    const visualMemories = visualMemoryResult.data || [];

    // ── 2. Build system prompt ────────────────────────────
    // Base prompt (includes Argos context from G+)
    let systemPrompt = buildSystemPrompt(identity, scanHistory, vaultItems, profile, argosData);

    // Inject visual memory context (Sprint M: Oracle Eyes)
    if (visualMemories.length > 0) {
      systemPrompt += buildVisualMemoryContext(visualMemories);
    }

    // Inject safety context if crisis signal detected
    if (safetyScan.injectSafetyContext) {
      systemPrompt += buildSafetyPromptBlock(safetyScan);
    }

    // Inject follow-up care if user had recent safety events
    if (recentSafety.hasRecentEvents) {
      systemPrompt += buildFollowUpBlock(recentSafety);
    }

    // ── 3. Route to best provider ─────────────────────────
    const routing = routeMessage(message, identity, {
      conversationLength: Array.isArray(conversationHistory) ? conversationHistory.length : 0,
    });

    // ── 4. Assemble conversation messages ─────────────────
    // Respect privacy: if user disabled oracle memory, don't include history
    const includeHistory = privacySettings?.allow_oracle_memory !== false;

    const messages: OracleMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (includeHistory && Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-20);
      for (const turn of recentHistory) {
        if (turn.role === 'user' || turn.role === 'assistant') {
          messages.push({ role: turn.role, content: turn.content });
        }
      }
    }

    messages.push({ role: 'user', content: message });

    // ── 5. Call LLM via provider router ───────────────────
    const result = await callOracle(routing, messages);

    const responseText = result.text;
    if (!responseText) throw new Error('Oracle returned empty response');

    if (result.isFallback) {
      console.log(`Oracle routed: ${routing.reason} → FALLBACK to ${result.providerId} (${result.responseTime}ms)`);
    }

    // ── 6. Post-call safety logging ───────────────────────
    // Log safety event if signal was detected (does NOT store the user's message)
    if (safetyScan.shouldLog) {
      logSafetyEvent(supabaseAdmin, {
        user_id: user.id,
        conversation_id: conversationId || undefined,
        event_type: safetyScan.signal,
        severity: safetyScan.signal === 'crisis_signal' ? 'critical'
          : safetyScan.signal === 'harm_to_others' ? 'high'
          : 'moderate',
        action_taken: safetyScan.responseGuidance,
        resources_given: safetyScan.availableResources,
        trigger_category: safetyScan.category,
        oracle_response_excerpt: responseText.substring(0, 300),
      }).catch(() => {}); // Non-blocking
    }

    // ── 7. Non-blocking background tasks ──────────────────
    checkForNameCeremony(supabaseAdmin, identity, responseText).catch(() => {});
    updateIdentityAfterChat(supabaseAdmin, identity, message, scanHistory).catch(() => {});
    evolvePersonality(openai, supabaseAdmin, identity, conversationHistory || []).catch(() => {});

    // ── 8. Persist conversation ───────────────────────────
    const userMsg = { role: 'user', content: message, timestamp: Date.now() };
    const assistantMsg = { role: 'assistant', content: responseText, timestamp: Date.now() };

    let activeConversationId = conversationId || null;

    try {
      if (activeConversationId) {
        const { data: existing } = await supabaseAdmin
          .from('oracle_conversations')
          .select('messages')
          .eq('id', activeConversationId)
          .eq('user_id', user.id)
          .single();

        if (existing) {
          const updatedMessages = [...(existing.messages as any[]), userMsg, assistantMsg];
          await supabaseAdmin
            .from('oracle_conversations')
            .update({ messages: updatedMessages })
            .eq('id', activeConversationId);
        }
      } else {
        // New conversation — use user's default privacy level
        const defaultPrivacy = privacySettings?.default_privacy || 'private';

        const { data: newConvo } = await supabaseAdmin
          .from('oracle_conversations')
          .insert({
            user_id: user.id,
            title: generateTitle(message),
            messages: [userMsg, assistantMsg],
            scan_count_at_creation: scanHistory.length,
            is_active: true,
            privacy_level: defaultPrivacy,
          })
          .select('id')
          .single();

        activeConversationId = newConvo?.id || null;
      }
    } catch (convError: any) {
      console.warn('Conversation persistence failed (non-fatal):', convError.message);
    }

    // ── 9. Response ───────────────────────────────────────
    const quickChips = getQuickChips(scanHistory, vaultItems, identity);

    return res.status(200).json({
      response: responseText,
      conversationId: activeConversationId,
      quickChips,
      scanCount: scanHistory.length,
      vaultCount: vaultItems.length,
      memoryCount: visualMemories.length,
      oracleName: identity.oracle_name,
      tier: {
        current: access.tier.current,
        messagesUsed: access.usage.messagesUsed,
        messagesLimit: access.usage.messagesLimit,
        messagesRemaining: access.usage.messagesRemaining,
      },
      argos: {
        unreadAlerts: argosData.unreadCount,
        hasProactiveContent: argosData.hasProactiveContent,
      },
      _provider: {
        used: result.providerId,
        model: result.model,
        intent: routing.intent,
        responseTime: result.responseTime,
        isFallback: result.isFallback,
      },
    });

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Oracle chat error:', errMsg);
    return res.status(500).json({ error: 'Oracle is thinking too hard. Try again.' });
  }
}