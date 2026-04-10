// FILE: src/components/analysis/components/EbayMarketDisplay.tsx
// Displays eBay market data from HYDRA pipeline.
// Shows median price, price range, sample size, and link to listings.
//
// v2.0 — Visual Match badge
//   When HYDRA used eBay image search (sent the actual scan photo to eBay),
//   show "📸 Visual Match" so the user knows the prices are for THEIR exact
//   item — not just keyword-matched listings.
//   Reads: ebayData.metadata.imageSearch (pure visual) or
//          ebayData.metadata.imageSearchBlended (visual + keyword merged)

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown, ChevronUp, ExternalLink,
  TrendingUp, TrendingDown, Minus, Camera,
} from 'lucide-react';

interface EbayPriceAnalysis {
  median?: number;
  low?: number;
  high?: number;
  average?: number;
  lowest?: number;
  highest?: number;
  sampleSize?: number;
  currency?: string;
}

interface EbayMarketData {
  source?: string;
  available?: boolean;
  totalListings?: number;
  query?: string;
  responseTime?: number;
  priceAnalysis?: EbayPriceAnalysis;
  sampleListings?: Array<{
    title?: string;
    price?: number;
    condition?: string;
    url?: string;
    image?: string;
  }>;
  listings?: Array<{
    title?: string;
    price?: number;
    condition?: string;
    url?: string;
    image?: string;
  }>;
  metadata?: {
    imageSearch?: boolean;
    imageSearchBlended?: boolean;
    keywordListings?: number;
    imageListings?: number;
    responseTime?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

interface EbayMarketDisplayProps {
  ebayData: EbayMarketData;
  estimatedValue: number;
  itemName: string;
}

const EbayMarketDisplay: React.FC<EbayMarketDisplayProps> = ({
  ebayData,
  estimatedValue,
  itemName,
}) => {
  const [expanded, setExpanded] = useState(false);

  const pa = ebayData.priceAnalysis;
  if (!pa || (!pa.median && !pa.average && !pa.low && !pa.lowest)) return null;

  const median     = pa.median   || pa.average  || 0;
  const low        = pa.low      || pa.lowest   || median;
  const high       = pa.high     || pa.highest  || median;
  const sampleSize = pa.sampleSize || ebayData.totalListings || 0;

  const isVisualMatch = !!(ebayData.metadata?.imageSearch);
  const isBlended     = !!(ebayData.metadata?.imageSearchBlended);
  const hasVisualData = isVisualMatch || isBlended;

  const imageListings   = ebayData.metadata?.imageListings   || 0;
  const keywordListings = ebayData.metadata?.keywordListings || 0;

  const diff        = estimatedValue - median;
  const diffPercent = median > 0 ? ((diff / median) * 100) : 0;
  const isAbove     = diffPercent > 5;
  const isBelow     = diffPercent < -5;

  const listingsToShow = ebayData.sampleListings || ebayData.listings || [];

  const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(itemName)}&LH_Sold=1&LH_Complete=1`;

  return (
    <div className="w-full p-4 rounded-lg border bg-card">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">eBay Market Data</span>

          {isVisualMatch && (
            <Badge
              className="text-xs gap-1 bg-primary/15 text-primary border-primary/30 font-medium"
              variant="outline"
            >
              <Camera className="h-3 w-3" />
              Visual Match
            </Badge>
          )}
          {isBlended && (
            <Badge
              className="text-xs gap-1 bg-primary/10 text-primary/80 border-primary/20"
              variant="outline"
            >
              <Camera className="h-3 w-3" />
              Visual + Keyword
            </Badge>
          )}

          <Badge variant="outline" className="text-xs">
            {sampleSize} listing{sampleSize !== 1 ? 's' : ''}
          </Badge>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Visual match explanation */}
      {hasVisualData && (
        <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
          {isVisualMatch
            ? 'eBay matched your photo directly — prices are for this exact item.'
            : `Photo found ${imageListings} visual matches · keyword search found ${keywordListings} more · prices blended.`}
        </p>
      )}

      {/* Price bar */}
      <div className="grid grid-cols-3 gap-3 text-center mb-3">
        <div>
          <p className="text-xs text-muted-foreground">Low</p>
          <p className="text-sm font-semibold text-red-400">${low.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Median</p>
          <p className="text-lg font-bold">${median.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">High</p>
          <p className="text-sm font-semibold text-green-400">${high.toFixed(2)}</p>
        </div>
      </div>

      {/* Visual price range bar */}
      <div className="relative h-2 rounded-full bg-muted mb-3">
        {high > low && (
          <>
            <div
              className="absolute h-full rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 opacity-40"
              style={{ left: '0%', width: '100%' }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background shadow-sm"
              style={{
                left: `${Math.min(Math.max(
                  ((estimatedValue - low) / (high - low)) * 100,
                  2), 98)}%`,
              }}
              title={`HYDRA estimate: $${estimatedValue.toFixed(2)}`}
            />
          </>
        )}
      </div>

      {/* HYDRA vs eBay comparison */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>
          HYDRA estimate:{' '}
          <span className="font-medium text-foreground">
            ${estimatedValue.toFixed(2)}
          </span>
        </span>
        <span className={`flex items-center gap-1 font-medium ${
          isAbove
            ? 'text-green-400'
            : isBelow
            ? 'text-red-400'
            : 'text-muted-foreground'
        }`}>
          {isAbove ? (
            <><TrendingUp className="h-3 w-3" />+{diffPercent.toFixed(0)}% above median</>
          ) : isBelow ? (
            <><TrendingDown className="h-3 w-3" />{diffPercent.toFixed(0)}% below median</>
          ) : (
            <><Minus className="h-3 w-3" />At median</>
          )}
        </span>
      </div>

      {/* Expanded: listings preview + link */}
      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2">

          {listingsToShow.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {isVisualMatch ? 'Visual Matches' : 'Sample Listings'}
              </p>
              {listingsToShow.slice(0, 5).map((listing, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground truncate max-w-[70%]">
                    {listing.url ? (
                      <a
                        href={listing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary hover:underline transition-colors"
                      >
                        {listing.title || `Listing ${i + 1}`}
                      </a>
                    ) : (
                      listing.title || `Listing ${i + 1}`
                    )}
                  </span>
                  <div className="flex items-center gap-1.5 flex-none">
                    {listing.condition && (
                      <span className="text-muted-foreground/60">
                        {listing.condition}
                      </span>
                    )}
                    <span className="font-medium">
                      ${(listing.price || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Metadata row */}
          <div className="flex justify-between text-xs text-muted-foreground">
            {(ebayData.metadata?.responseTime || ebayData.responseTime) && (
              <span>
                Fetched in {ebayData.metadata?.responseTime || ebayData.responseTime}ms
              </span>
            )}
            {pa.average && pa.average !== median && (
              <span>Avg: ${pa.average.toFixed(2)}</span>
            )}
          </div>

          {/* eBay link */}
          <a
            href={ebaySearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
          >
            <ExternalLink className="h-3 w-3" />
            View sold listings on eBay
          </a>
        </div>
      )}
    </div>
  );
};

export default EbayMarketDisplay;