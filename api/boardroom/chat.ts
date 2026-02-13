// FILE: api/boardroom/chat.ts
// Boardroom Chat Handler — Multi-provider AI board with evolution
//
// Sprint M: Board members now evolve with AI DNA, uncaged personalities,
//           cross-domain detection, and provider performance tracking.
//
// Supports 8 AI providers: OpenAI, Anthropic, Google, DeepSeek, Groq, xAI, Perplexity, Mistral

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { verifyUser } from '../_lib/security.js';
import {
  buildBoardMemberPrompt,
  evolveBoarDna,
  isCrossDomain,
  type BoardMember,
  type InteractionResult,
} from '../../src/lib/boardroom/evolution.js';

export const config = {
  maxDuration: 30,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
 * Falls back to OpenAI if the primary provider fails.
 */
async function callProvider(
  member: BoardMember,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): Promise<ProviderResponse> {
  const start = Date.now();
  const provider = member.dominant_provider || member.ai_provider;
  const model = member.ai_model;

  try {
    const text = await callProviderDirect(provider, model, systemPrompt, messages);
    return {
      text,
      provider,
      model,
      responseTime: Date.now() - start,
      isFallback: false,
    };
  } catch (err: any) {
    console.warn(`Board member ${member.slug} primary provider (${provider}) failed: ${err.message}`);

    // Fallback to OpenAI
    try {
      const fallbackStart = Date.now();
      const text = await callProviderDirect('openai', 'gpt-4o-mini', systemPrompt, messages);
      return {
        text,
        provider: 'openai',
        model: 'gpt-4o-mini',
        responseTime: Date.now() - fallbackStart,
        isFallback: true,
      };
    } catch (fallbackErr: any) {
      throw new Error(`All providers failed for ${member.name}: ${fallbackErr.message}`);
    }
  }
}

/**
 * Direct provider call — handles all 8 provider APIs.
 */
async function callProviderDirect(
  provider: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  switch (provider) {
    case 'openai':
      return callOpenAICompatible(
        'https://api.openai.com/v1/chat/completions',
        process.env.OPEN_AI_API_KEY!,
        model || 'gpt-4o-mini',
        systemPrompt,
        messages
      );

    case 'anthropic':
      return callAnthropic(model || 'claude-sonnet-4-20250514', systemPrompt, messages);

    case 'google':
    case 'gemini':
      return callGemini(model || 'gemini-2.0-flash', systemPrompt, messages);

    case 'deepseek':
      return callOpenAICompatible(
        'https://api.deepseek.com/v1/chat/completions',
        process.env.DEEPSEEK_API_KEY!,
        model || 'deepseek-chat',
        systemPrompt,
        messages
      );

    case 'groq':
      return callOpenAICompatible(
        'https://api.groq.com/openai/v1/chat/completions',
        process.env.GROQ_API_KEY!,
        model || 'llama-3.3-70b-versatile',
        systemPrompt,
        messages
      );

    case 'xai':
      return callOpenAICompatible(
        'https://api.x.ai/v1/chat/completions',
        process.env.XAI_API_KEY!,
        model || 'grok-2-latest',
        systemPrompt,
        messages
      );

    case 'perplexity':
      return callOpenAICompatible(
        'https://api.perplexity.ai/chat/completions',
        process.env.PERPLEXITY_API_KEY!,
        model || 'sonar-pro',
        systemPrompt,
        messages
      );

    case 'mistral':
      return callOpenAICompatible(
        'https://api.mistral.ai/v1/chat/completions',
        process.env.MISTRAL_API_KEY!,
        model || 'mistral-large-latest',
        systemPrompt,
        messages
      );

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── OpenAI-compatible (OpenAI, Groq, DeepSeek, xAI, Perplexity, Mistral) ──
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  if (!apiKey) throw new Error('API key not configured');

  const response = await fetchWithTimeout(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  }, 20000);

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Anthropic Messages API ──
async function callAnthropic(
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
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
  }, 20000);

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// ── Google Gemini ──
async function callGemini(
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
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
  }, 20000);

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Fetch with timeout ──
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
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
// TOPIC DETECTION
// =============================================================================

