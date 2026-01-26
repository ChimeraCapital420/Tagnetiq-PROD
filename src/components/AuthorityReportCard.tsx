// FILE: src/components/AuthorityReportCard.tsx
// HYDRA v6.0 - Universal Authority Report Card
// Dynamically renders authority data from ALL sources

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
  Package
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
  
  // Fallback
  itemDetails?: Record<string, unknown>;
}

interface AuthorityReportCardProps {
  authorityData: AuthorityData;
  className?: string;
}

// Source icon mapping
const SOURCE_ICONS: Record<string, React.ReactNode> = {
  google_books: <BookOpen className="h-5 w-5" />,
  numista: <Coins className="h-5 w-5" />,
  pokemon_tcg: <Sparkles className="h-5 w-5" />,
  brickset: <Blocks className="h-5 w-5" />,
  discogs: <Music className="h-5 w-5" />,
  retailed: <ShoppingBag className="h-5 w-5" />,
  psa: <Award className="h-5 w-5" />,
  nhtsa: <Car className="h-5 w-5" />,
  upcitemdb: <Package className="h-5 w-5" />,
  ebay: <ShoppingBag className="h-5 w-5" />,
};

// Source display names
const SOURCE_NAMES: Record<string, string> = {
  google_books: 'Google Books',
  numista: 'Numista',
  pokemon_tcg: 'Pokemon TCG',
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
  const source = authorityData.source;
  const icon = SOURCE_ICONS[source] || <Shield className="h-5 w-5" />;
  const sourceName = SOURCE_NAMES[source] || source;
  
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
        
        {/* External Link - THIS IS THE FIXED SECTION */}
        {authorityData.externalUrl && (
          <div className="pt-2 text-center">
            <a href={authorityData.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
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
// SOURCE-SPECIFIC SECTIONS
// =============================================================================

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

const BricksetSection: React.FC<{ data: AuthorityData }> = ({ data }) => (
  <div className="space-y-3">
    {data.imageLinks?.thumbnail && (
      <div className="flex justify-center">
        <ThumbnailImage 
          src={data.imageLinks.thumbnail} 
          alt={data.title || 'LEGO set'} 
          className="w-40 h-32"
        />
      </div>
    )}
    <div className="grid grid-cols-2 gap-3">
      <DataRow label="Set Number" value={data.setNumber} />
      <DataRow label="Year" value={data.year} />
      <DataRow label="Theme" value={data.theme} />
      <DataRow label="Subtheme" value={data.subtheme} />
      <DataRow label="Pieces" value={data.pieces?.toLocaleString()} />
      <DataRow label="Minifigures" value={data.minifigs} />
      <DataRow label="Age Range" value={data.ageRange} />
      <DataRow label="Availability" value={data.availability} />
      {data.rrp && <DataRow label="RRP" value={`$${data.rrp.toFixed(2)}`} />}
      {data.pricePerPiece && <DataRow label="Price/Piece" value={`$${data.pricePerPiece.toFixed(3)}`} />}
    </div>
  </div>
);

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