// FILE: src/lib/hydra/types.ts
// Centralized TypeScript interfaces for HYDRA system
// All modules should import types from here

// =============================================================================
// AI PROVIDER TYPES
// =============================================================================

/**
 * Configuration for an AI provider
 */
export interface AIProvider {
  id: string;
  name: string;
  model?: string;
  baseWeight: number;
  specialty?: 'vision' | 'reasoning' | 'pricing' | 'search';
  apiKey?: string;
}

/**
 * Response from an AI analysis
 */
export interface AIAnalysisResponse {
  response: ParsedAnalysis | null;
  confidence: number;
  responseTime: number;
}

/**
 * Parsed analysis result from AI
 */
export interface ParsedAnalysis {
  itemName: string;
  estimatedValue: number;
  decision: 'BUY' | 'SELL';
  valuation_factors: string[];
  summary_reasoning: string;
  confidence?: number;
  category?: string;
  
  // Optional extended fields
  market_sources?: string[];
  price_range?: {
    low: number;
    high: number;
  };
}

/**
 * Individual vote from an AI model
 */
export interface ModelVote {
  providerId: string;
  providerName: string;
  itemName: string;
  estimatedValue: number;
  decision: 'BUY' | 'SELL';
  confidence: number;
  responseTime: number;
  weight: number;
  rawResponse: ParsedAnalysis | null;
  success: boolean;
}

// =============================================================================
// CONSENSUS TYPES
// =============================================================================

/**
 * Metrics about consensus quality
 */
export interface ConsensusMetrics {
  avgAIConfidence: number;
  decisionAgreement: number;
  valueAgreement: number;
  participationRate: number;
  authorityVerified: boolean;
}

/**
 * Final consensus result
 */
export interface ConsensusResult {
  itemName: string;
  estimatedValue: number;
  decision: 'BUY' | 'SELL';
  confidence: number;
  totalVotes: number;
  analysisQuality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
  consensusMetrics: ConsensusMetrics;
}

/**
 * Full HYDRA consensus response
 */
export interface HydraConsensus {
  analysisId: string;
  votes: ModelVote[];
  consensus: ConsensusResult;
  processingTime: number;
  authorityData?: AuthorityData;
  providerFailures?: Record<string, string>;
}

// =============================================================================
// AUTHORITY DATA TYPES
// =============================================================================

/**
 * Data from authority/reference sources
 */
export interface AuthorityData {
  source: string;
  verified: boolean;
  externalUrl?: string;
  itemDetails: Record<string, any>;
  priceByCondition?: PriceByCondition;
  lastUpdated: string;
  
  // Source-specific fields
  isbn?: string;
  catalogNumber?: string;
  setNumber?: string;
  gradeInfo?: GradeInfo;
}

/**
 * Price breakdown by condition
 */
export interface PriceByCondition {
  mint?: number;
  nearMint?: number;
  excellent?: number;
  veryGood?: number;
  good?: number;
  fair?: number;
  poor?: number;
  
  // Alternative naming conventions
  gem?: number;
  uncirculated?: number;
  extremely_fine?: number;
  very_fine?: number;
  fine?: number;
}

/**
 * Grading information (PSA, BGS, etc.)
 */
export interface GradeInfo {
  service: string;
  grade: number | string;
  population?: number;
  higherPop?: number;
}

// =============================================================================
// MARKET DATA TYPES
// =============================================================================

/**
 * Result from market data fetching
 */
export interface MarketDataResult {
  sources: MarketDataSource[];
  primaryAuthority?: AuthorityData;
  ebayListings?: EbayListing[];
  priceAnalysis?: PriceAnalysis;
}

/**
 * Individual market data source
 */
export interface MarketDataSource {
  source: string;
  available: boolean;
  data?: any;
  priceAnalysis?: PriceAnalysis;
  authorityData?: AuthorityData;
  error?: string;
}

/**
 * Price analysis from market data
 */
export interface PriceAnalysis {
  average: number;
  median: number;
  low: number;
  high: number;
  sampleSize: number;
  currency: string;
}

/**
 * eBay listing data
 */
export interface EbayListing {
  title: string;
  price: number;
  currency: string;
  condition?: string;
  soldDate?: string;
  url?: string;
  imageUrl?: string;
}

// =============================================================================
// CATEGORY TYPES
// =============================================================================

/**
 * Result from category detection
 */
export interface CategoryResult {
  category: string;
  confidence: number;
  source: CategorySource;
  subcategory?: string;
  keywords?: string[];
}

