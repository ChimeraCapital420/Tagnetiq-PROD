/**
 * HYDRA v8.0 - AI Provider Configuration
 *
 * Centralized configuration for all AI providers used in the consensus engine.
 *
 * v7.0: Added Llama 4 as a standalone provider via Groq inference.
 *   Llama 4 Maverick: multimodal (vision + text), 128k context, 128 experts
 *   Llama 4 Scout: multimodal, 10M context window, cost-efficient
 *
 *   IMPORTANT: Llama 4 and Groq are SEPARATE providers in HYDRA.
 *   - groq: runs Llama 3 models (fast inference, text-only in HYDRA context)
 *   - llama4: runs Llama 4 Maverick/Scout via Groq (multimodal, vision-capable)
 *   Both use the same GROQ_API_KEY but vote independently in consensus.
 *
 * v8.0: Added Kimi K2.6 as provider #10 (Moonshot AI).
 *   Kimi K2.6: Native multimodal MoE, 1T total / 32B active params.
 *   262K context window. Agent Swarm (100 parallel sub-agents).
 *   Scored 80.2 on SWE-Bench Verified — competitive with Claude Opus 4.6.
 *   OpenAI-compatible API — drops into HYDRA pipeline with zero changes to analyze.ts.
 *
 *   Why Kimi earns a PRIMARY VISION seat:
 *   - Native multimodal (vision + text pretrained together, not bolted on)
 *   - 262K context holds full scan history, all HYDRA votes, and authority data simultaneously
 *   - Agent Swarm architecture maps directly to RH-035 hierarchical intelligence
 *   - $0.60/M input tokens — among the cheapest frontier vision models
 *   - Modified MIT license — open weights, no IP concerns for integration
 *   - Janus (CIO) board seat: monitors Chinese AI development — Kimi IS that intelligence
 *
 *   Uses MOONSHOT_API_KEY or KIMI_API_KEY.
 *   OpenAI-compatible endpoint: https://api.moonshot.cn/v1
 *
 * v8.1: Updated Llama 4 model string.
 *   Groq deprecated meta-llama/llama-4-maverick-17b-128e-instruct on Feb 20, 2026.
 *   Replacement: openai/gpt-oss-120b — Groq's recommended successor.
 *
 * HYDRA now has 10 independent AI voices:
 *   Primary Vision (5): OpenAI, Anthropic, Google, Llama 4, Kimi
 *   Secondary (4):      Mistral, Groq, xAI, Perplexity
 *   Tiebreaker (1):     DeepSeek
 *
 * @module hydra/config/providers
 */

export interface ProviderConfig {
  /** Display name for logging */
  name: string;
  /** Environment variable names to check for API key (in priority order) */
  envKeys: string[];
  /** Available models for this provider */
  models: string[];
  /** Primary model to use */
  primaryModel: string;
  /** Whether this provider supports vision/image analysis */
  supportsVision: boolean;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Weight multiplier for consensus voting (0-1) */
  weight: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Base URL for API calls (optional, uses SDK default if not set) */
  baseUrl?: string;
  /** Whether this provider is used for tiebreaking only */
  tiebreakerOnly?: boolean;
}

/**
 * AI Provider Configurations
 *
 * Primary Vision Models (Stage 1) — 5 providers:
 * - OpenAI GPT-4o:           Best overall accuracy, excellent vision
 * - Anthropic Claude Sonnet: Strong reasoning, good vision
 * - Google Gemini 2.0 Flash: Fast, good vision, cost-effective
 * - Llama 4 / GPT-OSS-120B:  Groq-hosted, frontier multimodal
 * - Kimi K2.6:               Moonshot MoE, 262K context, Agent Swarm, 80.2 SWE-bench
 *
 * Secondary Models (Stage 2) — 4 providers:
 * - Mistral:    Strong reasoning, cost-effective
 * - Groq:       Ultra-fast Llama 3 text inference — independent from Llama 4
 * - xAI Grok:   Real-time knowledge, good reasoning
 * - Perplexity: Real-time market search, web knowledge
 *
 * Tiebreaker — 1 provider:
 * - DeepSeek: Text-only, used when primary models disagree
 */
