// FILE: api/whatnot-listing.ts
// RH-024 — Whatnot Listing Builder
// Generates optimized Whatnot-ready listing content from a HYDRA scan result.
// Whatnot is live-auction focused — copy needs urgency + collectibility angle.
//
// POST /api/whatnot-listing
// Body: { itemName, estimatedValue, category, condition, analysisId, userId, votes? }

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 30 };

const CATEGORY_MAP: Record<string, string> = {
  coins:          'Coins & Currency',
  cards:          'Trading Cards',
  comics:         'Comics & Manga',
  toys:           'Toys & Games',
  vintage:        'Vintage & Antiques',
  electronics:    'Electronics',
  sneakers:       'Sneakers',
  fashion:        'Fashion',
  sports:         'Sports Memorabilia',
  collectibles:   'Collectibles',
  jewelry:        'Jewelry & Watches',
  art:            'Art',
  books:          'Books',
  music:          'Music & Vinyl',
  general:        'Everything Else',
};

// Starting price logic by category (Whatnot convention: start low, let bidding push)
function suggestStartingPrice(estimatedValue: number, category: string): number {
  const ratio = ['coins', 'cards', 'comics'].includes(category) ? 0.3 : 0.4;
  const start = estimatedValue * ratio;
  // Round to clean number
  if (start < 5)   return 1;
  if (start < 20)  return Math.round(start);
  if (start < 100) return Math.round(start / 5) * 5;
  return Math.round(start / 10) * 10;
}

function buildWhatnotPrompt(
  itemName: string,
  estimatedValue: number,
  category: string,
  condition: string,
  votes: any[]
): string {
  const topVotes = votes
    .filter(v => v.success)
    .slice(0, 3)
    .map(v => `${v.providerName}: $${v.estimatedValue}`)
    .join(', ');

  return `You are writing a Whatnot live auction listing. Whatnot is a live-streaming selling platform where sellers auction items in real time. Listings need to be exciting, concise, and optimized for live presentation.

Item: ${itemName}
Estimated Value: $${estimatedValue}
Category: ${category}
Condition: ${condition}
${topVotes ? `AI Price Consensus: ${topVotes}` : ''}

Write a Whatnot listing package with these EXACT sections:

TITLE: (max 60 chars, keyword-rich, no ALL CAPS)
OPENING_LINE: (1 punchy sentence for when the item goes live — builds excitement)  
DESCRIPTION: (3-4 sentences: what it is, why it's valuable, condition details, why buyers should bid)
CONDITION_NOTES: (1-2 sentences of honest condition detail — Whatnot buyers expect transparency)
HASHTAGS: (6-8 relevant hashtags without # symbol, comma separated)
STARTING_PRICE: (number only — the auction opening bid)
BIN_PRICE: (number only — buy it now price if you offer one, or "none")

Tone: Enthusiastic but honest. Whatnot buyers are knowledgeable collectors — don't oversell.
Format the response as JSON with keys: title, openingLine, description, conditionNotes, hashtags, startingPrice, binPrice`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const {
    itemName,
    estimatedValue,
    category = 'general',
    condition = 'good',
    votes = [],
    userId,
  } = req.body;

  if (!itemName) return res.status(400).json({ error: 'itemName required' });
  if (!estimatedValue) return res.status(400).json({ error: 'estimatedValue required' });

  const suggestedStart = suggestStartingPrice(estimatedValue, category);
  const whatnotCategory = CATEGORY_MAP[category] || CATEGORY_MAP.general;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',  // Fast + cheap for listing generation
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: buildWhatnotPrompt(itemName, estimatedValue, category, condition, votes),
        }],
      }),
    });

    if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    // Parse JSON from Claude response
    let listing: any = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) listing = JSON.parse(jsonMatch[0]);
    } catch {
      // Fallback: build a basic listing
      listing = {
        title: itemName.substring(0, 60),
        openingLine: `Up next — ${itemName}! Starting the bidding now!`,
        description: `${itemName} in ${condition} condition. HYDRA consensus value: $${estimatedValue}. Great addition to any collection.`,
        conditionNotes: `Condition: ${condition}. Please review all photos before bidding.`,
        hashtags: [category, 'whatnot', 'collector', 'auction', 'forsale', 'vintage'],
        startingPrice: suggestedStart,
        binPrice: Math.round(estimatedValue * 0.9),
      };
    }

    // Override with calculated prices if Claude didn't provide good ones
    if (!listing.startingPrice || listing.startingPrice > estimatedValue) {
      listing.startingPrice = suggestedStart;
    }
    if (!listing.binPrice || listing.binPrice === 'none') {
      listing.binPrice = Math.round(estimatedValue * 0.85);
    }

    return res.status(200).json({
      success: true,
      listing: {
        ...listing,
        whatnotCategory,
        estimatedValue,
        priceGuidance: {
          hydraConsensus: estimatedValue,
          suggestedStart,
          suggestedBIN: Math.round(estimatedValue * 0.85),
          note: 'Starting at 30-40% of value is standard Whatnot practice — competitive bidding typically pushes final price up.',
        },
        shareUrl: `https://www.whatnot.com/sell`,
      },
    });

  } catch (error: any) {
    // Fallback listing on any error
    return res.status(200).json({
      success: true,
      listing: {
        title: itemName.substring(0, 60),
        openingLine: `Starting the auction on this ${itemName}!`,
        description: `${itemName} in ${condition} condition. Estimated value $${estimatedValue} by HYDRA AI consensus.`,
        conditionNotes: `Condition: ${condition}. Review photos carefully.`,
        hashtags: [category, 'whatnot', 'auction', 'collector'],
        startingPrice: suggestedStart,
        binPrice: Math.round(estimatedValue * 0.85),
        whatnotCategory,
        estimatedValue,
        priceGuidance: {
          hydraConsensus: estimatedValue,
          suggestedStart,
          suggestedBIN: Math.round(estimatedValue * 0.85),
        },
      },
      _fallback: true,
    });
  }
}