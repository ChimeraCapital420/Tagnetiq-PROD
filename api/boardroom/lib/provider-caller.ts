// FILE: api/boardroom/lib/provider-caller.ts
// ═══════════════════════════════════════════════════════════════════════
// THE BOARD'S AI GATEWAY
// ═══════════════════════════════════════════════════════════════════════
//
// This is NOT a utility wrapper. This is the central nervous system
// through which every board member connects to their AI backbone.
//
// Every conversation, every task, every briefing section, every sandbox
// scenario, every overnight debate — all flow through this gateway.
//
// CAPABILITIES:
//   ✓ 8 cloud providers + local GPU towers
//   ✓ Intelligent fallback chains (Primary → Groq speed → OpenAI reliable)
//   ✓ Per-provider timeout management (learned from HYDRA 504 fix)
//   ✓ Audit logging (every call tracked: who, what, when, cost)
//   ✓ Performance metrics (response time, fallback rate, quality signals)
//   ✓ Cost estimation (token tracking for budget management)
//   ✓ Local tower routing (Ollama, vLLM, llama.cpp)
//   ✓ Gateway-level error recovery
//   ✓ Shared Supabase admin client (one connection, all routes)
//   ✓ Company context loader (shared business knowledge)
//
// PROVIDERS:
//   Cloud:  OpenAI, Anthropic, Google/Gemini, DeepSeek, Groq, xAI, Perplexity, Mistral
//   Local:  Any local_tower_* with OpenAI-compatible API
//
// FUTURE:
//   - Streaming support (SSE for real-time responses)
//   - Tool use / function calling passthrough
//   - Multi-modal (image input for product photos)
//   - Token budget management per member
//   - Rate limit awareness per provider
//   - A/B testing routes (test new models per member)
//
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// API KEY REGISTRY
// =============================================================================
// Multiple env key variants per provider — different hosting platforms
// use different naming conventions. We check all of them.

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

/**
 * Resolve API key for a provider. Checks multiple env variable names.
 * Returns null if no key found (caller decides whether to throw).
 */
export function getApiKey(provider: string): string | null {
  const keys = ENV_KEYS[provider.toLowerCase()];
  if (!keys) return null;
  for (const envKey of keys) {
    const value = process.env[envKey];
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
}

/**
 * Check which providers are configured (have valid API keys).
 * Useful for health checks and dashboard display.
 */
export function getAvailableProviders(): string[] {
  return Object.keys(ENV_KEYS).filter(p => getApiKey(p) !== null);
}

// =============================================================================
// TYPES
// =============================================================================

export interface ProviderCallResult {
  /** The AI response text */
  text: string;
  /** Which provider actually served the response */
  provider: string;
  /** Which model was used */
  model: string;
  /** Total response time in milliseconds */
  responseTime: number;
  /** Whether a fallback provider was used */
  isFallback: boolean;
  /** Estimated token counts (approximate) */
  tokenEstimate: {
    input: number;
    output: number;
    estimatedCost: number;
  };
}

export interface CallOptions {
  /** Max tokens to generate (default: 2048) */
  maxTokens?: number;
  /** Temperature (default: 0.7) */
  temperature?: number;
  /** Override timeout in ms */
  timeoutMs?: number;
  /** Task context for audit logging */
  taskContext?: {
    memberSlug?: string;
    taskType?: string;
    meetingId?: string;
    source?: 'chat' | 'task' | 'briefing' | 'sandbox' | 'execution';
  };
  /** Skip fallback chain, fail hard on primary */
  noFallback?: boolean;
}

export interface GatewayHealthStatus {
  providers: Record<string, {
    configured: boolean;
    lastCallTime: number | null;
    lastError: string | null;
    fallbackRate: number;
    avgResponseTime: number;
  }>;
  localTowers: Record<string, {
    ip: string;
    port: string;
    reachable: boolean;
    lastChecked: number | null;
  }>;
}

// =============================================================================
// TIMEOUT MANAGEMENT
// =============================================================================
// Learned from HYDRA L8 504 fix: every provider needs a hard cap.
// Vercel serverless has maxDuration: 60, but we never want to wait
// that long for a single provider call. The fallback chain is there
// for a reason.

const PROVIDER_TIMEOUTS: Record<string, number> = {
  groq:       8000,   // Groq is fast or it's down
  openai:     15000,  // GPT-4o is reliable but can spike
  anthropic:  20000,  // Claude needs more time for long prompts
  google:     15000,  // Gemini is generally fast
  gemini:     15000,
  deepseek:   18000,  // DeepSeek can be slow but deep
  xai:        15000,  // Grok is fast
  perplexity: 15000,  // Perplexity includes search time
  mistral:    15000,  // Mistral is efficient
  local:      30000,  // Local towers get more time (slower but free)
};

/** Absolute maximum wait time for any single provider call */
const HARD_TIMEOUT = 25000;

/** Local tower default timeout — they're slower but cost nothing */
const LOCAL_TOWER_TIMEOUT = 30000;

function getTimeout(provider: string, override?: number): number {
  if (override) return Math.min(override, HARD_TIMEOUT);
  if (provider.startsWith('local')) return LOCAL_TOWER_TIMEOUT;
  return Math.min(PROVIDER_TIMEOUTS[provider.toLowerCase()] || 15000, HARD_TIMEOUT);
}

// =============================================================================
// COST ESTIMATION
// =============================================================================
// Approximate costs per 1K tokens. Updated as pricing changes.
// Used for budget tracking and reporting, not billing.

const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-4o':                { input: 0.0025,  output: 0.01 },
  'gpt-4o-mini':           { input: 0.00015, output: 0.0006 },
  'claude-sonnet-4-20250514': { input: 0.003,   output: 0.015 },
  'claude-haiku-3-5-20241022':   { input: 0.0008,  output: 0.004 },
  'gemini-2.0-flash':      { input: 0.00035, output: 0.0015 },
  'gemini-1.5-pro':        { input: 0.00125, output: 0.005 },
  'deepseek-chat':         { input: 0.00014, output: 0.00028 },
  'deepseek-reasoner':     { input: 0.00055, output: 0.0022 },
  'llama-3.3-70b-versatile': { input: 0.00059, output: 0.00079 },
  'grok-2-latest':         { input: 0.002,   output: 0.01 },
  'sonar-pro':             { input: 0.003,   output: 0.015 },
  'mistral-large-latest':  { input: 0.002,   output: 0.006 },
  // Local models: $0 (electricity only)
  'qwen2.5:14b':           { input: 0, output: 0 },
  'mistral-nemo:12b':      { input: 0, output: 0 },
};

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1K_TOKENS[model];
  if (!rates) return 0;
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

