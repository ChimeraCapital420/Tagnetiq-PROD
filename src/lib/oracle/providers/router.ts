// FILE: src/lib/oracle/providers/registry.ts
// Oracle Conversation Provider Registry
//
// Sprint F:  Provider Registry + Hot-Loading
// Sprint N+: Tier-aware model selection
//
// This is Oracle's own provider roster — separate from HYDRA's scan providers.
// HYDRA blends models for ACCURACY. Oracle blends models for SOUL.
//
// Each provider has conversation-specific config: token limits, temperature
// preferences, strengths, and cost tiers. The router uses this to pick
// the best model for each message.
//
// ═══════════════════════════════════════════════════════════════════════
// MODEL PHILOSOPHY — LIBERATION 1: ONE BRAIN, ALL TIERS
// ═══════════════════════════════════════════════════════════════════════
//
// Every user talks to the SAME Oracle. Same model. Same depth. Same soul.
//
//   model           = The Oracle's brain. Used for ALL user-facing
//                     conversations. Free, Pro, Elite — everyone.
//   backgroundModel = Invisible tasks the user never sees directly.
//                     Memory compression, personality evolution,
//                     character evolution, personal detail extraction.
//                     Cheap model. No soul needed.
//   fallbackModel   = Last-resort when primary fails on same provider.
//
// Cost control is through message caps in tier.ts (15/day free),
// NOT through model degradation. A user who bonds with Dash, names
// Dash, tells Dash their kid's birthday — they get THAT Dash whether
// they pay or not.
// ═══════════════════════════════════════════════════════════════════════
//
// Adding a new provider:
//   1. Add its config to ORACLE_PROVIDERS below
//   2. Add its caller in caller.ts
//   3. That's it — the router auto-discovers it

// =============================================================================
// TYPES
// =============================================================================

export type OracleProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'groq'
  | 'xai'
  | 'perplexity';

export type ProviderStrength =
  | 'general'        // Good all-rounder for casual chat
  | 'reasoning'      // Complex analysis, deep thinking
  | 'vision'         // Image understanding, visual descriptions
  | 'speed'          // Fastest response time
  | 'web'            // Real-time market/web knowledge
  | 'creative';      // Creative writing, personality, humor

export type CostTier = 'low' | 'medium' | 'high';

export interface OracleProviderConfig {
  /** Unique provider identifier */
  id: OracleProviderId;
  /** Display name (for logging, never shown to user) */
  name: string;
  /** The Oracle's brain — ALL user-facing conversations, ALL tiers */
  model: string;
  /** Cheap model for background tasks (compression, evolution). User never sees this. */
  backgroundModel: string;
  /** Last-resort fallback if primary model fails on this provider */
  fallbackModel?: string;
  /** Environment variable names to check for API key */
  envKeys: string[];
  /** What this provider is best at */
  strengths: ProviderStrength[];
  /** Primary strength — what the router prioritizes */
  primaryStrength: ProviderStrength;
  /** Whether this provider supports image input in conversations */
  supportsVision: boolean;
  /** Max tokens for Oracle responses */
  maxResponseTokens: number;
  /** Preferred temperature for this provider (Oracle personality range) */
  temperature: number;
  /** API timeout in milliseconds */
  timeout: number;
  /** Cost tier — used for fallback ordering */
  costTier: CostTier;
  /** Whether this provider uses OpenAI-compatible API format */
  openaiCompatible: boolean;
  /** Base URL for OpenAI-compatible providers (null = use SDK default) */
  baseUrl?: string;
}

// =============================================================================
// PROVIDER REGISTRY
// =============================================================================

