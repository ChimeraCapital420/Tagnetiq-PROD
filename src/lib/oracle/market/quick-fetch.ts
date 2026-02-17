// FILE: src/lib/oracle/market/quick-fetch.ts
// Market-Aware Conversation — HYDRA fetchers connected to chat
//
// ═══════════════════════════════════════════════════════════════════════
// LIBERATION 7 — THE ORACLE CHECKS PRICES MID-CONVERSATION
// ═══════════════════════════════════════════════════════════════════════
//
// When the Oracle is discussing an item the user has scanned or vaulted,
// it should be able to pull live market data mid-conversation. Not a full
// HYDRA analysis — a lightweight fetch.
//
// "Let me check what eBay has right now..." and actually check.
//
// Imports from the existing HYDRA fetcher infrastructure — no duplication.
// The eBay fetcher uses OAuth2 client credentials flow (Browse API v1).
// Adds a 3-second hard timeout so chat responsiveness isn't killed.
//
// Pro/Elite only. Free tier gets honest: "I can't pull live prices
// right now, but here's what I know from your last scan..."
//
// Client-side: cache results in localStorage for 30 minutes.
// ═══════════════════════════════════════════════════════════════════════

import { fetchEbayData } from '../../hydra/fetchers/ebay.js';

// =============================================================================
// TYPES
// =============================================================================

export interface QuickMarketResult {
  /** Which sources returned data */
  sources: string[];
  /** Number of active listings found */
  activeListings: number;
  /** Price range across all sources */
  priceRange: {
    low: number;
    high: number;
    average: number;
    median: number;
  } | null;
  /** Sample listings for context */
  sampleListings: Array<{
    title: string;
    price: number;
    condition: string;
    url: string;
    source: string;
  }>;
  /** Suggested price points */
  suggestedPrices: {
    goodDeal: number;
    fairMarket: number;
    sellPrice: number;
  } | null;
  /** When this data was fetched */
  fetchedAt: string;
  /** How long the fetch took */
  fetchTimeMs: number;
  /** Whether the fetch timed out */
  timedOut: boolean;
}

export interface QuickFetchOptions {
  /** Hard timeout in ms (default: 3000) */
  timeoutMs?: number;
  /** Client-cached data (skip fetch if fresh) */
  cachedData?: {
    result: QuickMarketResult;
    cachedAt: string;
  };
}

// =============================================================================
// CATEGORY → FETCHER MAPPING
// =============================================================================
// Maps item categories to which HYDRA fetchers to use for quick lookups.
// eBay is always included as universal fallback.
// As more HYDRA fetchers get quick-search variants, add them here.
//
// The fetcher interface matches hydra/fetchers/ebay.ts:
//   (itemName: string, category?: string) => Promise<MarketDataSource>

interface FetcherSpec {
  name: string;
  fetch: (itemName: string, category?: string) => Promise<any>;
}

function selectFetchersForCategory(category?: string): FetcherSpec[] {
  const fetchers: FetcherSpec[] = [];

  // Always include eBay — universal market
  fetchers.push({
    name: 'ebay',
    fetch: fetchEbayData,
  });

  // ── Future category-specific fetchers ─────────────────
  // When a HYDRA fetcher is ready for quick-search, add it here.
  // The Oracle will automatically get category-specific market intelligence.
  //
  // if (category === 'coins' || category === 'banknotes') {
  //   fetchers.push({ name: 'numista', fetch: fetchNumistaData });
  // }
  // if (category === 'vinyl' || category === 'records') {
  //   fetchers.push({ name: 'discogs', fetch: fetchDiscogsData });
  // }
  // if (category === 'lego') {
  //   fetchers.push({ name: 'brickset', fetch: fetchBricksetData });
  // }
  // if (category === 'pokemon_cards' || category === 'trading_cards') {
  //   fetchers.push({ name: 'pokemontcg', fetch: fetchPokemonTcgData });
  // }

  return fetchers;
}

// =============================================================================
// QUICK MARKET FETCH
// =============================================================================

/**
 * Lightweight market data fetch for mid-conversation use.
 * Hits 1-2 HYDRA fetchers with a hard 3-second timeout.
 *
 * Returns null if:
 *  - All fetchers timed out
 *  - No listings found
 *  - Client cache is still fresh
 *
 * Pro/Elite only — checked by chat.ts before calling.
 */