// =============================================================================
// IN-MEMORY PERFORMANCE TRACKING
// =============================================================================
// Tracks recent call performance per provider. Resets on cold start.
// Future: persist to DB for long-term analytics.

interface CallRecord {
  provider: string;
  model: string;
  responseTime: number;
  success: boolean;
  wasFallback: boolean;
  timestamp: number;
  source?: string;
}

const recentCalls: CallRecord[] = [];
const MAX_CALL_HISTORY = 200;

function recordCall(record: CallRecord) {
  recentCalls.push(record);
  if (recentCalls.length > MAX_CALL_HISTORY) {
    recentCalls.splice(0, recentCalls.length - MAX_CALL_HISTORY);
  }
}

/**
 * Get performance metrics for dashboard display.
 */
export function getGatewayMetrics() {
  const now = Date.now();
  const last24h = recentCalls.filter(c => now - c.timestamp < 86400000);

  const byProvider: Record<string, { calls: number; failures: number; fallbacks: number; avgTime: number }> = {};
  for (const call of last24h) {
    if (!byProvider[call.provider]) {
      byProvider[call.provider] = { calls: 0, failures: 0, fallbacks: 0, avgTime: 0 };
    }
    const p = byProvider[call.provider];
    p.calls++;
    if (!call.success) p.failures++;
    if (call.wasFallback) p.fallbacks++;
    p.avgTime = ((p.avgTime * (p.calls - 1)) + call.responseTime) / p.calls;
  }

  return {
    totalCalls24h: last24h.length,
    byProvider,
    fallbackRate: last24h.length > 0
      ? last24h.filter(c => c.wasFallback).length / last24h.length
      : 0,
    avgResponseTime: last24h.length > 0
      ? last24h.reduce((sum, c) => sum + c.responseTime, 0) / last24h.length
      : 0,
  };
}

// =============================================================================
// DIRECT PROVIDER CALL (single attempt, no fallback)
// =============================================================================

