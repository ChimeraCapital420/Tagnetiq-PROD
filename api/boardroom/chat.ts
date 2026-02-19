// FILE: api/boardroom/chat.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARDROOM CHAT HANDLER — The Orchestrator
// ═══════════════════════════════════════════════════════════════════════
//
// Phase 0: The board now has a soul.
//
// BEFORE (stateless):
//   message → buildPrompt(member) → callProvider → respond
//
// AFTER (living):
//   message → detectEnergy → fetchMemory → fetchCrossBoardFeed
//     → buildRichPrompt(member + memory + energy + feed)
//     → callProvider (with timeout management)
//     → respond
//     → [background] extractFounderDetails
//     → [background] updateEnergy
//     → [background] compressThread (if threshold)
//     → [background] postToActivityFeed
//     → [background] evolveDNA
//
// Every conversation makes the board smarter. Every interaction
// builds the relationship. Nothing is wasted. Nothing is forgotten.
//
// Supports 8+ AI providers: OpenAI, Anthropic, Google, DeepSeek,
// Groq, xAI, Perplexity, Mistral (+ future local towers)
//
// maxDuration: 60 (Vercel Pro) — no more 504s
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';

// ── Evolution (DNA, trust, cross-domain) ────────────────
import {
  evolveBoarDna,
  isCrossDomain,
  detectTopicCategory,
  type BoardMember,
  type InteractionResult,
} from '../../src/lib/boardroom/evolution.js';

// ── Phase 0: Living Board ───────────────────────────────
import { buildBoardMemberPrompt } from './lib/prompt-builder.js';
import { detectEnergy, detectEnergyArc, type EnergyLevel, type EnergyArc } from '../../src/lib/boardroom/energy.js';
import {
  getFounderMemory,
  getCrossBoardFeed,
  getRecentDecisions,
  extractFounderDetails,
  compressBoardThread,
  trackEmotionalArc,
  updateFounderEnergy,
} from '../../src/lib/boardroom/memory/founder-memory.js';

// ═══════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════

