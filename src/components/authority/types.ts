// FILE: src/components/authority/types.ts
// Type definitions for Authority Report Card system
// v7.5 - Comprehensive types for all authority sources

/**
 * Market value range from authority sources
 */
export interface MarketValue {
  low: string;
  mid: string;
  high: string;
}

/**
 * Price by condition/grade
 */
export interface PriceByCondition {
  condition?: string;
  grade?: string;
  price: number;
}

/**
 * Image links structure (Google Books style)
 */
export interface ImageLinks {
  thumbnail?: string;
  smallThumbnail?: string;
  medium?: string;
  large?: string;
}

/**
 * Main Authority Data structure
 * Contains all possible fields from all authority sources
 * Each section extracts only the fields it needs
 */
export interface AuthorityData {
  // === COMMON FIELDS ===
  source: string;
  verified?: boolean;
  confidence?: number;
  title?: string;
  catalogNumber?: string;
  externalUrl?: string;
  marketValue?: MarketValue;
  pricesByCondition?: PriceByCondition[];
  
  // === NESTED DETAILS (fallback) ===
  // Data may be flat OR nested in itemDetails depending on formatter version
  itemDetails?: Record<string, unknown>;
  
  // === GOOGLE BOOKS ===
  googleBooksId?: string;
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
  imageLinks?: ImageLinks;
  retailPrice?: number;
  infoLink?: string;
  canonicalVolumeLink?: string;
  
  // === NUMISTA (Coins) ===
  numistaId?: string;
  issuer?: string;
  minYear?: number;
  maxYear?: number;
  value?: string;
  denomination?: string;
  composition?: string;
  weight?: number;
  size?: number;
  diameter?: number;
  shape?: string;
  obverseThumb?: string;
  reverseThumb?: string;
  
  // === POKEMON TCG ===
  pokemonTcgId?: string;
  set?: string;
  setName?: string;
  rarity?: string;
  artist?: string;
  hp?: string;
  types?: string[];
  number?: string;
  tcgplayer?: {
    url?: string;
    prices?: {
      normal?: { market?: number; low?: number; high?: number };
      holofoil?: { market?: number; low?: number; high?: number };
      reverseHolofoil?: { market?: number; low?: number; high?: number };
    };
  };
  tcgPlayerUrl?: string;
  
  // === BRICKSET (LEGO) ===
  bricksetId?: string;
  setNumber?: string;
  year?: number;
  theme?: string;
  subtheme?: string;
  pieces?: number;
  minifigs?: number;
  ageMin?: number;
  ageMax?: number;
  ageRange?: string;
  availability?: string;
  isRetired?: boolean;
  dateLastAvailable?: string;
  rrp?: number;
  pricePerPiece?: number;
  currentValue?: number;
  priceGuide?: {
    minPrice?: number;
    maxPrice?: number;
    avgPrice?: number;
  };
  bricksetURL?: string;
  
  // === COMIC VINE ===
  comicVineId?: string;
  issueNumber?: string;
  volumeName?: string;
  coverDate?: string;
  deck?: string;
  writers?: string[];
  artists?: string[];
  firstAppearances?: string[];
  hasFirstAppearances?: boolean;
  isKeyIssue?: boolean;
  coverImage?: string;
  coverImageThumb?: string;
  comicVineUrl?: string;
  characterCount?: number;
  
  // === DISCOGS (Vinyl) ===
  discogsId?: string;
  artistName?: string;
  labels?: unknown[];
  label?: unknown;
  formats?: unknown[];
  format?: unknown;
  country?: string;
  released?: string;
  genres?: string[];
  styles?: string[];
  lowestPrice?: number;
  medianPrice?: number;
  highestPrice?: number;
  numForSale?: number;
  thumb?: string;
  uri?: string;
  
  // === RETAILED (Sneakers/Streetwear) ===
  retailedId?: string;
  sku?: string;
  styleId?: string;
  brand?: string;
  colorway?: string;
  releaseDate?: string;
  gender?: string;
  silhouette?: string;
  model?: string;
  msrp?: number;
  resellPrices?: {
    stockx?: number;
    goat?: number;
    flightClub?: number;
    stadiumGoods?: number;
  };
  market?: Record<string, number>;
  
  // === PSA (Graded Cards) ===
  psaCertNumber?: string;
  certNumber?: string;
  grade?: string;
  gradeDescription?: string;
  cardYear?: string;
  cardBrand?: string;
  cardSubject?: string;
  totalPopulation?: number;
  populationHigher?: number;
  labelType?: string;
  certUrl?: string;
  
  // === NHTSA (Vehicles) ===
  vin?: string;
  make?: string;
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
  manufacturerName?: string;
  vehicleYear?: number;
  
  // === UPCITEMDB (Barcodes) ===
  upc?: string;
  ean?: string;
  
  // === GENERIC/EXTENSION FIELDS ===
  name?: string;
  thumbnail?: string;
  image?: string;
  url?: string;
}

/**
 * Props for AuthorityReportCard component
 */
export interface AuthorityReportCardProps {
  authorityData: AuthorityData;
  className?: string;
}

/**
 * Props for individual section components
 */
export interface SectionProps {
  data: AuthorityData;
}