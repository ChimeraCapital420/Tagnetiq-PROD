// FILE: src/lib/oracle/providers/caller.ts
// Unified Oracle Provider Caller
//
// Sprint F: Provider Registry + Hot-Loading
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
// PUBLIC API
// =============================================================================

/**
 * Call the Oracle's selected provider with full fallback chain.
 *
 * Tries the primary provider first, then falls through the fallback
 * chain until one succeeds. If all fail, throws an error.
 *
 * @param routing   - The routing decision from router.ts
 * @param messages  - Conversation messages (system + history + user)
 */
export async function callOracle(
  routing: RoutingDecision,
  messages: OracleMessage[]
): Promise<CallerResult> {
  const startTime = Date.now();

  // Try primary provider
  try {
    const text = await callProvider(routing.providerId, messages, {
      model: routing.model,
      temperature: routing.temperature,
      maxTokens: routing.maxTokens,
    });

    return {
      text,
      providerId: routing.providerId,
      model: routing.model,
      responseTime: Date.now() - startTime,
      isFallback: false,
    };
  } catch (primaryError: any) {
    console.warn(`Oracle primary provider ${routing.providerId} failed: ${primaryError.message}`);
  }

  // Try fallbacks in order
  for (const fallbackId of routing.fallbacks) {
    try {
      const config = ORACLE_PROVIDERS[fallbackId];
      const fallbackStart = Date.now();

      const text = await callProvider(fallbackId, messages, {
        model: config.model,
        temperature: routing.temperature,
        maxTokens: routing.maxTokens,
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
      console.warn(`Oracle fallback ${fallbackId} failed: ${fallbackError.message}`);
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

  // Anthropic uses its own API format
  if (providerId === 'anthropic') {
    return callAnthropic(apiKey, messages, options);
  }

  // Google uses Gemini API format
  if (providerId === 'google') {
    return callGoogle(apiKey, messages, options, config);
  }

  // Everything else is OpenAI-compatible
  return callOpenAICompatible(apiKey, messages, options, config);
}

// =============================================================================
// OPENAI-COMPATIBLE (OpenAI, Groq, DeepSeek, xAI, Perplexity)
// =============================================================================

async function callOpenAICompatible(
  apiKey: string,
  messages: OracleMessage[],
  options: CallOptions,
  config: OracleProviderConfig
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.openai.com';
  const url = `${baseUrl}/v1/chat/completions`;

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
  }, config.timeout);

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
  options: CallOptions
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
  }, ORACLE_PROVIDERS.anthropic.timeout);

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
  config: OracleProviderConfig
): Promise<string> {
  const model = options.model || config.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Gemini uses a different message format
  // System instruction is separate, then contents array
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
  }, config.timeout);

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