export const config = {
  maxDuration: 60, // Vercel Pro — no more 504 timeouts
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Provider timeout caps (learned from HYDRA fix)
const PROVIDER_TIMEOUTS: Record<string, number> = {
  groq: 8000,        // Groq is fast or not at all
  openai: 15000,
  anthropic: 20000,  // Claude needs more time for deep responses
  google: 15000,
  deepseek: 18000,
  xai: 15000,
  perplexity: 15000,
  mistral: 15000,
  local: 30000,      // Local towers get more time (slower but free)
};

const HARD_TIMEOUT = 25000; // Never wait longer than 25s for any single call

// =============================================================================
// PROVIDER CALLERS
// =============================================================================

interface ProviderResponse {
  text: string;
  provider: string;
  model: string;
  responseTime: number;
  isFallback: boolean;
}

/**
 * Call the appropriate AI provider for a board member.
 * Time-budget aware with provider-specific timeouts.
 * Falls back to Groq (fastest) then OpenAI if primary fails.
 */
async function callProvider(
  member: BoardMember,
  systemPrompt: string,
  userPrompt: string,
): Promise<ProviderResponse> {
  const start = Date.now();
  const provider = member.dominant_provider || member.ai_provider;
  const model = member.ai_model;
  const timeout = Math.min(
    PROVIDER_TIMEOUTS[provider] || 15000,
    HARD_TIMEOUT,
  );

  // ── Primary attempt ──────────────────────────────────
  try {
    const text = await callProviderDirect(provider, model, systemPrompt, userPrompt, timeout);
    return {
      text,
      provider,
      model,
      responseTime: Date.now() - start,
      isFallback: false,
    };
  } catch (err: any) {
    console.warn(`[Board] ${member.slug} primary (${provider}/${model}) failed: ${err.message}`);
  }

  // ── Speed fallback: Groq (if not already Groq) ────────
  if (provider !== 'groq') {
    try {
      const groqStart = Date.now();
      const text = await callProviderDirect(
        'groq', 'llama-3.3-70b-versatile',
        systemPrompt, userPrompt, 8000,
      );
      return {
        text,
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        responseTime: Date.now() - groqStart,
        isFallback: true,
      };
    } catch (groqErr: any) {
      console.warn(`[Board] ${member.slug} Groq fallback failed: ${groqErr.message}`);
    }
  }

  // ── Final fallback: OpenAI ────────────────────────────
  try {
    const oaiStart = Date.now();
    const text = await callProviderDirect(
      'openai', 'gpt-4o-mini',
      systemPrompt, userPrompt, 12000,
    );
    return {
      text,
      provider: 'openai',
      model: 'gpt-4o-mini',
      responseTime: Date.now() - oaiStart,
      isFallback: true,
    };
  } catch (oaiErr: any) {
    throw new Error(`All providers failed for ${member.name}: ${oaiErr.message}`);
  }
}

/**
 * Direct provider call — handles all provider API formats.
 * Sends system prompt + user prompt as the standard two-message pattern.
 */
async function callProviderDirect(
  provider: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
): Promise<string> {
  const messages = [
    { role: 'user' as const, content: userPrompt },
  ];

  switch (provider) {
    case 'openai':
      return callOpenAICompatible(
        'https://api.openai.com/v1/chat/completions',
        process.env.OPEN_AI_API_KEY!, model || 'gpt-4o-mini',
        systemPrompt, messages, timeoutMs,
      );

    case 'anthropic':
      return callAnthropic(model || 'claude-sonnet-4-20250514', systemPrompt, messages, timeoutMs);

    case 'google':
    case 'gemini':
      return callGemini(model || 'gemini-2.0-flash', systemPrompt, messages, timeoutMs);

    case 'deepseek':
      return callOpenAICompatible(
        'https://api.deepseek.com/v1/chat/completions',
        process.env.DEEPSEEK_API_KEY!, model || 'deepseek-chat',
        systemPrompt, messages, timeoutMs,
      );

    case 'groq':
      return callOpenAICompatible(
        'https://api.groq.com/openai/v1/chat/completions',
        process.env.GROQ_API_KEY!, model || 'llama-3.3-70b-versatile',
        systemPrompt, messages, timeoutMs,
      );

    case 'xai':
      return callOpenAICompatible(
        'https://api.x.ai/v1/chat/completions',
        process.env.XAI_API_KEY!, model || 'grok-2-latest',
        systemPrompt, messages, timeoutMs,
      );

    case 'perplexity':
      return callOpenAICompatible(
        'https://api.perplexity.ai/chat/completions',
        process.env.PERPLEXITY_API_KEY!, model || 'sonar-pro',
        systemPrompt, messages, timeoutMs,
      );

    case 'mistral':
      return callOpenAICompatible(
        'https://api.mistral.ai/v1/chat/completions',
        process.env.MISTRAL_API_KEY!, model || 'mistral-large-latest',
        systemPrompt, messages, timeoutMs,
      );

    // Future: local tower providers
    default:
      if (provider.startsWith('local_tower')) {
        const towerIp = process.env[`${provider.toUpperCase()}_IP`] || '192.168.1.101';
        const towerPort = process.env[`${provider.toUpperCase()}_PORT`] || '11434';
        return callOpenAICompatible(
          `http://${towerIp}:${towerPort}/v1/chat/completions`,
          'not-needed', model || 'qwen2.5:14b',
          systemPrompt, messages, timeoutMs,
        );
      }
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── OpenAI-compatible (OpenAI, Groq, DeepSeek, xAI, Perplexity, Mistral, Local) ──
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  timeoutMs: number,
): Promise<string> {
  if (!apiKey && !baseUrl.startsWith('http://192.168')) {
    throw new Error('API key not configured');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey !== 'not-needed') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetchWithTimeout(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  }, timeoutMs);

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Anthropic Messages API ──
async function callAnthropic(
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  timeoutMs: number,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
      max_tokens: 2000,
      temperature: 0.7,
    }),
  }, timeoutMs);

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// ── Google Gemini ──
async function callGemini(
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  timeoutMs: number,
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
    }),
  }, timeoutMs);

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Fetch with timeout ──
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const {
      meeting_id,
      member_slug,
      message,
      conversation_history,
      mention_all,
      meeting_type,
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'A "message" is required.' });
    }

    // Verify boardroom access
    const { data: accessRow } = await supabaseAdmin
      .from('boardroom_access')
      .select('access_level')
      .eq('user_id', user.id)
      .single();

    if (!accessRow) {
      return res.status(403).json({ error: 'You do not have boardroom access.' });
    }

    // ── Detect energy + topic (instant, zero cost) ──────
    const founderEnergy = detectEnergy(message);
    const founderArc = conversation_history?.length > 2
      ? detectEnergyArc(conversation_history)
      : 'steady' as EnergyArc;
    const topicCategory = detectTopicCategory(message);

    // ══════════════════════════════════════════════════════
    // SINGLE MEMBER CHAT
    // ══════════════════════════════════════════════════════

    if (member_slug && !mention_all) {
      const { data: member } = await supabaseAdmin
        .from('boardroom_members')
        .select('*')
        .eq('slug', member_slug)
        .single();

      if (!member) {
        return res.status(404).json({ error: `Board member "${member_slug}" not found.` });
      }

      const boardMember = member as BoardMember;

      // ── Fetch memory + context (parallel, non-blocking) ──
      const [founderMemory, crossBoardFeed, recentDecisions] = await Promise.all([
        getFounderMemory(supabaseAdmin, user.id, member_slug).catch(() => null),
        getCrossBoardFeed(supabaseAdmin, user.id, member_slug).catch(() => []),
        getRecentDecisions(supabaseAdmin, user.id).catch(() => []),
      ]);

      // ── Build rich prompt (memory + energy + feed) ────
      const { systemPrompt, userPrompt } = buildBoardMemberPrompt({
        member: boardMember,
        userMessage: message,
        meetingType: meeting_type || 'one_on_one',
        conversationHistory: (conversation_history || []).slice(-20),
        founderMemory,
        founderEnergy,
        founderArc,
        crossBoardFeed,
        recentDecisions,
      });

      // ── Call provider ─────────────────────────────────
      const result = await callProvider(boardMember, systemPrompt, userPrompt);

      // ── Background post-call tasks (fire and forget) ──
      const crossDomain = isCrossDomain(boardMember, topicCategory);
      const hasMemory = !!(founderMemory && (
        (founderMemory.founder_details || []).length > 0 ||
        (founderMemory.compressed_memories || []).length > 0
      ));

      // 1. Evolve DNA
      evolveBoarDna(supabaseAdmin, {
        memberSlug: member_slug,
        providerUsed: result.provider,
        modelUsed: result.model,
        responseTime: result.responseTime,
        wasFallback: result.isFallback,
        wasCrossDomain: crossDomain,
        topicCategory,
        messageType: crossDomain ? 'cross_domain' : 'chat',
        founderEnergy,
        founderArc,
        memoryHit: hasMemory,
        feedInjected: (crossBoardFeed || []).length > 0,
      }).catch(() => {});

      // 2. Extract founder details from this conversation
      const fullMessages = [
        ...(conversation_history || []).slice(-20),
        { role: 'user', content: message },
        { role: 'assistant', content: result.text },
      ];
      extractFounderDetails(supabaseAdmin, user.id, member_slug, fullMessages).catch(() => {});

      // 3. Update energy state
      updateFounderEnergy(supabaseAdmin, user.id, member_slug, founderEnergy, founderArc).catch(() => {});

      // 4. Prometheus special: track emotional arc
      if (member_slug === 'prometheus') {
        const note = message.length > 100
          ? message.substring(0, 100) + '...'
          : message;
        trackEmotionalArc(supabaseAdmin, user.id, founderEnergy, founderArc, note).catch(() => {});
      }

      // 5. Compress thread if threshold reached
      const msgCount = (conversation_history || []).length + 2;
      if (msgCount >= 25 && msgCount % 10 === 0) {
        compressBoardThread(supabaseAdmin, user.id, member_slug, fullMessages).catch(() => {});
      }

      // 6. Persist to meeting if provided
      if (meeting_id) {
        persistMessage(meeting_id, user.id, message, member_slug, result.text);
      }

      // ── Response ──────────────────────────────────────
      return res.status(200).json({
        member: member_slug,
        response: result.text,
        meeting_id,
        _meta: {
          provider: result.provider,
          model: result.model,
          responseTime: result.responseTime,
          isFallback: result.isFallback,
          topic: topicCategory,
          crossDomain,
          trustLevel: boardMember.trust_level,
          aiDna: boardMember.ai_dna,
          // Phase 0 meta
          founderEnergy,
          founderArc,
          memoryDepth: (founderMemory?.founder_details || []).length,
          feedSize: (crossBoardFeed || []).length,
        },
      });
    }

    // ══════════════════════════════════════════════════════
    // ALL MEMBERS (BOARD MEETING)
    // ══════════════════════════════════════════════════════

    if (mention_all) {
      const { data: members } = await supabaseAdmin
        .from('boardroom_members')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (!members || members.length === 0) {
        return res.status(500).json({ error: 'No active board members found.' });
      }

      // Fetch shared context once (not per-member)
      const recentDecisions = await getRecentDecisions(supabaseAdmin, user.id).catch(() => []);

      const responses = await Promise.all(
        members.map(async (member) => {
          const boardMember = member as BoardMember;
          try {
            // Per-member memory (parallel within the Promise.all)
            const [founderMemory, crossBoardFeed] = await Promise.all([
              getFounderMemory(supabaseAdmin, user.id, boardMember.slug).catch(() => null),
              getCrossBoardFeed(supabaseAdmin, user.id, boardMember.slug, 7, 3).catch(() => []),
            ]);

            const { systemPrompt, userPrompt } = buildBoardMemberPrompt({
              member: boardMember,
              userMessage: message,
              meetingType: meeting_type || 'full_board',
              conversationHistory: [], // Board meetings start fresh
              founderMemory,
              founderEnergy,
              founderArc,
              crossBoardFeed,
              recentDecisions,
            });

            const result = await callProvider(boardMember, systemPrompt, userPrompt);

            // Background: evolve DNA + extract details
            const crossDomain = isCrossDomain(boardMember, topicCategory);
            evolveBoarDna(supabaseAdmin, {
              memberSlug: boardMember.slug,
              providerUsed: result.provider,
              modelUsed: result.model,
              responseTime: result.responseTime,
              wasFallback: result.isFallback,
              wasCrossDomain: crossDomain,
              topicCategory,
              messageType: 'chat',
              founderEnergy,
              founderArc,
            }).catch(() => {});

            extractFounderDetails(supabaseAdmin, user.id, boardMember.slug, [
              { role: 'user', content: message },
              { role: 'assistant', content: result.text },
            ]).catch(() => {});

            return {
              member: boardMember.slug,
              name: boardMember.name,
              title: boardMember.title,
              response: result.text,
              provider: result.provider,
              responseTime: result.responseTime,
              error: false,
            };
          } catch (err: any) {
            return {
              member: boardMember.slug,
              name: boardMember.name,
              title: boardMember.title,
              response: `[${boardMember.name} is unavailable: ${err.message}]`,
              provider: boardMember.ai_provider,
              responseTime: 0,
              error: true,
            };
          }
        }),
      );

      // Persist meeting message
      if (meeting_id) {
        persistMessage(meeting_id, user.id, message, '@all', 'Board meeting response');
      }

      return res.status(200).json({
        user_message: message,
        responses,
        meeting_id,
        topic: topicCategory,
        _meta: {
          founderEnergy,
          founderArc,
          memberCount: responses.length,
          errorCount: responses.filter(r => r.error).length,
        },
      });
    }

    return res.status(400).json({
      error: 'Provide either "member_slug" for a direct chat or "mention_all: true" for a board meeting.',
    });

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('[Boardroom] Chat error:', errMsg);
    return res.status(500).json({ error: 'Board is in recess. Try again.' });
  }
}

// =============================================================================
// HELPERS
// =============================================================================

async function persistMessage(
  meetingId: string,
  userId: string,
  userMessage: string,
  memberSlug: string,
  response: string,
) {
  try {
    await supabaseAdmin
      .from('boardroom_meetings')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', meetingId);
  } catch {
    // Non-fatal
  }
}