// FILE: src/components/authority/sections/RetailedSection.tsx
// Retailed (Sneakers/Streetwear) authority data display
// v7.5 - Bulletproof data extraction with StockX pricing

'use client';

import React from 'react';
import { ExternalLink, Footprints, TrendingUp, Tag, Calendar, Ruler } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatPrice, formatDate } from '../helpers';
import { createFieldExtractor, getExternalUrl, getThumbnailUrl } from '../helpers';

export const RetailedSection: React.FC<SectionProps> = ({ data }) => {
  const get = createFieldExtractor(data);
  
  // Extract sneaker/streetwear-specific fields
  const thumbnail = getThumbnailUrl(data);
  const name = get<string>('name') || get<string>('title');
  const brand = get<string>('brand');
  const sku = get<string>('sku') || get<string>('styleId') || get<string>('styleCode');
  const colorway = get<string>('colorway') || get<string>('color');
  const releaseDate = get<string>('releaseDate');
  const gender = get<string>('gender');
  const silhouette = get<string>('silhouette') || get<string>('model');
  const category = get<string>('category');
  const retailPrice = get<number>('retailPrice') || get<number>('msrp') || get<number>('retailPriceMSRP');
  const description = get<string>('description');
  
  // Resale prices from multiple platforms
  const resellPrices = get<{
    stockx?: number;
    goat?: number;
    flightClub?: number;
    stadiumGoods?: number;
    ebay?: number;
  }>('resellPrices') || get<Record<string, number>>('market');
  
  // Size-specific pricing
  const pricesBySize = get<Record<string, number>>('pricesBySize');
  const sizes = pricesBySize ? Object.keys(pricesBySize) : undefined;
  
  // Volatility/trends
  const volatility = get<number>('volatility');
  const lastSale = get<number>('lastSale');
  const salesLast72Hours = get<number>('salesLast72Hours');
  
  const marketValue = data.marketValue;
  const externalUrl = getExternalUrl(data);

  const hasData = brand || sku || colorway || releaseDate;
  const hasResellPrices = resellPrices && Object.keys(resellPrices).length > 0;
  
  // Calculate profit margin if retail and resell available
  const stockxPrice = resellPrices?.stockx || lastSale;
  const profitMargin = retailPrice && stockxPrice 
    ? ((stockxPrice - retailPrice) / retailPrice * 100).toFixed(0)
    : null;
  const isProfit = profitMargin && parseInt(profitMargin) > 0;

  return (
    <div className="space-y-3">
      {/* Product Image */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={name || 'Sneaker'}
            className="w-32 h-24 object-contain rounded"
          />
        </div>
      )}

      {/* Brand & Name */}
      {(brand || name) && (
        <div className="text-center">
          {brand && <p className="text-xs text-muted-foreground uppercase tracking-wide">{brand}</p>}
          {name && data.title !== name && (
            <p className="text-sm font-semibold">{name}</p>
          )}
        </div>
      )}

      {/* SKU & Colorway */}
      {(sku || colorway) && (
        <div className="text-center">
          {sku && (
            <p className="text-xs font-mono text-primary">{sku}</p>
          )}
          {colorway && (
            <p className="text-xs text-muted-foreground">{colorway}</p>
          )}
        </div>
      )}

      {/* Status Badges */}
      <div className="flex justify-center gap-2 flex-wrap">
        {gender && (
          <Badge variant="outline" className="text-xs">
            {gender}
          </Badge>
        )}
        {category && category !== 'sneakers' && (
          <Badge variant="secondary" className="text-xs">
            {category}
          </Badge>
        )}
        {isProfit && (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            <TrendingUp className="h-3 w-3 mr-1" />
            +{profitMargin}% Resale
          </Badge>
        )}
        {profitMargin && !isProfit && (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
            {profitMargin}% Below Retail
          </Badge>
        )}
      </div>

      {/* Resale Platform Prices */}
      {(hasResellPrices || marketValue) && (
        <div className="bg-muted/50 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">
            Resale Market Prices
            {salesLast72Hours && <span className="ml-1">({salesLast72Hours} sales in 72h)</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            {resellPrices?.stockx && (
              <div className="p-2 rounded bg-background">
                <p className="text-[10px] text-muted-foreground">StockX</p>
                <p className="font-bold text-sm text-green-500">{formatPrice(resellPrices.stockx)}</p>
              </div>
            )}
            {resellPrices?.goat && (
              <div className="p-2 rounded bg-background">
                <p className="text-[10px] text-muted-foreground">GOAT</p>
                <p className="font-bold text-sm">{formatPrice(resellPrices.goat)}</p>
              </div>
            )}
            {resellPrices?.flightClub && (
              <div className="p-2 rounded bg-background">
                <p className="text-[10px] text-muted-foreground">Flight Club</p>
                <p className="font-bold text-sm">{formatPrice(resellPrices.flightClub)}</p>
              </div>
            )}
            {resellPrices?.stadiumGoods && (
              <div className="p-2 rounded bg-background">
                <p className="text-[10px] text-muted-foreground">Stadium Goods</p>
                <p className="font-bold text-sm">{formatPrice(resellPrices.stadiumGoods)}</p>
              </div>
            )}
            {/* Fallback to marketValue if no specific platforms */}
            {!hasResellPrices && marketValue && (
              <>
                <div className="p-2 rounded bg-background">
                  <p className="text-[10px] text-muted-foreground">Low</p>
                  <p className="font-bold text-sm text-red-500">{marketValue.low}</p>
                </div>
                <div className="p-2 rounded bg-background">
                  <p className="text-[10px] text-muted-foreground">High</p>
                  <p className="font-bold text-sm text-blue-500">{marketValue.high}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Retail vs Resale Comparison */}
      {retailPrice && stockxPrice && (
        <div className="flex justify-between items-center px-3 py-2 rounded bg-muted/30">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Retail</p>
            <p className="text-sm font-medium">{formatPrice(retailPrice)}</p>
          </div>
          <div className="text-xl text-muted-foreground">→</div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Resale</p>
            <p className={`text-sm font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
              {formatPrice(stockxPrice)}
            </p>
          </div>
        </div>
      )}

      {/* Available Sizes */}
      {sizes && sizes.length > 0 && (
        <div className="text-xs text-center text-muted-foreground">
          <Ruler className="h-3 w-3 inline mr-1" />
          Available: {sizes.slice(0, 8).join(', ')}{sizes.length > 8 && ` +${sizes.length - 8} more`}
        </div>
      )}

      {/* Data Grid */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <DataRow label="Brand" value={brand} />
          <DataRow label="Style" value={silhouette} />
          <DataRow label="Release" value={formatDate(releaseDate)} />
          <DataRow label="Gender" value={gender} />
          {retailPrice && <DataRow label="Retail" value={formatPrice(retailPrice)} />}
          {lastSale && <DataRow label="Last Sale" value={formatPrice(lastSale)} />}
        </div>
      )}

      {/* No Data Fallback */}
      {!hasData && !thumbnail && (
        <div className="text-center py-4">
          <Footprints className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Item verified but detailed info unavailable
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
          View on StockX <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

export default RetailedSection;