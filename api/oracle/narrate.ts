// FILE: api/oracle/narrate.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Narrator — Lightweight LLM Commentary Endpoint
// ═══════════════════════════════════════════════════════════════════════
// Fires ONLY for interesting scans (~30% of all scans).
// Uses gpt-4o-mini via raw fetch (no SDK dependency).
// Max 120 tokens → punchy, conversational, 2-3 sentences.
// Cost: ~$0.001 per call.
//
// v2.0: Now receives authority + market data from the client.
//       Oracle leads with MARKET REALITY (eBay, Google Books, Numista)
//       and treats AI model disagreements as supporting context, not
//       the headline.
//
// The client-side discrepancy detector decides IF this endpoint fires.
// Template fallback always works even if this endpoint fails.
//
// IMPORTANT: Uses raw fetch() — NOT the openai npm package.
// This matches the pattern used by HYDRA engine and all other AI calls.
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 10,
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get the OpenAI API key from environment.
 * Checks both common env var names used across the codebase.
 */
function getOpenAIKey(): string | null {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.OPEN_AI_API_KEY ||
    null
  );
}

/**
 * Build a compact vote summary string for the prompt.
 * Limits to 5 votes to keep prompt small.
 */
function buildVoteSummary(votes: any): string {
  if (!Array.isArray(votes) || votes.length === 0) {
    return 'No vote details available';
  }

  return votes
    .slice(0, 5)
    .map((v: any) => {
      const provider = v.provider || v.providerName || v.provider_id || 'Unknown';
      const value = v.value ?? v.estimatedValue ?? v.estimated_value ?? '?';
      const decision = v.decision || '?';
      return `${provider}: $${value} ${decision}`;
    })
    .join(', ');
}

/**
 * Build a compact authority data summary for the prompt.
 */
function buildAuthoritySummary(authorityData: any): string {
  if (!authorityData) return '';

  const parts: string[] = [];
  const source = authorityData.source || authorityData.name || '';

  if (source) parts.push(`Source: ${source}`);

  const details = authorityData.itemDetails || authorityData.details || {};
  if (details.title || details.name) parts.push(`Title: ${details.title || details.name}`);
  if (details.catalogNumber || details.km_number) parts.push(`Catalog: ${details.catalogNumber || details.km_number}`);
  if (details.year || details.mintYear || details.year_range) parts.push(`Year: ${details.year || details.mintYear || details.year_range}`);
  if (details.material || details.composition) parts.push(`Material: ${details.material || details.composition}`);
  if (details.grade || details.condition) parts.push(`Grade: ${details.grade || details.condition}`);
  if (details.rarity || details.population) parts.push(`Rarity: ${details.rarity || details.population}`);
  if (details.manufacturer || details.brand || details.mint) parts.push(`Maker: ${details.manufacturer || details.brand || details.mint}`);
  if (details.set_name || details.series) parts.push(`Series: ${details.set_name || details.series}`);

  const priceData = authorityData.priceData || authorityData.pricing || {};
  if (priceData.market) parts.push(`Market price: $${Number(priceData.market).toFixed(2)}`);
  if (priceData.retail) parts.push(`Retail: $${Number(priceData.retail).toFixed(2)}`);
  if (priceData.low && priceData.high) parts.push(`Range: $${priceData.low}–$${priceData.high}`);

  if (authorityData.url || authorityData.link) parts.push(`URL: ${authorityData.url || authorityData.link}`);

  return parts.length > 0 ? parts.join(', ') : '';
}

/**
 * Build a compact eBay/market data summary for the prompt.
 */
function buildMarketSummary(marketData: any, ebayData: any): string {
  const parts: string[] = [];

  // eBay-specific data
  if (ebayData) {
    if (ebayData.count || ebayData.listingCount || ebayData.totalResults) {
      const count = ebayData.count || ebayData.listingCount || ebayData.totalResults;
      parts.push(`eBay: ${count} similar listings found`);
    }
    if (ebayData.priceRange) {
      parts.push(`eBay range: $${ebayData.priceRange.low || '?'}–$${ebayData.priceRange.high || '?'}`);
    }
    if (ebayData.averagePrice || ebayData.median) {
      parts.push(`eBay avg: $${Number(ebayData.averagePrice || ebayData.median).toFixed(2)}`);
    }
  }

  // General market data
  if (marketData) {
    if (Array.isArray(marketData.sources) && marketData.sources.length > 0) {
      // sources might be strings or objects
      const sourceNames = marketData.sources.map((s: any) =>
        typeof s === 'string' ? s : (s.source || s.name || 'unknown')
      );
      parts.push(`Market sources: ${sourceNames.join(', ')}`);
    }
    if (marketData.blendMethod) {
      parts.push(`Blend: ${marketData.blendMethod}`);
    }
  }

  return parts.length > 0 ? parts.join('. ') : '';
}

/**
 * Get persona-specific tone instruction.
 */
