// FILE: src/components/authority/sections/BricksetSection.tsx
// Brickset (LEGO) authority data display
// Refactored from monolith v7.3
// Includes smart retirement detection

'use client';

import React from 'react';
import { ExternalLink, Package, ShoppingBag } from 'lucide-react';
import type { SectionProps } from '../types';
import { 
  DataRow, 
  ThumbnailImage, 
  formatDate,
  isLegoSetRetired,
  isLegoSetCurrentlyAvailable 
} from '../helpers';

export const BricksetSection: React.FC<SectionProps> = ({ data }) => {
  const details = (data.itemDetails || data) as typeof data;
  
  // Extract all values with fallbacks
  const thumbnail = details.imageLinks?.thumbnail;
  const setNumber = details.setNumber;
  const year = details.year;
  const theme = details.theme;
  const subtheme = details.subtheme;
  const pieces = details.pieces;
  const minifigs = details.minifigs;
  const ageRange = details.ageRange;
  const availability = details.availability;
  const rrp = details.rrp;
  const pricePerPiece = details.pricePerPiece;
  const bricksetId = details.bricksetId;
  const dateFirstAvailable = details.dateFirstAvailable;
  const dateLastAvailable = details.dateLastAvailable;
  const isRetiredFlag = details.isRetired;
  const externalUrl = details.externalUrl || data.externalUrl;

  // Smart retirement detection
  const isRetired = isLegoSetRetired(year, isRetiredFlag, dateLastAvailable, availability);
  const isCurrentlyAvailable = isLegoSetCurrentlyAvailable(year, isRetired, availability);

  return (
    <div className="space-y-3">
      {/* Set image */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={`LEGO Set ${setNumber}`}
            className="w-28 h-28 object-contain"
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
            {!dateLastAvailable && year && ` • ${year}`}
          </span>
        </div>
      )}

      {/* Currently Available Badge */}
      {isCurrentlyAvailable && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-md p-2 flex items-center justify-center gap-2">
          <ShoppingBag className="h-4 w-4 text-green-600" />
          <span className="text-green-700 dark:text-green-400 font-semibold text-sm">
            Currently Available
          </span>
        </div>
      )}

      {/* Data grid */}
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

      {/* External link */}
      {externalUrl && (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          View on Brickset <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* Footer attribution */}
      <p className="text-xs text-muted-foreground text-center">
        Data provided by Brickset
      </p>
    </div>
  );
};

export default BricksetSection;