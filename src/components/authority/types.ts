// FILE: src/components/authority/types.ts
// All TypeScript interfaces for Authority Report Card system
// Refactored from monolith v7.3

export interface AuthorityData {
  source: string;
  verified?: boolean;
  confidence?: number;
  title?: string;
  catalogNumber?: string;
  externalUrl?: string;
  marketValue?: {
    low: string;
    mid: string;
    high: string;
  };
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
  rrp?: number;
  pricePerPiece?: number;
  dateFirstAvailable?: string;
  dateLastAvailable?: string;
  isRetired?: boolean;
  
  // Comic Vine (Comics)
  comicVineId?: number;
  issueName?: string;
  issueNumber?: string;
  volumeName?: string;
  volumeId?: number;
  coverDate?: string;
  storeDate?: string;
  deck?: string;
  credits?: Record<string, string[]>;
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
  gender?: string;
  silhouette?: string;
  retailPriceMSRP?: number;
  resalePrices?: {
    stockx?: number;
    goat?: number;
    flightClub?: number;
    stadiumGoods?: number;
  };
  
  // PSA (Graded)
  psaCertNumber?: string;
  grade?: string;
  gradeDescription?: string;
  cardYear?: string;
  cardBrand?: string;
  cardCategory?: string;
  cardSubject?: string;
  totalPopulation?: number;
  populationHigher?: number;
  labelType?: string;
  
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
  manufacturerName?: string;
  
  // UPCitemdb (Barcodes)
  upc?: string;
  ean?: string;
  msrp?: number;
  
  // Fallback - nested itemDetails from fetchers
  itemDetails?: Record<string, unknown>;
}

export interface AuthorityReportCardProps {
  authorityData: AuthorityData;
  className?: string;
}

export interface SectionProps {
  data: AuthorityData;
}