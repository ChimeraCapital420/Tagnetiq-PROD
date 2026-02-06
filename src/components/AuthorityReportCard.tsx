// FILE: src/components/AuthorityReportCard.tsx
// HYDRA v6.3 - Universal Authority Report Card
// FIXED: Normalized source to lowercase for consistent matching
// ADDED v6.3: Comic Vine section with full issue details, credits, first appearances

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  ExternalLink, 
  BookOpen, 
  Coins, 
  Sparkles, 
  Blocks, 
  Music, 
  ShoppingBag,
  Award,
  Car,
  Package,
  BookMarked,
  Star
} from 'lucide-react';

// Types for the formatted authority data from HYDRA
interface AuthorityData {
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
  
  // Fallback - nested itemDetails from fetchers
  itemDetails?: Record<string, unknown>;
}

interface AuthorityReportCardProps {
  authorityData: AuthorityData;
  className?: string;
}

// Source icon mapping (lowercase keys)
// 10 Authority Sources + eBay market data
const SOURCE_ICONS: Record<string, React.ReactNode> = {
  // Books & Comics
  google_books: <BookOpen className="h-5 w-5" />,
  comicvine: <BookMarked className="h-5 w-5" />,
  'comic vine': <BookMarked className="h-5 w-5" />,
  
  // Collectibles
  numista: <Coins className="h-5 w-5" />,
  pokemon_tcg: <Sparkles className="h-5 w-5" />,
  brickset: <Blocks className="h-5 w-5" />,
  psa: <Award className="h-5 w-5" />,
  
  // Music & Fashion
  discogs: <Music className="h-5 w-5" />,
  retailed: <ShoppingBag className="h-5 w-5" />,
  
  // Vehicles & Products
  nhtsa: <Car className="h-5 w-5" />,
  upcitemdb: <Package className="h-5 w-5" />,
  
  // Market data
  ebay: <ShoppingBag className="h-5 w-5" />,
};

// Source display names (lowercase keys)
const SOURCE_NAMES: Record<string, string> = {
  google_books: 'Google Books',
  comicvine: 'Comic Vine',
  'comic vine': 'Comic Vine',
  numista: 'Numista',
  pokemon_tcg: 'Pokémon TCG',
  brickset: 'Brickset',
  discogs: 'Discogs',
  retailed: 'Retailed',
  psa: 'PSA',
  nhtsa: 'NHTSA',
  upcitemdb: 'UPCitemdb',
  ebay: 'eBay',
};

// Helper component for data rows
const DataRow: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ 
  label, 
  value,
  className = ''
}) => {
  if (value === null || value === undefined || value === '') return null;
  
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
};

