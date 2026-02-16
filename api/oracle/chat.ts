// FILE: api/oracle/chat.ts
// Oracle Chat Handler — ORCHESTRATION ONLY
//
// All business logic lives in src/lib/oracle/:
//   identity/   → Oracle CRUD, name ceremony, AI DNA
//   personality/ → Evolution via LLM, energy detection, character
//   prompt/      → System prompt builder + all context sections
//   chips/       → Dynamic quick chips
//   tier.ts      → Tier gating + message counting
//   providers/   → Multi-provider routing + calling
//   argos/       → Alerts, hunt, push, watchlist
//   safety/      → Privacy & safety guardian
//   eyes/        → Visual memory capture + recall
//   nexus/       → Decision tree (post-scan flow)
//   memory/      → Long-term memory compression + retrieval (Sprint N)
//   trust/       → Trust score tracking (Sprint N)
//   voice-profile/ → User writing style analysis (Sprint N)
//
// Sprint C:   Identity, name ceremony, personality evolution
// Sprint C.1: AI DNA (provider affinity → personality)
// Sprint D:   Tier-gated Oracle
// Sprint F:   Provider registry + hot-loading
// Sprint G+:  Argos integration
// Sprint K:   True Oracle — full-spectrum knowledge
// Sprint L:   Privacy & safety — crisis detection, care responses
// Sprint M:   Oracle Eyes — visual memory recall in chat + Nexus decision tree
// Sprint N:   Memory, trust, energy, seasonal, content creation
// Sprint N+:  Persistent voice character (catchphrases, running jokes, callbacks)

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

import type { BuildPromptParams } from '../../src/lib/oracle/prompt/builder.js';
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

// ── Oracle Eyes (Sprint M) ──────────────────────────────
import { recallMemories, buildRecallPromptBlock } from '../../src/lib/oracle/eyes/index.js';

// ── Memory, Trust, Energy (Sprint N) ────────────────────
import {
  getRelevantMemories,
  getExpertiseLevel,
  getUnfulfilledPromises,
  getAggregatedInterests,
  shouldCompress,
  compressConversation,
} from '../../src/lib/oracle/memory/index.js';

import { getTrustMetrics, detectTrustSignals, recordTrustEvent } from '../../src/lib/oracle/trust/tracker.js';
import { detectEnergy, detectEnergyArc, detectExpertiseFromMessage } from '../../src/lib/oracle/personality/energy.js';

// ── Persistent Voice Character (Sprint N+) ──────────────
import { evolveCharacter } from '../../src/lib/oracle/personality/character.js';

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
// RECALL DETECTION
// =============================================================================

function isRecallQuestion(message: string): boolean {
  const lower = message.toLowerCase();

  const recallPatterns = [
    /where\s+(?:did|do|are|is|was|were)\s+(?:i|my|the)/,
    /where\s+(?:are|is)\s+my/,
    /where.*(?:put|leave|left|place|set|store)/,
    /what\s+(?:did|do)\s+(?:i|we)\s+(?:see|scan|capture|photograph|look at)/,
    /what\s+(?:was|were)\s+(?:in|on|at)\s+(?:the|my|that)/,
    /(?:find|seen|remember|recall)\s+my/,
    /have\s+you\s+seen/,
    /do\s+you\s+remember\s+(?:seeing|where|what|when)/,
    /what\s+(?:did|does|was)\s+(?:that|the)\s+(?:receipt|label|tag|document|paper|article|sign)/,
    /what(?:'s|\s+is)\s+in\s+(?:my|the)/,
    /show\s+me\s+(?:what|everything)\s+(?:you\s+)?(?:saw|see|remember)/,
  ];

  return recallPatterns.some(pattern => pattern.test(lower));
}

// =============================================================================
// VISUAL MEMORY CONTEXT BUILDER
// =============================================================================

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
      const textPreview = mem.extracted_text.length > 500
        ? mem.extracted_text.substring(0, 500) + '... [truncated]'
        : mem.extracted_text;
      context += `TEXT CONTENT: ${textPreview}\n`;
    }

    context += `SOURCE: ${mem.source || 'phone_camera'}\n\n`;
  }

  if (visualMemories.length >= 30) {
    context += '(Showing most recent 30 visual memories. Older ones exist but are not shown.)\n';
  }

  return context;
}

// =============================================================================
// CONTENT CREATION DETECTION
// =============================================================================

