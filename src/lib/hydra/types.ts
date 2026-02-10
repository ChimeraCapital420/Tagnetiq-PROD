// FILE: src/lib/hydra/types.ts
// Centralized TypeScript interfaces for HYDRA system
// All modules should import types from here
// v8.0: Added ColnectData, ColnectMarketPrice, and new category types

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
 * All supported item categories
 * v8.0: Added Colnect-primary categories
 */
export type ItemCategory =
  // Coins & Currency
  | 'coins'
  | 'banknotes'
  | 'currency'
  // Stamps (Colnect primary)
  | 'stamps'
  | 'postage_stamps'
  | 'miniature_sheets'
  // Postcards (Colnect primary)
  | 'postcards'
  // Phone Cards (Colnect primary)
  | 'phonecards'
  // Medals & Tokens (Colnect primary)
  | 'medals'
  | 'tokens'
  // Pins & Patches (Colnect primary)
  | 'pins'
  | 'patches'
  // Stickers (Colnect primary)
  | 'stickers'
  // Keychains & Magnets (Colnect primary)
  | 'keychains'
  | 'magnets'
  // Tickets (Colnect primary)
  | 'tickets'
  // Beverage Collectibles (Colnect primary)
  | 'beer_coasters'
  | 'bottlecaps'
  | 'drink_labels'
  | 'sugar_packets'
  | 'tea_bags'
  // Card Collectibles (Colnect primary)
  | 'casino_cards'
  | 'gift_cards'
  | 'hotel_key_cards'
  // Kids Meal Toys (Colnect primary)
  | 'kids_meal_toys'
  | 'happy_meal'
  // LEGO
  | 'lego'
  | 'building_blocks'
  // Trading Cards
  | 'trading_cards'
  | 'pokemon_cards'
  | 'pokemon'
  | 'mtg_cards'
  | 'sports_cards'
  | 'baseball_cards'
  | 'football_cards'
  | 'basketball_cards'
  | 'hockey_cards'
  | 'graded_cards'
  | 'yugioh_cards'
  // Books
  | 'books'
  | 'rare_books'
  | 'textbooks'
  // Comics
  | 'comics'
  | 'manga'
  | 'graphic_novels'
  // Video Games
  | 'video_games'
  | 'retro_games'
  | 'game_consoles'
  // Music
  | 'vinyl_records'
  | 'vinyl'
  | 'music'
  | 'records'
  | 'cds'
  | 'cassettes'
  // Sneakers
  | 'sneakers'
  | 'shoes'
  | 'jordans'
  // Streetwear
  | 'streetwear'
  | 'hype_apparel'
  | 'supreme'
  | 'bape'
  // Apparel
  | 'apparel'
  | 'clothing'
  | 'jerseys'
  | 'vintage_clothing'
  | 'designer_fashion'
  // Vehicles
  | 'vehicles'
  | 'cars'
  | 'trucks'
  | 'motorcycles'
  | 'automotive'
  | 'autos'
  // Household
  | 'household'
  | 'appliances'
  | 'kitchen'
  | 'home'
  | 'tools'
  | 'power_tools'
  | 'baby'
  | 'pets'
  | 'grocery'
  | 'beauty'
  | 'health'
  // General
  | 'general'
  | 'collectibles'
  | 'antiques'
  | 'vintage'
  | 'toys'
  | 'action_figures'
  | 'watches'
  | 'jewelry'
  | 'electronics'
  | 'art';

/**
 * Result from category detection
 */
export interface CategoryDetection {
  category: ItemCategory;
  confidence: number;
  keywords: string[];
  source: string;
}

/**
 * Result from category detection (alias for backward compat)
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
  | 'name_override'
  | 'ai_vote'
  | 'user_hint'
  | 'category_hint'
  | 'keyword_match'
  | 'keyword_detection'
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

/**
 * Colnect collectible data (v8.0)
 * Covers 40+ categories: stamps, coins, banknotes, medals, tokens, pins, etc.
 */
export interface ColnectData {
  colnectItemId: number;
  colnectCategory: string;
  categoryDisplay: string;
  itemName: string;
  description?: string;
  catalogCodes?: string;
  seriesId?: number;
  producerId?: number;
  frontImageUrl?: string;
  backImageUrl?: string;
  conditionPrices?: Record<string, number>;
  attribution: string;
  attributionUrl: string;
}

/**
 * Colnect market price entry
 */
export interface ColnectMarketPrice {
  itemId: number;
  condition: string;
  prices: Array<{
    currencyId: number;
    price: number;
  }>;
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