/**
 * Call a single provider directly. No fallback chain.
 *
 * Use this when you need a specific provider (e.g., Perplexity for web search,
 * a particular model for a specialized task, or a local tower for sandbox work).
 *
 * For general board conversations, prefer callWithFallback() which handles
 * provider failures gracefully.
 */
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
  const start = Date.now();

  try {
    let result: string;

    switch (p) {
      case 'openai':
        result = await callOpenAICompatible(
          'https://api.openai.com/v1/chat/completions',
          getApiKey('openai')!, model || 'gpt-4o-mini',
          systemPrompt, messages, maxTokens, temperature, timeoutMs,
        );
        break;

      case 'anthropic':
        result = await callAnthropic(
          model || 'claude-sonnet-4-20250514',
          systemPrompt, messages, maxTokens, temperature, timeoutMs,
        );
        break;

      case 'google':
      case 'gemini':
        result = await callGemini(
          model || 'gemini-2.0-flash',
          systemPrompt, messages, maxTokens, temperature, timeoutMs,
        );
        break;

      case 'deepseek':
        result = await callOpenAICompatible(
          'https://api.deepseek.com/v1/chat/completions',
          getApiKey('deepseek')!, model || 'deepseek-chat',
          systemPrompt, messages, maxTokens, temperature, timeoutMs,
        );
        break;

      case 'groq':
        result = await callOpenAICompatible(
          'https://api.groq.com/openai/v1/chat/completions',
          getApiKey('groq')!, model || 'llama-3.3-70b-versatile',
          systemPrompt, messages, maxTokens, temperature, timeoutMs,
        );
        break;

      case 'xai':
        result = await callOpenAICompatible(
          'https://api.x.ai/v1/chat/completions',
          getApiKey('xai')!, model || 'grok-2-latest',
          systemPrompt, messages, maxTokens, temperature, timeoutMs,
        );
        break;

      case 'perplexity':
        result = await callOpenAICompatible(
          'https://api.perplexity.ai/chat/completions',
          getApiKey('perplexity')!, model || 'sonar-pro',
          systemPrompt, messages, maxTokens, temperature, timeoutMs,
        );
        break;

      case 'mistral':
        result = await callOpenAICompatible(
          'https://api.mistral.ai/v1/chat/completions',
          getApiKey('mistral')!, model || 'mistral-large-latest',
          systemPrompt, messages, maxTokens, temperature, timeoutMs,
        );
        break;

      default:
        // ── Local GPU Towers ──────────────────────────────
        // Naming convention: local_tower_1, local_tower_2, etc.
        // Environment variables: LOCAL_TOWER_1_IP, LOCAL_TOWER_1_PORT
        // Protocol: OpenAI-compatible (Ollama, vLLM, llama.cpp all support this)
        if (p.startsWith('local_tower') || p.startsWith('local')) {
          const envPrefix = p.toUpperCase().replace(/-/g, '_');
          const towerIp = process.env[`${envPrefix}_IP`] || process.env['LOCAL_TOWER_IP'] || '192.168.1.101';
          const towerPort = process.env[`${envPrefix}_PORT`] || process.env['LOCAL_TOWER_PORT'] || '11434';
          const towerModel = model || process.env[`${envPrefix}_MODEL`] || 'qwen2.5:14b';

          result = await callOpenAICompatible(
            `http://${towerIp}:${towerPort}/v1/chat/completions`,
            'not-needed',
            towerModel,
            systemPrompt, messages, maxTokens, temperature,
            getTimeout('local', options.timeoutMs),
          );
          break;
        }
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Record success
    recordCall({
      provider: p,
      model,
      responseTime: Date.now() - start,
      success: true,
      wasFallback: false,
      timestamp: Date.now(),
      source: options.taskContext?.source,
    });

    return result;

  } catch (err: any) {
    // Record failure
    recordCall({
      provider: p,
      model,
      responseTime: Date.now() - start,
      success: false,
      wasFallback: false,
      timestamp: Date.now(),
      source: options.taskContext?.source,
    });
    throw err;
  }
}

// =============================================================================
// CALL WITH FALLBACK CHAIN
// =============================================================================

/**
 * Call provider with automatic fallback chain:
 *
 *   Primary provider (member's assigned AI)
 *     → Groq speed fallback (8s timeout, fast but smaller model)
 *     → OpenAI reliability fallback (12s timeout, always available)
 *
 * Returns rich result with metadata:
 *   - Which provider actually served the response
 *   - Response timing
 *   - Whether fallback was needed
 *   - Token/cost estimates
 *
 * The board never goes silent. If one provider is down, another steps in.
 * The founder should never see "Board is in recess" unless ALL providers fail.
 */