function getToneHint(persona?: string): string {
  switch (persona) {
    case 'estate':
      return 'Gentle, educational tone. The user might be new to resale or dealing with a difficult situation. Be warm and supportive.';
    case 'flipper':
    case 'hustle':
      return 'Direct, hustler energy. Quick and actionable. Focus on the money angle.';
    case 'collector':
      return 'Enthusiastic collector tone. Focus on rarity, history, and what makes this piece special.';
    case 'new_user':
      return 'Welcoming and educational. Explain briefly why the analysis matters.';
    default:
      return 'Knowledgeable friend tone. Natural and conversational.';
  }
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Method check ──────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ── Parse body safely ─────────────────────────────────────────────────
  let body: any;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    body = {};
  }

  const {
    itemName,
    category,
    consensusValue,
    votes,
    discrepancies,
    persona,
    // v2.0: New fields from client
    authorityData,
    marketData,
    ebayData,
    valueRange,
  } = body;

  // ── Validate minimum input ────────────────────────────────────────────
  if (!itemName || typeof itemName !== 'string') {
    // Don't 500 — return graceful null so client uses template fallback
    return res.status(200).json({ commentary: null, reason: 'no_item_name' });
  }

  // ── Check API key ─────────────────────────────────────────────────────
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    console.warn('[narrate] No OpenAI API key found (checked OPENAI_API_KEY and OPEN_AI_API_KEY)');
    return res.status(200).json({ commentary: null, reason: 'no_api_key' });
  }

  // ── Build prompt ──────────────────────────────────────────────────────
  const toneHint = getToneHint(persona);
  const voteSummary = buildVoteSummary(votes);
  const authoritySummary = buildAuthoritySummary(authorityData);
  const marketSummary = buildMarketSummary(marketData, ebayData);

  const systemPrompt = `You are Oracle, a knowledgeable AI partner for resale and collecting. Generate 2-3 sentences of natural commentary about this scan result.

PRIORITY ORDER for what to mention:
1. MARKET DATA FIRST — If eBay listings, authority prices, or market sources exist, lead with that. "eBay has 22 similar sold listings averaging $34" or "Google Books lists this at $8-$15" or "Numista confirms this is a KM#110, .900 silver."
2. AUTHORITY DETAILS — If catalog numbers, grades, rarity, or provenance exist, mention what collectors care about.
3. ACTIONABLE INSIGHT — What should the user know or do? Is it worth grading? Is the market hot or cold?
4. AI PANEL CONTEXT — Only mention provider disagreements if the spread is truly wild (>50% of median) AND you've already mentioned market data. Frame it as "the AI panel had a wide range" not "wow DeepSeek was way higher."

NEVER lead with AI model disagreements. The user cares about what the MARKET says, not what the models argued about.

${toneHint} Sound like a friend who knows their stuff, not a robot reading data. Never use bullet points or lists. Keep it under 70 words.`;

  // Build user prompt with all available context
  const userPromptParts: string[] = [
    `Item: ${itemName}`,
    `Category: ${category || 'general'}`,
    `Consensus Value: $${consensusValue ?? 'unknown'}`,
  ];

  if (valueRange) {
    userPromptParts.push(`Value Range: $${valueRange.low || '?'}–$${valueRange.high || '?'}`);
  }

  if (marketSummary) {
    userPromptParts.push(`Market Data: ${marketSummary}`);
  }

  if (authoritySummary) {
    userPromptParts.push(`Authority Data: ${authoritySummary}`);
  }

  userPromptParts.push(`AI Provider Votes: ${voteSummary}`);

  if (discrepancies) {
    userPromptParts.push(`Notable Patterns: ${discrepancies}`);
  }

  userPromptParts.push('', 'Give me 2-3 sentences of natural commentary. Lead with market data if available.');

  const userPrompt = userPromptParts.join('\n');

  // ── Call gpt-4o-mini via raw fetch ────────────────────────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 120,
        temperature: 0.8,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // ── Handle non-200 from OpenAI ────────────────────────────────────
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn(`[narrate] OpenAI returned ${response.status}: ${errorText.slice(0, 200)}`);
      return res.status(200).json({ commentary: null, reason: `openai_${response.status}` });
    }

    // ── Parse response ────────────────────────────────────────────────
    const data = await response.json();

    const commentary =
      data?.choices?.[0]?.message?.content?.trim() || null;

    if (!commentary) {
      console.warn('[narrate] OpenAI returned empty content');
      return res.status(200).json({ commentary: null, reason: 'empty_response' });
    }

    console.log(`[narrate] Generated commentary for "${itemName}" (${commentary.length} chars)`);
    return res.status(200).json({ commentary });

  } catch (error: any) {
    // ── Graceful degradation — NEVER 500 ──────────────────────────────
    // Client has template fallback. Narrate failing should be invisible.
    if (error.name === 'AbortError') {
      console.warn(`[narrate] Timeout after 8s for "${itemName}"`);
      return res.status(200).json({ commentary: null, reason: 'timeout' });
    }

    console.error(`[narrate] Unexpected error for "${itemName}":`, error.message);
    return res.status(200).json({ commentary: null, reason: 'error' });
  }
}