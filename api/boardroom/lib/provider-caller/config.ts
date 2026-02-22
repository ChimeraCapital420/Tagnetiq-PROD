// FILE: api/boardroom/lib/provider-caller/config.ts
// ═══════════════════════════════════════════════════════════════════════
// GATEWAY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════
//
// API key registry, timeout management, cost estimation.
// All the "knobs" in one place. Easy to tune, impossible to lose.
//
// ═══════════════════════════════════════════════════════════════════════

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
export const HARD_TIMEOUT = 25000;

/** Local tower default timeout — they're slower but cost nothing */
export const LOCAL_TOWER_TIMEOUT = 30000;

export function getTimeout(provider: string, override?: number): number {
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

export function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1K_TOKENS[model];
  if (!rates) return 0;
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}