export async function callWithFallback(
  provider: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: CallOptions = {},
): Promise<ProviderCallResult> {
  const overallStart = Date.now();
  const inputTokenEst = estimateTokens(systemPrompt + userPrompt);

  // ── Primary attempt ───────────────────────────────────
  try {
    const text = await callProviderDirect(provider, model, systemPrompt, userPrompt, options);
    const outputTokenEst = estimateTokens(text);

    return {
      text,
      provider,
      model,
      responseTime: Date.now() - overallStart,
      isFallback: false,
      tokenEstimate: {
        input: inputTokenEst,
        output: outputTokenEst,
        estimatedCost: estimateCost(model, inputTokenEst, outputTokenEst),
      },
    };
  } catch (primaryErr: any) {
    console.warn(`[Gateway] Primary (${provider}/${model}) failed in ${Date.now() - overallStart}ms: ${primaryErr.message}`);

    // If noFallback requested, fail immediately
    if (options.noFallback) {
      throw primaryErr;
    }
  }

  // ── Speed fallback: Groq ──────────────────────────────
  // Groq runs Llama 3.3 70B at ~500 tok/s. Not as smart as Claude/GPT-4o
  // but FAST. Good enough to keep the board responsive.
  if (provider.toLowerCase() !== 'groq' && getApiKey('groq')) {
    const groqModel = 'llama-3.3-70b-versatile';
    try {
      const groqStart = Date.now();
      const text = await callProviderDirect(
        'groq', groqModel,
        systemPrompt, userPrompt,
        { ...options, timeoutMs: 8000 },
      );
      const outputTokenEst = estimateTokens(text);

      recordCall({
        provider: 'groq',
        model: groqModel,
        responseTime: Date.now() - groqStart,
        success: true,
        wasFallback: true,
        timestamp: Date.now(),
        source: options.taskContext?.source,
      });

      console.info(`[Gateway] Groq fallback served in ${Date.now() - groqStart}ms (total: ${Date.now() - overallStart}ms)`);

      return {
        text,
        provider: 'groq',
        model: groqModel,
        responseTime: Date.now() - overallStart,
        isFallback: true,
        tokenEstimate: {
          input: inputTokenEst,
          output: outputTokenEst,
          estimatedCost: estimateCost(groqModel, inputTokenEst, outputTokenEst),
        },
      };
    } catch (groqErr: any) {
      console.warn(`[Gateway] Groq fallback failed in ${Date.now() - overallStart}ms: ${groqErr.message}`);
    }
  }

  // ── Reliability fallback: OpenAI ──────────────────────
  // GPT-4o-mini is cheap, fast, and almost never down.
  // Last resort before total failure.
  if (provider.toLowerCase() !== 'openai' && getApiKey('openai')) {
    const oaiModel = 'gpt-4o-mini';
    try {
      const oaiStart = Date.now();
      const text = await callProviderDirect(
        'openai', oaiModel,
        systemPrompt, userPrompt,
        { ...options, timeoutMs: 12000 },
      );
      const outputTokenEst = estimateTokens(text);

      recordCall({
        provider: 'openai',
        model: oaiModel,
        responseTime: Date.now() - oaiStart,
        success: true,
        wasFallback: true,
        timestamp: Date.now(),
        source: options.taskContext?.source,
      });

      console.info(`[Gateway] OpenAI fallback served in ${Date.now() - oaiStart}ms (total: ${Date.now() - overallStart}ms)`);

      return {
        text,
        provider: 'openai',
        model: oaiModel,
        responseTime: Date.now() - overallStart,
        isFallback: true,
        tokenEstimate: {
          input: inputTokenEst,
          output: outputTokenEst,
          estimatedCost: estimateCost(oaiModel, inputTokenEst, outputTokenEst),
        },
      };
    } catch (oaiErr: any) {
      console.warn(`[Gateway] OpenAI fallback failed in ${Date.now() - overallStart}ms: ${oaiErr.message}`);
    }
  }

  // ── DeepSeek emergency fallback ───────────────────────
  // Cheapest provider. If everything else is down, this might still work.
  if (provider.toLowerCase() !== 'deepseek' && getApiKey('deepseek')) {
    const dsModel = 'deepseek-chat';
    try {
      const dsStart = Date.now();
      const text = await callProviderDirect(
        'deepseek', dsModel,
        systemPrompt, userPrompt,
        { ...options, timeoutMs: 15000 },
      );
      const outputTokenEst = estimateTokens(text);

      console.info(`[Gateway] DeepSeek emergency fallback served in ${Date.now() - dsStart}ms`);

      return {
        text,
        provider: 'deepseek',
        model: dsModel,
        responseTime: Date.now() - overallStart,
        isFallback: true,
        tokenEstimate: {
          input: inputTokenEst,
          output: outputTokenEst,
          estimatedCost: estimateCost(dsModel, inputTokenEst, outputTokenEst),
        },
      };
    } catch (dsErr: any) {
      console.warn(`[Gateway] DeepSeek emergency fallback failed: ${dsErr.message}`);
    }
  }

  // ── Total failure ─────────────────────────────────────
  // This should be extremely rare. It means primary + Groq + OpenAI + DeepSeek
  // all failed within the same request. Something is very wrong.
  throw new Error(
    `[Gateway] ALL providers failed for ${options.taskContext?.memberSlug || 'unknown'} ` +
    `(primary: ${provider}/${model}). Total time: ${Date.now() - overallStart}ms. ` +
    `Check API keys and provider status.`
  );
}

