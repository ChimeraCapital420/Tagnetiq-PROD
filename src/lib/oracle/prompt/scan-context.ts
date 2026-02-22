// FILE: src/lib/oracle/prompt/scan-context.ts
// ═══════════════════════════════════════════════════════════════════════
// Builds the scan history context for Oracle's system prompt.
//
// v2.0 — FULL HYDRA DATA EXTRACTION
//
// BEFORE: Oracle only saw item name, value, decision, confidence.
//         Result: Oracle fixated on AI model disagreements instead of
//         actual market data. "Wow, DeepSeek was much higher..."
//
// AFTER:  Oracle sees eBay sold listings, authority data (Numista,
//         PSA, NHTSA, Colnect, Brickset, etc.), individual provider
//         reasoning, and market source breakdowns.
//         Result: "eBay shows 22 similar sold listings at $12–$85.
//         Numista confirms this is a KM#110, .900 silver..."
//
// TOKEN BUDGET STRATEGY:
//   - Most recent 10 scans: full detail (market + authority + actions)
//   - Scans 11–25: compact (name, value, decision, category only)
//   - Scans 26–50: aggregate stats only
//   - Behavioral patterns: always included (cheap, high-value)
//
// Oracle is explicitly instructed to:
//   1. Lead with MARKET REALITY (eBay data, authority prices)
//   2. Reference authority sources BY NAME
//   3. Mention provider opinions only when spread is notable
//   4. Suggest actionable next steps naturally
// ═══════════════════════════════════════════════════════════════════════

// =============================================================================
// IMPORTS
// =============================================================================

import { buildScanActionsBlock } from './scan-actions.js';

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Build scan history context for Oracle's system prompt.
 *
 * @param scanHistory - Array of scan records from analysis_history
 * @param vaultItems  - Array of vault items (optional, enables action suggestions)
 */
export function buildScanContext(scanHistory: any[], vaultItems: any[] = []): string {
  let context = '\n\n## USER SCAN HISTORY\n';

  if (scanHistory.length === 0) {
    context += 'No scans yet. The user is new — warm welcome. ';
    context += 'Let them know TagnetIQ covers the entire $400B resale market. ';
    context += 'Suggest they scan their first item.\n';
    return context;
  }

  // ── Instructions for Oracle ───────────────────────────────
  context += buildOracleInstructions();

  context += `${scanHistory.length} total scans. Most recent first:\n\n`;

  // ── Recent scans: FULL detail (market + authority + votes + actions) ──
  const recentDetailed = scanHistory.slice(0, 10);
  for (const scan of recentDetailed) {
    context += buildDetailedScanBlock(scan);
    // Actionable suggestions for recent scans
    context += buildScanActionsBlock(scan, vaultItems);
  }

  // ── Older scans: COMPACT (name + value + decision only) ─────
  const olderCompact = scanHistory.slice(10, 25);
  if (olderCompact.length > 0) {
    context += '--- OLDER SCANS (compact) ---\n';
    for (const scan of olderCompact) {
      context += buildCompactScanLine(scan);
    }
    context += '\n';
  }

  // ── Beyond 25: just note the count ──────────────────────────
  if (scanHistory.length > 25) {
    context += `... and ${scanHistory.length - 25} older scans not shown.\n\n`;
  }

  // ── Aggregate stats ─────────────────────────────────────────
  context += buildScanStats(scanHistory);

  // ── Behavioral patterns ─────────────────────────────────────
  if (scanHistory.length >= 5) {
    context += buildScanPatterns(scanHistory);
  }

  return context;
}

// =============================================================================
// ORACLE INSTRUCTIONS — How to discuss scan data
// =============================================================================

function buildOracleInstructions(): string {
  return `
HOW TO DISCUSS SCANS:
- Lead with MARKET DATA: eBay sold count, price ranges, authority prices. These are real.
- Reference authority sources BY NAME: "Numista confirms...", "PSA cert lookup shows...", "eBay has 22 sold listings..."
- When mentioning AI estimates, frame as supporting evidence, not the headline.
  BAD: "Wow, DeepSeek valued it at $74 while others said $30!"
  GOOD: "eBay sold listings average $35. The AI panel agrees, with estimates from $28–$45."
- Only highlight provider disagreements when the spread exceeds 50% of the median — then it IS useful context.
- When the user asks about a scan, offer 1-2 specific next actions naturally (not a menu).
- If authority data includes catalog numbers, grades, or specs, mention them — collectors care about details.

`;
}

