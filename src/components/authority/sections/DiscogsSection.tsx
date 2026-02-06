// FILE: src/components/authority/sections/DiscogsSection.tsx
// Discogs (vinyl/music) authority data display
// Refactored from monolith v7.3

'use client';

import React from 'react';
import { ExternalLink, ShoppingCart } from 'lucide-react';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatArray } from '../helpers';

export const DiscogsSection: React.FC<SectionProps> = ({ data }) => {
  const details = (data.itemDetails || data) as typeof data;
  
  const thumbnail = details.imageLinks?.thumbnail;
  const title = details.title;
  const artistName = details.artistName;
  const label = details.label;
  const format = details.format;
  const country = details.country;
  const released = details.released;
  const genres = details.genres;
  const styles = details.styles;
  const lowestPrice = details.lowestPrice;
  const medianPrice = details.medianPrice;
  const highestPrice = details.highestPrice;
  const numForSale = details.numForSale;
  const discogsId = details.discogsId || details.releaseId;
  const externalUrl = details.externalUrl || data.externalUrl;

  return (
    <div className="space-y-3">
      {/* Album art */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={`${artistName} - ${title}`}
            className="w-28 h-28 object-cover rounded shadow-md"
          />
        </div>
      )}

      {/* For Sale badge */}
      {numForSale && numForSale > 0 && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-md p-2 flex items-center justify-center gap-2">
          <ShoppingCart className="h-4 w-4 text-green-600" />
          <span className="text-green-700 dark:text-green-400 font-semibold text-sm">
            {numForSale} copies for sale
          </span>
        </div>
      )}

      {/* Data grid */}
      <div className="grid grid-cols-2 gap-3">
        <DataRow label="Artist" value={artistName} />
        <DataRow label="Title" value={title} />
        <DataRow label="Label" value={label} />
        <DataRow label="Format" value={Array.isArray(format) ? format.join(', ') : format} />
        <DataRow label="Country" value={country} />
        <DataRow label="Released" value={released} />
        <DataRow label="Genres" value={formatArray(genres, 3)} />
        <DataRow label="Styles" value={formatArray(styles, 3)} />
        <DataRow label="Discogs ID" value={discogsId} />
      </div>

      {/* Marketplace prices */}
      {(lowestPrice || medianPrice || highestPrice) && (
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-xs text-muted-foreground text-center mb-1">
            Discogs Marketplace
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Low</div>
              <div className="font-medium">
                {lowestPrice ? `$${lowestPrice.toFixed(2)}` : '-'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Median</div>
              <div className="font-medium">
                {medianPrice ? `$${medianPrice.toFixed(2)}` : '-'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">High</div>
              <div className="font-medium">
                {highestPrice ? `$${highestPrice.toFixed(2)}` : '-'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Market value from formatter */}
      {data.marketValue && !lowestPrice && (
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-xs text-muted-foreground text-center mb-1">Market Value</div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Low</div>
              <div className="font-medium">{data.marketValue.low}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Mid</div>
              <div className="font-medium">{data.marketValue.mid}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">High</div>
              <div className="font-medium">{data.marketValue.high}</div>
            </div>
          </div>
        </div>
      )}

      {/* External link */}
      {externalUrl && (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          View on Discogs <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        Data provided by Discogs
      </p>
    </div>
  );
};

export default DiscogsSection;