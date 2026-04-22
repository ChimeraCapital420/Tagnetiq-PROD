// FILE: src/components/analysis/components/EbayMarketDisplay.tsx
// v3.0 — Rich Market Intelligence Display
//   NEW: Sell-through rate + velocity label (🔥 Hot / 📈 Steady / 🐌 Slow / 💤 Sitting)
//   NEW: Condition breakdown (New / Like New / Good / Acceptable)
//   NEW: Buying options split (Fixed Price / Auction / Best Offer)
//   NEW: Authenticity Guarantee flag (luxury items)
//   NEW: Free shipping percentage
//   NEW: Best platform suggestion
//   NEW: Sold median price vs active median comparison
//   KEPT: All v2.0 functionality (visual match, price bar, listings, HYDRA comparison)

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown, ChevronUp, ExternalLink,
  TrendingUp, TrendingDown, Minus, Camera,
  ShieldCheck, Zap, Clock, Package,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────

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

interface SellThroughData {
  rate:             number;
  label:            string;
  velocity:         'hot' | 'steady' | 'slow' | 'sitting' | 'unknown';
  medianDaysToSell: number;
  activeListings:   number;
  soldLast30Days:   number;
}

interface RichMarketIntel {
  conditionBreakdown:       Record<string, number>;
  buyingOptions:            { fixedPrice: number; auction: number; bestOffer: number };
  hasAuthenticityGuarantee: boolean;
  avgSellerFeedback:        number;
  freeShippingPct:          number;
  bestPlatform:             string;
}

interface EbayMarketData {
  source?:        string;
  available?:     boolean;
  totalListings?: number;
  query?:         string;
  priceAnalysis?: EbayPriceAnalysis;
  sellThrough?:   SellThroughData;
  richIntel?:     RichMarketIntel;
  sampleListings?: Array<{
    title?:     string;
    price?:     number;
    condition?: string;
    url?:       string;
    image?:     string;
  }>;
  listings?: Array<{
    title?:     string;
    price?:     number;
    condition?: string;
    url?:       string;
  }>;
  metadata?: {
    imageSearch?:        boolean;
    imageSearchBlended?: boolean;
    keywordListings?:    number;
    imageListings?:      number;
    responseTime?:       number;
    [key: string]:       any;
  };
  [key: string]: any;
}

interface EbayMarketDisplayProps {
  ebayData:       EbayMarketData;
  estimatedValue: number;
  itemName:       string;
}

// ── Velocity config ───────────────────────────────────────────────────