// =============================================================================
// DETAILED SCAN BLOCK — Recent 10 scans with full HYDRA data
// =============================================================================

function buildDetailedScanBlock(scan: any): string {
  const result = scan.analysis_result || {};
  const consensus = scan.consensus_data || {};
  let block = '---\n';

  // ── Core identification ─────────────────────────────────
  block += `ITEM: ${scan.item_name || result.itemName || 'Unknown'}\n`;
  block += `SCANNED: ${formatDate(scan.created_at)}\n`;
  block += `VALUE: ${formatValue(result.estimatedValue || scan.estimated_value)}\n`;

  if (result.valueRange) {
    block += `RANGE: $${result.valueRange.low || '?'}–$${result.valueRange.high || '?'}\n`;
  }

  block += `DECISION: ${result.decision || scan.decision || 'N/A'}\n`;
  block += `CONFIDENCE: ${formatConfidence(result.confidence || scan.confidence)}\n`;
  block += `CATEGORY: ${result.category || scan.category || 'general'}\n`;

  // ── Market Data (eBay, etc.) ────────────────────────────
  const marketBlock = buildMarketDataBlock(result, consensus);
  if (marketBlock) block += marketBlock;

  // ── Authority Data (Numista, PSA, NHTSA, etc.) ──────────
  const authorityBlock = buildAuthorityBlock(result.authorityData);
  if (authorityBlock) block += authorityBlock;

  // ── AI Provider Votes (compact) ─────────────────────────
  const votesBlock = buildVotesBlock(result.votes, consensus);
  if (votesBlock) block += votesBlock;

  // ── Summary reasoning ───────────────────────────────────
  if (result.summary_reasoning) {
    block += `SUMMARY: ${result.summary_reasoning.substring(0, 300)}\n`;
  }

  // ── Valuation factors ───────────────────────────────────
  if (result.valuation_factors?.length > 0) {
    block += `KEY FACTORS: ${result.valuation_factors.slice(0, 5).join('; ')}\n`;
  }

  block += '\n';
  return block;
}

// =============================================================================
// MARKET DATA BLOCK — eBay listings, sold data, price sources
// =============================================================================

function buildMarketDataBlock(result: any, consensus: any): string {
  let block = '';
  const sources: string[] = [];

  // ── Extract from marketData in analysis_result ──────────
  const md = result.marketData || {};

  // Source names that contributed
  if (Array.isArray(md.sources) && md.sources.length > 0) {
    sources.push(...md.sources);
  }

  if (md.blendMethod) {
    block += `PRICING METHOD: ${md.blendMethod}\n`;
  }

  // ── Extract eBay-specific data from authority/votes ─────
  // eBay data can live in multiple places depending on HYDRA version:
  // 1. result.authorityData (if eBay was primary authority)
  // 2. consensus.apiSources (raw fetcher results)
  // 3. Individual votes may reference eBay comps

  const ebayData = extractEbayData(result, consensus);
  if (ebayData) {
    block += `EBAY: ${ebayData}\n`;
  }

  // ── Other market sources from consensus_data ────────────
  if (consensus?.apiSources) {
    const apiBlock = extractApiSources(consensus.apiSources);
    if (apiBlock) block += apiBlock;
  }

  // ── Source list if we have one ──────────────────────────
  if (sources.length > 0) {
    block += `MARKET SOURCES: ${sources.join(', ')}\n`;
  }

  return block;
}

// =============================================================================
// AUTHORITY DATA BLOCK — Numista, PSA, NHTSA, Colnect, etc.
// =============================================================================