export const ORACLE_PROVIDERS: Record<OracleProviderId, OracleProviderConfig> = {
  // ── Primary: The Oracle's main brain ──────────────────
  openai: {
    id: 'openai',
    name: 'OpenAI',
    model: 'gpt-4o',                    // Full brain — ALL tiers
    backgroundModel: 'gpt-4o-mini',     // Background only — compression, evolution
    fallbackModel: 'gpt-4o-mini',
    envKeys: ['OPEN_AI_API_KEY', 'OPENAI_API_KEY'],
    strengths: ['general', 'creative'],
    primaryStrength: 'general',
    supportsVision: true,
    maxResponseTokens: 500,
    temperature: 0.7,
    timeout: 25000,
    costTier: 'medium',
    openaiCompatible: true,
  },

  // ── Reasoning: Complex analysis, structured thinking ──
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    model: 'claude-sonnet-4-20250514',   // Full reasoning — ALL tiers
    backgroundModel: 'claude-3-haiku-20240307',
    fallbackModel: 'claude-3-haiku-20240307',
    envKeys: ['ANTHROPIC_API_KEY', 'ANTHROPIC_SECRET'],
    strengths: ['reasoning', 'creative'],
    primaryStrength: 'reasoning',
    supportsVision: true,
    maxResponseTokens: 500,
    temperature: 0.7,
    timeout: 25000,
    costTier: 'medium',
    openaiCompatible: false,
  },

  // ── Vision: Best visual understanding + fast ──────────
  google: {
    id: 'google',
    name: 'Google',
    model: 'gemini-2.0-flash',          // Fast + capable — ALL tiers
    backgroundModel: 'gemini-2.0-flash', // Already cheap
    fallbackModel: 'gemini-1.5-flash',
    envKeys: ['GOOGLE_AI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    strengths: ['vision', 'speed', 'general'],
    primaryStrength: 'vision',
    supportsVision: true,
    maxResponseTokens: 500,
    temperature: 0.7,
    timeout: 20000,
    costTier: 'low',
    openaiCompatible: false,
  },

  // ── Deep Reasoning: Complex valuation logic ───────────
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    model: 'deepseek-chat',             // Already cheap — ALL tiers
    backgroundModel: 'deepseek-chat',
    envKeys: ['DEEPSEEK_API_KEY'],
    strengths: ['reasoning'],
    primaryStrength: 'reasoning',
    supportsVision: false,
    maxResponseTokens: 500,
    temperature: 0.7,
    timeout: 25000,
    costTier: 'low',
    openaiCompatible: true,
    baseUrl: 'https://api.deepseek.com',
  },

  // ── Speed: Ultra-fast for quick answers + live scanning ─
  groq: {
    id: 'groq',
    name: 'Groq',
    model: 'llama-3.3-70b-versatile',   // Full 70B — ALL tiers
    backgroundModel: 'llama-3.1-8b-instant',
    fallbackModel: 'llama-3.1-8b-instant',
    envKeys: ['GROQ_API_KEY'],
    strengths: ['speed', 'general'],
    primaryStrength: 'speed',
    supportsVision: false,
    maxResponseTokens: 500,
    temperature: 0.7,
    timeout: 10000,
    costTier: 'low',
    openaiCompatible: true,
    baseUrl: 'https://api.groq.com/openai',
  },

  // ── Web Knowledge: Real-time market data ──────────────
  xai: {
    id: 'xai',
    name: 'xAI',
    model: 'grok-2-latest',             // ALL tiers
    backgroundModel: 'grok-2-latest',
    envKeys: ['XAI_API_KEY', 'GROK_API_KEY'],
    strengths: ['web', 'creative'],
    primaryStrength: 'web',
    supportsVision: true,
    maxResponseTokens: 500,
    temperature: 0.7,
    timeout: 25000,
    costTier: 'medium',
    openaiCompatible: true,
    baseUrl: 'https://api.x.ai',
  },

  // ── Market Search: Live pricing + trends ──────────────
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    model: 'sonar-pro',                 // Full search — ALL tiers
    backgroundModel: 'sonar',
    fallbackModel: 'sonar',
    envKeys: ['PERPLEXITY_API_KEY'],
    strengths: ['web'],
    primaryStrength: 'web',
    supportsVision: false,
    maxResponseTokens: 500,
    temperature: 0.7,
    timeout: 25000,
    costTier: 'medium',
    openaiCompatible: true,
    baseUrl: 'https://api.perplexity.ai',
  },
};

// =============================================================================
// REGISTRY HELPERS
// =============================================================================

/**
 * Get API key for a provider from environment variables.
 * Checks all possible env var names in priority order.
 */
export function getProviderApiKey(providerId: OracleProviderId): string | null {
  const config = ORACLE_PROVIDERS[providerId];
  if (!config) return null;

  for (const envKey of config.envKeys) {
    const val = process.env[envKey];
    if (val && val.length > 10) return val;
  }
  return null;
}

/**
 * Check if a provider is available (has API key configured).
 */
export function isProviderAvailable(providerId: OracleProviderId): boolean {
  return getProviderApiKey(providerId) !== null;
}

/**
 * Get all available providers (have API keys).
 */
export function getAvailableProviders(): OracleProviderId[] {
  return (Object.keys(ORACLE_PROVIDERS) as OracleProviderId[])
    .filter(id => isProviderAvailable(id));
}

/**
 * Get providers filtered by strength.
 * Only returns available providers.
 */
export function getProvidersByStrength(strength: ProviderStrength): OracleProviderId[] {
  return getAvailableProviders().filter(id => {
    const config = ORACLE_PROVIDERS[id];
    return config.strengths.includes(strength);
  });
}

/**
 * Get the cheapest available provider for a given strength.
 * Falls back to openai if nothing matches.
 */
export function getCheapestForStrength(strength: ProviderStrength): OracleProviderId {
  const costOrder: CostTier[] = ['low', 'medium', 'high'];
  const candidates = getProvidersByStrength(strength);

  for (const tier of costOrder) {
    const match = candidates.find(id => ORACLE_PROVIDERS[id].costTier === tier);
    if (match) return match;
  }

  return 'openai'; // Ultimate fallback
}

/**
 * Get the BEST available provider for a given strength.
 * Prefers medium/high cost models — these are the real brains.
 * Falls back to openai if nothing matches.
 */
export function getBestForStrength(strength: ProviderStrength): OracleProviderId {
  const costOrder: CostTier[] = ['high', 'medium', 'low'];
  const candidates = getProvidersByStrength(strength);

  for (const tier of costOrder) {
    const match = candidates.find(id => ORACLE_PROVIDERS[id].costTier === tier);
    if (match) return match;
  }

  return 'openai';
}

/**
 * Resolve the model string for user-facing conversations.
 *
 * ALL tiers get the premium model. The Oracle's soul is never paywalled.
 * Cost control is through message caps in tier.ts, not model degradation.
 *
 * @param providerId - Which provider
 * @param _userTier  - Kept for API compatibility. Does NOT affect model selection.
 */
export function resolveModelForTier(
  providerId: OracleProviderId,
  _userTier: string,
): string {
  const config = ORACLE_PROVIDERS[providerId];
  if (!config) return 'gpt-4o';

  // Everyone gets the full brain.
  return config.model;
}

/**
 * Get the background model for non-user-facing tasks.
 *
 * Used by: memory compression, personality evolution, character evolution,
 * personal detail extraction, push notification voice generation.
 * The user never sees output from this model directly.
 */
export function getBackgroundModel(providerId: OracleProviderId = 'openai'): string {
  const config = ORACLE_PROVIDERS[providerId];
  if (!config) return 'gpt-4o-mini';
  return config.backgroundModel;
}