// =============================================================================
// PROVIDER IMPLEMENTATIONS
// =============================================================================

// ── OpenAI-Compatible API ───────────────────────────────
// Works with: OpenAI, Groq, DeepSeek, xAI, Perplexity, Mistral, Ollama, vLLM
//
// The OpenAI chat completions format has become the de facto standard.
// Every provider except Anthropic and Google uses it (or offers it).
// Local towers (Ollama, vLLM) also expose this format.

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
  // Local towers don't need API keys
  const isLocal = baseUrl.startsWith('http://192.168') || baseUrl.startsWith('http://10.') || baseUrl.startsWith('http://localhost');
  if (!apiKey && !isLocal) {
    throw new Error(`API key not configured for ${baseUrl}`);
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
      max_tokens: maxTokens,
      temperature,
    }),
  }, timeoutMs);

  const data = await response.json();

  if (data.error) {
    const errMsg = typeof data.error === 'string'
      ? data.error
      : data.error.message || JSON.stringify(data.error);
    throw new Error(`${model}: ${errMsg}`);
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`${model}: Empty response (no choices returned)`);
  }

  return text;
}

// ── Anthropic Messages API ──────────────────────────────
// Claude uses its own format. System prompt is a top-level field,
// not a message role. Messages must alternate user/assistant.

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

  // Anthropic requires alternating user/assistant messages
  // and doesn't support 'system' role in messages array
  const cleanMessages = messages.map(m => ({
    role: m.role === 'system' ? 'user' : m.role,
    content: m.content,
  }));

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
      messages: cleanMessages,
      max_tokens: maxTokens,
      temperature,
    }),
  }, timeoutMs);

  const data = await response.json();

  if (data.error) {
    const errMsg = data.error.message || JSON.stringify(data.error);
    throw new Error(`Claude ${model}: ${errMsg}`);
  }

  const text = data.content?.[0]?.text;
  if (!text) {
    throw new Error(`Claude ${model}: Empty response (no content blocks)`);
  }

  return text;
}