export async function quickMarketFetch(
  itemName: string,
  category?: string,
  options: QuickFetchOptions = {},
): Promise<QuickMarketResult | null> {
  const timeoutMs = options.timeoutMs || 3000;

  // If client sent fresh cached data, skip the fetch entirely
  if (options.cachedData) {
    const cachedAge = Date.now() - new Date(options.cachedData.cachedAt).getTime();
    if (cachedAge < 30 * 60 * 1000) { // 30 minutes
      console.log('[QuickFetch] Using client-cached data (age: ' +
        Math.floor(cachedAge / 1000) + 's)');
      return options.cachedData.result;
    }
  }

  const startTime = Date.now();
  const fetchers = selectFetchersForCategory(category);

  // Fire all fetchers in parallel with hard timeout
  const fetchPromises = fetchers.map(f =>
    f.fetch(itemName, category)
      .then((result: any) => ({ name: f.name, result }))
      .catch((err: any) => {
        console.error(`[QuickFetch] ${f.name} error:`, err?.message || err);
        return null;
      })
  );

  const raceResult = await Promise.race([
    Promise.allSettled(fetchPromises),
    new Promise<'timeout'>(resolve =>
      setTimeout(() => resolve('timeout'), timeoutMs)
    ),
  ]);

  if (raceResult === 'timeout') {
    console.log(`[QuickFetch] Timed out after ${timeoutMs}ms`);

    // Try to salvage any results that completed before timeout
    const partial = await Promise.race([
      Promise.allSettled(fetchPromises),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 500)),
    ]);

    if (!partial) return null;
    return compileResults(partial, startTime, true);
  }

  return compileResults(
    raceResult as PromiseSettledResult<{ name: string; result: any } | null>[],
    startTime,
    false,
  );
}

// =============================================================================
// COMPILE RESULTS FROM MULTIPLE FETCHERS
// =============================================================================

function compileResults(
  settled: PromiseSettledResult<{ name: string; result: any } | null>[],
  startTime: number,
  timedOut: boolean,
): QuickMarketResult | null {
  // Filter to successful fetchers that returned available data
  const successful = settled
    .filter((s): s is PromiseFulfilledResult<{ name: string; result: any }> =>
      s.status === 'fulfilled' && s.value !== null && s.value.result?.available === true
    )
    .map(s => s.value);

  if (successful.length === 0) return null;

  // Merge data across sources
  const allListings: QuickMarketResult['sampleListings'] = [];
  let totalListings = 0;
  let mergedPriceRange: QuickMarketResult['priceRange'] = null;
  let mergedSuggested: QuickMarketResult['suggestedPrices'] = null;

  for (const { name, result } of successful) {
    totalListings += result.totalListings || 0;

    // Use the fetcher's own price analysis if available
    // eBay fetcher returns: { lowest, highest, average, median }
    if (result.priceAnalysis) {
      const pa = result.priceAnalysis;
      if (!mergedPriceRange) {
        mergedPriceRange = {
          low: pa.lowest,
          high: pa.highest,
          average: pa.average,
          median: pa.median,
        };
      } else {
        // Merge: expand range, average the midpoints
        mergedPriceRange.low = Math.min(mergedPriceRange.low, pa.lowest);
        mergedPriceRange.high = Math.max(mergedPriceRange.high, pa.highest);
        mergedPriceRange.average = parseFloat(
          ((mergedPriceRange.average + pa.average) / 2).toFixed(2)
        );
        mergedPriceRange.median = parseFloat(
          ((mergedPriceRange.median + pa.median) / 2).toFixed(2)
        );
      }
    }

    // Use the fetcher's suggested prices
    // eBay fetcher returns: { goodDeal, fairMarket, sellPrice }
    if (result.suggestedPrices && !mergedSuggested) {
      mergedSuggested = {
        goodDeal: result.suggestedPrices.goodDeal,
        fairMarket: result.suggestedPrices.fairMarket,
        sellPrice: result.suggestedPrices.sellPrice,
      };
    }

    // Collect sample listings
    // eBay fetcher returns: [{ title, price, condition, url }]
    if (Array.isArray(result.sampleListings)) {
      for (const listing of result.sampleListings.slice(0, 3)) {
        allListings.push({
          title: listing.title || 'Unknown',
          price: listing.price || 0,
          condition: listing.condition || 'Unknown',
          url: listing.url || '',
          source: name,
        });
      }
    }
  }

  const fetchTimeMs = Date.now() - startTime;

  console.log(
    `[QuickFetch] ${successful.length} source(s), ` +
    `${totalListings} listings, ` +
    `median $${mergedPriceRange?.median || 'N/A'}, ` +
    `${fetchTimeMs}ms${timedOut ? ' (partial — timed out)' : ''}`
  );

  return {
    sources: successful.map(s => s.name),
    activeListings: totalListings,
    priceRange: mergedPriceRange,
    sampleListings: allListings.slice(0, 5),
    suggestedPrices: mergedSuggested,
    fetchedAt: new Date().toISOString(),
    fetchTimeMs,
    timedOut,
  };
}

