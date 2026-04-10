/**
 * HYDRA v7.0 - AI Provider Configuration
 *
 * Centralized configuration for all AI providers used in the consensus engine.
 * Extracted from hydra-engine.js as part of modular refactoring.
 *
 * v7.0: Added Llama 4 as a standalone provider via Groq inference.
 *   Llama 4 Maverick: multimodal (vision + text), 128k context, 128 experts
 *   Llama 4 Scout: multimodal, 10M context window, cost-efficient
 *
 *   IMPORTANT: Llama 4 and Groq are SEPARATE providers in HYDRA.
 *   - groq: runs Llama 3 models (fast inference, text-only in HYDRA context)
 *   - llama4: runs Llama 4 Maverick/Scout via Groq (multimodal, vision-capable)
 *   Both use the same GROQ_API_KEY but vote independently in consensus.
 *   This gives HYDRA 9 independent AI voices instead of 8.
 *
 *   Llama 4 Maverick is promoted to PRIMARY VISION (Stage 1) alongside
 *   OpenAI, Anthropic, and Google. It earned this position:
 *   - 17B active params × 128 experts = frontier reasoning
 *   - True multimodal (image + text) out of the box
 *   - Meta's most powerful open source model ever released
 *   - Runs on Groq hardware = sub-second inference
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
 * Primary Vision Models (Stage 1) — 4 providers:
 * - OpenAI GPT-4o: Best overall accuracy, excellent vision
 * - Anthropic Claude Sonnet: Strong reasoning, good vision
 * - Google Gemini 2.0 Flash: Fast, good vision, cost-effective
 * - Llama 4 Maverick: Meta's frontier multimodal, 128 experts, Groq speed ← NEW v7.0
 *
 * Secondary Models (Stage 2) — 4 providers:
 * - Mistral: Strong reasoning, cost-effective
 * - Groq (Llama 3): Ultra-fast text inference — independent from Llama 4
 * - xAI Grok: Real-time knowledge, good reasoning
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

  // ==========================================================================
  // v7.0: LLAMA 4 — Standalone provider via Groq inference
  // ==========================================================================
  //
  // Llama 4 Maverick is Meta's most powerful open source multimodal model.
  // It runs on Groq's inference hardware — same API key as groq provider,
  // but completely SEPARATE in HYDRA. Both cast independent votes.
  //
  // Why separate from groq:
  //   - Groq runs Llama 3 (text-only in HYDRA) — fast, lightweight reasoning
  //   - Llama 4 is multimodal frontier — different capability tier entirely
  //   - Separating them gives HYDRA 9 independent voices, not 8
  //   - Groq's Llama 3 vote + Llama 4 Maverick vote = two different perspectives
  //     from the same hardware but different model generations
  //
  // Uses GROQ_API_KEY — no new credentials needed.
  // Model strings from Groq's Llama 4 API (verify at console.groq.com).
  // ==========================================================================

  llama4: {
    name: 'Llama 4',
    envKeys: ['GROQ_API_KEY'],              // Same key as groq — different model tier
    models: [
      'meta-llama/llama-4-maverick-17b-128e-instruct',   // Primary: most powerful, multimodal
      'meta-llama/llama-4-scout-17b-16e-instruct',       // Fallback: 10M context, faster
    ],
    primaryModel: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    supportsVision: true,                   // Llama 4 Maverick is multimodal
    timeout: 20000,                         // Groq inference is fast
    weight: 0.95,                           // High weight — frontier model
    maxRetries: 2,
    baseUrl: 'https://api.groq.com/openai/v1',
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
  // These vote separately from llama4 above. Same GROQ_API_KEY, different
  // model generation and capability tier. Do not merge with llama4.
  groq: {
    name: 'Groq',
    envKeys: ['GROQ_API_KEY'],
    models: [
      'llama-3.3-70b-versatile',    // Best Llama 3 for reasoning
      'llama-3.1-8b-instant',       // Fast fallback
      'mixtral-8x7b-32768',         // Mixtral for variety
    ],
    primaryModel: 'llama-3.3-70b-versatile',  // Upgraded: 70B for better reasoning
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
 * v7.0: llama4 added to primaryVision and visionCapable.
 *       groq remains in secondary and textOnly — it runs Llama 3, not Llama 4.
 *       Both llama4 and groq are in 'all' — they vote independently.
 */
export const PROVIDER_GROUPS = {
  /** Primary vision-capable models for Stage 1 analysis */
  primaryVision: ['openai', 'anthropic', 'google', 'llama4'],   // v7.0: llama4 added
  /** Secondary text-based models for additional analysis */
  secondary: ['mistral', 'groq', 'xai', 'perplexity'],
  /** Text-only models for Stage 2 context analysis */
  textOnly: ['deepseek', 'mistral', 'groq', 'xai'],
  /** All providers that support vision */
  visionCapable: ['openai', 'anthropic', 'google', 'llama4'],   // v7.0: llama4 added
  /** Providers used for tiebreaking */
  tiebreakers: ['deepseek'],
  /** Providers with real-time market/web search */
  marketSearch: ['perplexity'],
  /** Fast inference providers */
  fastInference: ['groq', 'llama4'],                            // v7.0: llama4 added
  /** All available providers — 9 total */
  all: ['openai', 'anthropic', 'google', 'llama4', 'mistral', 'groq', 'xai', 'perplexity', 'deepseek'],
} as const;

/**
 * Get API key for a provider
 * Checks multiple environment variable names in order
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
 *
 * @param visionOnly - If true, only return vision-capable providers
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
 * Used for normalizing consensus scores
 */
export function getTotalWeight(providers: string[]): number {
  return providers.reduce((total, provider) => {
    const config = AI_PROVIDERS[provider];
    return total + (config?.weight || 0);
  }, 0);
}

/**
 * Validate provider configuration at startup
 * Logs warnings for missing providers
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

  // Minimum requirement check
  const visionProviders = available.filter(p => AI_PROVIDERS[p]?.supportsVision);
  if (visionProviders.length < 2) {
    warnings.push(`⚠️ Less than 2 vision providers available. Consensus quality may be degraded.`);
  }

  // v7.0: Note when Llama 4 is available — it's a significant capability addition
  if (available.includes('llama4')) {
    console.log('🦙 Llama 4 Maverick active — HYDRA now has 9 independent AI voices');
  }

  return { available, missing, warnings };
}

export default AI_PROVIDERS;