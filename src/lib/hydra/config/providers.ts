/**
 * HYDRA v6.0 - AI Provider Configuration
 * 
 * Centralized configuration for all AI providers used in the consensus engine.
 * Extracted from hydra-engine.js as part of modular refactoring.
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
 * Primary Vision Models (Stage 1):
 * - OpenAI GPT-4o: Best overall accuracy, excellent vision
 * - Anthropic Claude Sonnet: Strong reasoning, good vision
 * - Google Gemini 2.0 Flash: Fast, good vision, cost-effective
 * 
 * Secondary Models (Stage 2):
 * - Mistral: Strong reasoning, cost-effective
 * - Groq: Ultra-fast inference with Llama models
 * - xAI Grok: Real-time knowledge, good reasoning
 * - Perplexity: Real-time market search, web knowledge
 * 
 * Tiebreaker:
 * - DeepSeek: Text-only, used for tiebreaking when primary models disagree
 */
export const AI_PROVIDERS: Record<string, ProviderConfig> = {
  // ==========================================================================
  // PRIMARY VISION MODELS (Stage 1)
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
    envKeys: ['ANTHROPIC_API_KEY'],
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    primaryModel: 'claude-sonnet-4-20250514',
    supportsVision: true,
    timeout: 30000,
    weight: 1.0,
    maxRetries: 2,
  },
  
  google: {
    name: 'Google',
    envKeys: ['GOOGLE_AI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    primaryModel: 'gemini-2.0-flash',
    supportsVision: true,
    timeout: 30000,
    weight: 1.0,
    maxRetries: 2,
  },
  
  // ==========================================================================
  // SECONDARY MODELS (Stage 2 - Text/Reasoning)
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
  
  groq: {
    name: 'Groq',
    envKeys: ['GROQ_API_KEY'],
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    primaryModel: 'llama-3.1-8b-instant',
    supportsVision: false,
    timeout: 15000, // Groq is very fast
    weight: 0.75,
    maxRetries: 2,
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  
  xai: {
    name: 'xAI',
    envKeys: ['XAI_API_KEY', 'GROK_API_KEY'],
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
    weight: 0.85, // Higher weight because it has real-time market data
    maxRetries: 2,
    baseUrl: 'https://api.perplexity.ai',
  },
  
  // ==========================================================================
  // TIEBREAKER
  // ==========================================================================
  
  deepseek: {
    name: 'DeepSeek',
    envKeys: ['DEEPSEEK_API_KEY'],
    models: ['deepseek-chat', 'deepseek-reasoner'],
    primaryModel: 'deepseek-chat',
    supportsVision: false,
    timeout: 45000,
    weight: 0.6, // Lower weight for tiebreaker
    maxRetries: 1,
    baseUrl: 'https://api.deepseek.com',
    tiebreakerOnly: true,
  },
};

/**
 * Provider groups for different analysis stages
 */
export const PROVIDER_GROUPS = {
  /** Primary vision-capable models for Stage 1 analysis */
  primaryVision: ['openai', 'anthropic', 'google'],
  
  /** Secondary text-based models for additional analysis */
  secondary: ['mistral', 'groq', 'xai', 'perplexity'],
  
  /** Text-only models for Stage 2 context analysis */
  textOnly: ['deepseek', 'mistral', 'groq', 'xai'],
  
  /** All providers that support vision */
  visionCapable: ['openai', 'anthropic', 'google'],
  
  /** Providers used for tiebreaking */
  tiebreakers: ['deepseek'],
  
  /** Providers with real-time market/web search */
  marketSearch: ['perplexity'],
  
  /** Fast inference providers */
  fastInference: ['groq'],
  
  /** All available providers */
  all: ['openai', 'anthropic', 'google', 'mistral', 'groq', 'xai', 'perplexity', 'deepseek'],
} as const;

/**
 * Get API key for a provider
 * Checks multiple environment variable names in order
 * 
 * @param provider - Provider identifier (e.g., 'openai', 'OpenAI', 'Anthropic')
 * @returns API key string or null if not configured
 */
export function getApiKey(provider: string): string | null {
  // Normalize provider name to lowercase for lookup
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
 * 
 * @param provider - Provider identifier (case-insensitive)
 * @returns true if provider has valid API key
 */
export function isProviderAvailable(provider: string): boolean {
  return getApiKey(provider) !== null;
}

/**
 * Get list of available providers
 * 
 * @param visionOnly - If true, only return vision-capable providers
 * @returns Array of available provider identifiers
 */
export function getAvailableProviders(visionOnly: boolean = false): string[] {
  return Object.entries(AI_PROVIDERS)
    .filter(([name, config]) => {
      // Check if API key exists
      if (!isProviderAvailable(name)) return false;
      
      // Filter by vision capability if requested
      if (visionOnly && !config.supportsVision) return false;
      
      // Exclude tiebreaker-only providers from primary list
      if (config.tiebreakerOnly) return false;
      
      return true;
    })
    .map(([name]) => name);
}

/**
 * Get provider configuration with defaults applied
 * 
 * @param provider - Provider identifier (case-insensitive)
 * @returns Provider config or null if not found
 */
export function getProviderConfig(provider: string): ProviderConfig | null {
  const normalizedProvider = provider.toLowerCase();
  return AI_PROVIDERS[normalizedProvider] || null;
}

/**
 * Get the primary model for a provider
 * 
 * @param provider - Provider identifier (case-insensitive)
 * @returns Model string or null if provider not found
 */
export function getPrimaryModel(provider: string): string | null {
  const config = getProviderConfig(provider);
  return config?.primaryModel || null;
}

/**
 * Calculate total weight for a set of providers
 * Used for normalizing consensus scores
 * 
 * @param providers - Array of provider identifiers
 * @returns Total weight
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
      
      // Only warn for primary providers
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
  
  return { available, missing, warnings };
}

export default AI_PROVIDERS;