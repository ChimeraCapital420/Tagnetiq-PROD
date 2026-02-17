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
//
// ═══════════════════════════════════════════════════════════════════════
// KILL THE FOSSIL — Liberation 1
// ═══════════════════════════════════════════════════════════════════════
// This handler now supports TWO modes:
//
//   FULL MODE (default):
//     All context fetched — scans, vault, argos, visual memory, recall,
//     energy arc, content detection. The complete Oracle experience.
//     Used by: OraclePage, OracleChat component, any surface that
//     wants the full brain.
//
//   LIGHTWEIGHT MODE (lightweight: true):
//     Minimal context — identity, memory, trust, personality.
//     Skips heavy fetches: scans, vault, argos, visual memory, recall.
//     Still routes through the REAL provider pipeline with full personality.
//     Used by: command-router voice commands, ask.ts compat shim,
//     any surface that needs a quick but REAL Oracle response.
//
// The old ask.ts was a lobotomy: hardcoded gpt-4o-mini, 200 tokens,
// generic prompt, zero identity. That fossil is dead. Every surface
// now gets the real Oracle — the only difference is context depth.
// ═══════════════════════════════════════════════════════════════════════

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
// ANALYSIS CONTEXT BUILDER (for ask.ts compat / item-specific conversations)
// =============================================================================