function buildAuthorityBlock(authorityData: any): string {
  if (!authorityData) return '';

  let block = '';
  const source = authorityData.source || authorityData.name || 'authority';

  block += `AUTHORITY [${source.toUpperCase()}]: `;

  const details: string[] = [];

  // ── Item details (catalog info) ─────────────────────────
  const itemDetails = authorityData.itemDetails || authorityData.details || {};

  if (itemDetails.title || itemDetails.name) {
    details.push(itemDetails.title || itemDetails.name);
  }

  if (itemDetails.catalogNumber || itemDetails.km_number || itemDetails.catalog_id) {
    details.push(`Catalog: ${itemDetails.catalogNumber || itemDetails.km_number || itemDetails.catalog_id}`);
  }

  if (itemDetails.year || itemDetails.mintYear || itemDetails.year_range) {
    details.push(`Year: ${itemDetails.year || itemDetails.mintYear || itemDetails.year_range}`);
  }

  if (itemDetails.material || itemDetails.composition || itemDetails.metal) {
    details.push(`Material: ${itemDetails.material || itemDetails.composition || itemDetails.metal}`);
  }

  if (itemDetails.grade || itemDetails.condition || itemDetails.psa_grade) {
    details.push(`Grade: ${itemDetails.grade || itemDetails.condition || itemDetails.psa_grade}`);
  }

  if (itemDetails.manufacturer || itemDetails.brand || itemDetails.mint) {
    details.push(`Maker: ${itemDetails.manufacturer || itemDetails.brand || itemDetails.mint}`);
  }

  if (itemDetails.rarity || itemDetails.population) {
    details.push(`Rarity: ${itemDetails.rarity || itemDetails.population}`);
  }

  if (itemDetails.set_name || itemDetails.series) {
    details.push(`Series: ${itemDetails.set_name || itemDetails.series}`);
  }

  // ── Price data from authority ───────────────────────────
  const priceData = authorityData.priceData || authorityData.pricing || {};

  if (priceData.market) {
    details.push(`Market price: $${Number(priceData.market).toFixed(2)}`);
  }
  if (priceData.retail) {
    details.push(`Retail: $${Number(priceData.retail).toFixed(2)}`);
  }
  if (priceData.low && priceData.high) {
    details.push(`Range: $${priceData.low}–$${priceData.high}`);
  }

  // ── Authority URL (for Oracle to reference) ─────────────
  if (authorityData.url || authorityData.link || authorityData.detailUrl) {
    details.push(`Link: ${authorityData.url || authorityData.link || authorityData.detailUrl}`);
  }

  block += details.length > 0 ? details.join('. ') : 'Data available but no specific details extracted';
  block += '\n';

  return block;
}

// =============================================================================
// VOTES BLOCK — Individual AI provider estimates (compact)
// =============================================================================

function buildVotesBlock(votes: any[], consensus: any): string {
  // Try votes from analysis_result first, then consensus_data
  const voteArray = votes || consensus?.votes || [];

  if (!Array.isArray(voteArray) || voteArray.length === 0) {
    return '';
  }

  let block = 'AI PANEL: ';
  const voteLines: string[] = [];

  for (const vote of voteArray) {
    const provider = vote.provider || vote.model || vote.source || 'unknown';
    const shortName = normalizeProviderName(provider);
    const value = extractVoteValue(vote);
    const decision = vote.decision || vote.rawResponse?.decision || '';

    if (value) {
      voteLines.push(`${shortName}=${value}${decision ? ` (${decision})` : ''}`);
    }
  }

  if (voteLines.length === 0) return '';

  block += voteLines.join(', ');

  // ── Note significant spread ─────────────────────────────
  const numericValues = extractNumericValues(voteArray);
  if (numericValues.length >= 3) {
    const median = getMedian(numericValues);
    const maxSpread = Math.max(...numericValues) - Math.min(...numericValues);
    if (median > 0 && maxSpread > median * 0.5) {
      block += ` ⚠️ Wide spread (${formatDollar(Math.min(...numericValues))}–${formatDollar(Math.max(...numericValues))})`;
    }
  }

  block += '\n';

  // ── Consensus ratio ─────────────────────────────────────
  const ratio = consensus?.consensusRatio || consensus?.ratio;
  if (ratio) {
    block += `CONSENSUS: ${ratio}\n`;
  }

  return block;
}

// =============================================================================
// COMPACT SCAN LINE — Older scans, one line each
// =============================================================================

