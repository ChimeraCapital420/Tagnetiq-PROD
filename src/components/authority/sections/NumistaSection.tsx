// FILE: src/components/authority/sections/NumistaSection.tsx
// Numista (coins/banknotes) authority data display
// Refactored from monolith v7.3

'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage } from '../helpers';

export const NumistaSection: React.FC<SectionProps> = ({ data }) => {
  const details = (data.itemDetails || data) as typeof data;
  
  const obverseThumb = details.obverseThumb;
  const reverseThumb = details.reverseThumb;
  const issuer = details.issuer;
  const value = details.value;
  const minYear = details.minYear;
  const maxYear = details.maxYear;
  const composition = details.composition;
  const weight = details.weight;
  const size = details.size;
  const thickness = details.thickness;
  const shape = details.shape;
  const references = details.references;
  const numistaId = details.numistaId;
  const externalUrl = details.externalUrl || data.externalUrl;

  // Format year range
  const yearRange = minYear && maxYear && minYear !== maxYear
    ? `${minYear} - ${maxYear}`
    : minYear || maxYear;

  return (
    <div className="space-y-3">
      {/* Coin images - obverse and reverse */}
      {(obverseThumb || reverseThumb) && (
        <div className="flex justify-center gap-2">
          {obverseThumb && (
            <ThumbnailImage
              src={obverseThumb}
              alt="Obverse"
              className="w-16 h-16 object-contain rounded-full border"
            />
          )}
          {reverseThumb && (
            <ThumbnailImage
              src={reverseThumb}
              alt="Reverse"
              className="w-16 h-16 object-contain rounded-full border"
            />
          )}
        </div>
      )}

      {/* Data grid */}
      <div className="grid grid-cols-2 gap-3">
        <DataRow label="Issuer" value={issuer} />
        <DataRow label="Value" value={value} />
        <DataRow label="Year" value={yearRange} />
        <DataRow label="Composition" value={composition} />
        {weight && <DataRow label="Weight" value={`${weight}g`} />}
        {size && <DataRow label="Diameter" value={`${size}mm`} />}
        {thickness && <DataRow label="Thickness" value={`${thickness}mm`} />}
        <DataRow label="Shape" value={shape} />
        <DataRow label="References" value={references} />
        <DataRow label="Numista ID" value={numistaId} />
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
          View on Numista <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

export default NumistaSection;