// Helper component for image thumbnails
const ThumbnailImage: React.FC<{ src?: string; alt: string; className?: string }> = ({
  src,
  alt,
  className = ''
}) => {
  if (!src) return null;
  
  return (
    <div className={`relative overflow-hidden rounded-md ${className}`}>
      <img 
        src={src} 
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
};

export const AuthorityReportCard: React.FC<AuthorityReportCardProps> = ({ 
  authorityData,
  className = ''
}) => {
  // FIXED: Normalize source to lowercase for consistent matching
  const source = authorityData.source?.toLowerCase().replace(/\s+/g, '') || '';
  const icon = SOURCE_ICONS[source] || SOURCE_ICONS[authorityData.source?.toLowerCase() || ''] || <Shield className="h-5 w-5" />;
  const sourceName = SOURCE_NAMES[source] || SOURCE_NAMES[authorityData.source?.toLowerCase() || ''] || authorityData.source || 'Authority';
  
  // Debug log to help troubleshoot - ENHANCED v7.3
  console.log(`🎴 AuthorityReportCard rendering for source: "${source}"`);
  console.log(`🎴 Authority data keys:`, Object.keys(authorityData));
  console.log(`🎴 Has itemDetails:`, !!authorityData.itemDetails);
  if (authorityData.itemDetails) {
    console.log(`🎴 itemDetails keys:`, Object.keys(authorityData.itemDetails));
    console.log(`🎴 itemDetails sample:`, JSON.stringify(authorityData.itemDetails).substring(0, 500));
  }
  // Log key fields directly
  console.log(`🎴 Direct fields - setNumber: ${(authorityData as any).setNumber}, year: ${(authorityData as any).year}, pieces: ${(authorityData as any).pieces}`);
  
  return (
    <Card className={`border-green-500/20 bg-green-50/50 dark:bg-green-950/20 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="text-green-600">{icon}</div>
          <CardTitle className="text-lg">
            {authorityData.title || `Verified by ${sourceName}`}
          </CardTitle>
          <Badge variant="outline" className="ml-auto text-green-600 border-green-600">
            {authorityData.verified !== false ? 'Authority Verified' : 'Partial Match'}
          </Badge>
        </div>
        {authorityData.confidence && (
          <p className="text-xs text-muted-foreground mt-1">
            Match Confidence: {Math.round(authorityData.confidence * 100)}%
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Render source-specific content */}
        {source === 'google_books' && <GoogleBooksSection data={authorityData} />}
        {source === 'numista' && <NumistaSection data={authorityData} />}
        {source === 'pokemon_tcg' && <PokemonTcgSection data={authorityData} />}
        {source === 'brickset' && <BricksetSection data={authorityData} />}
        {source === 'discogs' && <DiscogsSection data={authorityData} />}
        {source === 'retailed' && <RetailedSection data={authorityData} />}
        {source === 'psa' && <PsaSection data={authorityData} />}
        {source === 'nhtsa' && <NhtsaSection data={authorityData} />}
        {source === 'upcitemdb' && <UpcItemDbSection data={authorityData} />}
        {(source === 'comicvine' || source === 'comic vine') && <ComicVineSection data={authorityData} />}
        
        {/* Market Value Display (Universal) */}
        {authorityData.marketValue && (
          <div className="pt-3 border-t">
            <p className="text-sm font-semibold mb-2">Market Value Range</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xs text-muted-foreground">Low</p>
                <p className="font-bold text-sm text-red-600">{authorityData.marketValue.low}</p>
              </div>
              <div className="text-center p-2 rounded bg-background border-2 border-green-500/50">
                <p className="text-xs text-muted-foreground">Market</p>
                <p className="font-bold text-sm text-green-600">{authorityData.marketValue.mid}</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xs text-muted-foreground">High</p>
                <p className="font-bold text-sm text-blue-600">{authorityData.marketValue.high}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Prices by Condition (if available) */}
        {authorityData.pricesByCondition && authorityData.pricesByCondition.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-sm font-semibold mb-2">Prices by Grade/Condition</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {authorityData.pricesByCondition.slice(0, 6).map((pc, idx) => (
                <div key={idx} className="text-center p-2 rounded bg-background">
                  <p className="text-xs text-muted-foreground">{pc.grade || pc.condition}</p>
                  <p className="font-bold text-sm">${pc.price.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* External Link */}
        {authorityData.externalUrl && (
          <div className="pt-2 text-center">
            <a 
              href={authorityData.externalUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
            >
              View on {sourceName} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        
        {/* Source Attribution */}
        <div className="pt-2 text-xs text-center text-muted-foreground">
          Data provided by {sourceName}
          {authorityData.catalogNumber && ` • ${authorityData.catalogNumber}`}
        </div>
      </CardContent>
    </Card>
  );
};

// =============================================================================
// SOURCE-SPECIFIC SECTIONS (10 Authority Sources)
// =============================================================================

// -----------------------------------------------------------------------------
// 1. GOOGLE BOOKS
// -----------------------------------------------------------------------------
const GoogleBooksSection: React.FC<{ data: AuthorityData }> = ({ data }) => (
  <div className="space-y-3">
    {data.imageLinks?.thumbnail && (
      <div className="flex justify-center">
        <ThumbnailImage 
          src={data.imageLinks.thumbnail} 
          alt={data.title || 'Book cover'} 
          className="w-24 h-32"
        />
      </div>
    )}
    <div className="grid grid-cols-2 gap-3">
      <DataRow label="ISBN" value={data.isbn || data.isbn13 || data.isbn10} />
      <DataRow label="Author(s)" value={data.authors?.join(', ')} />
      <DataRow label="Publisher" value={data.publisher} />
      <DataRow label="Published" value={data.publishedDate} />
      <DataRow label="Pages" value={data.pageCount} />
      <DataRow label="Language" value={data.language?.toUpperCase()} />
      {data.averageRating && (
        <DataRow label="Rating" value={`${data.averageRating}/5 (${data.ratingsCount} reviews)`} />
      )}
      {data.retailPrice && (
        <DataRow label="Retail Price" value={`$${data.retailPrice.toFixed(2)}`} />
      )}
    </div>
    {data.categories && data.categories.length > 0 && (
      <div className="pt-2">
        <p className="text-xs text-muted-foreground mb-1">Categories</p>
        <div className="flex flex-wrap gap-1">
          {data.categories.slice(0, 3).map((cat, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">{cat}</Badge>
          ))}
        </div>
      </div>
    )}
  </div>
);

// -----------------------------------------------------------------------------
// 2. COMIC VINE (NEW!)
// -----------------------------------------------------------------------------
const ComicVineSection: React.FC<{ data: AuthorityData }> = ({ data }) => {
  // Handle both flat data and nested itemDetails
  const details = (data.itemDetails || data) as AuthorityData;
  
  // Extract values with fallbacks
  const coverImage = details.coverImage || (data.itemDetails?.coverImage as string);
  const isKeyIssue = details.isKeyIssue || (data.itemDetails?.isKeyIssue as boolean);
  const firstAppearances = details.firstAppearances || (data.itemDetails?.firstAppearances as string[]);
  const issueNumber = details.issueNumber || (data.itemDetails?.issueNumber as string);
  const volumeName = details.volumeName || (data.itemDetails?.volumeName as string);
  const coverDate = details.coverDate || (data.itemDetails?.coverDate as string);
  const storeDate = details.storeDate || (data.itemDetails?.storeDate as string);
  const deck = details.deck || (data.itemDetails?.deck as string);
  const description = details.description || (data.itemDetails?.description as string);
  const writers = details.writers || (data.itemDetails?.writers as string[]);
  const artists = details.artists || (data.itemDetails?.artists as string[]);
  const coverArtists = details.coverArtists || (data.itemDetails?.coverArtists as string[]);
  const characterAppearances = details.characterAppearances || (data.itemDetails?.characterAppearances as string[]);
  const characterCount = details.characterCount || (data.itemDetails?.characterCount as number);
  const comicVineId = details.comicVineId || (data.itemDetails?.comicVineId as number);
  
  return (
    <div className="space-y-3">
      {/* Cover Image */}
      {coverImage && (
        <div className="flex justify-center">
          <ThumbnailImage 
            src={coverImage} 
            alt="Comic Cover" 
            className="w-32 h-48 shadow-lg" 
          />
        </div>
      )}
      
      {/* Key Issue Alert - IMPORTANT for collectors! */}
      {isKeyIssue && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-md p-2 flex items-center justify-center gap-2">
          <Star className="h-4 w-4 text-yellow-600 fill-yellow-600" />
          <span className="text-yellow-700 dark:text-yellow-400 font-semibold text-sm">Key Issue</span>
        </div>
      )}
      
      {/* First Appearances - CRITICAL for comic value! */}
      {firstAppearances && firstAppearances.length > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-md p-3">
          <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> First Appearances
          </p>
          <div className="flex flex-wrap gap-1">
            {firstAppearances.map((char, idx) => (
              <Badge key={idx} className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
                {char}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {/* Basic Info Grid */}
      <div className="grid grid-cols-2 gap-3">
        <DataRow label="Issue" value={issueNumber ? `#${issueNumber}` : undefined} />
        <DataRow label="Series/Volume" value={volumeName} />
        <DataRow label="Cover Date" value={coverDate} />
        <DataRow label="On Sale Date" value={storeDate} />
        <DataRow label="Comic Vine ID" value={comicVineId} />
      </div>
      
      {/* Story Description */}
      {(deck || description) && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Story</p>
          <p className="text-sm line-clamp-3">{deck || description}</p>
        </div>
      )}
      
      {/* Creative Team */}
      <div className="space-y-2">
        {writers && writers.length > 0 && (
          <DataRow label="Writer(s)" value={writers.join(', ')} />
        )}
        {artists && artists.length > 0 && (
          <DataRow label="Artist(s)" value={artists.join(', ')} />
        )}
        {coverArtists && coverArtists.length > 0 && (
          <DataRow label="Cover Artist(s)" value={coverArtists.join(', ')} />
        )}
      </div>
      
      {/* Character Appearances */}
      {characterAppearances && characterAppearances.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            Characters ({characterCount || characterAppearances.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {characterAppearances.slice(0, 12).map((char, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">{char}</Badge>
            ))}
            {characterAppearances.length > 12 && (
              <Badge variant="outline" className="text-xs">
                +{characterAppearances.length - 12} more
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// 3. NUMISTA (Coins)
// -----------------------------------------------------------------------------
const NumistaSection: React.FC<{ data: AuthorityData }> = ({ data }) => (
  <div className="space-y-3">
    {(data.obverseThumb || data.reverseThumb) && (
      <div className="flex justify-center gap-4">
        {data.obverseThumb && (
          <div className="text-center">
            <ThumbnailImage src={data.obverseThumb} alt="Obverse" className="w-20 h-20 rounded-full" />
            <p className="text-xs text-muted-foreground mt-1">Obverse</p>
          </div>
        )}
        {data.reverseThumb && (
          <div className="text-center">
            <ThumbnailImage src={data.reverseThumb} alt="Reverse" className="w-20 h-20 rounded-full" />
            <p className="text-xs text-muted-foreground mt-1">Reverse</p>
          </div>
        )}
      </div>
    )}
    <div className="grid grid-cols-2 gap-3">
      <DataRow label="Numista ID" value={data.numistaId} />
      <DataRow label="Issuer" value={data.issuer} />
      <DataRow label="Year(s)" value={data.minYear === data.maxYear ? data.minYear : `${data.minYear}-${data.maxYear}`} />
      <DataRow label="Denomination" value={data.value} />
      <DataRow label="Composition" value={data.composition} />
      <DataRow label="Weight" value={data.weight ? `${data.weight}g` : undefined} />
      <DataRow label="Diameter" value={data.size ? `${data.size}mm` : undefined} />
      <DataRow label="Thickness" value={data.thickness ? `${data.thickness}mm` : undefined} />
      <DataRow label="Shape" value={data.shape} />
      <DataRow label="Orientation" value={data.orientation} />
    </div>
    {data.references && (
      <DataRow label="Catalog References" value={data.references} className="col-span-2" />
    )}
  </div>
);

// -----------------------------------------------------------------------------
// 4. POKEMON TCG
// -----------------------------------------------------------------------------
const PokemonTcgSection: React.FC<{ data: AuthorityData }> = ({ data }) => (
  <div className="space-y-3">
    {data.imageLinks?.thumbnail && (
      <div className="flex justify-center">
        <ThumbnailImage 
          src={data.imageLinks.thumbnail} 
          alt={data.title || 'Pokemon card'} 
          className="w-32 h-44"
        />
      </div>
    )}
    <div className="grid grid-cols-2 gap-3">
      <DataRow label="Card ID" value={data.pokemonTcgId} />
      <DataRow label="Set" value={data.setName} />
      <DataRow label="Card Number" value={data.cardNumber} />
      <DataRow label="Rarity" value={data.rarity} />
      <DataRow label="HP" value={data.hp} />
      <DataRow label="Artist" value={data.artist} />
    </div>
    {data.types && data.types.length > 0 && (
      <div>
        <p className="text-xs text-muted-foreground mb-1">Types</p>
        <div className="flex flex-wrap gap-1">
          {data.types.map((type, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">{type}</Badge>
          ))}
        </div>
      </div>
    )}
  </div>
);

// -----------------------------------------------------------------------------
// 5. BRICKSET (LEGO)
// -----------------------------------------------------------------------------
const BricksetSection: React.FC<{ data: AuthorityData }> = ({ data }) => {
  // Handle both flat data and nested itemDetails
  const details = (data.itemDetails || data) as AuthorityData;
  
  // DEBUG v7.3 - Log what we're extracting from
  console.log(`🧱 BricksetSection - data.itemDetails exists:`, !!data.itemDetails);
  console.log(`🧱 BricksetSection - using details from:`, data.itemDetails ? 'itemDetails' : 'data directly');
  console.log(`🧱 BricksetSection - details keys:`, Object.keys(details));
  
  // Extract values with fallbacks
  const thumbnail = details.imageLinks?.thumbnail || (data.itemDetails?.imageLinks as any)?.thumbnail;
  const setNumber = details.setNumber || (data.itemDetails?.setNumber as string);
  const year = details.year || (data.itemDetails?.year as number);
  const theme = details.theme || (data.itemDetails?.theme as string);
  const subtheme = details.subtheme || (data.itemDetails?.subtheme as string);
  const pieces = details.pieces || (data.itemDetails?.pieces as number);
  const minifigs = details.minifigs || (data.itemDetails?.minifigs as number);
  const ageRange = details.ageRange || (data.itemDetails?.ageRange as string);
  const availability = details.availability || (data.itemDetails?.availability as string);
  const rrp = details.rrp || (data.itemDetails?.rrp as number);
  const pricePerPiece = details.pricePerPiece || (data.itemDetails?.pricePerPiece as number);
  const bricksetId = details.bricksetId || (data.itemDetails?.bricksetId as number);
  const dateFirstAvailable = details.dateFirstAvailable || (data.itemDetails?.dateFirstAvailable as string);
  const dateLastAvailable = details.dateLastAvailable || (data.itemDetails?.dateLastAvailable as string);
  const isRetired = details.isRetired || (data.itemDetails?.isRetired as boolean);
  
  // DEBUG v7.3 - Log extracted values
  console.log(`🧱 BricksetSection - Extracted: setNumber=${setNumber}, year=${year}, theme=${theme}, pieces=${pieces}`);
  
  // Format dates nicely
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return undefined;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };
  
  return (
    <div className="space-y-3">
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage 
            src={thumbnail} 
            alt={data.title || 'LEGO set'} 
            className="w-40 h-32"
          />
        </div>
      )}
      
      {/* Retired Badge */}
      {isRetired && (
        <div className="bg-orange-500/20 border border-orange-500/50 rounded-md p-2 flex items-center justify-center gap-2">
          <Package className="h-4 w-4 text-orange-600" />
          <span className="text-orange-700 dark:text-orange-400 font-semibold text-sm">
            Retired Set
            {dateLastAvailable && ` • ${formatDate(dateLastAvailable)}`}
          </span>
        </div>
      )}
      
      {/* Currently Available Badge */}
      {availability === 'Retail' && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-md p-2 flex items-center justify-center gap-2">
          <ShoppingBag className="h-4 w-4 text-green-600" />
          <span className="text-green-700 dark:text-green-400 font-semibold text-sm">Currently Available</span>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-3">
        <DataRow label="Set Number" value={setNumber} />
        <DataRow label="Year" value={year} />
        <DataRow label="Theme" value={theme} />
        <DataRow label="Subtheme" value={subtheme} />
        <DataRow label="Pieces" value={pieces?.toLocaleString()} />
        <DataRow label="Minifigures" value={minifigs} />
        <DataRow label="Age Range" value={ageRange} />
        {dateFirstAvailable && <DataRow label="Released" value={formatDate(dateFirstAvailable)} />}
        {dateLastAvailable && <DataRow label="Retired" value={formatDate(dateLastAvailable)} />}
        {rrp && <DataRow label="Original RRP" value={`$${rrp.toFixed(2)}`} />}
        {pricePerPiece && <DataRow label="Price/Piece" value={`$${pricePerPiece.toFixed(3)}`} />}
        <DataRow label="Brickset ID" value={bricksetId} />
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 6. DISCOGS (Vinyl Records)
// -----------------------------------------------------------------------------
const DiscogsSection: React.FC<{ data: AuthorityData }> = ({ data }) => (
  <div className="space-y-3">
    {data.imageLinks?.thumbnail && (
      <div className="flex justify-center">
        <ThumbnailImage 
          src={data.imageLinks.thumbnail} 
          alt={data.title || 'Album cover'} 
          className="w-32 h-32"
        />
      </div>
    )}
    <div className="grid grid-cols-2 gap-3">
      <DataRow label="Artist" value={data.artistName} />
      <DataRow label="Label" value={data.label} />
      <DataRow label="Format" value={Array.isArray(data.format) ? data.format.join(', ') : data.format} />
      <DataRow label="Country" value={data.country} />
      <DataRow label="Released" value={data.released} />
      <DataRow label="For Sale" value={data.numForSale ? `${data.numForSale} listings` : undefined} />
    </div>
    {data.genres && data.genres.length > 0 && (
      <div>
        <p className="text-xs text-muted-foreground mb-1">Genres</p>
        <div className="flex flex-wrap gap-1">
          {data.genres.map((g, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">{g}</Badge>
          ))}
        </div>
      </div>
    )}
    {data.styles && data.styles.length > 0 && (
      <div>
        <p className="text-xs text-muted-foreground mb-1">Styles</p>
        <div className="flex flex-wrap gap-1">
          {data.styles.map((s, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">{s}</Badge>
          ))}
        </div>
      </div>
    )}
  </div>
);

// -----------------------------------------------------------------------------
// 7. RETAILED (Sneakers)
// -----------------------------------------------------------------------------
const RetailedSection: React.FC<{ data: AuthorityData }> = ({ data }) => (
  <div className="space-y-3">
    {data.imageLinks?.thumbnail && (
      <div className="flex justify-center">
        <ThumbnailImage 
          src={data.imageLinks.thumbnail} 
          alt={data.title || 'Sneaker'} 
          className="w-40 h-28"
        />
      </div>
    )}
    <div className="grid grid-cols-2 gap-3">
      <DataRow label="Brand" value={data.brand} />
      <DataRow label="SKU" value={data.sku || data.styleCode} />
      <DataRow label="Colorway" value={data.colorway} />
      <DataRow label="Silhouette" value={data.silhouette} />
      <DataRow label="Gender" value={data.gender} />
      <DataRow label="Release Date" value={data.releaseDate} />
      {data.retailPriceMSRP && <DataRow label="Retail (MSRP)" value={`$${data.retailPriceMSRP}`} />}
    </div>
    {data.resalePrices && (
      <div className="pt-2 border-t">
        <p className="text-sm font-semibold mb-2">Resale Prices</p>
        <div className="grid grid-cols-2 gap-2">
          {data.resalePrices.stockx && (
            <div className="text-center p-2 rounded bg-background">
              <p className="text-xs text-muted-foreground">StockX</p>
              <p className="font-bold text-sm">${data.resalePrices.stockx}</p>
            </div>
          )}
          {data.resalePrices.goat && (
            <div className="text-center p-2 rounded bg-background">
              <p className="text-xs text-muted-foreground">GOAT</p>
              <p className="font-bold text-sm">${data.resalePrices.goat}</p>
            </div>
          )}
          {data.resalePrices.flightClub && (
            <div className="text-center p-2 rounded bg-background">
              <p className="text-xs text-muted-foreground">Flight Club</p>
              <p className="font-bold text-sm">${data.resalePrices.flightClub}</p>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

// -----------------------------------------------------------------------------
// 8. PSA (Graded Cards)
// -----------------------------------------------------------------------------
const PsaSection: React.FC<{ data: AuthorityData }> = ({ data }) => (
  <div className="space-y-3">
    <div className="flex justify-center">
      <div className="bg-gradient-to-r from-red-500 to-red-700 text-white px-6 py-3 rounded-lg text-center">
        <p className="text-xs opacity-80">PSA Grade</p>
        <p className="text-3xl font-bold">{data.grade}</p>
        {data.gradeDescription && (
          <p className="text-xs opacity-80">{data.gradeDescription}</p>
        )}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <DataRow label="Cert Number" value={data.psaCertNumber} />
      <DataRow label="Year" value={data.cardYear} />
      <DataRow label="Brand" value={data.cardBrand} />
      <DataRow label="Subject" value={data.cardSubject} />
      <DataRow label="Category" value={data.cardCategory} />
      <DataRow label="Card Number" value={data.cardNumber} />
      <DataRow label="Label Type" value={data.labelType} />
    </div>
    {(data.totalPopulation || data.populationHigher !== undefined) && (
      <div className="pt-2 border-t">
        <p className="text-sm font-semibold mb-2">Population Report</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 rounded bg-background">
            <p className="text-xs text-muted-foreground">This Grade</p>
            <p className="font-bold text-lg">{data.totalPopulation?.toLocaleString()}</p>
          </div>
          <div className="text-center p-2 rounded bg-background">
            <p className="text-xs text-muted-foreground">Higher Grades</p>
            <p className="font-bold text-lg">{data.populationHigher?.toLocaleString()}</p>
          </div>
        </div>
      </div>
    )}
  </div>
);

// -----------------------------------------------------------------------------
// 9. NHTSA (Vehicles)
// -----------------------------------------------------------------------------
const NhtsaSection: React.FC<{ data: AuthorityData }> = ({ data }) => (
  <div className="space-y-3">
    <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-lg text-center">
      <p className="text-2xl font-bold">
        {data.vehicleYear} {data.make} {data.model}
      </p>
      {data.trim && <p className="text-sm opacity-80">{data.trim}</p>}
    </div>
    <div className="grid grid-cols-2 gap-3">
      <DataRow label="VIN" value={data.vin} className="col-span-2 font-mono" />
      <DataRow label="Body Class" value={data.bodyClass} />
      <DataRow label="Vehicle Type" value={data.vehicleType} />
      <DataRow label="Drive Type" value={data.driveType} />
      <DataRow label="Fuel Type" value={data.fuelType} />
      <DataRow label="Engine" value={data.engineCylinders ? `${data.engineCylinders} Cylinder` : undefined} />
      <DataRow label="Displacement" value={data.engineDisplacement} />
      <DataRow label="Horsepower" value={data.engineHP ? `${data.engineHP} HP` : undefined} />
      <DataRow label="Transmission" value={data.transmissionStyle} />
      <DataRow label="Doors" value={data.doors} />
      <DataRow label="Manufacturer" value={data.manufacturerName} />
      <DataRow label="Plant Location" value={data.plantCity && data.plantCountry ? `${data.plantCity}, ${data.plantCountry}` : undefined} />
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// 10. UPCitemdb (Barcodes/Products)
// -----------------------------------------------------------------------------
const UpcItemDbSection: React.FC<{ data: AuthorityData }> = ({ data }) => (
  <div className="space-y-3">
    {data.imageLinks?.thumbnail && (
      <div className="flex justify-center">
        <ThumbnailImage 
          src={data.imageLinks.thumbnail} 
          alt={data.title || 'Product'} 
          className="w-32 h-32"
        />
      </div>
    )}
    <div className="grid grid-cols-2 gap-3">
      <DataRow label="UPC" value={data.upc} className="font-mono" />
      <DataRow label="EAN" value={data.ean} className="font-mono" />
      {data.msrp && <DataRow label="MSRP" value={`$${data.msrp.toFixed(2)}`} />}
    </div>
    {data.description && (
      <div className="pt-2">
        <p className="text-xs text-muted-foreground mb-1">Description</p>
        <p className="text-sm">{data.description}</p>
      </div>
    )}
  </div>
);

export default AuthorityReportCard;