// =============================================================================
// BUILD MARKET DATA PROMPT BLOCK
// =============================================================================

/**
 * Build the "LIVE MARKET DATA" system prompt section from quick-fetch results.
 * Injected into the conversation context before the LLM call.
 */
export function buildMarketDataBlock(itemName: string, data: QuickMarketResult): string {
  const sections: string[] = [];

  sections.push('\n═══════════════════════════════════════════════════════');
  sections.push('LIVE MARKET DATA (just fetched)');
  sections.push('═══════════════════════════════════════════════════════');
  sections.push(`Source: ${data.sources.join(', ')}`);
  sections.push(`Active listings for "${itemName}": ${data.activeListings}`);

  if (data.priceRange) {
    sections.push(`Price range: $${data.priceRange.low} — $${data.priceRange.high}`);
    sections.push(`Average: $${data.priceRange.average} | Median: $${data.priceRange.median}`);
  }

  if (data.suggestedPrices) {
    sections.push(`Good deal: under $${data.suggestedPrices.goodDeal}`);
    sections.push(`Fair market: ~$${data.suggestedPrices.fairMarket}`);
    sections.push(`Sell price: $${data.suggestedPrices.sellPrice}+`);
  }

  if (data.sampleListings.length > 0) {
    sections.push('');
    sections.push('Sample listings:');
    for (const listing of data.sampleListings.slice(0, 3)) {
      sections.push(`  - ${listing.title} | $${listing.price} | ${listing.condition} (${listing.source})`);
    }
  }

  sections.push(`Data freshness: ${data.fetchTimeMs}ms ago${data.timedOut ? ' (partial — some sources timed out)' : ''}`);
  sections.push('');
  sections.push('Use this data confidently. Quote specific numbers. This is REAL market intelligence.');
  sections.push('If the user asks about pricing, lead with these numbers.');

  return sections.join('\n');
}

// =============================================================================
// ITEM NAME EXTRACTION (for detecting market queries in conversation)
// =============================================================================

/**
 * Try to extract an item name from a market query message.
 * Looks for items in the user's vault/scan history that match.
 * Returns the best-matching item name + category, or null.
 */
export function extractItemReference(
  message: string,
  vaultItems: Array<{ item_name: string; category?: string }>,
  scanHistory: Array<{ item_name: string; category?: string }>,
): { itemName: string; category?: string } | null {
  const lower = message.toLowerCase();

  // Check vault items first (user owns these)
  for (const item of vaultItems) {
    if (!item.item_name) continue;
    const itemLower = item.item_name.toLowerCase();
    // Match if message contains >50% of the significant words in item name
    const words = itemLower.split(/\s+/).filter(w => w.length > 3);
    if (words.length === 0) continue;
    const matchCount = words.filter(w => lower.includes(w)).length;
    if (matchCount >= Math.max(1, Math.floor(words.length * 0.5))) {
      return { itemName: item.item_name, category: item.category };
    }
  }

  // Then scan history
  for (const scan of scanHistory) {
    if (!scan.item_name) continue;
    const scanLower = scan.item_name.toLowerCase();
    const words = scanLower.split(/\s+/).filter(w => w.length > 3);
    if (words.length === 0) continue;
    const matchCount = words.filter(w => lower.includes(w)).length;
    if (matchCount >= Math.max(1, Math.floor(words.length * 0.5))) {
      return { itemName: scan.item_name, category: scan.category };
    }
  }

  return null;
}