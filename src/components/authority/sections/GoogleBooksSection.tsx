// FILE: src/components/authority/sections/GoogleBooksSection.tsx
// Google Books authority data display - v7.5

'use client';

import React from 'react';
import { Star, ExternalLink, BookOpen, DollarSign, Hash, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatDate, formatPrice, truncateText } from '../helpers';
import { createFieldExtractor, getExternalUrl, getThumbnailUrl } from '../helpers';

const MATURITY_LABELS: Record<string, string> = {
  'NOT_MATURE': 'All Ages',
  'MATURE': 'Mature Content',
};

export const GoogleBooksSection: React.FC<SectionProps> = ({ data }) => {
  const get = createFieldExtractor(data);
  
  const thumbnail = getThumbnailUrl(data);
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
  
  const isbn13 = get<string>('isbn13');
  const isbn10 = get<string>('isbn10');
  const isbn = get<string>('isbn') || isbn13 || isbn10;
  const googleBooksId = get<string>('googleBooksId') || get<string>('id');
  
  const industryIdentifiers = get<Array<{ type: string; identifier: string }>>('industryIdentifiers');
  const isbnFromIdentifiers = industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier 
    || industryIdentifiers?.find(i => i.type === 'ISBN_10')?.identifier;
  const finalIsbn = isbn || isbnFromIdentifiers;
  
  const averageRating = get<number>('averageRating');
  const ratingsCount = get<number>('ratingsCount');
  
  const retailPrice = get<number>('retailPrice');
  const listPrice = get<{ amount?: number; currencyCode?: string }>('listPrice');
  const saleInfo = get<{ listPrice?: { amount: number }; retailPrice?: { amount: number }; saleability?: string }>('saleInfo');
  const finalPrice = retailPrice || listPrice?.amount || saleInfo?.retailPrice?.amount || saleInfo?.listPrice?.amount;
  const isForSale = saleInfo?.saleability === 'FOR_SALE';
  
  const previewLink = get<string>('previewLink');
  const infoLink = get<string>('infoLink');
  const canonicalVolumeLink = get<string>('canonicalVolumeLink');
  const accessInfo = get<{ viewability?: string; embeddable?: boolean; publicDomain?: boolean }>('accessInfo');
  const isPublicDomain = accessInfo?.publicDomain;
  
  const dimensions = get<{ height?: string; width?: string; thickness?: string }>('dimensions');
  
  const externalUrl = getExternalUrl(data) || infoLink || previewLink || canonicalVolumeLink;
  const marketValue = data.marketValue;

  const hasData = authors || publisher || finalIsbn || pageCount || description;
  const hasRating = averageRating !== undefined && averageRating > 0;
  const languageDisplay = language ? language.toUpperCase() : undefined;

  const linkElement = externalUrl ? (
    <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2">
      View on Google Books <ExternalLink className="h-3 w-3" />
    </a>
  ) : null;

  return (
    <div className="space-y-3">
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage src={thumbnail} alt={title || 'Book cover'} className="w-24 h-32 object-cover rounded shadow-md" />
        </div>
      )}

      {(title || subtitle) && (
        <div className="text-center">
          {title && data.title !== title && <p className="text-sm font-semibold">{title}</p>}
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {authors && authors.length > 0 && (
        <p className="text-sm text-center text-muted-foreground">by {authors.join(', ')}</p>
      )}

      {hasRating && (
        <div className="flex items-center justify-center gap-1">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className={`h-4 w-4 ${star <= Math.round(averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
            ))}
          </div>
          <span className="text-sm font-medium ml-1">{averageRating.toFixed(1)}</span>
          {ratingsCount && <span className="text-xs text-muted-foreground">({ratingsCount.toLocaleString()} ratings)</span>}
        </div>
      )}

      <div className="flex justify-center gap-2 flex-wrap">
        {printType && <Badge variant="outline" className="text-xs"><BookOpen className="h-3 w-3 mr-1" />{printType}</Badge>}
        {isPublicDomain && <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">Public Domain</Badge>}
        {isForSale && finalPrice && <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-xs"><DollarSign className="h-3 w-3 mr-1" />{formatPrice(finalPrice)}</Badge>}
        {maturityRating && maturityRating !== 'NOT_MATURE' && <Badge variant="secondary" className="text-xs">{MATURITY_LABELS[maturityRating] || maturityRating}</Badge>}
      </div>

      {categories && categories.length > 0 && (
        <div className="flex justify-center gap-1 flex-wrap">
          {categories.slice(0, 3).map((category, i) => <Badge key={i} variant="secondary" className="text-xs"><Tag className="h-3 w-3 mr-1" />{category}</Badge>)}
          {categories.length > 3 && <Badge variant="outline" className="text-xs">+{categories.length - 3} more</Badge>}
        </div>
      )}

      {marketValue && (
        <div className="bg-muted/50 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">Market Value</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-xs text-muted-foreground">Low</div><div className="font-semibold text-red-500">{marketValue.low}</div></div>
            <div><div className="text-xs text-muted-foreground">Mid</div><div className="font-semibold text-green-500">{marketValue.mid}</div></div>
            <div><div className="text-xs text-muted-foreground">High</div><div className="font-semibold text-blue-500">{marketValue.high}</div></div>
          </div>
        </div>
      )}

      {description && <p className="text-xs text-muted-foreground text-center">{truncateText(description.replace(/<[^>]*>/g, ''), 200)}</p>}

      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <DataRow label="Author(s)" value={authors?.slice(0, 2).join(', ')} />
          <DataRow label="Publisher" value={publisher} />
          <DataRow label="Published" value={formatDate(publishedDate)} />
          <DataRow label="Pages" value={pageCount?.toLocaleString()} />
          <DataRow label="ISBN" value={finalIsbn} />
          <DataRow label="Language" value={languageDisplay} />
          {finalPrice && <DataRow label="Retail Price" value={formatPrice(finalPrice)} />}
          {dimensions?.height && <DataRow label="Dimensions" value={`${dimensions.height} × ${dimensions.width}`} />}
        </div>
      )}

      {googleBooksId && <p className="text-xs text-center text-muted-foreground font-mono"><Hash className="h-3 w-3 inline mr-1" />{googleBooksId}</p>}

      {!hasData && !thumbnail && (
        <div className="text-center py-4">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Book verified but detailed info unavailable</p>
        </div>
      )}

      {linkElement}
    </div>
  );
};

export default GoogleBooksSection;