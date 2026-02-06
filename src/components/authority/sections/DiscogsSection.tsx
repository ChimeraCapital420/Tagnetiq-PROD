// FILE: src/components/authority/sections/DiscogsSection.tsx
// Discogs (Vinyl Records) authority data display
// v7.5 - Bulletproof data extraction with defensive array handling

'use client';

import React from 'react';
import { ExternalLink, Disc3, Music, Calendar, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatPrice } from '../helpers';
import { createFieldExtractor, getExternalUrl, getThumbnailUrl } from '../helpers';

// Helper to safely get first array element or string
function safeFirst(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'string') return first;
    if (typeof first === 'object' && first !== null) {
      return (first as any).name || (first as any).title || String(first);
    }
  }
  if (typeof value === 'string') return value;
  return undefined;
}

// Helper to safely join array or return string
function safeJoin(value: unknown, separator = ', '): string | undefined {
  if (Array.isArray(value)) {
    return value.map(v => {
      if (typeof v === 'string') return v;
      if (typeof v === 'object' && v !== null) return (v as any).name || String(v);
      return String(v);
    }).join(separator);
  }
  if (typeof value === 'string') return value;
  return undefined;
}

export const DiscogsSection: React.FC<SectionProps> = ({ data }) => {
  const get = createFieldExtractor(data);
  
  // Extract vinyl-specific fields with defensive handling
  const thumbnail = getThumbnailUrl(data) || get<string>('thumb') || get<string>('cover_image');
  const title = get<string>('title');
  const artistName = get<string>('artistName') || safeFirst(get<unknown>('artists'));
  const year = get<number>('year') || get<string>('released');
  const label = safeFirst(get<unknown>('labels')) || safeFirst(get<unknown>('label'));
  const catno = get<string>('catno');
  const format = safeFirst(get<unknown>('formats')) || safeFirst(get<unknown>('format'));
  const formatDescriptions = get<string[]>('format_descriptions');
  const country = get<string>('country');
  const genres = get<string[]>('genres') || get<string[]>('genre');
  const styles = get<string[]>('styles') || get<string[]>('style');
  const catalogNumber = get<string>('catalogNumber') || data.catalogNumber || catno;
  const tracklist = get<unknown[]>('tracklist');
  const notes = get<string>('notes');
  
  // Pricing from Discogs marketplace
  const lowestPrice = get<number>('lowestPrice') || get<number>('lowest_price');
  const medianPrice = get<number>('medianPrice');
  const highestPrice = get<number>('highestPrice');
  const numForSale = get<number>('numForSale') || get<number>('num_for_sale');
  const numHave = get<number>('community')?.have || get<number>('have');
  const numWant = get<number>('community')?.want || get<number>('want');
  
  const marketValue = data.marketValue;
  const externalUrl = getExternalUrl(data);

  const hasData = artistName || label || format || year;
  const hasPricing = lowestPrice || medianPrice || highestPrice || marketValue;
  const hasCommunity = numHave || numWant;

  return (
    <div className="space-y-3">
      {/* Album Cover */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={title || 'Album cover'}
            className="w-24 h-24 object-cover rounded shadow-md"
          />
        </div>
      )}

      {/* Title & Artist */}
      {(title || artistName) && (
        <div className="text-center">
          {artistName && <p className="text-sm font-semibold">{artistName}</p>}
          {title && data.title !== title && (
            <p className="text-sm text-muted-foreground">{title}</p>
          )}
        </div>
      )}

      {/* Format & Year */}
      {(format || year) && (
        <div className="flex justify-center items-center gap-2 text-xs text-muted-foreground">
          {format && <span className="flex items-center gap-1"><Disc3 className="h-3 w-3" />{format}</span>}
          {year && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{year}</span>}
          {country && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{country}</span>}
        </div>
      )}

      {/* Genre/Style Badges */}
      {(genres || styles) && (
        <div className="flex justify-center gap-1 flex-wrap">
          {genres?.slice(0, 2).map((genre, i) => (
            <Badge key={`g-${i}`} variant="secondary" className="text-xs">
              {genre}
            </Badge>
          ))}
          {styles?.slice(0, 3).map((style, i) => (
            <Badge key={`s-${i}`} variant="outline" className="text-xs">
              {style}
            </Badge>
          ))}
        </div>
      )}

      {/* Format Descriptions */}
      {formatDescriptions && formatDescriptions.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          {formatDescriptions.join(', ')}
        </p>
      )}

      {/* Marketplace Pricing */}
      {hasPricing && (
        <div className="bg-muted/50 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">
            Discogs Marketplace
            {numForSale && <span className="ml-1">({numForSale} for sale)</span>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Low</div>
              <div className="font-semibold text-red-500">
                {marketValue?.low || (lowestPrice ? formatPrice(lowestPrice) : '-')}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Median</div>
              <div className="font-semibold text-green-500">
                {marketValue?.mid || (medianPrice ? formatPrice(medianPrice) : '-')}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">High</div>
              <div className="font-semibold text-blue-500">
                {marketValue?.high || (highestPrice ? formatPrice(highestPrice) : '-')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Community Stats */}
      {hasCommunity && (
        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          {numHave && <span>{numHave.toLocaleString()} have</span>}
          {numWant && <span>{numWant.toLocaleString()} want</span>}
        </div>
      )}

      {/* Data Grid */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <DataRow label="Artist" value={artistName} />
          <DataRow label="Label" value={typeof label === 'object' ? (label as any)?.name : label} />
          <DataRow label="Year" value={year} />
          <DataRow label="Format" value={typeof format === 'object' ? (format as any)?.name : format} />
          <DataRow label="Country" value={country} />
          {catalogNumber && <DataRow label="Cat #" value={catalogNumber} />}
        </div>
      )}

      {/* Tracklist Preview */}
      {tracklist && tracklist.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1 flex items-center gap-1">
            <Music className="h-3 w-3" /> Tracklist ({tracklist.length} tracks)
          </p>
          <p className="line-clamp-2">
            {tracklist.slice(0, 4).map((t: any) => t.title || t).join(' • ')}
            {tracklist.length > 4 && '...'}
          </p>
        </div>
      )}

      {/* No Data Fallback */}
      {!hasData && !thumbnail && (
        <div className="text-center py-4">
          <Disc3 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Record verified but detailed info unavailable
          </p>
        </div>
      )}

      {/* External Link */}
      {externalUrl && (
        
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2"
        >
          View on Discogs <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

export default DiscogsSection;