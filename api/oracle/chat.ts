// FILE: api/oracle/chat.ts
// Oracle Chat Handler — ORCHESTRATION ONLY
//
// All business logic lives in src/lib/oracle/:
//   identity/   → Oracle CRUD, name ceremony, AI DNA
//   personality/ → Evolution via LLM, energy detection, character
//   prompt/      → System prompt builder + all context sections
//   chips/       → Dynamic quick chips
//   tier.ts      → Tier gating + message counting
//   providers/   → Multi-provider routing + calling + multi-call synthesis
//   argos/       → Alerts, hunt, push, watchlist
//   safety/      → Privacy & safety guardian
//   eyes/        → Visual memory capture + recall
//   nexus/       → Decision tree (post-scan flow)
//   memory/      → Long-term memory compression + retrieval
//   trust/       → Trust score tracking
//   voice-profile/ → User writing style analysis
//   market/      → Quick market data fetching (Liberation 7)
//
// ═══════════════════════════════════════════════════════════════════════
// THE NINE LIBERATIONS — FULLY WIRED
// ═══════════════════════════════════════════════════════════════════════
//
// L1: Kill the Fossil — ask.ts tombstoned, lightweight mode
// L2: Client-Side Intelligence — clientContext hints, validated
// L3: Emotional Memory — shared moments injected
// L4: Personal Concierge — names, dates, preferences extracted + injected
// L5: Self-Aware Oracle — capabilities block from tier + stats
// L6: Oracle-Voiced Push — push-voice.ts (called by Argos cron, not here)
// L7: Market-Aware Chat — quick-fetch mid-conversation for Pro/Elite
// L8: Conversational HYDRA — multi-model synthesis for Elite deep questions
// L9: Adaptive Token Depth — auto-continuation on truncation
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
import { checkOracleAccess, hasFeature } from '../../src/lib/oracle/tier.js';
import { routeMessage, callOracle } from '../../src/lib/oracle/providers/index.js';
import type { OracleMessage, RoutingResult } from '../../src/lib/oracle/providers/index.js';
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
  getEmotionalMoments,                                // Liberation 3
} from '../../src/lib/oracle/memory/index.js';

import {
  getPersonalDetails,                                  // Liberation 4
  extractPersonalDetails,                              // Liberation 4
} from '../../src/lib/oracle/memory/personal-details.js';

import { getTrustMetrics, detectTrustSignals, recordTrustEvent } from '../../src/lib/oracle/trust/tracker.js';
import { detectEnergy, detectEnergyArc, detectExpertiseFromMessage } from '../../src/lib/oracle/personality/energy.js';

// ── Persistent Voice Character (Sprint N+) ──────────────
import { evolveCharacter } from '../../src/lib/oracle/personality/character.js';

// ── Liberation 7: Market-Aware Conversation ─────────────
import {
  quickMarketFetch,
  buildMarketDataBlock,
  extractItemReference,
} from '../../src/lib/oracle/market/quick-fetch.js';

// ── Liberation 8: Conversational HYDRA ──────────────────
import {
  multiPerspectiveCall,
  isComplexEnoughForMulti,
} from '../../src/lib/oracle/providers/multi-call.js';

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
// VALIDATION — Liberation 2 client hint whitelists
// =============================================================================

const VALID_INTENTS = new Set([
  'casual', 'quick_answer', 'deep_analysis', 'market_query',
  'vision', 'strategy', 'creative', 'speed',
]);

const VALID_ENERGIES = new Set([
  'neutral', 'excited', 'frustrated', 'focused', 'curious', 'casual',
]);

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

  if (analysisContext.itemName) block += `Item: ${analysisContext.itemName}\n`;
  if (analysisContext.estimatedValue !== undefined) block += `Estimated Value: $${analysisContext.estimatedValue}\n`;
  if (analysisContext.summary_reasoning) block += `Analysis Summary: ${analysisContext.summary_reasoning}\n`;
  if (Array.isArray(analysisContext.valuation_factors) && analysisContext.valuation_factors.length > 0) {
    block += `Key Valuation Factors: ${analysisContext.valuation_factors.join('; ')}\n`;
  }
  if (analysisContext.category) block += `Category: ${analysisContext.category}\n`;
  if (analysisContext.confidence !== undefined) block += `Confidence: ${analysisContext.confidence}%\n`;

  return block;
}