function isContentCreationRequest(message: string): { isCreation: boolean; mode?: string; platform?: string } {
  const lower = message.toLowerCase();

  // Listing detection
  const listingPatterns = [
    /(?:list|sell|post)\s+(?:this|my|that|the)\s+(?:on|to)\s+(ebay|mercari|poshmark|facebook|amazon|whatnot)/i,
    /(?:write|create|make|generate)\s+(?:a|me|my)?\s*(?:listing|description)/i,
    /(?:help me )?list\s+(?:this|it|my)/i,
  ];

  for (const pattern of listingPatterns) {
    const match = message.match(pattern);
    if (match) {
      const platform = match[1]?.toLowerCase() || 'ebay';
      return { isCreation: true, mode: 'listing', platform };
    }
  }

  // Video detection
  if (/(?:make|create|generate)\s+(?:a|me)?\s*video/i.test(lower)) {
    return { isCreation: true, mode: 'video' };
  }

  // Brag card detection
  if (/(?:brag|flex)\s*card/i.test(lower) || /(?:celebrate|show off)\s+(?:this|my)\s+(?:flip|sale|win)/i.test(lower)) {
    return { isCreation: true, mode: 'brag_card' };
  }

  return { isCreation: false };
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

    // ── 0. TIER GATE ─────────────────────────────────────
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

    // ── 0.5 SAFETY SCAN ─────────────────────────────────
    const safetyScan = scanMessage(message);

    // ── 0.6 ENERGY DETECTION (Sprint N) ──────────────────
    const currentEnergy = detectEnergy(message);

    // ── 0.7 TRUST SIGNAL DETECTION (Sprint N) ────────────
    const trustSignal = detectTrustSignals(message);

    // ── 0.8 RECALL DETECTION ─────────────────────────────
    const isRecall = isRecallQuestion(message);

    // ── 0.9 CONTENT CREATION DETECTION (Sprint N) ────────
    const contentDetection = isContentCreationRequest(message);

    // ── 1. Fetch ALL data in parallel ─────────────────────
    const historyLength = Array.isArray(conversationHistory) ? conversationHistory.length : 0;

    const [
      identity, scanResult, vaultResult, profileResult,
      argosData, privacySettings, recentSafety,
      visualMemoryResult, recallResult,
      // Sprint N: Memory, trust, expertise
      relevantMemories, expertiseLevel, trustMetrics,
      unfulfilledPromises, aggregatedInterests,
    ] = await Promise.all([
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
      // Visual memories
      supabaseAdmin
        .from('oracle_visual_memory')
        .select('id, mode, description, objects, extracted_text, location_hint, source, observed_at')
        .eq('user_id', user.id)
        .is('forgotten_at', null)
        .order('observed_at', { ascending: false })
        .limit(30)
        .then(res => res)
        .catch(() => ({ data: [], error: null })),
      // Active recall
      isRecall
        ? recallMemories(supabaseAdmin, user.id, { question: message }).catch(() => null)
        : Promise.resolve(null),
      // Sprint N: Long-term memory
      getRelevantMemories(user.id, message, 5).catch(() => []),
      getExpertiseLevel(user.id).catch(() => ({ level: 'learning', indicators: [], conversationsAnalyzed: 0 })),
      getTrustMetrics(user.id).catch(() => null),
      getUnfulfilledPromises(user.id).catch(() => []),
      getAggregatedInterests(user.id).catch(() => []),
    ]);

    const scanHistory = scanResult.data || [];
    const vaultItems = vaultResult.data || [];
    const profile = profileResult.data;
    const visualMemories = visualMemoryResult.data || [];

    // ── 1.5 Energy arc (needs conversation history) ──────
    let energyArc: string = 'steady';
    if (Array.isArray(conversationHistory) && conversationHistory.length >= 4) {
      energyArc = detectEnergyArc(conversationHistory);
    }

    // ── 1.6 Message-level expertise (supplements memory-based) ──
    const messageExpertise = detectExpertiseFromMessage(message, scanHistory.length);

    // ── 2. Build system prompt (Sprint N: enhanced params) ─
    const promptParams: BuildPromptParams = {
      identity,
      scanHistory,
      vaultItems,
      userProfile: profile,
      argosData,
      memories: relevantMemories,
      unfulfilledPromises,
      aggregatedInterests,
      expertiseLevel: expertiseLevel.conversationsAnalyzed >= 2 ? expertiseLevel : {
        level: messageExpertise.level,
        indicators: messageExpertise.indicators,
        conversationsAnalyzed: 0,
      },
      trustMetrics,
      energyArc: energyArc as any,
      currentEnergy,
    };

    let systemPrompt = buildSystemPrompt(promptParams);

    // Inject visual memory context
    if (visualMemories.length > 0) {
      systemPrompt += buildVisualMemoryContext(visualMemories);
    }

    // Inject active recall results
    if (recallResult && recallResult.memories.length > 0) {
      systemPrompt += buildRecallPromptBlock(recallResult);
    }

    // Inject safety context
    if (safetyScan.injectSafetyContext) {
      systemPrompt += buildSafetyPromptBlock(safetyScan);
    }

    if (recentSafety.hasRecentEvents) {
      systemPrompt += buildFollowUpBlock(recentSafety);
    }

    // ── 3. Route to best provider ─────────────────────────
    const routing = routeMessage(message, identity, {
      conversationLength: historyLength,
      userTier: access.tier.current,
    });

    // ── 4. Assemble conversation messages ─────────────────
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
      }).catch(() => {});
    }

    // ── 6.5 Trust signal recording (Sprint N) ─────────────
    if (trustSignal) {
      recordTrustEvent(user.id, trustSignal).catch(() => {});
    }

    // ── 7. Non-blocking background tasks ──────────────────
    checkForNameCeremony(supabaseAdmin, identity, responseText).catch(() => {});
    updateIdentityAfterChat(supabaseAdmin, identity, message, scanHistory).catch(() => {});
    evolvePersonality(openai, supabaseAdmin, identity, conversationHistory || []).catch(() => {});

    // Sprint N+: Evolve voice character (catchphrases, running jokes, callbacks)
    evolveCharacter(process.env.OPEN_AI_API_KEY!, supabaseAdmin, identity, conversationHistory || []).catch(() => {});

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

          // Sprint N: Check if conversation needs compression
          const msgCount = updatedMessages.length;
          if (msgCount >= 25 && msgCount % 10 === 0) {
            // Trigger compression in background (every 10 messages after 25)
            shouldCompress(user.id, activeConversationId, msgCount)
              .then(needsCompression => {
                if (needsCompression) {
                  compressConversation(user.id, activeConversationId!, updatedMessages).catch(() => {});
                }
              }).catch(() => {});
          }
        }
      } else {
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
      energy: currentEnergy,
      energyArc,
      recallUsed: !!(recallResult && recallResult.memories.length > 0),
      recallCount: recallResult?.memories.length || 0,
      // Content creation hint (so frontend can show appropriate UI)
      contentHint: contentDetection.isCreation ? contentDetection : undefined,
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
