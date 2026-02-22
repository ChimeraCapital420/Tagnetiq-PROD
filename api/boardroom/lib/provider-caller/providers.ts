// FILE: api/boardroom/lib/provider-caller/providers.ts
// ═══════════════════════════════════════════════════════════════════════
// AI PROVIDER IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════
//
// Three protocol families cover all 8+ cloud providers + local towers:
//
//   1. OpenAI-Compatible  → OpenAI, Groq, DeepSeek, xAI, Perplexity,
//                           Mistral, Ollama, vLLM, llama.cpp
//   2. Anthropic Messages → Claude (own format)
//   3. Google Gemini      → Gemini (own format)
//
// Each function takes raw params and returns the response text.
// No fallback logic here — that lives in fallback.ts.
//
// ═══════════════════════════════════════════════════════════════════════

import { getApiKey } from './config.js';
import { fetchWithTimeout } from './utils.js';
import type { ChatMessage } from './types.js';

// =============================================================================
// OpenAI-Compatible API
// =============================================================================
// Works with: OpenAI, Groq, DeepSeek, xAI, Perplexity, Mistral, Ollama, vLLM
//
// The OpenAI chat completions format has become the de facto standard.
// Every provider except Anthropic and Google uses it (or offers it).
// Local towers (Ollama, vLLM) also expose this format.

export async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
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

// =============================================================================
// Anthropic Messages API
// =============================================================================
// Claude uses its own format. System prompt is a top-level field,
// not a message role. Messages must alternate user/assistant.

export async function callAnthropic(
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
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

// =============================================================================
// Google Gemini API
// =============================================================================
// Gemini uses generateContent with a different structure.
// System prompt goes in systemInstruction. Messages use 'model' not 'assistant'.

export async function callGemini(
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
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