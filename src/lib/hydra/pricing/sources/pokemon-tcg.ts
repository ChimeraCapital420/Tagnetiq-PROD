// FILE: src/lib/hydra/pricing/sources/pokemon-tcg.ts
// Pokemon TCG data extraction for formatter
// Refactored from monolith v7.3

import type { FormattedAuthorityData } from '../types.js';
import { formatPriceSmart } from '../formatter.js';

/**
 * Extract Pokemon TCG specific data from authority data
 */
export function extractPokemonTcgData(
  details: Record<string, unknown>,
  formatted: FormattedAuthorityData
): void {
  formatted.pokemonTcgId = (details.pokemonTcgId || details.id) as string;
  formatted.title = (details.name as string) || formatted.title;
  
  // Handle set data - could be nested or flat
  const set = details.set as Record<string, unknown> | undefined;
  formatted.setName = (details.setName || set?.name) as string;
  formatted.setCode = (details.setCode || set?.id) as string;
  
  formatted.rarity = details.rarity as string;
  formatted.artist = details.artist as string;
  formatted.hp = details.hp as string;
  formatted.types = details.types as string[];
  formatted.attacks = details.attacks as unknown[];
  formatted.weaknesses = details.weaknesses as unknown[];
  formatted.resistances = details.resistances as unknown[];
  formatted.cardNumber = (details.number || details.cardNumber) as string;
  formatted.imageLinks = details.images as { thumbnail?: string; smallThumbnail?: string };
  formatted.externalUrl = (details.tcgPlayerUrl as string) || formatted.externalUrl;
  
  // Market prices from tcgplayer
  const tcgplayer = details.tcgplayer as Record<string, unknown> | undefined;
  if (tcgplayer?.prices) {
    const prices = tcgplayer.prices as Record<string, Record<string, number>>;
    const priceType = prices.holofoil || prices.normal || prices.reverseHolofoil || {};
    formatted.marketValue = {
      low: formatPriceSmart(priceType.low || 0),
      mid: formatPriceSmart(priceType.mid || priceType.market || 0),
      high: formatPriceSmart(priceType.high || 0),
    };
  }
}

/**
 * Check if this authority data is Pokemon TCG
 */
export function isPokemonTcgSource(
  source: string,
  details: Record<string, unknown>
): boolean {
  return source === 'pokemon_tcg' || !!details.pokemonTcgId || !!details.id;
}