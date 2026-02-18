// FILE: src/lib/oracle/providers/caller.ts
// Unified Oracle Provider Caller
//
// Sprint F:  Provider Registry + Hot-Loading
// Sprint N+: Time-budget-aware fallback chain
//
// Single function that calls ANY provider and returns the response text.
// Handles three API formats:
//   1. OpenAI-compatible (OpenAI, Groq, DeepSeek, xAI, Perplexity)
//   2. Anthropic Messages API
//   3. Google Gemini API
//
// The chat handler doesn't need to know which provider it's calling —
// it just passes the routing decision and gets text back.
//
// ═══════════════════════════════════════════════════════════════════════
// TIME BUDGET FIX — February 2026
// ═══════════════════════════════════════════════════════════════════════
//
// Problem: Primary provider times out at 25s, fallback gets 5s,
//          speech generation gets 0s → cascade failure → robot voice.
//
// Fix: When fallbacks exist, cap primary timeout to leave room.
//      Track elapsed time. Skip fallbacks if budget exhausted.
//
//   Budget strategy:
//     - Total budget: 20s (leave 10s for speech + response)
//     - Primary: min(provider.timeout, budget * 0.5) → ~10s max
//     - Fallback: remaining budget
//     - If primary fails FAST (404/401 = <1s), fallback gets ~19s
//     - If primary fails SLOW (timeout), fallback gets ~10s
// ═══════════════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════════════
// PERPLEXITY 404 FIX — February 18, 2026
// ═══════════════════════════════════════════════════════════════════════
// Perplexity's API endpoint is /chat/completions (no /v1/ prefix).
// The caller was constructing ${baseUrl}/v1/chat/completions for ALL
// OpenAI-compatible providers, which 404'd on Perplexity.
//
// Fix: Added optional chatEndpoint to OracleProviderConfig.
// Default: '/v1/chat/completions' (works for OpenAI, Groq, DeepSeek, xAI)
// Perplexity: '/chat/completions'
// ═══════════════════════════════════════════════════════════════════════
//
// Mobile-first: All provider logic is server-side. Client sends a message,
// gets a response. Doesn't know or care which model answered.

import type { OracleProviderId, OracleProviderConfig } from './registry.js';
import { ORACLE_PROVIDERS, getProviderApiKey } from './registry.js';
import type { RoutingDecision } from './router.js';

// =============================================================================
// TYPES
// =============================================================================

export interface OracleMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CallerResult {
  /** The response text from the model */
  text: string;
  /** Which provider actually answered */
  providerId: OracleProviderId;
  /** Which model was used */
  model: string;
  /** Response time in ms */
  responseTime: number;
  /** Whether this was a fallback (not the primary choice) */
  isFallback: boolean;
}

// =============================================================================
// TIME BUDGET
// =============================================================================

// Total time budget for the LLM call phase.
// chat.ts maxDuration is 30s. We need to leave room for:
//   - speech generation (~8-12s)
//   - response serialization (~200ms)
//   - safety logging, trust recording (~100ms)
// So LLM budget = 20s max.
const TOTAL_LLM_BUDGET_MS = 20_000;

// Minimum time needed for a fallback call to be worthwhile
const MIN_FALLBACK_BUDGET_MS = 3_000;

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Call the Oracle's selected provider with full fallback chain.
 *
 * Time-budget-aware: tracks elapsed time, caps provider timeouts
 * so fallbacks always have a chance. If primary fails fast (404/401),
 * fallback gets almost the full budget. If primary fails slow (timeout),
 * fallback gets the remainder.
 *
 * @param routing   - The routing decision from router.ts
 * @param messages  - Conversation messages (system + history + user)
 */
