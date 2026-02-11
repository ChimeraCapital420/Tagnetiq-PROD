// FILE: src/lib/hydra/pipeline/types.ts
// HYDRA v9.0 - Pipeline Type Definitions
// Evidence-based pipeline with role-specific provider assignments

import type { ModelVote, ItemCategory, MarketDataResult, MarketDataSource } from '../types.js';

// =============================================================================
// PROVIDER ROLES
// =============================================================================

/** Provider role in the v9.0 pipeline */
export type ProviderRole = 'identify' | 'fetch' | 'reason' | 'validate';

/** Maps each provider to its assigned role */
export const PROVIDER_ROLES: Record<string, ProviderRole> = {
  google:     'identify',   // Fast vision, OCR, barcodes
  openai:     'identify',   // Best item identification accuracy
  perplexity: 'fetch',      // Web search specialist
  xai:        'fetch',      // Built-in real-time web access
  anthropic:  'reason',     // Best structured reasoning (0.9% error)
  deepseek:   'reason',     // Top reasoning model
  mistral:    'reason',     // Good structured JSON output
  groq:       'validate',   // Fastest inference (332ms) — sanity check
} as const;

/** Get providers for a specific pipeline role */
export function getProvidersForRole(role: ProviderRole): string[] {
  return Object.entries(PROVIDER_ROLES)
    .filter(([_, r]) => r === role)
    .map(([name]) => name);
}

// =============================================================================
// STAGE 1: IDENTIFY
// =============================================================================

export interface IdentifyResult {
  /** AI-identified item name with specifics (model, year, edition) */
  itemName: string;
  /** Detected category from vision */
  category: string;
  /** Physical condition assessment */
  condition: string;
  /** Extracted identifiers (VIN, ISBN, UPC, PSA cert, etc.) */
  identifiers: {
    vin?: string;
    isbn?: string;
    upc?: string;
    psaCert?: string;
    setNumber?: string;
    cardNumber?: string;
    coinDate?: string;
    coinMint?: string;
    serialNumber?: string;
    [key: string]: string | undefined;
  };
  /** Brief physical description */
  description: string;
  /** Which provider gave the best identification */
  primaryProvider: string;
  /** All identification votes (for benchmark tracking) */
  votes: ModelVote[];
  /** Time taken for identification stage */
  stageTimeMs: number;
}

// =============================================================================
// STAGE 2: FETCH
// =============================================================================

export interface FetchResult {
  /** Market data from authority APIs */
  marketData: MarketDataResult;
  /** Web search results from Perplexity */
  perplexityData: WebSearchResult | null;
  /** Web verification from xAI Grok */
  xaiData: WebSearchResult | null;
  /** Combined evidence summary for Stage 3 */
  evidenceSummary: EvidenceSummary;
  /** Votes from web-search providers (for benchmarks) */
  votes: ModelVote[];
  /** Time taken for fetch stage */
  stageTimeMs: number;
}

export interface WebSearchResult {
  /** Provider that ran the search */
  provider: string;
  /** Prices found with sources */
  prices: Array<{
    value: number;
    source: string;
    date?: string;
    type: 'sold' | 'listed' | 'estimate' | 'authority';
  }>;
  /** Raw vote for benchmark tracking */
  vote: ModelVote | null;
}

export interface EvidenceSummary {
  /** eBay data if available */
  ebay: {
    median: number;
    listings: number;
    available: boolean;
  } | null;
  /** Authority source data */
  authority: {
    source: string;
    price: number;
    details: Record<string, any>;
  } | null;
  /** Web search price range */
  webPrices: {
    low: number;
    high: number;
    sources: string[];
  } | null;
  /** Pre-formatted evidence string for AI prompts */
  formattedEvidence: string;
  /** Market confidence before AI reasoning */
  marketConfidence: number;
}

// =============================================================================
// STAGE 3: REASON
// =============================================================================

export interface ReasonResult {
  /** All reasoning votes */
  votes: ModelVote[];
  /** Consensus from evidence-based reasoning */
  consensus: {
    estimatedValue: number;
    decision: 'BUY' | 'SELL';
    confidence: number;
    reasoning: string;
    analysisQuality: string;
  };
  /** Market assessment from reasoning models */
  marketAssessment: {
    trend: 'rising' | 'falling' | 'stable' | 'unknown';
    demandLevel: 'high' | 'medium' | 'low' | 'unknown';
  };
  /** Time taken for reasoning stage */
  stageTimeMs: number;
}