/**
 * How the category was determined
 */
export type CategorySource = 
  | 'name_parsing'
  | 'ai_vote'
  | 'user_hint'
  | 'keyword_match'
  | 'authority_data'
  | 'default';

// =============================================================================
// FETCHER-SPECIFIC TYPES
// =============================================================================

/**
 * Numista coin data
 */
export interface NumistaData {
  id: number;
  title: string;
  issuer: string;
  minYear?: number;
  maxYear?: number;
  composition?: string;
  weight?: number;
  diameter?: number;
  catalogNumbers?: Record<string, string>;
  url: string;
  imageUrl?: string;
}

/**
 * Pokemon TCG card data
 */
export interface PokemonTCGData {
  id: string;
  name: string;
  set: string;
  setNumber: string;
  rarity?: string;
  types?: string[];
  hp?: string;
  prices?: {
    normal?: { market: number; low: number; high: number };
    holofoil?: { market: number; low: number; high: number };
    reverseHolofoil?: { market: number; low: number; high: number };
    firstEdition?: { market: number; low: number; high: number };
  };
  images?: {
    small: string;
    large: string;
  };
}

/**
 * Brickset LEGO data
 */
export interface BricksetData {
  setNumber: string;
  name: string;
  theme: string;
  subtheme?: string;
  year: number;
  pieces?: number;
  minifigs?: number;
  rrp?: number;
  currentValue?: number;
  imageUrl?: string;
  bricksetUrl: string;
}

/**
 * Google Books data
 */
export interface GoogleBooksData {
  id: string;
  title: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  isbn10?: string;
  isbn13?: string;
  pageCount?: number;
  categories?: string[];
  description?: string;
  imageUrl?: string;
  infoLink: string;
}

/**
 * Discogs music data
 */
export interface DiscogsData {
  id: number;
  title: string;
  artist: string;
  year?: number;
  format?: string[];
  label?: string;
  country?: string;
  lowestPrice?: number;
  numForSale?: number;
  url: string;
  imageUrl?: string;
}

/**
 * Retailed sneaker data
 */
export interface RetailedData {
  id: string;
  name: string;
  brand: string;
  colorway?: string;
  releaseDate?: string;
  retailPrice?: number;
  marketPrice?: number;
  imageUrl?: string;
  url: string;
}

/**
 * PSA grading data
 */
export interface PSAData {
  certNumber: string;
  grade: number;
  cardName: string;
  year?: string;
  brand?: string;
  variety?: string;
  population?: number;
  higherPop?: number;
  averagePrice?: number;
  url: string;
}

/**
 * Comic Vine data
 */
export interface ComicVineData {
  id: number;
  name: string;
  issueNumber?: string;
  volume?: string;
  publisher?: string;
  coverDate?: string;
  description?: string;
  imageUrl?: string;
  url: string;
}

// =============================================================================
// TIEBREAKER TYPES
// =============================================================================

/**
 * Tiebreaker response structure
 */
export interface TiebreakerResponse {
  selectedVote: number;
  confidence: number;
  reasoning: string;
  adjustedValue?: number;
  adjustedDecision?: 'BUY' | 'SELL';
}

/**
 * Vote summary for tiebreaker
 */
export interface VoteSummary {
  index: number;
  provider: string;
  decision: 'BUY' | 'SELL';
  value: number;
  confidence: number;
  reasoning?: string;
}

// =============================================================================
// REFINEMENT TYPES
// =============================================================================

/**
 * Context for analysis refinement
 */
export interface RefinementContext {
  originalAnalysis: ParsedAnalysis;
  newInformation: {
    userContext?: string;
    categoryCorrection?: string;
    userValueEstimate?: number;
    conditionDetails?: string;
  };
  authorityData?: AuthorityData;
  marketData?: MarketDataResult;
}

/**
 * Refinement notes from re-analysis
 */
export interface RefinementNotes {
  categoryChanged: boolean;
  valueAdjustment: number;
  adjustmentReason: string;
  confidenceChange: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Blended price result
 */
export interface BlendedPrice {
  price: number;
  method: string;
  confidence: number;
  breakdown?: Array<{
    source: string;
    price: number;
    weight: number;
  }>;
}

// =============================================================================
// RE-EXPORTS FOR CONVENIENCE
// =============================================================================

// Make common types easily accessible
export type Decision = 'BUY' | 'SELL';
export type AnalysisQuality = 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';