const VELOCITY_CONFIG = {
  hot:     { icon: '🔥', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  steady:  { icon: '📈', color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30'  },
  slow:    { icon: '🐌', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  sitting: { icon: '💤', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30'      },
  unknown: { icon: '❓', color: 'text-muted-foreground', bg: 'bg-muted/20 border-border'       },
} as const;

// ── Main component ────────────────────────────────────────────────────

const EbayMarketDisplay: React.FC<EbayMarketDisplayProps> = ({
  ebayData,
  estimatedValue,
  itemName,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(false);

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
  const ebaySearchUrl  = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(itemName)}&LH_Sold=1&LH_Complete=1`;

  const st     = ebayData.sellThrough;
  const intel  = ebayData.richIntel;
  const velCfg = st ? VELOCITY_CONFIG[st.velocity] : null;

  // Condition order for display
  const conditionOrder = ['New', 'Like New', 'Very Good', 'Good', 'Acceptable', 'Unknown'];

  return (
    <div className="w-full p-4 rounded-lg border bg-card space-y-3">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">eBay Market Data</span>

          {isVisualMatch && (
            <Badge className="text-xs gap-1 bg-primary/15 text-primary border-primary/30 font-medium" variant="outline">
              <Camera className="h-3 w-3" />Visual Match
            </Badge>
          )}
          {isBlended && (
            <Badge className="text-xs gap-1 bg-primary/10 text-primary/80 border-primary/20" variant="outline">
              <Camera className="h-3 w-3" />Visual + Keyword
            </Badge>
          )}
          {intel?.hasAuthenticityGuarantee && (
            <Badge className="text-xs gap-1 bg-blue-500/10 text-blue-400 border-blue-500/30" variant="outline">
              <ShieldCheck className="h-3 w-3" />Auth Guarantee
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {sampleSize} listing{sampleSize !== 1 ? 's' : ''}
          </Badge>
        </div>

        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Visual match explanation */}
      {hasVisualData && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {isVisualMatch
            ? 'eBay matched your photo directly — prices are for this exact item.'
            : `Photo found ${imageListings} visual matches · keyword search found ${keywordListings} more · prices blended.`}
        </p>
      )}

      {/* ── Sell-Through Rate (v3.0 NEW) ─────────────────────── */}
      {st && st.velocity !== 'unknown' && velCfg && (
        <div className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs ${velCfg.bg}`}>
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{velCfg.icon}</span>
            <div>
              <span className={`font-semibold ${velCfg.color}`}>
                {st.rate}% sell-through
              </span>
              <span className="text-muted-foreground ml-1.5">— {st.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            {st.medianDaysToSell > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ~{st.medianDaysToSell}d to sell
              </span>
            )}
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {st.soldLast30Days} sold
            </span>
          </div>
        </div>
      )}

      {/* ── Price bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 text-center">
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
      <div className="relative h-2 rounded-full bg-muted">
        {high > low && (
          <>
            <div
              className="absolute h-full rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 opacity-40"
              style={{ left: '0%', width: '100%' }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background shadow-sm"
              style={{
                left: `${Math.min(Math.max(((estimatedValue - low) / (high - low)) * 100, 2), 98)}%`,
              }}
              title={`HYDRA estimate: $${estimatedValue.toFixed(2)}`}
            />
          </>
        )}
      </div>

      {/* HYDRA vs eBay comparison */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          HYDRA estimate:{' '}
          <span className="font-medium text-foreground">${estimatedValue.toFixed(2)}</span>
        </span>
        <span className={`flex items-center gap-1 font-medium ${
          isAbove ? 'text-green-400' : isBelow ? 'text-red-400' : 'text-muted-foreground'
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

      {/* ── Rich Intel Summary (always visible, compact) ──────── */}
      {intel && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {intel.bestPlatform && (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-yellow-400" />
              Best: <span className="text-foreground font-medium ml-0.5">{intel.bestPlatform}</span>
            </span>
          )}
          {intel.freeShippingPct > 0 && (
            <span>{intel.freeShippingPct}% free shipping</span>
          )}
          {intel.avgSellerFeedback > 0 && (
            <span>{intel.avgSellerFeedback}% avg seller feedback</span>
          )}
          <button
            className="text-primary hover:underline"
            onClick={() => setIntelExpanded(!intelExpanded)}
          >
            {intelExpanded ? 'Less detail' : 'More detail'}
          </button>
        </div>
      )}

      {/* ── Rich Intel Expanded ───────────────────────────────── */}
      {intel && intelExpanded && (
        <div className="pt-2 border-t space-y-2.5">

          {/* Condition breakdown */}
          {Object.keys(intel.conditionBreakdown).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Condition breakdown</p>
              <div className="flex flex-wrap gap-1.5">
                {conditionOrder
                  .filter(c => intel.conditionBreakdown[c])
                  .map(cond => (
                    <Badge key={cond} variant="outline" className="text-xs">
                      {cond}: {intel.conditionBreakdown[cond]}
                    </Badge>
                  ))
                }
                {Object.entries(intel.conditionBreakdown)
                  .filter(([c]) => !conditionOrder.includes(c))
                  .map(([cond, count]) => (
                    <Badge key={cond} variant="outline" className="text-xs">
                      {cond}: {count}
                    </Badge>
                  ))
                }
              </div>
            </div>
          )}

          {/* Buying options */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">How sellers are listing</p>
            <div className="flex gap-3 text-xs">
              {intel.buyingOptions.fixedPrice > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{intel.buyingOptions.fixedPrice}</span> Fixed Price
                </span>
              )}
              {intel.buyingOptions.auction > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{intel.buyingOptions.auction}</span> Auction
                </span>
              )}
              {intel.buyingOptions.bestOffer > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{intel.buyingOptions.bestOffer}</span> Best Offer
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Expanded: listings + metadata ────────────────────── */}
      {expanded && (
        <div className="pt-3 border-t space-y-2">

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
                      <span className="text-muted-foreground/60">{listing.condition}</span>
                    )}
                    <span className="font-medium">${(listing.price || 0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Metadata row */}
          <div className="flex justify-between text-xs text-muted-foreground">
            {(ebayData.metadata?.responseTime || ebayData.responseTime) && (
              <span>Fetched in {ebayData.metadata?.responseTime || ebayData.responseTime}ms</span>
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