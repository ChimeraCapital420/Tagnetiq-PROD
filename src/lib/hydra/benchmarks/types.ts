// FILE: src/lib/hydra/benchmarks/types.ts
// HYDRA v8.0 - AI Provider Benchmark Types
// Ground truth tracking for every AI vote

// =============================================================================
// CORE BENCHMARK RECORD
// =============================================================================

/**
 * Raw benchmark data for a single AI vote
 * Created during analyze.ts flow, inserted into provider_benchmarks table
 */
export interface BenchmarkRecord {
  analysis_id: string;
  
  // Provider
  provider_id: string;
  provider_model?: string;
  provider_price: number;
  provider_decision: 'BUY' | 'SELL';
  provider_confidence?: number;
  provider_item_name?: string;
  provider_category?: string;
  response_time_ms?: number;
  
  // Ground truth
  ground_truth_price?: number;
  ground_truth_source?: string;
  authority_source?: string;
  authority_price?: number;
  ebay_median_price?: number;
  ebay_listing_count?: number;
  market_confidence?: number;
  
  // Calculated
  price_error_dollars?: number;
  price_error_percent?: number;
  price_direction?: 'over' | 'under' | 'accurate';
  decision_correct?: boolean;
  
  // Context
  item_name: string;
  detected_category: string;
  category_confidence?: number;
  stage?: 'vision' | 'text' | 'market_search' | 'tiebreaker';
  had_image?: boolean;
  
  // Consensus
  consensus_price?: number;
  consensus_decision?: string;
  final_blended_price?: number;
  total_votes?: number;
  analysis_quality?: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
}

// =============================================================================
// WEEKLY SCORECARD
// =============================================================================

/**
 * Aggregated weekly performance for one provider
 */
export interface WeeklyScorecard {
  provider_id: string;
  provider_display_name: string;
  week_start: string;
  week_end: string;
  
  // Volume
  total_votes: number;
  successful_votes: number;
  
  // Price accuracy
  mean_absolute_error: number;
  mean_absolute_percent_error: number;
  median_error_percent: number;
  accuracy_rate_10: number;    // % within 10% of ground truth
  accuracy_rate_25: number;    // % within 25%
  
  // Direction
  over_predictions: number;
  under_predictions: number;
  accurate_predictions: number;
  
  // Decisions
  correct_decisions: number;
  decision_accuracy: number;
  
  // Speed
  avg_response_ms: number;
  p50_response_ms: number;
  p95_response_ms: number;
  
  // Category breakdown
  category_scores: Record<string, CategoryScore>;
  
  // Vision
  vision_votes: number;
  vision_accuracy: number;
  
  // Rankings (null = not included in free tier)
  overall_rank: number | null;
  price_accuracy_rank: number | null;
  speed_rank: number | null;
  decision_accuracy_rank: number | null;
  
  // Composite (0-100)
  composite_score: number;
}

/**
 * Per-category performance breakdown
 */
export interface CategoryScore {
  votes: number;
  mape: number;              // Mean absolute % error
  accuracy_10: number;       // % within 10%
  accuracy_25: number;       // % within 25%
  avg_response_ms: number;
  best_category: boolean;    // Is this their strongest category?
  worst_category: boolean;   // Is this their weakest?
}

// =============================================================================
// COMPETITIVE RANKINGS (PAID TIER)
// =============================================================================

/**
 * Cross-provider competitive analysis
 * Free tier: own data only. Paid tier: includes this.
 */
export interface CompetitiveRanking {
  week_start: string;
  
  // Overall leaderboard
  overall: RankEntry[];
  
  // By dimension
  price_accuracy: RankEntry[];
  speed: RankEntry[];
  decision_accuracy: RankEntry[];
  vision_accuracy: RankEntry[];
  
  // By category
  category_leaders: Record<string, RankEntry[]>;
}

export interface RankEntry {
  rank: number;
  provider_id: string;
  provider_display_name: string;
  score: number;
  delta_from_last_week: number | null;   // +2 means improved 2 ranks
}

// =============================================================================
// EMAIL CONFIGURATION
// =============================================================================

/**
 * Provider contact for email delivery
 */
export interface ProviderContact {
  provider_id: string;
  provider_display_name: string;
  primary_email: string | null;
  secondary_email: string | null;
  contact_name: string | null;
  contact_title: string | null;
  relationship_status: 'prospect' | 'contacted' | 'engaged' | 'partner';
  email_frequency: 'weekly' | 'monthly' | 'paused';
  include_rankings: boolean;
  models_tracked: string[];
}

/**
 * Email payload ready to send
 */
export interface ScorecardEmail {
  to: string;
  subject: string;
  html: string;
  scorecard: WeeklyScorecard;
  includes_rankings: boolean;
  provider_id: string;
  week_start: string;
}

// =============================================================================
// INVESTOR REPORT TYPES
// =============================================================================

/**
 * Data for the investor suite PDF
 */
export interface InvestorBenchmarkReport {
  generated_at: string;
  period: string;
  
  // High-level stats
  total_analyses: number;
  total_votes_tracked: number;
  providers_tracked: number;
  categories_covered: number;
  
  // Platform accuracy (how good is HYDRA overall)
  platform_accuracy: {
    market_verified_analyses: number;
    avg_final_price_error: number;
    authority_match_rate: number;
  };
  
  // Provider leaderboard
  provider_rankings: Array<{
    rank: number;
    provider_id: string;
    provider_name: string;
    composite_score: number;
    mape: number;
    decision_accuracy: number;
    avg_speed_ms: number;
    strongest_category: string;
    weakest_category: string;
  }>;
  
  // Category coverage
  category_performance: Record<string, {
    total_analyses: number;
    best_provider: string;
    avg_market_confidence: number;
  }>;
  
  // Trend data
  weekly_trends: Array<{
    week: string;
    avg_platform_accuracy: number;
    total_analyses: number;
  }>;
}

// =============================================================================
// INPUT TYPES (what analyze.ts passes in)
// =============================================================================

/**
 * Market context passed from analyze.ts after all fetching is complete
 */
export interface BenchmarkContext {
  analysis_id: string;
  item_name: string;
  detected_category: string;
  category_confidence: number;
  had_image: boolean;
  
  // Ground truth from market data
  ground_truth_price: number | null;
  ground_truth_source: string | null;
  authority_source: string | null;
  authority_price: number | null;
  ebay_median_price: number | null;
  ebay_listing_count: number | null;
  market_confidence: number;
  
  // Consensus results
  consensus_price: number;
  consensus_decision: 'BUY' | 'SELL';
  final_blended_price: number;
  total_votes: number;
  analysis_quality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
}