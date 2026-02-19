// FILE: api/boardroom/lib/provider-caller.ts
// ═══════════════════════════════════════════════════════════════════════
// SHARED PROVIDER CALLER — One Module, All Board AI Calls
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 0d: Consolidation
//
// BEFORE: Three copies of callProvider() in chat.ts, tasks.ts, briefing.ts
//         Each with slightly different provider support, different timeout
//         handling, different error behavior. Adding a local tower meant
//         editing three files.
//
// AFTER:  One callProviderDirect(), one callWithFallback(), one getApiKey().
//         chat.ts, tasks.ts, briefing.ts all import from here.
//         Adding a local tower = one edit in one file.
//
// PROVIDERS:
//   Cloud:  OpenAI, Anthropic, Google/Gemini, DeepSeek, Groq, xAI, Perplexity, Mistral
//   Local:  Any local_tower_* with OpenAI-compatible API (Ollama, vLLM, llama.cpp)
//
// FALLBACK: Primary → Groq speed (8s) → OpenAI final (12s)
//
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// API KEY LOOKUP
// =============================================================================

const ENV_KEYS: Record<string, string[]> = {
  openai:     ['OPENAI_API_KEY', 'OPEN_AI_API_KEY'],
  anthropic:  ['ANTHROPIC_API_KEY', 'ANTHROPIC_SECRET'],
  google:     ['GOOGLE_AI_API_KEY', 'GOOGLE_AI_TOKEN', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
  gemini:     ['GOOGLE_AI_API_KEY', 'GOOGLE_AI_TOKEN', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
  mistral:    ['MISTRAL_API_KEY'],
  groq:       ['GROQ_API_KEY'],
  xai:        ['XAI_API_KEY', 'XAI_SECRET', 'GROK_API_KEY'],
  perplexity: ['PERPLEXITY_API_KEY', 'PPLX_API_KEY'],
  deepseek:   ['DEEPSEEK_API_KEY', 'DEEPSEEK_TOKEN'],
};

export function getApiKey(provider: string): string | null {
  const keys = ENV_KEYS[provider.toLowerCase()];
  if (!keys) return null;
  for (const envKey of keys) {
    const value = process.env[envKey];
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
}

// =============================================================================
// TYPES
// =============================================================================

export interface ProviderCallResult {
  text: string;
  provider: string;
  model: string;
  responseTime: number;
  isFallback: boolean;
}

export interface CallOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

// =============================================================================
// TIMEOUT CAPS (learned from HYDRA fix)
// =============================================================================

const PROVIDER_TIMEOUTS: Record<string, number> = {
  groq:       8000,
  openai:     15000,
  anthropic:  20000,
  google:     15000,
  gemini:     15000,
  deepseek:   18000,
  xai:        15000,
  perplexity: 15000,
  mistral:    15000,
  local:      30000,
};

const HARD_TIMEOUT = 25000;

function getTimeout(provider: string, override?: number): number {
  if (override) return Math.min(override, HARD_TIMEOUT);
  if (provider.startsWith('local')) return PROVIDER_TIMEOUTS.local;
  return Math.min(PROVIDER_TIMEOUTS[provider] || 15000, HARD_TIMEOUT);
}

// =============================================================================
// DIRECT PROVIDER CALL (single attempt, no fallback)
// =============================================================================

export async function callProviderDirect(
  provider: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: CallOptions = {},
): Promise<string> {
  const maxTokens = options.maxTokens || 2048;
  const temperature = options.temperature || 0.7;
  const timeoutMs = getTimeout(provider, options.timeoutMs);
  const messages = [{ role: 'user' as const, content: userPrompt }];

  const p = provider.toLowerCase();

  switch (p) {
    case 'openai':
      return callOpenAICompatible(
        'https://api.openai.com/v1/chat/completions',
        getApiKey('openai')!, model || 'gpt-4o-mini',
        systemPrompt, messages, maxTokens, temperature, timeoutMs,
      );

    case 'anthropic':
      return callAnthropic(
        model || 'claude-sonnet-4-20250514',
        systemPrompt, messages, maxTokens, temperature, timeoutMs,
      );

    case 'google':
    case 'gemini':
      return callGemini(
        model || 'gemini-2.0-flash',
        systemPrompt, messages, maxTokens, temperature, timeoutMs,
      );

    case 'deepseek':
      return callOpenAICompatible(
        'https://api.deepseek.com/v1/chat/completions',
        getApiKey('deepseek')!, model || 'deepseek-chat',
        systemPrompt, messages, maxTokens, temperature, timeoutMs,
      );

    case 'groq':
      return callOpenAICompatible(
        'https://api.groq.com/openai/v1/chat/completions',
        getApiKey('groq')!, model || 'llama-3.3-70b-versatile',
        systemPrompt, messages, maxTokens, temperature, timeoutMs,
      );

    case 'xai':
      return callOpenAICompatible(
        'https://api.x.ai/v1/chat/completions',
        getApiKey('xai')!, model || 'grok-2-latest',
        systemPrompt, messages, maxTokens, temperature, timeoutMs,
      );

    case 'perplexity':
      return callOpenAICompatible(
        'https://api.perplexity.ai/chat/completions',
        getApiKey('perplexity')!, model || 'sonar-pro',
        systemPrompt, messages, maxTokens, temperature, timeoutMs,
      );

    case 'mistral':
      return callOpenAICompatible(
        'https://api.mistral.ai/v1/chat/completions',
        getApiKey('mistral')!, model || 'mistral-large-latest',
        systemPrompt, messages, maxTokens, temperature, timeoutMs,
      );

    default:
      // Local towers: local_tower_1, local_tower_2, etc.
      if (p.startsWith('local_tower') || p.startsWith('local')) {
        const envPrefix = p.toUpperCase().replace(/-/g, '_');
        const towerIp = process.env[`${envPrefix}_IP`] || '192.168.1.101';
        const towerPort = process.env[`${envPrefix}_PORT`] || '11434';
        return callOpenAICompatible(
          `http://${towerIp}:${towerPort}/v1/chat/completions`,
          'not-needed', model || 'qwen2.5:14b',
          systemPrompt, messages, maxTokens, temperature,
          getTimeout('local', options.timeoutMs),
        );
      }
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// =============================================================================
// CALL WITH FALLBACK CHAIN
// =============================================================================

export async function callWithFallback(
  provider: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: CallOptions = {},
): Promise<ProviderCallResult> {
  const start = Date.now();

  // ── Primary attempt ──
  try {
    const text = await callProviderDirect(provider, model, systemPrompt, userPrompt, options);
    return {
      text, provider, model,
      responseTime: Date.now() - start,
      isFallback: false,
    };
  } catch (err: any) {
    console.warn(`[Board] Primary (${provider}/${model}) failed: ${err.message}`);
  }

  // ── Speed fallback: Groq ──
  if (provider !== 'groq') {
    try {
      const t = Date.now();
      const text = await callProviderDirect(
        'groq', 'llama-3.3-70b-versatile',
        systemPrompt, userPrompt,
        { ...options, timeoutMs: 8000 },
      );
      return {
        text, provider: 'groq', model: 'llama-3.3-70b-versatile',
        responseTime: Date.now() - t,
        isFallback: true,
      };
    } catch (e: any) {
      console.warn(`[Board] Groq fallback failed: ${e.message}`);
    }
  }

  // ── Final fallback: OpenAI ──
  try {
    const t = Date.now();
    const text = await callProviderDirect(
      'openai', 'gpt-4o-mini',
      systemPrompt, userPrompt,
      { ...options, timeoutMs: 12000 },
    );
    return {
      text, provider: 'openai', model: 'gpt-4o-mini',
      responseTime: Date.now() - t,
      isFallback: true,
    };
  } catch (e: any) {
    throw new Error(`All providers failed (primary: ${provider}): ${e.message}`);
  }
}

// =============================================================================
// PROVIDER IMPLEMENTATIONS
// =============================================================================

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
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
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: maxTokens,
      temperature,
    }),
  }, timeoutMs);

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.choices?.[0]?.message?.content || '';
}

async function callAnthropic(
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
): Promise<string> {
  const apiKey = getApiKey('anthropic');
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
      max_tokens: maxTokens,
      temperature,
    }),
  }, timeoutMs);

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.content?.[0]?.text || '';
}

async function callGemini(
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
): Promise<string> {
  const apiKey = getApiKey('google');
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
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
  }, timeoutMs);

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// SHARED SUPABASE ADMIN + COMPANY CONTEXT
// =============================================================================

let _supaAdmin: ReturnType<typeof createClient> | null = null;

export function getSupaAdmin() {
  if (!_supaAdmin) {
    _supaAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supaAdmin;
}

export async function getCompanyContext(): Promise<string> {
  const { data } = await getSupaAdmin()
    .from('boardroom_company_context')
    .select('title, content')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (!data || data.length === 0) return '';

  let context = '\n\n# === TAGNETIQ COMPANY KNOWLEDGE ===\n';
  for (const item of data) {
    context += `${item.content}\n\n`;
  }
  return context;
}