function buildCompactScanLine(scan: any): string {
  const result = scan.analysis_result || {};
  const name = scan.item_name || result.itemName || 'Unknown';
  const value = formatValue(result.estimatedValue || scan.estimated_value);
  const decision = result.decision || scan.decision || '?';
  const category = result.category || scan.category || '';
  const date = formatShortDate(scan.created_at);

  return `• ${name} | ${value} | ${decision} | ${category} | ${date}\n`;
}

// =============================================================================
// STATS
// =============================================================================

function buildScanStats(scanHistory: any[]): string {
  const categories = [...new Set(
    scanHistory.map((s: any) => s.category || s.analysis_result?.category || 'general')
  )];

  const buyCount = scanHistory.filter(
    (s: any) => (s.decision || s.analysis_result?.decision) === 'BUY'
  ).length;

  const passCount = scanHistory.filter(
    (s: any) => (s.decision || s.analysis_result?.decision) === 'PASS'
  ).length;

  let totalValue = 0;
  for (const scan of scanHistory) {
    const val = scan.estimated_value
      || parseFloat(String(scan.analysis_result?.estimatedValue || '0').replace(/[^0-9.]/g, ''));
    if (!isNaN(val)) totalValue += val;
  }

  // ── Authority source summary across all scans ───────────
  const authoritySources = new Set<string>();
  for (const scan of scanHistory) {
    const auth = scan.analysis_result?.authorityData;
    if (auth?.source) authoritySources.add(auth.source);
  }

  // ── Market source summary across all scans ──────────────
  const marketSources = new Set<string>();
  for (const scan of scanHistory) {
    const sources = scan.analysis_result?.marketData?.sources;
    if (Array.isArray(sources)) {
      sources.forEach((s: string) => marketSources.add(s));
    }
  }

  let stats = '\n## SCAN STATS\n';
  stats += `Total scans: ${scanHistory.length}\n`;
  stats += `BUY: ${buyCount} | PASS: ${passCount} | Other: ${scanHistory.length - buyCount - passCount}\n`;
  stats += `Categories: ${categories.join(', ')}\n`;
  stats += `Total estimated value scanned: $${totalValue.toLocaleString()}\n`;

  if (authoritySources.size > 0) {
    stats += `Authority sources used: ${[...authoritySources].join(', ')}\n`;
  }
  if (marketSources.size > 0) {
    stats += `Market sources used: ${[...marketSources].join(', ')}\n`;
  }

  return stats;
}

// =============================================================================
// PATTERNS (reference naturally, don't list robotically)
// =============================================================================