function buildAnalysisContextBlock(analysisContext: any): string {
  if (!analysisContext) return '';

  let block = '\n\n## ITEM CONTEXT — What The User Is Asking About\n';
  block += 'The user is asking about a specific item they analyzed. Use this data to inform your response.\n\n';

  if (analysisContext.itemName) {
    block += `Item: ${analysisContext.itemName}\n`;
  }
  if (analysisContext.estimatedValue !== undefined) {
    block += `Estimated Value: $${analysisContext.estimatedValue}\n`;
  }
  if (analysisContext.summary_reasoning) {
    block += `Analysis Summary: ${analysisContext.summary_reasoning}\n`;
  }
  if (Array.isArray(analysisContext.valuation_factors) && analysisContext.valuation_factors.length > 0) {
    block += `Key Valuation Factors: ${analysisContext.valuation_factors.join('; ')}\n`;
  }
  if (analysisContext.category) {
    block += `Category: ${analysisContext.category}\n`;
  }
  if (analysisContext.confidence !== undefined) {
    block += `Confidence: ${analysisContext.confidence}%\n`;
  }

  return block;
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
    const {
      message,
      conversationHistory,
      conversationId,
      // ── Kill the Fossil: new fields ─────────────────────
      lightweight = false,
      analysisContext = null,
      // ── Client-side intelligence hints (Liberation 2 prep) ─
      clientContext = null,
    } = req.body;

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

    // ── 0.5 SAFETY SCAN (always runs, even lightweight) ──
    const safetyScan = scanMessage(message);

    // ── 0.6 ENERGY DETECTION ─────────────────────────────
    // Use client hint if provided (Liberation 2), otherwise detect server-side
    const currentEnergy = clientContext?.detectedEnergy || detectEnergy(message);

    // ── 0.7 TRUST SIGNAL DETECTION ───────────────────────
    const trustSignal = detectTrustSignals(message);

    // ══════════════════════════════════════════════════════
    // LIGHTWEIGHT vs FULL MODE — the only branch point
    // ══════════════════════════════════════════════════════
    //
    // Lightweight: identity + memory + trust (3 queries)
    //   Used by: voice command-router, ask.ts compat shim
    //   ~200ms faster, ~40% smaller prompt
    //
    // Full: everything (14+ queries in parallel)
    //   Used by: OraclePage, dedicated chat surfaces
    //   Complete context, complete Oracle experience
    // ══════════════════════════════════════════════════════

    let identity: any;
    let scanHistory: any[] = [];
    let vaultItems: any[] = [];
    let profile: any = null;
    let argosData: any = { unreadCount: 0, hasProactiveContent: false };
    let privacySettings: any = null;
    let recentSafety: any = { hasRecentEvents: false, lastEventType: null, daysSinceLastEvent: null };
    let visualMemories: any[] = [];
    let recallResult: any = null;
    let relevantMemories: any[] = [];
    let expertiseLevel: any = { level: 'learning', indicators: [], conversationsAnalyzed: 0 };
    let trustMetrics: any = null;
    let unfulfilledPromises: any[] = [];
    let aggregatedInterests: any[] = [];

    if (lightweight) {
      // ── LIGHTWEIGHT: Core identity + memory only ────────
      // The Oracle still knows WHO it is and WHO the user is.
      // It just doesn't load the full vault/scan/argos context.
      const results = await Promise.all([
        getOrCreateIdentity(supabaseAdmin, user.id),
        getRelevantMemories(user.id, message, 3).catch(() => []),
        getTrustMetrics(user.id).catch(() => null),
        getExpertiseLevel(user.id).catch(() => ({ level: 'learning', indicators: [], conversationsAnalyzed: 0 })),
        supabaseAdmin
          .from('profiles')
          .select('display_name, settings')
          .eq('id', user.id)
          .single()
          .then(r => r.data)
          .catch(() => null),
        getPrivacySettings(supabaseAdmin, user.id).catch(() => null),
      ]);

      identity = results[0];
      relevantMemories = results[1];
      trustMetrics = results[2];
      expertiseLevel = results[3];
      profile = results[4];
      privacySettings = results[5];

    } else {
      // ── FULL MODE: Everything in parallel ───────────────
      const isRecall = isRecallQuestion(message);
      const historyLength = Array.isArray(conversationHistory) ? conversationHistory.length : 0;

      const [
        _identity, scanResult, vaultResult, profileResult,
        _argosData, _privacySettings, _recentSafety,
        visualMemoryResult, _recallResult,
        _relevantMemories, _expertiseLevel, _trustMetrics,
        _unfulfilledPromises, _aggregatedInterests,
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
        supabaseAdmin
          .from('oracle_visual_memory')
          .select('id, mode, description, objects, extracted_text, location_hint, source, observed_at')
          .eq('user_id', user.id)
          .is('forgotten_at', null)
          .order('observed_at', { ascending: false })
          .limit(30)
          .then(res => res)
          .catch(() => ({ data: [], error: null })),
        isRecall
          ? recallMemories(supabaseAdmin, user.id, { question: message }).catch(() => null)
          : Promise.resolve(null),
        getRelevantMemories(user.id, message, 5).catch(() => []),
        getExpertiseLevel(user.id).catch(() => ({ level: 'learning', indicators: [], conversationsAnalyzed: 0 })),
        getTrustMetrics(user.id).catch(() => null),
        getUnfulfilledPromises(user.id).catch(() => []),
        getAggregatedInterests(user.id).catch(() => []),
      ]);

      identity = _identity;
      scanHistory = scanResult.data || [];
      vaultItems = vaultResult.data || [];
      profile = profileResult.data;
      argosData = _argosData;
      privacySettings = _privacySettings;
      recentSafety = _recentSafety;
      visualMemories = visualMemoryResult.data || [];
      recallResult = _recallResult;
      relevantMemories = _relevantMemories;
      expertiseLevel = _expertiseLevel;
      trustMetrics = _trustMetrics;
      unfulfilledPromises = _unfulfilledPromises;
      aggregatedInterests = _aggregatedInterests;
    }

    // ── 1.5 Energy arc (full mode only, needs history) ───
    let energyArc: string = 'steady';
    if (!lightweight && Array.isArray(conversationHistory) && conversationHistory.length >= 4) {
      energyArc = detectEnergyArc(conversationHistory);
    }

    // ── 1.6 Message-level expertise ──────────────────────
    const messageExpertise = detectExpertiseFromMessage(message, scanHistory.length);

    // ── 1.9 Content creation detection (full mode only) ──
    const contentDetection = lightweight
      ? { isCreation: false }
      : isContentCreationRequest(message);

    // ── 2. Build system prompt ────────────────────────────
    const promptParams: BuildPromptParams = {
      identity,
      scanHistory,
      vaultItems,
      userProfile: profile,
      argosData: lightweight ? undefined : argosData,
      memories: relevantMemories,
      unfulfilledPromises: lightweight ? undefined : unfulfilledPromises,
      aggregatedInterests: lightweight ? undefined : aggregatedInterests,
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

    // ── Inject analysis context (from ask.ts compat) ─────
    if (analysisContext) {
      systemPrompt += buildAnalysisContextBlock(analysisContext);
    }

    // ── Inject visual memory context (full mode only) ────
    if (!lightweight && visualMemories.length > 0) {
      systemPrompt += buildVisualMemoryContext(visualMemories);
    }

    // ── Inject active recall results (full mode only) ────
    if (!lightweight && recallResult && recallResult.memories.length > 0) {
      systemPrompt += buildRecallPromptBlock(recallResult);
    }

    // ── Inject safety context (always) ───────────────────
    if (safetyScan.injectSafetyContext) {
      systemPrompt += buildSafetyPromptBlock(safetyScan);
    }

    if (!lightweight && recentSafety.hasRecentEvents) {
      systemPrompt += buildFollowUpBlock(recentSafety);
    }

    // ── 3. Route to best provider ─────────────────────────
    // Use client intent hint if available (Liberation 2 prep)
    const routing = routeMessage(message, identity, {
      conversationLength: Array.isArray(conversationHistory) ? conversationHistory.length : 0,
      userTier: access.tier.current,
    });

    // ── 4. Assemble conversation messages ─────────────────
    const includeHistory = privacySettings?.allow_oracle_memory !== false;

    const messages: OracleMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (includeHistory && Array.isArray(conversationHistory)) {
      // Lightweight gets less history to stay fast
      const historyLimit = lightweight ? 10 : 20;
      const recentHistory = conversationHistory.slice(-historyLimit);
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

    // ── 6.5 Trust signal recording ────────────────────────
    if (trustSignal) {
      recordTrustEvent(user.id, trustSignal).catch(() => {});
    }

    // ── 7. Non-blocking background tasks ──────────────────
    checkForNameCeremony(supabaseAdmin, identity, responseText).catch(() => {});
    updateIdentityAfterChat(supabaseAdmin, identity, message, scanHistory).catch(() => {});

    // Evolution only on full-mode conversations (voice commands don't contribute)
    if (!lightweight) {
      evolvePersonality(openai, supabaseAdmin, identity, conversationHistory || []).catch(() => {});
      evolveCharacter(process.env.OPEN_AI_API_KEY!, supabaseAdmin, identity, conversationHistory || []).catch(() => {});
    }

    // ── 8. Persist conversation ───────────────────────────
    // Lightweight calls from voice/command-router don't persist
    // (they have no conversationId and no history to build on)
    let activeConversationId = conversationId || null;

    if (!lightweight) {
      const userMsg = { role: 'user', content: message, timestamp: Date.now() };
      const assistantMsg = { role: 'assistant', content: responseText, timestamp: Date.now() };

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
    }

    // ── 9. Response ───────────────────────────────────────
    const quickChips = lightweight ? [] : getQuickChips(scanHistory, vaultItems, identity);

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
      contentHint: contentDetection.isCreation ? contentDetection : undefined,
      lightweight,
      tier: {
        current: access.tier.current,
        messagesUsed: access.usage.messagesUsed,
        messagesLimit: access.usage.messagesLimit,
        messagesRemaining: access.usage.messagesRemaining,
      },
      argos: {
        unreadAlerts: argosData.unreadCount || 0,
        hasProactiveContent: argosData.hasProactiveContent || false,
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