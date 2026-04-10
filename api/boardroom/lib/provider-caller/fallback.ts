// FILE: api/boardroom/lib/provider-caller/fallback.ts
// ═══════════════════════════════════════════════════════════════════════
// PROVIDER CALL ORCHESTRATION & FALLBACK CHAIN
// ═══════════════════════════════════════════════════════════════════════
//
// Two main functions:
//
//   callProviderDirect()  — Single provider, no safety net.
//                           Use when you need a specific provider.
//
//   callWithFallback()    — Primary → Groq speed → OpenAI reliable → DeepSeek.
//                           The board never goes silent.
//
// v2.0: llama4 case added to callProviderDirect switch.
//   Routes Sal, Janus, Scuba Steve, and Aegle to Groq's OpenAI-compatible
//   endpoint using Llama 4 Maverick/Scout model strings.
//   Uses getApiKey('groq') — same GROQ_API_KEY, different model tier.
//
//   Fallback note: llama4 members skip the Groq speed fallback since they
//   already run on Groq infrastructure — if Llama 4 is down, Groq Llama 3
//   is likely also affected. They fall through directly to OpenAI instead.
//
// ═══════════════════════════════════════════════════════════════════════

import { getApiKey, getTimeout, estimateTokens, estimateCost } from './config.js';
import { callOpenAICompatible, callAnthropic, callGemini } from './providers.js';
import { recordCall } from './metrics.js';
import type { ProviderCallResult, CallOptions, ChatMessage } from './types.js';

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
  const messages: ChatMessage[] = [{ role: 'user', content: userPrompt }];
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

      // ── v2.0: Llama 4 via Groq ──────────────────────────────────────
      // Sal (COO), Janus (CIO), Scuba Steve (Research), Aegle (CSciO)
      // Same Groq infrastructure as 'groq' case above, but frontier
      // Llama 4 model tier. Both use GROQ_API_KEY independently.
      case 'llama4':
        result = await callOpenAICompatible(
          'https://api.groq.com/openai/v1/chat/completions',
          getApiKey('groq')!, model || 'meta-llama/llama-4-maverick-17b-128e-instruct',
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
 *       NOTE: skipped for llama4 members — same Groq infrastructure,
 *       if Llama 4 is down Groq Llama 3 is likely also affected
 *     → OpenAI reliability fallback (12s timeout, always available)
 *     → DeepSeek emergency fallback (cheapest, last resort)
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
  //
  // v2.0: Skip for llama4 members — they already run on Groq infrastructure.
  // If Llama 4 via Groq failed, Groq Llama 3 is likely also unavailable.
  // Fall through directly to OpenAI instead.
  const isLlama4 = provider.toLowerCase() === 'llama4';
  if (!isLlama4 && provider.toLowerCase() !== 'groq' && getApiKey('groq')) {
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