// =============================================================================
// CONTENT CREATION DETECTION
// =============================================================================

function isContentCreationRequest(message: string): { isCreation: boolean; mode?: string; platform?: string } {
  const lower = message.toLowerCase();

  const listingPatterns = [
    /(?:list|sell|post)\s+(?:this|my|that|the)\s+(?:on|to)\s+(ebay|mercari|poshmark|facebook|amazon|whatnot)/i,
    /(?:write|create|make|generate)\s+(?:a|me|my)?\s*(?:listing|description)/i,
    /(?:help me )?list\s+(?:this|it|my)/i,
  ];

  for (const pattern of listingPatterns) {
    const match = message.match(pattern);
    if (match) {
      return { isCreation: true, mode: 'listing', platform: match[1]?.toLowerCase() || 'ebay' };
    }
  }

  if (/(?:make|create|generate)\s+(?:a|me)?\s*video/i.test(lower)) {
    return { isCreation: true, mode: 'video' };
  }

  if (/(?:brag|flex)\s*card/i.test(lower) || /(?:celebrate|show off)\s+(?:this|my)\s+(?:flip|sale|win)/i.test(lower)) {
    return { isCreation: true, mode: 'brag_card' };
  }

  return { isCreation: false };
}

// =============================================================================
// MARKET QUERY DETECTION (Liberation 7)
// =============================================================================