export async function callOracle(
  routing: RoutingDecision,
  messages: OracleMessage[]
): Promise<CallerResult> {
  const startTime = Date.now();
  const hasFallbacks = routing.fallbacks && routing.fallbacks.length > 0;

  // ── Calculate primary timeout ─────────────────────────
  // If we have fallbacks, cap primary so there's always time for a fallback.
  // If no fallbacks, give primary the full budget.
  const primaryTimeout = hasFallbacks
    ? Math.min(ORACLE_PROVIDERS[routing.providerId]?.timeout || 15000, Math.floor(TOTAL_LLM_BUDGET_MS * 0.5))
    : Math.min(ORACLE_PROVIDERS[routing.providerId]?.timeout || 25000, TOTAL_LLM_BUDGET_MS);

  // ── Try primary provider ──────────────────────────────
  try {
    const text = await callProvider(routing.providerId, messages, {
      model: routing.model,
      temperature: routing.temperature,
      maxTokens: routing.maxTokens,
      timeoutMs: primaryTimeout,
    });

    return {
      text,
      providerId: routing.providerId,
      model: routing.model,
      responseTime: Date.now() - startTime,
      isFallback: false,
    };
  } catch (primaryError: any) {
    const elapsed = Date.now() - startTime;
    console.warn(
      `Oracle primary provider ${routing.providerId} failed after ${elapsed}ms: ${primaryError.message}`
    );
  }

  // ── Try fallbacks with remaining budget ───────────────
  if (!hasFallbacks) {
    throw new Error('Oracle primary provider failed and no fallbacks configured.');
  }

  for (const fallbackId of routing.fallbacks) {
    const elapsed = Date.now() - startTime;
    const remaining = TOTAL_LLM_BUDGET_MS - elapsed;

    // Not enough time for a meaningful call? Skip.
    if (remaining < MIN_FALLBACK_BUDGET_MS) {
      console.warn(
        `Oracle: Skipping fallback ${fallbackId} — only ${remaining}ms remaining (need ${MIN_FALLBACK_BUDGET_MS}ms)`
      );
      continue;
    }

    const config = ORACLE_PROVIDERS[fallbackId];
    if (!config) continue;

    try {
      const fallbackStart = Date.now();
      const fallbackTimeout = Math.min(config.timeout, remaining);

      // Always use the fallback provider's FULL model, not its fallbackModel.
      // The user deserves the best brain regardless of how we got here.
      const text = await callProvider(fallbackId, messages, {
        model: config.model,
        temperature: routing.temperature,
        maxTokens: routing.maxTokens,
        timeoutMs: fallbackTimeout,
      });

      console.log(`Oracle fallback ${fallbackId} succeeded (${Date.now() - fallbackStart}ms)`);

      return {
        text,
        providerId: fallbackId,
        model: config.model,
        responseTime: Date.now() - startTime,
        isFallback: true,
      };
    } catch (fallbackError: any) {
      console.warn(
        `Oracle fallback ${fallbackId} failed after ${Date.now() - startTime}ms: ${fallbackError.message}`
      );
    }
  }

  throw new Error('All Oracle providers failed. No response available.');
}

// =============================================================================
// PROVIDER-SPECIFIC CALLERS
// =============================================================================

interface CallOptions {
  model: string;
  temperature: number;
  maxTokens: number;
  /** Override timeout for this specific call */
  timeoutMs?: number;
}

/**
 * Route to the correct API format for a provider.
 */
async function callProvider(
  providerId: OracleProviderId,
  messages: OracleMessage[],
  options: CallOptions
): Promise<string> {
  const config = ORACLE_PROVIDERS[providerId];
  const apiKey = getProviderApiKey(providerId);

  if (!apiKey) {
    throw new Error(`No API key for ${providerId}`);
  }

  // Use the explicit timeout if provided, otherwise fall back to config
  const timeout = options.timeoutMs || config.timeout;

  // Anthropic uses its own API format
  if (providerId === 'anthropic') {
    return callAnthropic(apiKey, messages, options, timeout);
  }

  // Google uses Gemini API format
  if (providerId === 'google') {
    return callGoogle(apiKey, messages, options, config, timeout);
  }

  // Everything else is OpenAI-compatible
  return callOpenAICompatible(apiKey, messages, options, config, timeout);
}

// =============================================================================
// OPENAI-COMPATIBLE (OpenAI, Groq, DeepSeek, xAI, Perplexity)
// =============================================================================

async function callOpenAICompatible(
  apiKey: string,
  messages: OracleMessage[],
  options: CallOptions,
  config: OracleProviderConfig,
  timeout: number
): Promise<string> {
  // ── URL construction ──────────────────────────────────
  // Each provider can specify its own chat endpoint path.
  // Default: /v1/chat/completions (OpenAI, Groq, DeepSeek, xAI)
  // Perplexity: /chat/completions (no /v1/ prefix — their API 404s with it)
  const baseUrl = config.baseUrl || 'https://api.openai.com';
  const chatEndpoint = config.chatEndpoint || '/v1/chat/completions';
  const url = `${baseUrl}${chatEndpoint}`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    }),
  }, timeout);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`${config.name} API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(`${config.name} returned empty response`);
  }

  return text;
}

// =============================================================================
// ANTHROPIC (Messages API)
// =============================================================================

async function callAnthropic(
  apiKey: string,
  messages: OracleMessage[],
  options: CallOptions,
  timeout: number
): Promise<string> {
  // Anthropic separates system prompt from messages
  const systemMessages = messages.filter(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const systemPrompt = systemMessages.map(m => m.content).join('\n\n');

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: systemPrompt,
      messages: chatMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    }),
  }, timeout);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Anthropic API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;

  if (!text) {
    throw new Error('Anthropic returned empty response');
  }

  return text;
}

// =============================================================================
// GOOGLE GEMINI (generateContent API)
// =============================================================================

async function callGoogle(
  apiKey: string,
  messages: OracleMessage[],
  options: CallOptions,
  config: OracleProviderConfig,
  timeout: number
): Promise<string> {
  const model = options.model || config.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Gemini uses a different message format
  const systemMessages = messages.filter(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const systemInstruction = systemMessages.length > 0
    ? { parts: [{ text: systemMessages.map(m => m.content).join('\n\n') }] }
    : undefined;

  // Map roles: user → user, assistant → model
  const contents = chatMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: any = {
    contents,
    generationConfig: {
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, timeout);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Google API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Google returned empty response');
  }

  return text;
}

// =============================================================================
// UTILS
// =============================================================================

/**
 * Fetch with timeout. Throws if the request takes too long.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}