export const AI_PROVIDERS: Record<string, ProviderConfig> = {

  // ==========================================================================
  // PRIMARY VISION MODELS (Stage 1) — ALL support image analysis
  // ==========================================================================

  openai: {
    name: 'OpenAI',
    envKeys: ['OPENAI_API_KEY', 'OPEN_AI_API_KEY'],
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    primaryModel: 'gpt-4o',
    supportsVision: true,
    timeout: 30000,
    weight: 1.0,
    maxRetries: 2,
  },

  anthropic: {
    name: 'Anthropic',
    envKeys: ['ANTHROPIC_API_KEY', 'ANTHROPIC_SECRET'],
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    primaryModel: 'claude-sonnet-4-20250514',
    supportsVision: true,
    timeout: 30000,
    weight: 1.0,
    maxRetries: 2,
  },

  google: {
    name: 'Google',
    envKeys: ['GOOGLE_AI_API_KEY', 'GOOGLE_AI_TOKEN', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    primaryModel: 'gemini-2.0-flash',
    supportsVision: true,
    timeout: 30000,
    weight: 1.0,
    maxRetries: 2,
  },

  // --------------------------------------------------------------------------
  // v7.0: LLAMA 4 — Standalone provider via Groq inference
  // v8.1: Model updated — Groq deprecated llama-4-maverick on Feb 20, 2026.
  //        New model: openai/gpt-oss-120b (Groq's recommended replacement).
  //        Scout remains available as fallback.
  // --------------------------------------------------------------------------
  llama4: {
    name: 'Llama 4',
    envKeys: ['GROQ_API_KEY'],
    models: [
      'openai/gpt-oss-120b',                      // v8.1: replaces deprecated Maverick
      'meta-llama/llama-4-scout-17b-16e-instruct', // Scout still available
    ],
    primaryModel: 'openai/gpt-oss-120b',
    supportsVision: true,
    timeout: 20000,
    weight: 0.95,
    maxRetries: 2,
    baseUrl: 'https://api.groq.com/openai/v1',
  },

  // --------------------------------------------------------------------------
  // v8.0: KIMI K2.6 — Moonshot AI, provider #10
  // --------------------------------------------------------------------------
  // 1T total / 32B active MoE. Native multimodal. 262K context window.
  // Agent Swarm: 100 parallel sub-agents for complex tasks.
  // OpenAI-compatible API — zero changes needed downstream.
  //
  // Board assignment: Janus (CIO) — Chinese AI intelligence monitoring.
  // Kimi is the board's direct window into Moonshot's architecture.
  //
  // RH-035 connection: Agent Swarm IS the hierarchical intelligence
  // architecture described in RH-035. Kimi has already built what we
  // are building. Study their implementation.
  //
  // env vars: MOONSHOT_API_KEY (primary) or KIMI_API_KEY (alias)
  // --------------------------------------------------------------------------
  kimi: {
    name: 'Kimi',
    envKeys: ['AI_GATEWAY_API_KEY', 'MOONSHOT_API_KEY', 'KIMI_API_KEY'],
    models: [
      'moonshotai/kimi-k2.6',   // Latest — via Vercel AI Gateway
      'moonshotai/kimi-k2.5',   // Fallback — via Vercel AI Gateway
    ],
    primaryModel: 'moonshotai/kimi-k2.6',
    supportsVision: true,     // Native multimodal — vision pretrained alongside text
    timeout: 30000,
    weight: 0.90,             // Strong weight — frontier model, validated on SWE-bench
    maxRetries: 2,
    baseUrl: 'https://ai-gateway.vercel.sh/v1',  // Vercel AI Gateway — US-hosted, no geo-restriction
  },

  // ==========================================================================
  // SECONDARY MODELS (Stage 2 — Text/Reasoning)
  // ==========================================================================

  mistral: {
    name: 'Mistral',
    envKeys: ['MISTRAL_API_KEY'],
    models: ['mistral-large-latest', 'mistral-small-latest', 'mistral-medium-latest'],
    primaryModel: 'mistral-small-latest',
    supportsVision: false,
    timeout: 25000,
    weight: 0.75,
    maxRetries: 2,
    baseUrl: 'https://api.mistral.ai',
  },

  // Groq: Llama 3 models — fast text reasoning, independent from Llama 4
  groq: {
    name: 'Groq',
    envKeys: ['GROQ_API_KEY'],
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
    ],
    primaryModel: 'llama-3.3-70b-versatile',
    supportsVision: false,
    timeout: 15000,
    weight: 0.75,
    maxRetries: 2,
    baseUrl: 'https://api.groq.com/openai/v1',
  },

  xai: {
    name: 'xAI',
    envKeys: ['XAI_API_KEY', 'XAI_SECRET', 'GROK_API_KEY'],
    models: ['grok-3', 'grok-3-mini', 'grok-2'],
    primaryModel: 'grok-3',
    supportsVision: false,
    timeout: 30000,
    weight: 0.80,
    maxRetries: 2,
    baseUrl: 'https://api.x.ai',
  },

  perplexity: {
    name: 'Perplexity',
    envKeys: ['PERPLEXITY_API_KEY', 'PPLX_API_KEY'],
    models: ['sonar', 'sonar-pro', 'sonar-reasoning'],
    primaryModel: 'sonar',
    supportsVision: false,
    timeout: 20000,
    weight: 0.85,
    maxRetries: 2,
    baseUrl: 'https://api.perplexity.ai',
  },

  // ==========================================================================
  // TIEBREAKER
  // ==========================================================================

  deepseek: {
    name: 'DeepSeek',
    envKeys: ['DEEPSEEK_API_KEY', 'DEEPSEEK_TOKEN'],
    models: ['deepseek-chat', 'deepseek-reasoner'],
    primaryModel: 'deepseek-chat',
    supportsVision: false,
    timeout: 45000,
    weight: 0.6,
    maxRetries: 1,
    baseUrl: 'https://api.deepseek.com',
    tiebreakerOnly: true,
  },
};