function detectTopicCategory(message: string): string {
  const topics: Array<[RegExp, string]> = [
    [/\b(revenue|cost|budget|pricing|margin|p[&]l|financial|roi|subscription|stripe)\b/i, 'finance'],
    [/\b(security|fraud|hack|breach|encrypt|auth|verification|trust)\b/i, 'security'],
    [/\b(strateg|competi|market position|long.?term|vision|pivot)\b/i, 'strategy'],
    [/\b(code|bug|deploy|api|refactor|architect|infra|database)\b/i, 'technical'],
    [/\b(market|brand|growth|campaign|seo|social|content|acquisition)\b/i, 'marketing'],
    [/\b(legal|compliance|contract|ip|patent|regulat|terms|privacy)\b/i, 'legal'],
    [/\b(hire|team|culture|onboard|performance review|hr)\b/i, 'hr'],
    [/\b(data|analytics|metric|dashboard|ml|model|pipeline)\b/i, 'data'],
    [/\b(product|feature|ux|roadmap|user experience|design)\b/i, 'product'],
    [/\b(research|investigat|deep.?dive|analysis|study)\b/i, 'research'],
    [/\b(science|experiment|hypothesis|method|test)\b/i, 'science'],
    [/\b(innovat|emerging|future|ai|blockchain|trend)\b/i, 'innovation'],
    [/\b(operat|process|efficien|uptime|health|monitor)\b/i, 'operations'],
    [/\b(psycholog|behavior|motivat|cognitiv|mental)\b/i, 'psychology'],
  ];

  for (const [pattern, category] of topics) {
    if (pattern.test(message)) return category;
  }
  return 'general';
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
      meeting_id,
      member_slug,
      message,
      conversation_history,
      mention_all,
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

    // Detect topic for cross-domain tracking
    const topicCategory = detectTopicCategory(message);

    // ── Single member chat ─────────────────────────────────
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
      const systemPrompt = buildBoardMemberPrompt(boardMember);

      const messages = (conversation_history || [])
        .slice(-20)
        .map((m: any) => ({ role: m.role, content: m.content }));
      messages.push({ role: 'user', content: message });

      const result = await callProvider(boardMember, systemPrompt, messages);

      // Evolve DNA (non-blocking)
      const crossDomain = isCrossDomain(boardMember, topicCategory);
      evolveBoarDna(supabaseAdmin, {
        memberSlug: member_slug,
        providerUsed: result.provider,
        modelUsed: result.model,
        responseTime: result.responseTime,
        wasFallback: result.isFallback,
        wasCrossDomain: crossDomain,
        topicCategory,
        messageType: crossDomain ? 'cross_domain' : 'chat',
      }).catch(() => {});

      // Persist to meeting if provided
      if (meeting_id) {
        persistMessage(meeting_id, user.id, message, member_slug, result.text);
      }

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
        },
      });
    }

    // ── All members (board meeting) ────────────────────────
    if (mention_all) {
      const { data: members } = await supabaseAdmin
        .from('boardroom_members')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (!members || members.length === 0) {
        return res.status(500).json({ error: 'No active board members found.' });
      }

      const responses = await Promise.all(
        members.map(async (member) => {
          const boardMember = member as BoardMember;
          try {
            const systemPrompt = buildBoardMemberPrompt(boardMember);
            const msgs = [{ role: 'user', content: message }];
            const result = await callProvider(boardMember, systemPrompt, msgs);

            // Evolve DNA (non-blocking)
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
            }).catch(() => {});

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
        })
      );

      if (meeting_id) {
        persistMessage(meeting_id, user.id, message, '@all', 'Board meeting response');
      }

      return res.status(200).json({
        user_message: message,
        responses,
        meeting_id,
        topic: topicCategory,
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
    console.error('Boardroom chat error:', errMsg);
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
  response: string
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