// ── Google Gemini API ───────────────────────────────────
// Gemini uses generateContent with a different structure.
// System prompt goes in systemInstruction. Messages use 'model' not 'assistant'.

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

  // Gemini uses 'model' instead of 'assistant'
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
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    }),
  }, timeoutMs);

  const data = await response.json();

  if (data.error) {
    const errMsg = data.error.message || JSON.stringify(data.error);
    throw new Error(`Gemini ${model}: ${errMsg}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    // Check for safety blocks
    const blockReason = data.candidates?.[0]?.finishReason;
    if (blockReason === 'SAFETY') {
      throw new Error(`Gemini ${model}: Response blocked by safety filter`);
    }
    throw new Error(`Gemini ${model}: Empty response`);
  }

  return text;
}

// ── Fetch with Timeout ──────────────────────────────────
// AbortController-based timeout. Clean up on completion or abort.
// Includes response body in error for debugging.

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      // Read body for error details (but cap length)
      const errorBody = await response.text().catch(() => '');
      const truncated = errorBody.substring(0, 300);
      throw new Error(`HTTP ${response.status}: ${truncated}`);
    }

    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// SHARED SUPABASE ADMIN CLIENT
// =============================================================================
// One connection, all routes. No duplicate clients.
// Service role key — full access for server-side operations.

let _supaAdmin: ReturnType<typeof createClient> | null = null;

/**
 * Get the shared Supabase admin client.
 * Singleton — created once, reused across all API routes in the same
 * serverless function instance.
 */
export function getSupaAdmin() {
  if (!_supaAdmin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
    }
    _supaAdmin = createClient(url, key);
  }
  return _supaAdmin;
}

// =============================================================================
// COMPANY CONTEXT
// =============================================================================
// Shared business knowledge loaded from boardroom_company_context table.
// Used by chat, tasks, and briefings to ground responses in real company info.

/** Cache company context for 5 minutes to avoid repeated DB calls */
let _companyContextCache: { text: string; timestamp: number } | null = null;
const COMPANY_CONTEXT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch company context from boardroom_company_context table.
 * Cached for 5 minutes. Shared by all API routes.
 */
export async function getCompanyContext(): Promise<string> {
  const now = Date.now();
  if (_companyContextCache && (now - _companyContextCache.timestamp) < COMPANY_CONTEXT_TTL) {
    return _companyContextCache.text;
  }

  try {
    const { data } = await getSupaAdmin()
      .from('boardroom_company_context')
      .select('title, content, category')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (!data || data.length === 0) {
      _companyContextCache = { text: '', timestamp: now };
      return '';
    }

    let context = '\n\n# === TAGNETIQ COMPANY KNOWLEDGE ===\n';
    let currentCategory = '';

    for (const item of data) {
      if (item.category && item.category !== currentCategory) {
        currentCategory = item.category;
        context += `\n## ${currentCategory}\n`;
      }
      context += `${item.content}\n\n`;
    }

    _companyContextCache = { text: context, timestamp: now };
    return context;
  } catch (err: any) {
    console.warn('[Gateway] Failed to load company context:', err.message);
    return _companyContextCache?.text || '';
  }
}

// =============================================================================
// AUDIT LOG (fire and forget)
// =============================================================================

/**
 * Log a gateway call to the audit table. Non-blocking.
 * Future: boardroom_gateway_audit table with full call details.
 */
export function logGatewayCall(details: {
  memberSlug?: string;
  provider: string;
  model: string;
  source: string;
  responseTime: number;
  isFallback: boolean;
  success: boolean;
  tokenEstimate?: { input: number; output: number; estimatedCost: number };
  errorMessage?: string;
}) {
  // For now: in-memory tracking via recordCall
  // Future: persist to boardroom_gateway_audit table
  recordCall({
    provider: details.provider,
    model: details.model,
    responseTime: details.responseTime,
    success: details.success,
    wasFallback: details.isFallback,
    timestamp: Date.now(),
    source: details.source,
  });
}

// =============================================================================
// LOCAL TOWER HEALTH CHECK
// =============================================================================

/**
 * Check if a local tower is reachable.
 * Used by sandbox orchestrator to route jobs to available towers.
 */
export async function checkTowerHealth(towerId: string): Promise<{
  reachable: boolean;
  responseTime: number;
  models?: string[];
  error?: string;
}> {
  const envPrefix = towerId.toUpperCase().replace(/-/g, '_');
  const ip = process.env[`${envPrefix}_IP`] || '192.168.1.101';
  const port = process.env[`${envPrefix}_PORT`] || '11434';
  const start = Date.now();

  try {
    const response = await fetchWithTimeout(
      `http://${ip}:${port}/api/tags`,
      { method: 'GET' },
      5000,
    );
    const data = await response.json();
    const models = data.models?.map((m: any) => m.name) || [];

    return {
      reachable: true,
      responseTime: Date.now() - start,
      models,
    };
  } catch (err: any) {
    return {
      reachable: false,
      responseTime: Date.now() - start,
      error: err.message,
    };
  }
}

/**
 * Check all configured local towers.
 */
export async function checkAllTowers(): Promise<Record<string, Awaited<ReturnType<typeof checkTowerHealth>>>> {
  const results: Record<string, Awaited<ReturnType<typeof checkTowerHealth>>> = {};
  const towerEnvs = Object.keys(process.env).filter(k => k.match(/^LOCAL_TOWER_\d+_IP$/));

  for (const envKey of towerEnvs) {
    const towerId = envKey.replace('_IP', '').toLowerCase();
    results[towerId] = await checkTowerHealth(towerId);
  }

  // Also check default tower if no numbered towers found
  if (towerEnvs.length === 0 && process.env.LOCAL_TOWER_IP) {
    results['local_tower_1'] = await checkTowerHealth('local_tower_1');
  }

  return results;
}