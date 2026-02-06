// FILE: src/components/authority/sections/RetailedSection.tsx
// Retailed (sneakers/streetwear) authority data display
// Refactored from monolith v7.3

'use client';

import React from 'react';
import { ExternalLink, TrendingUp } from 'lucide-react';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatDate } from '../helpers';

export const RetailedSection: React.FC<SectionProps> = ({ data }) => {
  const details = (data.itemDetails || data) as typeof data;
  
  const thumbnail = details.imageLinks?.thumbnail;
  const title = details.title;
  const brand = details.brand;
  const sku = details.sku || details.styleCode;
  const colorway = details.colorway;
  const releaseDate = details.releaseDate;
  const retailPriceMSRP = details.retailPriceMSRP || details.retailPrice;
  const gender = details.gender;
  const silhouette = details.silhouette;
  const resalePrices = details.resalePrices;
  const externalUrl = details.externalUrl || data.externalUrl;

  // Calculate average resale price
  const resaleValues = resalePrices
    ? Object.values(resalePrices).filter((p): p is number => typeof p === 'number' && p > 0)
    : [];
  const avgResale = resaleValues.length > 0
    ? resaleValues.reduce((a, b) => a + b, 0) / resaleValues.length
    : null;

  return (
    <div className="space-y-3">
      {/* Sneaker image */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={title || 'Sneaker'}
            className="w-32 h-20 object-contain"
          />
        </div>
      )}

      {/* Resale vs Retail indicator */}
      {avgResale && retailPriceMSRP && avgResale > retailPriceMSRP && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-md p-2 flex items-center justify-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <span className="text-green-700 dark:text-green-400 font-semibold text-sm">
            +{Math.round(((avgResale - retailPriceMSRP) / retailPriceMSRP) * 100)}% above retail
          </span>
        </div>
      )}

      {/* Data grid */}
      <div className="grid grid-cols-2 gap-3">
        <DataRow label="Brand" value={brand} />
        <DataRow label="Model" value={silhouette} />
        <DataRow label="SKU" value={sku} />
        <DataRow label="Colorway" value={colorway} />
        <DataRow label="Release Date" value={formatDate(releaseDate)} />
        <DataRow label="Gender" value={gender} />
        {retailPriceMSRP && (
          <DataRow label="Retail (MSRP)" value={`$${retailPriceMSRP.toFixed(0)}`} />
        )}
      </div>

      {/* Resale prices by platform */}
      {resalePrices && Object.keys(resalePrices).length > 0 && (
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-xs text-muted-foreground text-center mb-2">
            Resale Prices
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {resalePrices.stockx && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">StockX</span>
                <span className="font-medium">${resalePrices.stockx.toFixed(0)}</span>
              </div>
            )}
            {resalePrices.goat && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">GOAT</span>
                <span className="font-medium">${resalePrices.goat.toFixed(0)}</span>
              </div>
            )}
            {resalePrices.flightClub && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Flight Club</span>
                <span className="font-medium">${resalePrices.flightClub.toFixed(0)}</span>
              </div>
            )}
            {resalePrices.stadiumGoods && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stadium Goods</span>
                <span className="font-medium">${resalePrices.stadiumGoods.toFixed(0)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Market value from formatter */}
      {data.marketValue && (
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-xs text-muted-foreground text-center mb-1">Market Range</div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Low</div>
              <div className="font-medium">{data.marketValue.low}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Avg</div>
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
          View Details <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

export default RetailedSection;