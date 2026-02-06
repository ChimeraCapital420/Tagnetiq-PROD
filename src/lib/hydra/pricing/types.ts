// FILE: src/lib/hydra/pricing/types.ts
// Types for HYDRA pricing formatter
// Refactored from monolith v7.3

import type { ConsensusResult, AuthorityData, ModelVote } from '../types.js';
import type { BlendedPrice } from './blender.js';

// =============================================================================
// FORMATTED RESPONSE TYPES
// =============================================================================

export interface FormattedAnalysisResponse {
  analysisId: string;
  itemName: string;
  category: string;
  decision: 'BUY' | 'SELL';
  estimatedValue: number;
  formattedPrice: string;
  priceRange: {
    low: number;
    high: number;
    formattedLow: string;
    formattedHigh: string;
  };
  confidence: number;
  analysisQuality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
  summaryReasoning: string;
  valuationFactors: string[];
  authorityData?: FormattedAuthorityData;
  metrics: {
    totalVotes: number;
    avgAIConfidence: number;
    decisionAgreement: number;
    valueAgreement: number;
  };
  timestamp: string;
  processingTime?: number;
}

export interface FormattedAuthorityData {
  source: string;
  verified: boolean;
  confidence?: number;
  
  // Common fields
  title?: string;
  catalogNumber?: string;
  externalUrl?: string;
  
  // Market values
  marketValue?: {
    low: string;
    mid: string;
    high: string;
  };
  
  // Price by condition
  pricesByCondition?: Array<{
    condition: string;
    grade?: string;
    price: number;
  }>;
  
  // Google Books
  isbn?: string;
  isbn13?: string;
  isbn10?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  categories?: string[];
  description?: string;
  language?: string;
  averageRating?: number;
  ratingsCount?: number;
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  retailPrice?: number;
  
  // Numista (Coins)
  numistaId?: number;
  issuer?: string;
  minYear?: number;
  maxYear?: number;
  value?: string;
  composition?: string;
  weight?: number;
  size?: number;
  thickness?: number;
  shape?: string;
  orientation?: string;
  references?: string;
  obverseThumb?: string;
  reverseThumb?: string;
  
  // Pokemon TCG
  pokemonTcgId?: string;
  setName?: string;
  setCode?: string;
  rarity?: string;
  artist?: string;
  hp?: string;
  types?: string[];
  attacks?: unknown[];
  weaknesses?: unknown[];
  resistances?: unknown[];
  cardNumber?: string;
  
  // Brickset (LEGO)
  bricksetId?: number;
  setNumber?: string;
  year?: number;
  theme?: string;
  themeGroup?: string;
  subtheme?: string;
  pieces?: number;
  minifigs?: number;
  ageRange?: string;
  packagingType?: string;
  availability?: string;
  instructionsCount?: number;
  rrp?: number;
  pricePerPiece?: number;
  isRetired?: boolean;
  dateFirstAvailable?: string;
  dateLastAvailable?: string;
  
  // Comic Vine
  comicVineId?: number;
  issueName?: string;
  issueNumber?: string;
  volumeName?: string;
  volumeId?: number;
  coverDate?: string;
  storeDate?: string;
  deck?: string;
  writers?: string[];
  artists?: string[];
  coverArtists?: string[];
  characterAppearances?: string[];
  characterCount?: number;
  firstAppearances?: string[];
  hasFirstAppearances?: boolean;
  isKeyIssue?: boolean;
  coverImage?: string;
  coverImageLarge?: string;
  coverImageThumb?: string;
  comicVineUrl?: string;
  
  // Discogs (Vinyl)
  discogsId?: number;
  releaseId?: number;
  masterId?: number;
  artistName?: string;
  label?: string;
  format?: string[];
  country?: string;
  released?: string;
  genres?: string[];
  styles?: string[];
  tracklist?: Array<{ position: string; title: string; duration?: string }>;
  lowestPrice?: number;
  medianPrice?: number;
  highestPrice?: number;
  numForSale?: number;
  
  // Retailed (Sneakers)
  retailedId?: string;
  sku?: string;
  styleCode?: string;
  brand?: string;
  colorway?: string;
  releaseDate?: string;
  retailPriceMSRP?: number;
  resalePrices?: {
    stockx?: number;
    goat?: number;
    flightClub?: number;
    stadiumGoods?: number;
  };
  pricesBySize?: Array<{ size: string; price: number }>;
  gender?: string;
  silhouette?: string;
  
  // PSA (Graded)
  psaCertNumber?: string;
  grade?: string;
  gradeDescription?: string;
  cardYear?: string;
  cardBrand?: string;
  cardCategory?: string;
  cardSubject?: string;
  cardVariety?: string;
  totalPopulation?: number;
  populationHigher?: number;
  labelType?: string;
  isCrossedOver?: boolean;
  certDate?: string;
  
  // NHTSA (Vehicles)
  vin?: string;
  make?: string;
  model?: string;
  vehicleYear?: number;
  trim?: string;
  bodyClass?: string;
  vehicleType?: string;
  driveType?: string;
  fuelType?: string;
  engineCylinders?: number;
  engineDisplacement?: string;
  engineHP?: number;
  transmissionStyle?: string;
  doors?: number;
  plantCity?: string;
  plantCountry?: string;
  plantCompanyName?: string;
  series?: string;
  gvwr?: string;
  manufacturerName?: string;
  
  // Colnect
  colnectId?: number;
  colnectCategory?: string;
  seriesName?: string;
  producerName?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  catalogCodes?: string;
  
  // Fallback
  itemDetails?: Record<string, unknown>;
}

export interface PriceDisplay {
  value: number;
  formatted: string;
  currency: string;
  range?: {
    low: string;
    high: string;
  };
}

// Re-export types that extractors need
export type { ConsensusResult, AuthorityData, ModelVote, BlendedPrice };