function isMarketQuery(message: string, intent: string): boolean {
  if (intent === 'market_query') return true;

  const lower = message.toLowerCase();
  const marketPatterns = [
    /(?:what(?:'s|\s+is|\s+are))\s+(?:it|they|those|this|that|these)\s+(?:worth|going for|selling for)/i,
    /(?:how much)\s+(?:is|are|does|do|could|should)/i,
    /(?:check|pull|look up|search)\s+(?:the\s+)?(?:price|market|ebay|value)/i,
    /(?:current|live|recent)\s+(?:price|value|market|listing)/i,
    /what(?:'s|\s+is)\s+(?:the\s+)?(?:market|going rate|average price)/i,
    /(?:price\s+check|comp\s+check)/i,
  ];

  return marketPatterns.some(p => p.test(lower));
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
      lightweight = false,
      analysisContext = null,
      clientContext = null,
      cachedMarketData = null,       // Liberation 7: client-cached market data
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

    const userTier = access.tier.current;

    // ── 0.5 SAFETY SCAN (always runs, even lightweight) ──
    const safetyScan = scanMessage(message);

    // ── 0.6 ENERGY (L2: use client hint if valid) ────────
    const clientEnergy = clientContext?.detectedEnergy;
    const currentEnergy = (clientEnergy && VALID_ENERGIES.has(clientEnergy))
      ? clientEnergy
      : detectEnergy(message);

    // ── 0.65 INTENT HINT (L2: validate for router) ──────
    const clientIntent = clientContext?.detectedIntent;
    const validatedIntentHint = (clientIntent && VALID_INTENTS.has(clientIntent))
      ? clientIntent
      : null;

    // ── 0.7 TRUST SIGNAL DETECTION ───────────────────────
    const trustSignal = detectTrustSignals(message);

    // Device type (L2: for logging/analytics)
    const deviceType = clientContext?.deviceType || 'unknown';

    // ══════════════════════════════════════════════════════
    // LIGHTWEIGHT vs FULL MODE — the only branch point
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
    let emotionalMoments: any[] = [];     // Liberation 3
    let personalDetails: any[] = [];      // Liberation 4

    if (lightweight) {
      // ── LIGHTWEIGHT: Core identity + memory + concierge ──
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
        getEmotionalMoments(user.id, 5).catch(() => []),          // L3
        getPersonalDetails(user.id, 20).catch(() => []),           // L4
      ]);

      identity = results[0];
      relevantMemories = results[1];
      trustMetrics = results[2];
      expertiseLevel = results[3];
      profile = results[4];
      privacySettings = results[5];
      emotionalMoments = results[6];
      personalDetails = results[7];

    } else {
      // ── FULL MODE: Everything in parallel ───────────────
      const isRecall = isRecallQuestion(message);

      const [
        _identity, scanResult, vaultResult, profileResult,
        _argosData, _privacySettings, _recentSafety,
        visualMemoryResult, _recallResult,
        _relevantMemories, _expertiseLevel, _trustMetrics,
        _unfulfilledPromises, _aggregatedInterests,
        _emotionalMoments, _personalDetails,
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
          hasRecentEvents: false, lastEventType: null, daysSinceLastEvent: null,
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
        getEmotionalMoments(user.id, 5).catch(() => []),
        getPersonalDetails(user.id, 30).catch(() => []),
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
      emotionalMoments = _emotionalMoments;
      personalDetails = _personalDetails;
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
      emotionalMoments,          // L3
      personalDetails,           // L4
      userTier: userTier as any, // L5
      capabilitiesStats: !lightweight ? {
        vaultItemCount: vaultItems.length,
        scanCount: scanHistory.length,
        argosAlertCount: argosData?.unreadCount || 0,
        watchlistCount: argosData?.watchlistCount || 0,
        conversationCount: relevantMemories.length,
        visualMemoryCount: visualMemories.length,
      } : undefined,             // L5
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

    // ── 3. Route to best provider (L2: intentHint) ───────
    const routing = routeMessage(message, identity, {
      conversationLength: Array.isArray(conversationHistory) ? conversationHistory.length : 0,
      userTier,
      intentHint: validatedIntentHint || undefined,
    });

    // ══════════════════════════════════════════════════════
    // LIBERATION 7: MARKET-AWARE CONVERSATION
    // ══════════════════════════════════════════════════════
    // If this is a market query AND the user has live_market access,
    // fetch real-time pricing data and inject it into the prompt.

    let marketData: any = null;
    let marketItemRef: any = null;

    if (
      !lightweight &&
      hasFeature(userTier as any, 'live_market') &&
      isMarketQuery(message, routing.intent)
    ) {
      // Try to identify which item they're asking about
      marketItemRef = extractItemReference(message, vaultItems, scanHistory);

      if (marketItemRef) {
        try {
          marketData = await quickMarketFetch(
            marketItemRef.itemName,
            marketItemRef.category,
            {
              timeoutMs: 3000,
              cachedData: cachedMarketData || undefined,
            },
          );

          if (marketData) {
            systemPrompt += buildMarketDataBlock(marketItemRef.itemName, marketData);
            console.log(
              `[L7] Live market data injected: ${marketData.sources.join(',')} ` +
              `${marketData.activeListings} listings, ${marketData.fetchTimeMs}ms`
            );
          }
        } catch (err) {
          console.error('[L7] Quick market fetch failed (non-fatal):', err);
        }
      }
    }

    // ── 4. Assemble conversation messages ─────────────────
    const includeHistory = privacySettings?.allow_oracle_memory !== false;

    const messages: OracleMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (includeHistory && Array.isArray(conversationHistory)) {
      const historyLimit = lightweight ? 10 : 20;
      const recentHistory = conversationHistory.slice(-historyLimit);
      for (const turn of recentHistory) {
        if (turn.role === 'user' || turn.role === 'assistant') {
          messages.push({ role: turn.role, content: turn.content });
        }
      }
    }

    messages.push({ role: 'user', content: message });

    // ══════════════════════════════════════════════════════
    // LIBERATION 8: CONVERSATIONAL HYDRA
    // ══════════════════════════════════════════════════════
    // For Elite users with complex strategic/analytical questions,
    // fire multiple providers and synthesize perspectives.

    let result: any;
    let usedMultiCall = false;

    if (
      !lightweight &&
      hasFeature(userTier as any, 'conversational_hydra') &&
      isComplexEnoughForMulti(message, routing.intent)
    ) {
      console.log('[L8] Triggering multi-perspective synthesis');
      const multiResult = await multiPerspectiveCall(messages, identity, routing);
      result = {
        text: multiResult.text,
        providerId: multiResult.providers.join('+'),
        model: 'multi-perspective',
        responseTime: multiResult.totalTimeMs,
        isFallback: multiResult.isFallback,
      };
      usedMultiCall = !multiResult.isFallback;
    } else {
      // ── 5. Standard single-model call ───────────────────
      result = await callOracle(routing, messages);
    }

    let responseText = result.text;
    if (!responseText) throw new Error('Oracle returned empty response');

    // ══════════════════════════════════════════════════════
    // LIBERATION 9: ADAPTIVE TOKEN DEPTH
    // ══════════════════════════════════════════════════════
    // If the response looks truncated (hit token limit, doesn't end
    // with sentence-ending punctuation), auto-continue.
    // Only runs once. Max 500 additional tokens.

    let didContinue = false;

    if (!lightweight && !usedMultiCall) {
      const estimatedTokens = responseText.length / 4;
      const maxTokens = routing.maxTokens || 500;
      const utilizationRatio = estimatedTokens / maxTokens;

      // Only fire when ACTUALLY truncated: 92-105% utilization AND no ending punctuation.
      // >105% means the model finished naturally (just wrote a long response) — NOT truncated.
      // Also skip if the response already ends with punctuation — it's complete.
      const looksComplete = /[.!?…"')\]]\s*$/.test(responseText);
      const isTruncated = utilizationRatio > 0.92 && utilizationRatio < 1.05 && !looksComplete;

      if (isTruncated) {
        console.log(`[L9] Response appears truncated (${Math.floor(utilizationRatio * 100)}% utilization), continuing`);

        try {
          const continuationMessages: OracleMessage[] = [
            ...messages,
            { role: 'assistant', content: responseText },
            { role: 'user', content: 'Continue your thought.' },
          ];

          // Use the provider that ACTUALLY succeeded, not the original routing.
          // If primary timed out and Groq answered, continue with Groq — not OpenAI.
          const successfulProviderId = result.providerId as any;
          const successfulModel = result.model;

          const continuationRouting: RoutingResult = {
            ...routing,
            providerId: successfulProviderId,
            model: successfulModel,
            maxTokens: Math.min(maxTokens, 500),
            reason: `${routing.reason}→continuation(${successfulProviderId})`,
            fallbacks: routing.fallbacks, // Keep fallbacks in case continuation also fails
          };

          const continuation = await callOracle(continuationRouting, continuationMessages);

          if (continuation.text && continuation.text.trim().length > 10) {
            // Stitch together with natural join
            const needsSpace = !responseText.endsWith(' ') && !continuation.text.startsWith(' ');
            responseText = responseText + (needsSpace ? ' ' : '') + continuation.text;
            didContinue = true;
            console.log(`[L9] Continuation added: +${continuation.text.length} chars via ${continuation.providerId}`);
          }
        } catch (err) {
          console.error('[L9] Continuation failed (non-fatal):', err);
        }
      } else if (utilizationRatio > 1.05) {
        console.log(`[L9] Response over budget (${Math.floor(utilizationRatio * 100)}% utilization) but NOT truncated — model finished naturally`);
      }
    }

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

    if (!lightweight) {
      evolvePersonality(openai, supabaseAdmin, identity, conversationHistory || []).catch(() => {});
      evolveCharacter(process.env.OPEN_AI_API_KEY!, supabaseAdmin, identity, conversationHistory || []).catch(() => {});
    }

    // ── 8. Persist conversation ───────────────────────────
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

            const msgCount = updatedMessages.length;

            // Memory compression (every 10 messages after 25)
            if (msgCount >= 25 && msgCount % 10 === 0) {
              shouldCompress(user.id, activeConversationId, msgCount)
                .then(needsCompression => {
                  if (needsCompression) {
                    compressConversation(user.id, activeConversationId!, updatedMessages).catch(() => {});
                  }
                }).catch(() => {});
            }

            // L4: Extract personal details (every 10 messages after 8)
            if (msgCount >= 8 && msgCount % 10 === 0) {
              extractPersonalDetails(user.id, updatedMessages).catch(() => {});
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
        current: userTier,
        messagesUsed: access.usage.messagesUsed,
        messagesLimit: access.usage.messagesLimit,
        messagesRemaining: access.usage.messagesRemaining,
      },
      argos: {
        unreadAlerts: argosData.unreadCount || 0,
        hasProactiveContent: argosData.hasProactiveContent || false,
      },
      // Liberation 7: market data in response for client caching
      marketData: marketData ? {
        result: marketData,
        itemName: marketItemRef?.itemName,
        cachedAt: marketData.fetchedAt,
      } : undefined,
      _provider: {
        used: result.providerId,
        model: result.model,
        intent: routing.intent,
        responseTime: result.responseTime,
        isFallback: result.isFallback,
        deviceType,
        multiPerspective: usedMultiCall,     // L8
        continued: didContinue,              // L9
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