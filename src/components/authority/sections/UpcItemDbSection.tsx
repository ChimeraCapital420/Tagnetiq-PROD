// FILE: src/components/authority/sections/UpcItemDbSection.tsx
// UPCitemdb (barcode lookups) authority data display
// Refactored from monolith v7.3

'use client';

import React from 'react';
import { ExternalLink, Barcode } from 'lucide-react';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage } from '../helpers';

export const UpcItemDbSection: React.FC<SectionProps> = ({ data }) => {
  const details = (data.itemDetails || data) as typeof data;
  
  const thumbnail = details.imageLinks?.thumbnail;
  const title = details.title;
  const upc = details.upc;
  const ean = details.ean;
  const brand = details.brand;
  const description = details.description;
  const msrp = details.msrp || details.retailPrice;
  const categories = details.categories;
  const externalUrl = details.externalUrl || data.externalUrl;

  return (
    <div className="space-y-3">
      {/* Product image */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={title || 'Product'}
            className="w-24 h-24 object-contain"
          />
        </div>
      )}

      {/* Barcode display */}
      {(upc || ean) && (
        <div className="bg-muted/50 rounded-md p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
            <Barcode className="h-3 w-3" />
            Barcode
          </div>
          {upc && <div className="font-mono text-sm">UPC: {upc}</div>}
          {ean && ean !== upc && <div className="font-mono text-sm">EAN: {ean}</div>}
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground text-center line-clamp-3">
          {description}
        </p>
      )}

      {/* Data grid */}
      <div className="grid grid-cols-2 gap-3">
        <DataRow label="Brand" value={brand} />
        <DataRow label="Title" value={title} />
        {msrp && <DataRow label="MSRP" value={`$${msrp.toFixed(2)}`} />}
        <DataRow label="Categories" value={Array.isArray(categories) ? categories.join(', ') : categories} />
      </div>

      {/* Market value if available */}
      {data.marketValue && (
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
          View Product Details <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        Data provided by UPCitemdb
      </p>
    </div>
  );
};

export default UpcItemDbSection;