function buildScanPatterns(scanHistory: any[]): string {
  let patterns = '\n## PATTERNS (reference naturally, don\'t list robotically)\n';

  const categories = [...new Set(
    scanHistory.map((s: any) => s.category || s.analysis_result?.category || 'general')
  )];

  const buyCount = scanHistory.filter(
    (s: any) => (s.decision || s.analysis_result?.decision) === 'BUY'
  ).length;

  const passCount = scanHistory.filter(
    (s: any) => (s.decision || s.analysis_result?.decision) === 'PASS'
  ).length;

  // ── Category focus ──────────────────────────────────────
  if (categories.length === 1) {
    patterns += `User is focused on ${categories[0]} — they clearly have a passion here.\n`;
  } else if (categories.length >= 4) {
    patterns += `User explores many categories (${categories.length}) — curious and versatile.\n`;
  }

  // ── Win/loss ratio ──────────────────────────────────────
  if (buyCount > passCount * 2) {
    patterns += `Strong eye — scans a lot of winners (${buyCount} BUY vs ${passCount} PASS).\n`;
  } else if (passCount > buyCount * 2) {
    patterns += `Learning phase — more PASS than BUY. Be encouraging.\n`;
  }

  // ── Activity recency ───────────────────────────────────
  const lastScanDate = new Date(scanHistory[0].created_at);
  const daysSinceLastScan = Math.floor(
    (Date.now() - lastScanDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastScan === 0) {
    patterns += 'User scanned today — they\'re active right now.\n';
  } else if (daysSinceLastScan >= 7) {
    patterns += `It's been ${daysSinceLastScan} days since their last scan. Warm welcome if natural.\n`;
  }

  // ── Value trajectory ────────────────────────────────────
  if (scanHistory.length >= 5) {
    const recent5 = scanHistory.slice(0, 5);
    const older5 = scanHistory.slice(Math.max(0, scanHistory.length - 5));
    const recentAvg = avgValue(recent5);
    const olderAvg = avgValue(older5);

    if (recentAvg > 0 && olderAvg > 0) {
      if (recentAvg > olderAvg * 1.5) {
        patterns += `Value trending UP — scanning higher-value items recently (avg $${recentAvg.toFixed(0)} vs earlier $${olderAvg.toFixed(0)}).\n`;
      } else if (olderAvg > recentAvg * 1.5) {
        patterns += `Exploring lower price points recently — might be bargain hunting.\n`;
      }
    }
  }

  // ── Favorite authority source ───────────────────────────
  const authCounts: Record<string, number> = {};
  for (const scan of scanHistory) {
    const src = scan.analysis_result?.authorityData?.source;
    if (src) authCounts[src] = (authCounts[src] || 0) + 1;
  }
  const topAuth = Object.entries(authCounts).sort((a, b) => b[1] - a[1])[0];
  if (topAuth && topAuth[1] >= 3) {
    patterns += `${topAuth[0]} has been the most frequent authority source (${topAuth[1]} scans) — user likely values this data.\n`;
  }

  return patterns;
}

// =============================================================================
// EXTRACTORS — Pull specific data from nested HYDRA structures
// =============================================================================

/**
 * Extract eBay-specific data from wherever HYDRA stored it.
 * eBay data can live in authorityData, consensus apiSources, or vote rawResponses.
 */
function extractEbayData(result: any, consensus: any): string | null {
  const parts: string[] = [];

  // ── Check authorityData if eBay was primary ─────────────
  const auth = result.authorityData;
  if (auth?.source === 'ebay' || auth?.source === 'eBay') {
    if (auth.itemDetails?.listingCount || auth.itemDetails?.count || auth.itemDetails?.total_results) {
      const count = auth.itemDetails.listingCount || auth.itemDetails.count || auth.itemDetails.total_results;
      parts.push(`${count} listings found`);
    }
    if (auth.priceData?.low != null && auth.priceData?.high != null) {
      parts.push(`range $${auth.priceData.low}–$${auth.priceData.high}`);
    }
    if (auth.priceData?.market || auth.priceData?.median || auth.priceData?.average) {
      const price = auth.priceData.market || auth.priceData.median || auth.priceData.average;
      parts.push(`median $${Number(price).toFixed(2)}`);
    }
  }

  // ── Check apiSources in consensus_data ──────────────────
  if (consensus?.apiSources) {
    const ebaySrc = findSource(consensus.apiSources, 'ebay');
    if (ebaySrc) {
      if (ebaySrc.count || ebaySrc.resultCount || ebaySrc.totalResults) {
        const count = ebaySrc.count || ebaySrc.resultCount || ebaySrc.totalResults;
        if (!parts.some(p => p.includes('listings'))) {
          parts.push(`${count} similar listings`);
        }
      }
      if (ebaySrc.priceRange) {
        const pr = ebaySrc.priceRange;
        if (!parts.some(p => p.includes('range'))) {
          parts.push(`range $${pr.low || pr.min || '?'}–$${pr.high || pr.max || '?'}`);
        }
      }
      if (ebaySrc.averagePrice || ebaySrc.median) {
        const avg = ebaySrc.averagePrice || ebaySrc.median;
        if (!parts.some(p => p.includes('median'))) {
          parts.push(`avg $${Number(avg).toFixed(2)}`);
        }
      }
    }
  }

  // ── Check marketData sources array for eBay ─────────────
  // (In some HYDRA versions, marketData.sources is an array of objects before mapping)
  const mdSources = result.marketData?.rawSources || result.marketData?.sourceDetails;
  if (Array.isArray(mdSources)) {
    const ebaySrc = mdSources.find(
      (s: any) => (s.source || s.name || '').toLowerCase() === 'ebay'
    );
    if (ebaySrc) {
      if (ebaySrc.count && !parts.some(p => p.includes('listings'))) {
        parts.push(`${ebaySrc.count} results`);
      }
      if (ebaySrc.priceRange && !parts.some(p => p.includes('range'))) {
        parts.push(`$${ebaySrc.priceRange.low}–$${ebaySrc.priceRange.high}`);
      }
    }
  }

  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Extract non-eBay API sources from consensus apiSources.
 */
function extractApiSources(apiSources: any): string {
  if (!apiSources || typeof apiSources !== 'object') return '';

  let block = '';
  const entries = Array.isArray(apiSources)
    ? apiSources
    : Object.entries(apiSources).map(([key, val]) => ({ source: key, ...(val as any) }));

  for (const src of entries) {
    const name = (src.source || src.name || '').toLowerCase();
    // Skip eBay — handled separately
    if (name === 'ebay') continue;
    if (!name) continue;

    const details: string[] = [];
    if (src.found || src.matched) details.push('match found');
    if (src.price || src.market_price) details.push(`price: $${src.price || src.market_price}`);
    if (src.catalogId || src.catalog_number) details.push(`catalog: ${src.catalogId || src.catalog_number}`);
    if (src.grade || src.condition) details.push(`grade: ${src.grade || src.condition}`);

    if (details.length > 0) {
      block += `${name.toUpperCase()}: ${details.join(', ')}\n`;
    }
  }

  return block;
}

/**
 * Find a source by name in an array or object of API sources.
 */
function findSource(apiSources: any, name: string): any {
  if (Array.isArray(apiSources)) {
    return apiSources.find(
      (s: any) => (s.source || s.name || '').toLowerCase() === name.toLowerCase()
    );
  }
  if (typeof apiSources === 'object') {
    return apiSources[name] || apiSources[name.toLowerCase()] || null;
  }
  return null;
}

/**
 * Extract a dollar value from a vote object.
 */
function extractVoteValue(vote: any): string | null {
  // Direct value
  if (vote.estimatedValue != null) return formatDollar(vote.estimatedValue);
  if (vote.value != null) return formatDollar(vote.value);
  if (vote.price != null) return formatDollar(vote.price);

  // Nested in rawResponse
  const raw = vote.rawResponse || {};
  if (raw.estimatedValue != null) return formatDollar(raw.estimatedValue);
  if (raw.estimated_value != null) return formatDollar(raw.estimated_value);
  if (raw.value != null) return formatDollar(raw.value);

  return null;
}

/**
 * Extract numeric values from vote array for spread analysis.
 */
function extractNumericValues(votes: any[]): number[] {
  const values: number[] = [];
  for (const vote of votes) {
    const raw = extractVoteValue(vote);
    if (raw) {
      const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
      if (!isNaN(num) && num > 0) values.push(num);
    }
  }
  return values;
}

// =============================================================================
// HELPERS
// =============================================================================

function normalizeProviderName(name: string): string {
  const lower = (name || '').toLowerCase();
  if (lower.includes('openai') || lower.includes('gpt')) return 'GPT';
  if (lower.includes('anthropic') || lower.includes('claude')) return 'Claude';
  if (lower.includes('google') || lower.includes('gemini')) return 'Gemini';
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('mistral')) return 'Mistral';
  if (lower.includes('groq')) return 'Groq';
  if (lower.includes('xai') || lower.includes('grok')) return 'Grok';
  if (lower.includes('perplexity')) return 'Perplexity';
  // Return cleaned up name
  return name.split('/').pop()?.split('-')[0] || name;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr || 'Unknown';
  }
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatValue(value: any): string {
  if (value == null || value === '' || value === 'Unknown') return 'Unknown';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return String(value);
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDollar(value: any): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return String(value);
  return `$${num.toFixed(2)}`;
}

function formatConfidence(conf: any): string {
  if (conf == null) return 'N/A';
  const num = typeof conf === 'number' ? conf : parseFloat(String(conf));
  if (isNaN(num)) return String(conf);
  // If it's 0-1, convert to percentage. If already 0-100, keep as-is.
  const pct = num <= 1 ? Math.round(num * 100) : Math.round(num);
  return `${pct}%`;
}

function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avgValue(scans: any[]): number {
  let total = 0;
  let count = 0;
  for (const s of scans) {
    const val = s.estimated_value
      || parseFloat(String(s.analysis_result?.estimatedValue || '0').replace(/[^0-9.]/g, ''));
    if (!isNaN(val) && val > 0) {
      total += val;
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}