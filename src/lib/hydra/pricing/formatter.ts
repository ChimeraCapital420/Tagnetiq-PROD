// FILE: src/lib/hydra/pricing/formatter.ts
// Price and Response Formatting for HYDRA
// Formats final output for API responses

import type {
  ConsensusResult,
  AuthorityData,
  ModelVote,
} from '../types.js';
import type { BlendedPrice } from './blender.js';

// =============================================================================
// TYPES
// =============================================================================

export interface FormattedAnalysisResponse {
  /** Analysis ID */
  analysisId: string;
  /** Item identification */
  itemName: string;
  /** Category detected */
  category: string;
  /** BUY or SELL recommendation */
  decision: 'BUY' | 'SELL';
  /** Final estimated value */
  estimatedValue: number;
  /** Formatted price string */
  formattedPrice: string;
  /** Price range */
  priceRange: {
    low: number;
    high: number;
    formattedLow: string;
    formattedHigh: string;
  };
  /** Confidence score (0-100) */
  confidence: number;
  /** Analysis quality level */
  analysisQuality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
  /** Summary reasoning */
  summaryReasoning: string;
  /** Valuation factors */
  valuationFactors: string[];
  /** Authority data if available */
  authorityData?: FormattedAuthorityData;
  /** Consensus metrics */
  metrics: {
    totalVotes: number;
    avgAIConfidence: number;
    decisionAgreement: number;
    valueAgreement: number;
  };
  /** Timestamp */
  timestamp: string;
  /** Processing time in ms */
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
  
  // Price by condition (for coins, cards, etc.)
  pricesByCondition?: Array<{
    condition: string;
    grade?: string;
    price: number;
  }>;
  
  // =========================================================================
  // GOOGLE BOOKS SPECIFIC
  // =========================================================================
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
  imageLinks?: {
    thumbnail?: string;
    smallThumbnail?: string;
  };
  retailPrice?: number;
  
  // =========================================================================
  // NUMISTA SPECIFIC (Coins & Banknotes)
  // =========================================================================
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
  
  // =========================================================================
  // POKEMON TCG SPECIFIC
  // =========================================================================
  pokemonTcgId?: string;
  setName?: string;
  setCode?: string;
  rarity?: string;
  artist?: string;
  hp?: string;
  types?: string[];
  attacks?: any[];
  weaknesses?: any[];
  resistances?: any[];
  cardNumber?: string;
  
  // =========================================================================
  // BRICKSET SPECIFIC (LEGO)
  // =========================================================================
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
  rrp?: number; // Recommended retail price
  pricePerPiece?: number;
  
  // =========================================================================
  // DISCOGS SPECIFIC (Vinyl/Music)
  // =========================================================================
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
  tracklist?: Array<{
    position: string;
    title: string;
    duration?: string;
  }>;
  lowestPrice?: number;
  medianPrice?: number;
  highestPrice?: number;
  numForSale?: number;
  
  // =========================================================================
  // RETAILED SPECIFIC (Sneakers/Streetwear)
  // =========================================================================
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
  pricesBySize?: Array<{
    size: string;
    price: number;
  }>;
  gender?: string;
  silhouette?: string;
  
  // =========================================================================
  // PSA SPECIFIC (Graded Items)
  // =========================================================================
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
  
  // =========================================================================
  // COLNECT SPECIFIC (Future - Multi-category collectibles)
  // =========================================================================
  colnectId?: number;
  colnectCategory?: string;
  seriesName?: string;
  producerName?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  catalogCodes?: string;
  
  // Raw item details (fallback for any other data)
  itemDetails?: Record<string, any>;
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

// =============================================================================
// PRICE FORMATTING
// =============================================================================

/**
 * Format a price value for display
 */
export function formatPrice(
  value: number,
  currency: string = 'USD',
  options?: Intl.NumberFormatOptions
): string {
  if (value === 0 || isNaN(value)) return '$0.00';

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });

  return formatter.format(value);
}

/**
 * Format price with appropriate precision
 */
