// FILE: src/lib/hydra/pricing/sources/retailed.ts
// Retailed (sneakers/streetwear) data extraction for formatter
// Refactored from monolith v7.3

import type { FormattedAuthorityData } from '../types.js';
import { formatPriceSmart } from '../formatter.js';

/**
 * Extract Retailed specific data from authority data
 */
export function extractRetailedData(
  details: Record<string, unknown>,
  formatted: FormattedAuthorityData
): void {
  formatted.retailedId = (details.retailedId || details.id) as string;
  formatted.sku = (details.sku || details.styleId) as string;
  formatted.styleCode = (details.styleCode || details.styleId) as string;
  formatted.title = (details.name || details.title || formatted.title) as string;
  formatted.brand = details.brand as string;
  formatted.colorway = (details.colorway || details.color) as string;
  formatted.releaseDate = details.releaseDate as string;
  formatted.gender = details.gender as string;
  formatted.silhouette = (details.silhouette || details.model) as string;
  
  // Image handling
  const images = details.images as string[] | undefined;
  if (details.image) {
    formatted.imageLinks = { thumbnail: details.image as string };
  } else if (images?.[0]) {
    formatted.imageLinks = { thumbnail: images[0] };
  }
  
  formatted.externalUrl = (details.url as string) || formatted.externalUrl;
  
  // MSRP
  formatted.retailPriceMSRP = (details.retailPrice || details.msrp) as number;
  formatted.retailPrice = formatted.retailPriceMSRP;
  
  // Resale prices by platform
  const resellPrices = details.resellPrices as Record<string, number> | undefined;
  const market = details.market as Record<string, number> | undefined;
  const rp = resellPrices || market;
  
  if (rp) {
    formatted.resalePrices = {
      stockx: rp.stockX || rp.stockx,
      goat: rp.goat,
      flightClub: rp.flightClub,
      stadiumGoods: rp.stadiumGoods,
    };
    
    // Calculate market value from resale prices
    const prices = Object.values(formatted.resalePrices).filter(
      (p): p is number => typeof p === 'number' && p > 0
    );
    
    if (prices.length > 0) {
      formatted.marketValue = {
        low: formatPriceSmart(Math.min(...prices)),
        mid: formatPriceSmart(prices.reduce((a, b) => a + b, 0) / prices.length),
        high: formatPriceSmart(Math.max(...prices)),
      };
    }
  }
  
  // Prices by size
  const pricesBySize = details.pricesBySize || details.sizeChart;
  if (Array.isArray(pricesBySize)) {
    formatted.pricesBySize = pricesBySize.map((s: Record<string, unknown>) => ({
      size: s.size as string,
      price: (s.price || s.lowestAsk) as number,
    }));
  }
}

/**
 * Check if this authority data is Retailed
 */
export function isRetailedSource(
  source: string,
  details: Record<string, unknown>
): boolean {
  return source === 'retailed' || !!details.retailedId || !!details.sku;
}