/**
 * Provider groups for different analysis stages
 *
 * v8.0: kimi added to primaryVision, visionCapable, all.
 *       Total providers: 10 independent AI voices.
 */
export const PROVIDER_GROUPS = {
  /** Primary vision-capable models for Stage 1 analysis */
  primaryVision: ['openai', 'anthropic', 'google', 'llama4', 'kimi'],
  /** Secondary text-based models for additional analysis */
  secondary: ['mistral', 'groq', 'xai', 'perplexity'],
  /** Text-only models for Stage 2 context analysis */
  textOnly: ['deepseek', 'mistral', 'groq', 'xai'],
  /** All providers that support vision */
  visionCapable: ['openai', 'anthropic', 'google', 'llama4', 'kimi'],
  /** Providers used for tiebreaking */
  tiebreakers: ['deepseek'],
  /** Providers with real-time market/web search */
  marketSearch: ['perplexity'],
  /** Fast inference providers */
  fastInference: ['groq', 'llama4'],
  /** Extended context providers (100K+ tokens) */
  longContext: ['kimi', 'llama4'],
  /** All available providers — 10 total */
  all: ['openai', 'anthropic', 'google', 'llama4', 'kimi', 'mistral', 'groq', 'xai', 'perplexity', 'deepseek'],
} as const;

/**
 * Get API key for a provider
 */
export function getApiKey(provider: string): string | null {
  const normalizedProvider = provider.toLowerCase();
  const config = AI_PROVIDERS[normalizedProvider];

  if (!config) {
    console.warn(`⚠️ Unknown provider: ${provider}`);
    return null;
  }

  for (const envKey of config.envKeys) {
    const value = process.env[envKey];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

/**
 * Check if a provider is available (has API key configured)
 */
export function isProviderAvailable(provider: string): boolean {
  return getApiKey(provider) !== null;
}

/**
 * Get list of available providers
 */
export function getAvailableProviders(visionOnly: boolean = false): string[] {
  return Object.entries(AI_PROVIDERS)
    .filter(([name, config]) => {
      if (!isProviderAvailable(name)) return false;
      if (visionOnly && !config.supportsVision) return false;
      if (config.tiebreakerOnly) return false;
      return true;
    })
    .map(([name]) => name);
}

/**
 * Get provider configuration with defaults applied
 */
export function getProviderConfig(provider: string): ProviderConfig | null {
  const normalizedProvider = provider.toLowerCase();
  return AI_PROVIDERS[normalizedProvider] || null;
}

/**
 * Get the primary model for a provider
 */
export function getPrimaryModel(provider: string): string | null {
  const config = getProviderConfig(provider);
  return config?.primaryModel || null;
}

/**
 * Calculate total weight for a set of providers
 */
export function getTotalWeight(providers: string[]): number {
  return providers.reduce((total, provider) => {
    const config = AI_PROVIDERS[provider];
    return total + (config?.weight || 0);
  }, 0);
}

/**
 * Validate provider configuration at startup
 */
export function validateProviderConfig(): {
  available: string[];
  missing: string[];
  warnings: string[];
} {
  const available: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const [name, config] of Object.entries(AI_PROVIDERS)) {
    if (isProviderAvailable(name)) {
      available.push(name);
    } else {
      missing.push(name);
      if (!config.tiebreakerOnly) {
        warnings.push(`⚠️ ${config.name} not configured (missing: ${config.envKeys.join(' or ')})`);
      }
    }
  }

  const visionProviders = available.filter(p => AI_PROVIDERS[p]?.supportsVision);
  if (visionProviders.length < 2) {
    warnings.push(`⚠️ Less than 2 vision providers available. Consensus quality may be degraded.`);
  }

  if (available.includes('llama4')) {
    console.log('🦙 Llama 4 / GPT-OSS-120B active (via Groq)');
  }

  if (available.includes('kimi')) {
    console.log('🌙 Kimi K2.6 active — HYDRA now has 10 independent AI voices');
  }

  console.log(`🧠 HYDRA voices online: ${available.length}/10 — [${available.join(', ')}]`);

  return { available, missing, warnings };
}

export default AI_PROVIDERS;