export function formatPriceSmart(value: number, currency: string = 'USD'): string {
  if (value === 0 || isNaN(value)) return '$0';

  if (value < 1) {
    return formatPrice(value, currency, { minimumFractionDigits: 2 });
  }

  if (value < 100) {
    return formatPrice(value, currency, { minimumFractionDigits: 2 });
  }

  if (value < 1000) {
    return formatPrice(value, currency, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  return formatPrice(value, currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/**
 * Format a price range
 */
export function formatPriceRange(
  low: number,
  high: number,
  currency: string = 'USD'
): string {
  return `${formatPriceSmart(low, currency)} - ${formatPriceSmart(high, currency)}`;
}

/**
 * Create price display object
 */
export function createPriceDisplay(
  value: number,
  range?: { low: number; high: number },
  currency: string = 'USD'
): PriceDisplay {
  return {
    value,
    formatted: formatPriceSmart(value, currency),
    currency,
    range: range ? {
      low: formatPriceSmart(range.low, currency),
      high: formatPriceSmart(range.high, currency),
    } : undefined,
  };
}

// =============================================================================
// RESPONSE FORMATTING
// =============================================================================

/**
 * Format full analysis response
 */
export function formatAnalysisResponse(
  analysisId: string,
  consensus: ConsensusResult,
  category: string,
  blendedPrice: BlendedPrice | null,
  authorityData: AuthorityData | null,
  processingTime?: number
): FormattedAnalysisResponse {
  const estimatedValue = blendedPrice?.finalPrice ?? consensus.estimatedValue;
  const priceRange = blendedPrice?.range ?? {
    low: estimatedValue * 0.8,
    high: estimatedValue * 1.2,
  };

  // Extract valuation factors from consensus
  const valuationFactors = consensus.valuationFactors || [
    `${consensus.totalVotes} AI models analyzed`,
    `${consensus.analysisQuality} analysis quality`,
    `${Math.round(consensus.consensusMetrics.decisionAgreement * 100)}% decision agreement`,
  ];

  return {
    analysisId,
    itemName: consensus.itemName,
    category,
    decision: consensus.decision,
    estimatedValue,
    formattedPrice: formatPriceSmart(estimatedValue),
    priceRange: {
      low: priceRange.low,
      high: priceRange.high,
      formattedLow: formatPriceSmart(priceRange.low),
      formattedHigh: formatPriceSmart(priceRange.high),
    },
    confidence: consensus.confidence,
    analysisQuality: consensus.analysisQuality,
    summaryReasoning: generateSummaryReasoning(consensus, blendedPrice),
    valuationFactors,
    authorityData: authorityData ? formatAuthorityData(authorityData) : undefined,
    metrics: {
      totalVotes: consensus.totalVotes,
      avgAIConfidence: Math.round(consensus.consensusMetrics.avgAIConfidence * 100),
      decisionAgreement: Math.round(consensus.consensusMetrics.decisionAgreement * 100),
      valueAgreement: Math.round(consensus.consensusMetrics.valueAgreement * 100),
    },
    timestamp: new Date().toISOString(),
    processingTime,
  };
}

/**
 * Format authority data for response - PRESERVES ALL RICH DATA FROM ALL SOURCES
 */
export function formatAuthorityData(authority: AuthorityData): FormattedAuthorityData {
  const formatted: FormattedAuthorityData = {
    source: authority.source,
    verified: authority.verified ?? true,
    confidence: authority.confidence,
  };

  // Common fields
  if (authority.title) {
    formatted.title = authority.title;
  }
  if (authority.catalogNumber) {
    formatted.catalogNumber = authority.catalogNumber;
  }
  if (authority.externalUrl) {
    formatted.externalUrl = authority.externalUrl;
  }

  // Format market value if available
  if (authority.marketValue) {
    const mv = authority.marketValue;
    formatted.marketValue = {
      low: formatPriceSmart(mv.fair || mv.poor || mv.good || mv.low || 0),
      mid: formatPriceSmart(mv.good || mv.average || mv.vf || mv.mid || 0),
      high: formatPriceSmart(mv.excellent || mv.mint || mv.unc || mv.high || 0),
    };
  }

  // Format price data if available (conditions/grades)
  if (authority.priceData?.conditions) {
    formatted.pricesByCondition = authority.priceData.conditions.map((c: any) => ({
      condition: c.condition,
      grade: c.grade,
      price: c.price,
    }));
  }

  // Extract itemDetails based on source type
  const details = authority.itemDetails || {};

  // =========================================================================
  // GOOGLE BOOKS DATA
  // =========================================================================
  if (authority.source === 'google_books' || details.googleBooksId) {
    formatted.isbn = details.isbn13 || details.isbn10;
    formatted.isbn13 = details.isbn13;
    formatted.isbn10 = details.isbn10;
    formatted.authors = details.authors;
    formatted.publisher = details.publisher;
    formatted.publishedDate = details.publishedDate;
    formatted.pageCount = details.pageCount;
    formatted.categories = details.categories;
    formatted.description = details.description;
    formatted.language = details.language;
    formatted.averageRating = details.averageRating;
    formatted.ratingsCount = details.ratingsCount;
    formatted.imageLinks = details.imageLinks;
    formatted.title = details.title || formatted.title;
    formatted.externalUrl = details.infoLink || details.canonicalVolumeLink || formatted.externalUrl;
    
    // Retail price from priceData
    if (authority.priceData?.retail) {
      formatted.retailPrice = authority.priceData.retail;
    }
  }

  // =========================================================================
  // NUMISTA DATA (Coins & Banknotes)
  // =========================================================================
  if (authority.source === 'numista' || details.numistaId) {
    formatted.numistaId = details.numistaId;
    formatted.title = details.title || formatted.title;
    formatted.issuer = details.issuer;
    formatted.minYear = details.minYear;
    formatted.maxYear = details.maxYear;
    formatted.value = details.value;
    formatted.composition = details.composition;
    formatted.weight = details.weight;
    formatted.size = details.size;
    formatted.thickness = details.thickness;
    formatted.shape = details.shape;
    formatted.orientation = details.orientation;
    formatted.references = details.references;
    formatted.obverseThumb = details.obverseThumb;
    formatted.reverseThumb = details.reverseThumb;
    formatted.externalUrl = details.url || formatted.externalUrl;
  }

  // =========================================================================
  // POKEMON TCG DATA
  // =========================================================================
  if (authority.source === 'pokemon_tcg' || details.pokemonTcgId || details.id) {
    formatted.pokemonTcgId = details.pokemonTcgId || details.id;
    formatted.title = details.name || formatted.title;
    formatted.setName = details.setName || details.set?.name;
    formatted.setCode = details.setCode || details.set?.id;
    formatted.rarity = details.rarity;
    formatted.artist = details.artist;
    formatted.hp = details.hp;
    formatted.types = details.types;
    formatted.attacks = details.attacks;
    formatted.weaknesses = details.weaknesses;
    formatted.resistances = details.resistances;
    formatted.cardNumber = details.number || details.cardNumber;
    formatted.imageLinks = details.images;
    formatted.externalUrl = details.tcgPlayerUrl || formatted.externalUrl;
    
    // Market prices from tcgplayer
    if (details.tcgplayer?.prices) {
      const prices = details.tcgplayer.prices;
      const priceType = prices.holofoil || prices.normal || prices.reverseHolofoil || {};
      formatted.marketValue = {
        low: formatPriceSmart(priceType.low || 0),
        mid: formatPriceSmart(priceType.mid || priceType.market || 0),
        high: formatPriceSmart(priceType.high || 0),
      };
    }
  }

  // =========================================================================
  // BRICKSET DATA (LEGO)
  // =========================================================================
  if (authority.source === 'brickset' || details.bricksetId || details.setID) {
    formatted.bricksetId = details.bricksetId || details.setID;
    formatted.setNumber = details.number || details.setNumber;
    formatted.title = details.name || formatted.title;
    formatted.year = details.year;
    formatted.theme = details.theme;
    formatted.themeGroup = details.themeGroup;
    formatted.subtheme = details.subtheme;
    formatted.pieces = details.pieces;
    formatted.minifigs = details.minifigs;
    formatted.ageRange = details.ageRange || (details.ageMin && details.ageMax ? `${details.ageMin}-${details.ageMax}` : undefined);
    formatted.packagingType = details.packagingType;
    formatted.availability = details.availability;
    formatted.instructionsCount = details.instructionsCount;
    formatted.imageLinks = details.image ? { thumbnail: details.image } : undefined;
    formatted.externalUrl = details.bricksetURL || formatted.externalUrl;
    
    // LEGO pricing
    if (details.LEGOCom?.US) {
      formatted.rrp = details.LEGOCom.US.retailPrice;
      formatted.retailPrice = details.LEGOCom.US.retailPrice;
    }
    if (details.pieces && formatted.retailPrice) {
      formatted.pricePerPiece = parseFloat((formatted.retailPrice / details.pieces).toFixed(3));
    }
    
    // Current market value
    if (details.priceGuide || details.currentValue) {
      const pg = details.priceGuide || {};
      formatted.marketValue = {
        low: formatPriceSmart(pg.minNew || pg.minUsed || 0),
        mid: formatPriceSmart(pg.avgNew || details.currentValue || 0),
        high: formatPriceSmart(pg.maxNew || 0),
      };
    }
  }

  // =========================================================================
  // DISCOGS DATA (Vinyl/Music)
  // =========================================================================
  if (authority.source === 'discogs' || details.discogsId || details.releaseId) {
    formatted.discogsId = details.discogsId || details.id;
    formatted.releaseId = details.releaseId || details.id;
    formatted.masterId = details.masterId || details.master_id;
    formatted.title = details.title || formatted.title;
    formatted.artistName = Array.isArray(details.artists) 
      ? details.artists.map((a: any) => a.name).join(', ')
      : details.artistName;
    formatted.label = Array.isArray(details.labels)
      ? details.labels.map((l: any) => l.name).join(', ')
      : details.label;
    formatted.format = details.formats?.map((f: any) => f.name) || details.format;
    formatted.country = details.country;
    formatted.released = details.released || details.year;
    formatted.genres = details.genres;
    formatted.styles = details.styles;
    formatted.tracklist = details.tracklist?.map((t: any) => ({
      position: t.position,
      title: t.title,
      duration: t.duration,
    }));
    formatted.imageLinks = details.images?.[0] ? { thumbnail: details.images[0].uri } : undefined;
    formatted.externalUrl = details.uri || formatted.externalUrl;
    
    // Discogs marketplace stats
    if (details.lowestPrice || details.stats) {
      formatted.lowestPrice = details.lowestPrice || details.stats?.lowestPrice;
      formatted.medianPrice = details.medianPrice || details.stats?.medianPrice;
      formatted.highestPrice = details.highestPrice || details.stats?.highestPrice;
      formatted.numForSale = details.numForSale || details.stats?.numForSale;
      
      formatted.marketValue = {
        low: formatPriceSmart(formatted.lowestPrice || 0),
        mid: formatPriceSmart(formatted.medianPrice || 0),
        high: formatPriceSmart(formatted.highestPrice || 0),
      };
    }
  }

  // =========================================================================
  // RETAILED DATA (Sneakers/Streetwear)
  // =========================================================================
  if (authority.source === 'retailed' || details.retailedId || details.sku) {
    formatted.retailedId = details.retailedId || details.id;
    formatted.sku = details.sku || details.styleId;
    formatted.styleCode = details.styleCode || details.styleId;
    formatted.title = details.name || details.title || formatted.title;
    formatted.brand = details.brand;
    formatted.colorway = details.colorway || details.color;
    formatted.releaseDate = details.releaseDate;
    formatted.gender = details.gender;
    formatted.silhouette = details.silhouette || details.model;
    formatted.imageLinks = details.image ? { thumbnail: details.image } : (details.images?.[0] ? { thumbnail: details.images[0] } : undefined);
    formatted.externalUrl = details.url || formatted.externalUrl;
    
    // MSRP
    formatted.retailPriceMSRP = details.retailPrice || details.msrp;
    formatted.retailPrice = details.retailPrice || details.msrp;
    
    // Resale prices by platform
    if (details.resellPrices || details.market) {
      const rp = details.resellPrices || details.market || {};
      formatted.resalePrices = {
        stockx: rp.stockX || rp.stockx,
        goat: rp.goat,
        flightClub: rp.flightClub,
        stadiumGoods: rp.stadiumGoods,
      };
      
      // Calculate market value from resale prices
      const prices = Object.values(formatted.resalePrices).filter(p => p && p > 0) as number[];
      if (prices.length > 0) {
        formatted.marketValue = {
          low: formatPriceSmart(Math.min(...prices)),
          mid: formatPriceSmart(prices.reduce((a, b) => a + b, 0) / prices.length),
          high: formatPriceSmart(Math.max(...prices)),
        };
      }
    }
    
    // Prices by size
    if (details.pricesBySize || details.sizeChart) {
      formatted.pricesBySize = (details.pricesBySize || details.sizeChart)?.map((s: any) => ({
        size: s.size,
        price: s.price || s.lowestAsk,
      }));
    }
  }

  // =========================================================================
  // PSA DATA (Graded Items)
  // =========================================================================
  if (authority.source === 'psa' || details.psaCertNumber || details.certNumber) {
    formatted.psaCertNumber = details.psaCertNumber || details.certNumber;
    formatted.grade = details.grade;
    formatted.gradeDescription = details.gradeDescription;
    formatted.cardYear = details.cardYear || details.year;
    formatted.cardBrand = details.cardBrand || details.brand;
    formatted.cardCategory = details.cardCategory || details.category;
    formatted.cardSubject = details.cardSubject || details.subject || details.player;
    formatted.cardVariety = details.cardVariety || details.variety;
    formatted.cardNumber = details.cardNumber;
    formatted.totalPopulation = details.totalPopulation || details.popTotal;
    formatted.populationHigher = details.populationHigher || details.popHigher;
    formatted.labelType = details.labelType;
    formatted.isCrossedOver = details.isCrossedOver;
    formatted.certDate = details.certDate;
    formatted.title = `${details.cardYear || ''} ${details.cardBrand || ''} ${details.cardSubject || ''} PSA ${details.grade || ''}`.trim() || formatted.title;
    formatted.externalUrl = details.certUrl || `https://www.psacard.com/cert/${details.certNumber}` || formatted.externalUrl;
    formatted.catalogNumber = details.certNumber || formatted.catalogNumber;
  }

  // =========================================================================
  // COLNECT DATA (Future - Multi-category collectibles)
  // =========================================================================
  if (authority.source === 'colnect' || details.colnectId) {
    formatted.colnectId = details.colnectId || details.id;
    formatted.colnectCategory = details.colnectCategory || details.category;
    formatted.title = details.itemName || details.name || formatted.title;
    formatted.seriesName = details.seriesName || details.series;
    formatted.producerName = details.producerName || details.producer || details.issuer;
    formatted.catalogCodes = details.catalogCodes;
    formatted.year = details.year;
    formatted.country = details.country;
    
    // Image URLs
    if (details.frontPictureId) {
      const idStr = String(details.frontPictureId);
      const thousands = idStr.slice(0, -3) || '0';
      const remainder = idStr.slice(-3);
      formatted.frontImageUrl = `https://i.colnect.net/images/t/${thousands}/${remainder}/${formatted.title?.replace(/\s+/g, '_') || 'item'}.jpg`;
    }
    if (details.backPictureId) {
      const idStr = String(details.backPictureId);
      const thousands = idStr.slice(0, -3) || '0';
      const remainder = idStr.slice(-3);
      formatted.backImageUrl = `https://i.colnect.net/images/t/${thousands}/${remainder}/${formatted.title?.replace(/\s+/g, '_') || 'item'}.jpg`;
    }
    
    formatted.externalUrl = details.url || formatted.externalUrl;
  }

  // =========================================================================
  // FALLBACK: Include raw itemDetails for any unmapped data
  // =========================================================================
  if (Object.keys(details).length > 0) {
    // Only include itemDetails if there's data we haven't already extracted
    const remainingDetails = { ...details };
    
    // Remove already-extracted fields to avoid duplication
    const extractedKeys = [
      // Google Books
      'googleBooksId', 'isbn13', 'isbn10', 'authors', 'publisher', 'publishedDate',
      'pageCount', 'categories', 'description', 'language', 'averageRating', 'ratingsCount',
      'imageLinks', 'images', 'image', 'infoLink', 'canonicalVolumeLink', 'previewLink',
      // Numista
      'numistaId', 'title', 'name', 'issuer', 'minYear', 'maxYear', 'value', 'composition',
      'weight', 'size', 'thickness', 'shape', 'orientation', 'references', 'url',
      'obverseThumb', 'reverseThumb', 'category',
      // Pokemon TCG
      'pokemonTcgId', 'id', 'set', 'setName', 'setCode', 'rarity', 'artist',
      'hp', 'types', 'attacks', 'weaknesses', 'resistances', 'number', 'tcgplayer', 'tcgPlayerUrl',
      // Brickset
      'bricksetId', 'setID', 'setNumber', 'year', 'theme', 'themeGroup', 'subtheme',
      'pieces', 'minifigs', 'ageMin', 'ageMax', 'ageRange', 'packagingType', 'availability',
      'instructionsCount', 'LEGOCom', 'bricksetURL', 'priceGuide', 'currentValue',
      // Discogs
      'discogsId', 'releaseId', 'masterId', 'master_id', 'artists', 'artistName',
      'labels', 'label', 'formats', 'format', 'country', 'released', 'genres', 'styles',
      'tracklist', 'uri', 'lowestPrice', 'medianPrice', 'highestPrice', 'numForSale', 'stats',
      // Retailed
      'retailedId', 'sku', 'styleId', 'styleCode', 'brand', 'colorway', 'color',
      'releaseDate', 'gender', 'silhouette', 'model', 'retailPrice', 'msrp',
      'resellPrices', 'market', 'pricesBySize', 'sizeChart',
      // PSA
      'psaCertNumber', 'certNumber', 'grade', 'gradeDescription', 'cardYear',
      'cardBrand', 'cardCategory', 'cardSubject', 'subject', 'player', 'cardVariety', 'variety',
      'cardNumber', 'totalPopulation', 'popTotal', 'populationHigher', 'popHigher',
      'labelType', 'isCrossedOver', 'certDate', 'certUrl',
      // Colnect
      'colnectId', 'colnectCategory', 'itemName', 'seriesName', 'series',
      'producerName', 'producer', 'catalogCodes', 'frontPictureId', 'backPictureId',
    ];
    
    extractedKeys.forEach(key => delete remainingDetails[key]);
    
    if (Object.keys(remainingDetails).length > 0) {
      formatted.itemDetails = remainingDetails;
    }
  }

  return formatted;
}

/**
 * Generate summary reasoning text
 */
export function generateSummaryReasoning(
  consensus: ConsensusResult,
  blendedPrice: BlendedPrice | null
): string {
  const parts: string[] = [];

  // Decision reasoning
  if (consensus.decision === 'BUY') {
    parts.push(`This ${consensus.itemName} appears to be a good purchase opportunity.`);
  } else {
    parts.push(`This ${consensus.itemName} may not be the best value at this time.`);
  }

  // Confidence statement
  if (consensus.confidence >= 90) {
    parts.push(`Analysis confidence is high (${consensus.confidence}%).`);
  } else if (consensus.confidence >= 70) {
    parts.push(`Analysis confidence is moderate (${consensus.confidence}%).`);
  } else {
    parts.push(`Analysis confidence is limited (${consensus.confidence}%). Consider additional research.`);
  }

  // Authority verification
  if (blendedPrice?.authorityVerified) {
    parts.push('Price verified against authority database.');
  }

  // Quality note
  if (consensus.analysisQuality === 'FALLBACK') {
    parts.push('Limited data available; estimate may vary.');
  }

  return parts.join(' ');
}

// =============================================================================
// VOTE FORMATTING
// =============================================================================

/**
 * Format model votes for response
 */
export function formatVotes(votes: ModelVote[]): Array<{
  provider: string;
  decision: string;
  value: string;
  confidence: number;
  weight: number;
}> {
  return votes.map(vote => ({
    provider: vote.providerName,
    decision: vote.decision,
    value: formatPriceSmart(vote.estimatedValue),
    confidence: Math.round(vote.confidence * 100),
    weight: parseFloat(vote.weight.toFixed(2)),
  }));
}

/**
 * Format vote summary for logging
 */
export function formatVoteSummaryText(votes: ModelVote[]): string {
  if (votes.length === 0) return 'No votes collected';

  const buyVotes = votes.filter(v => v.decision === 'BUY');
  const sellVotes = votes.filter(v => v.decision === 'SELL');

  const lines = [
    `Total: ${votes.length} votes`,
    `BUY: ${buyVotes.length} | SELL: ${sellVotes.length}`,
    `Providers: ${votes.map(v => v.providerName).join(', ')}`,
  ];

  return lines.join('\n');
}

// =============================================================================
// CONFIDENCE FORMATTING
// =============================================================================

/**
 * Format confidence for display
 */
export function formatConfidence(confidence: number): {
  value: number;
  label: string;
  color: string;
} {
  if (confidence >= 90) {
    return { value: confidence, label: 'High', color: 'green' };
  }
  if (confidence >= 70) {
    return { value: confidence, label: 'Moderate', color: 'yellow' };
  }
  if (confidence >= 50) {
    return { value: confidence, label: 'Low', color: 'orange' };
  }
  return { value: confidence, label: 'Very Low', color: 'red' };
}

/**
 * Format quality level
 */
export function formatQuality(quality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK'): {
  level: string;
  description: string;
  icon: string;
} {
  switch (quality) {
    case 'OPTIMAL':
      return {
        level: 'Optimal',
        description: 'Full multi-AI consensus achieved',
        icon: '✅',
      };
    case 'DEGRADED':
      return {
        level: 'Degraded',
        description: 'Partial consensus, some providers unavailable',
        icon: '⚠️',
      };
    case 'FALLBACK':
      return {
        level: 'Fallback',
        description: 'Limited data, single source estimate',
        icon: '❌',
      };
  }
}

// =============================================================================
// API RESPONSE FORMATTING - MATCHES FRONTEND AnalysisResult INTERFACE
// =============================================================================

/**
 * Format response for API JSON output
 * CRITICAL: This MUST match the frontend AnalysisResult interface in src/types.ts
 */
export function formatAPIResponse(response: FormattedAnalysisResponse): Record<string, unknown> {
  return {
    // Required fields matching AnalysisResult interface
    id: response.analysisId,
    itemName: response.itemName,
    estimatedValue: response.estimatedValue,
    decision: response.decision,
    confidenceScore: response.confidence,
    summary_reasoning: response.summaryReasoning,
    valuation_factors: response.valuationFactors,
    resale_toolkit: {
      listInArena: true,
      sellOnProPlatforms: true,
      linkToMyStore: false,
      shareToSocial: true,
    },
    marketComps: [],
    imageUrl: '',
    capturedAt: response.timestamp,
    category: response.category,
    subCategory: response.category,
    tags: [response.category, response.decision.toLowerCase()],
    analysis_quality: response.analysisQuality,
    
    // Additional data for enhanced frontend features
    formattedPrice: response.formattedPrice,
    priceRange: response.priceRange,
    metrics: response.metrics,
    authorityData: response.authorityData,
    processingTime: response.processingTime,
  };
}

/**
 * Format error response
 */
export function formatErrorResponse(
  error: Error | string,
  analysisId?: string
): Record<string, unknown> {
  return {
    // Return minimal valid AnalysisResult to prevent frontend crash
    id: analysisId || `error_${Date.now()}`,
    itemName: 'Analysis Error',
    estimatedValue: 0,
    decision: 'SELL',
    confidenceScore: 0,
    summary_reasoning: typeof error === 'string' ? error : error.message,
    valuation_factors: ['Error occurred during analysis'],
    resale_toolkit: {
      listInArena: false,
      sellOnProPlatforms: false,
      linkToMyStore: false,
      shareToSocial: false,
    },
    marketComps: [],
    imageUrl: '',
    capturedAt: new Date().toISOString(),
    category: 'error',
    subCategory: 'error',
    tags: ['error'],
    analysis_quality: 'NO_RESULT',
    
    // Error details
    error: {
      message: typeof error === 'string' ? error : error.message,
      timestamp: new Date().toISOString(),
    },
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  formatPrice,
  formatPriceSmart,
  formatPriceRange,
  createPriceDisplay,
  formatAnalysisResponse,
  formatAuthorityData,
  generateSummaryReasoning,
  formatVotes,
  formatVoteSummaryText,
  formatConfidence,
  formatQuality,
  formatAPIResponse,
  formatErrorResponse,
};