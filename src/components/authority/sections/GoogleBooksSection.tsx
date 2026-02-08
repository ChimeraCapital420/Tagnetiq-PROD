// FILE: src/components/authority/sections/GoogleBooksSection.tsx
// Google Books authority data display
// v7.5 - Bulletproof data extraction - FULL VERSION

'use client';

import React from 'react';
import { Star, ExternalLink, BookOpen, DollarSign, Hash, Tag, Globe, FileText, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatDate, formatPrice, truncateText } from '../helpers';
import { createFieldExtractor, getExternalUrl, getThumbnailUrl } from '../helpers';

const MATURITY_LABELS: Record<string, string> = {
  'NOT_MATURE': 'All Ages',
  'MATURE': 'Mature Content',
};

const PRINT_TYPE_LABELS: Record<string, string> = {
  'BOOK': 'Book',
  'MAGAZINE': 'Magazine',
};

export const GoogleBooksSection: React.FC<SectionProps> = ({ data }) => {
  const get = createFieldExtractor(data);
  
  // Image extraction
  const thumbnail = getThumbnailUrl(data);
  const imageLinks = get<{ thumbnail?: string; smallThumbnail?: string; small?: string; medium?: string; large?: string }>('imageLinks');
  const bestImage = thumbnail || imageLinks?.medium || imageLinks?.small || imageLinks?.thumbnail || imageLinks?.smallThumbnail;
  
  // Basic info
  const title = get<string>('title');
  const subtitle = get<string>('subtitle');
  const authors = get<string[]>('authors');
  const publisher = get<string>('publisher');
  const publishedDate = get<string>('publishedDate');
  const pageCount = get<number>('pageCount');
  const categories = get<string[]>('categories');
  const description = get<string>('description');
  const language = get<string>('language');
  const printType = get<string>('printType');
  const maturityRating = get<string>('maturityRating');
  const contentVersion = get<string>('contentVersion');
  
  // Identifiers - multiple extraction paths
  const isbn13 = get<string>('isbn13');
  const isbn10 = get<string>('isbn10');
  const isbn = get<string>('isbn') || isbn13 || isbn10;
  const googleBooksId = get<string>('googleBooksId') || get<string>('id');
  
  // Industry identifiers from Google Books API format
  const industryIdentifiers = get<Array<{ type: string; identifier: string }>>('industryIdentifiers');
  const isbnFromIdentifiers = industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier 
    || industryIdentifiers?.find(i => i.type === 'ISBN_10')?.identifier;
  const otherIdentifier = industryIdentifiers?.find(i => i.type === 'OTHER')?.identifier;
  const finalIsbn = isbn || isbnFromIdentifiers;
  
  // Ratings
  const averageRating = get<number>('averageRating');
  const ratingsCount = get<number>('ratingsCount');
  
  // Pricing - multiple paths for different API response structures
  const retailPrice = get<number>('retailPrice');
  const listPrice = get<{ amount?: number; currencyCode?: string }>('listPrice');
  const saleInfo = get<{ 
    listPrice?: { amount: number; currencyCode?: string }; 
    retailPrice?: { amount: number; currencyCode?: string }; 
    saleability?: string;
    buyLink?: string;
    isEbook?: boolean;
  }>('saleInfo');
  const finalPrice = retailPrice || listPrice?.amount || saleInfo?.retailPrice?.amount || saleInfo?.listPrice?.amount;
  const currency = listPrice?.currencyCode || saleInfo?.retailPrice?.currencyCode || 'USD';
  const isForSale = saleInfo?.saleability === 'FOR_SALE';
  const isEbook = saleInfo?.isEbook;
  const buyLink = saleInfo?.buyLink;
  
  // Access info
  const previewLink = get<string>('previewLink');
  const infoLink = get<string>('infoLink');
  const canonicalVolumeLink = get<string>('canonicalVolumeLink');
  const webReaderLink = get<string>('webReaderLink');
  const accessInfo = get<{ 
    viewability?: string; 
    embeddable?: boolean; 
    publicDomain?: boolean;
    textToSpeechPermission?: string;
    epub?: { isAvailable?: boolean };
    pdf?: { isAvailable?: boolean };
  }>('accessInfo');
  const isPublicDomain = accessInfo?.publicDomain;
  const viewability = accessInfo?.viewability;
  const hasEpub = accessInfo?.epub?.isAvailable;
  const hasPdf = accessInfo?.pdf?.isAvailable;
  
  // Dimensions
  const dimensions = get<{ height?: string; width?: string; thickness?: string }>('dimensions');
  
  // Series info
  const seriesInfo = get<{ bookDisplayNumber?: string; kind?: string }>('seriesInfo');
  const volumeNumber = seriesInfo?.bookDisplayNumber;
  
  const externalUrl = getExternalUrl(data) || infoLink || previewLink || canonicalVolumeLink;
  const marketValue = data.marketValue;

  const hasData = authors || publisher || finalIsbn || pageCount || description;
  const hasRating = averageRating !== undefined && averageRating > 0;
  const languageDisplay = language ? language.toUpperCase() : undefined;
  const hasFormats = hasEpub || hasPdf || isEbook;

  return (
    <div className="space-y-3">
      {/* Book Cover */}
      {bestImage && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={bestImage}
            alt={title || 'Book cover'}
            className="w-24 h-32 object-cover rounded shadow-md"
          />
        </div>
      )}

      {/* Title & Subtitle */}
      {(title || subtitle) && (
        <div className="text-center">
          {title && data.title !== title && (
            <p className="text-sm font-semibold">{title}</p>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {volumeNumber && (
            <p className="text-xs text-primary">Volume {volumeNumber}</p>
          )}
        </div>
      )}

      {/* Authors */}
      {authors && authors.length > 0 && (
        <p className="text-sm text-center text-muted-foreground">
          by {authors.join(', ')}
        </p>
      )}

      {/* Star Rating */}
      {hasRating && (
        <div className="flex items-center justify-center gap-1">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${
                  star <= Math.round(averageRating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-medium ml-1">{averageRating.toFixed(1)}</span>
          {ratingsCount && (
            <span className="text-xs text-muted-foreground">
              ({ratingsCount.toLocaleString()} ratings)
            </span>
          )}
        </div>
      )}

      {/* Status Badges */}
      <div className="flex justify-center gap-2 flex-wrap">
        {printType && (
          <Badge variant="outline" className="text-xs">
            <BookOpen className="h-3 w-3 mr-1" />
            {PRINT_TYPE_LABELS[printType] || printType}
          </Badge>
        )}
        {isPublicDomain && (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
            Public Domain
          </Badge>
        )}
        {isForSale && finalPrice && (
          <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-xs">
            <DollarSign className="h-3 w-3 mr-1" />
            {formatPrice(finalPrice)}
          </Badge>
        )}
        {isEbook && (
          <Badge variant="secondary" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            eBook
          </Badge>
        )}
        {maturityRating && maturityRating !== 'NOT_MATURE' && (
          <Badge variant="secondary" className="text-xs">
            {MATURITY_LABELS[maturityRating] || maturityRating}
          </Badge>
        )}
      </div>

      {/* Format Availability */}
      {hasFormats && (
        <div className="flex justify-center gap-2 text-xs text-muted-foreground">
          {hasEpub && <span>EPUB Available</span>}
          {hasPdf && <span>PDF Available</span>}
        </div>
      )}

      {/* Categories */}
      {categories && categories.length > 0 && (
        <div className="flex justify-center gap-1 flex-wrap">
          {categories.slice(0, 3).map((category, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              <Tag className="h-3 w-3 mr-1" />
              {category}
            </Badge>
          ))}
          {categories.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{categories.length - 3} more
            </Badge>
          )}
        </div>
      )}

      {/* Market Value */}
      {marketValue && (
        <div className="bg-muted/50 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">Market Value</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Low</div>
              <div className="font-semibold text-red-500">{marketValue.low}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Mid</div>
              <div className="font-semibold text-green-500">{marketValue.mid}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">High</div>
              <div className="font-semibold text-blue-500">{marketValue.high}</div>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground text-center">
          {truncateText(description.replace(/<[^>]*>/g, ''), 200)}
        </p>
      )}

      {/* Data Grid */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <DataRow label="Author(s)" value={authors?.slice(0, 2).join(', ')} />
          <DataRow label="Publisher" value={publisher} />
          <DataRow label="Published" value={formatDate(publishedDate)} />
          <DataRow label="Pages" value={pageCount?.toLocaleString()} />
          <DataRow label="ISBN" value={finalIsbn} />
          <DataRow label="Language" value={languageDisplay} />
          {finalPrice && <DataRow label="Retail Price" value={formatPrice(finalPrice)} />}
          {dimensions?.height && (
            <DataRow 
              label="Dimensions" 
              value={`${dimensions.height} × ${dimensions.width}${dimensions.thickness ? ` × ${dimensions.thickness}` : ''}`} 
            />
          )}
        </div>
      )}

      {/* Google Books ID */}
      {googleBooksId && (
        <p className="text-xs text-center text-muted-foreground font-mono">
          <Hash className="h-3 w-3 inline mr-1" />
          {googleBooksId}
        </p>
      )}

      {/* No Data Fallback */}
      {!hasData && !bestImage && (
        <div className="text-center py-4">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Book verified but detailed info unavailable
          </p>
        </div>
      )}

      {/* External Link - SINGLE LINE */}
      {externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2">View on Google Books <ExternalLink className="h-3 w-3" /></a>}
    </div>
  );
};

export default GoogleBooksSection;