// =============================================================================
// STAGE 4: VALIDATE
// =============================================================================

export interface ValidateResult {
  /** Whether the analysis passed validation */
  valid: boolean;
  /** Flags raised by the validator */
  flags: ValidationFlag[];
  /** Groq's response time */
  responseTimeMs: number;
  /** Vote for benchmark tracking */
  vote: ModelVote | null;
}

export interface ValidationFlag {
  type: 'price_mismatch' | 'category_mismatch' | 'authority_conflict' | 'condition_gap' | 'data_insufficient';
  severity: 'warning' | 'error';
  message: string;
  /** Suggested adjustment if any */
  adjustment?: {
    field: string;
    suggestedValue: any;
    reason: string;
  };
}

// =============================================================================
// PIPELINE RESULT
// =============================================================================

export interface PipelineResult {
  /** Final item name from identification */
  itemName: string;
  /** Final category */
  category: ItemCategory;
  /** Category detection confidence */
  categoryConfidence: number;
  /** Final blended price */
  finalPrice: number;
  /** Price blend method */
  priceMethod: string;
  /** Final decision */
  decision: 'BUY' | 'SELL';
  /** Overall confidence */
  confidence: number;
  /** Analysis quality tier */
  analysisQuality: string;
  /** Price range */
  priceRange: { low: number; high: number };
  /** All votes from all stages (for benchmarks) */
  allVotes: ModelVote[];
  /** Stage-separated votes (for benchmarks) */
  stageVotes: {
    identify: ModelVote[];
    fetch: ModelVote[];
    reason: ModelVote[];
    validate: ModelVote[];
  };
  /** Per-stage results */
  stages: {
    identify: IdentifyResult;
    fetch: FetchResult;
    reason: ReasonResult;
    validate: ValidateResult;
  };
  /** eBay data for response */
  ebayData: any;
  /** All market sources */
  marketSources: any[];
  /** Authority data if present */
  authorityData: any;
  /** Total pipeline time */
  totalTimeMs: number;
  /** Per-stage timing */
  timing: {
    identify: number;
    fetch: number;
    reason: number;
    validate: number;
    total: number;
  };
}

// =============================================================================
// PIPELINE CONFIG
// =============================================================================

export interface PipelineConfig {
  /** Maximum time for entire pipeline (ms) */
  maxDuration: number;
  /** Per-stage timeout overrides */
  stageTimeouts: {
    identify: number;
    fetch: number;
    reason: number;
    validate: number;
  };
  /** Whether to run Stage 4 validation */
  enableValidation: boolean;
  /** Whether to run benchmark tracking */
  enableBenchmarks: boolean;
  /** Self-heal weight overrides (from benchmark data) */
  dynamicWeights?: Record<string, number>;
  /** Category-specific provider overrides */
  categoryOverrides?: Record<string, Partial<Record<ProviderRole, string[]>>>;
}

/** Default pipeline configuration */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  maxDuration: 55000,  // 55s (Vercel 60s limit with buffer)
  stageTimeouts: {
    identify: 8000,    // 8s max for vision
    fetch: 10000,      // 10s max for market data + web search
    reason: 8000,      // 8s max for reasoning
    validate: 2000,    // 2s max for Groq validation
  },
  enableValidation: true,
  enableBenchmarks: true,
};

// =============================================================================
// SELF-HEAL TYPES
// =============================================================================

export interface ProviderAccuracy {
  providerId: string;
  category: string;
  /** Rolling accuracy metrics */
  accuracy: {
    within10Pct: number;   // % of votes within 10% of truth
    within25Pct: number;   // % of votes within 25% of truth
    mape: number;          // Mean Absolute Percentage Error
    sampleSize: number;    // Number of votes in window
  };
  /** Dynamic weight multiplier */
  weightMultiplier: number;
  /** Whether provider is degraded */
  isDegraded: boolean;
  /** Last updated timestamp */
  updatedAt: string;
}

export interface SelfHealConfig {
  /** Minimum samples before adjusting weights */
  minSamples: number;
  /** Rolling window in days */
  windowDays: number;
  /** Degradation threshold (% drop from average) */
  degradationThreshold: number;
  /** Maximum weight boost */
  maxBoost: number;
  /** Minimum weight floor */
  minWeight: number;
}

export const DEFAULT_SELF_HEAL_CONFIG: SelfHealConfig = {
  minSamples: 20,
  windowDays: 30,
  degradationThreshold: 0.20,
  maxBoost: 1.5,
  minWeight: 0.3,
};