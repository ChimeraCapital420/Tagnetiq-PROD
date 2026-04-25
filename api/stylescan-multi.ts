// FILE: api/stylescan-multi.ts
// RH-028 Phase 2 — StyleScan Multi-Garment Detection
// Scans a full outfit photo and identifies multiple items simultaneously.
// Returns per-item brand routing, affiliate links, and a shareable outfit card.
//
// POST /api/stylescan-multi
// Body: { imageBase64, userId?, sessionId? }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyRateLimit, LIMITS } from './_lib/rateLimit.js';
import { detectLuxuryBrand, buildStyleScanLanes } from '../src/lib/affiliate/affiliate-engine.js';

export const config = { maxDuration: 45 };

const MULTI_GARMENT_PROMPT = `You are an expert fashion identifier analyzing an outfit photo.

Identify EVERY distinct wearable item visible in this image. For each item provide:

Return a JSON array of items:
[
  {
    "position": string (e.g., "top", "bottom", "shoes", "bag", "jacket", "accessory", "hat", "outerwear"),
    "itemName": string (specific as possible: "White button-down oxford shirt"),
    "brand": string or null (if identifiable),
    "color": string,
    "category": "fashion" | "sneakers" | "handbags" | "jewelry" | "watches" | "general",
    "estimatedRetailPrice": number (USD, approximate),
    "condition": "excellent" | "good" | "fair",
    "isLuxury": boolean,
    "confidence": number (0-1, how confident you are in the identification)
  }
]

Be thorough — include ALL visible items: top, bottom, shoes, bag, jacket, accessories, hat, belt, etc.
If you cannot identify a specific brand, say null. Do not guess brands.
Respond ONLY with valid JSON array. No preamble.`;

async function identifyGarments(imageBase64: string): Promise<any[]> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: MULTI_GARMENT_PROMPT },
          ],
        }],
      }),
    });

    const data = await res.json();
    const rawText = data.content?.[0]?.text || '[]';
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch { return []; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (applyRateLimit(req, res, LIMITS.STANDARD)) return;

  const { imageBase64, userId, sessionId } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 required' });
  }

  console.log(`👗 StyleScan Multi: identifying garments...`);

  const garments = await identifyGarments(imageBase64);

  if (!garments.length) {
    return res.status(200).json({
      success: true,
      garments: [],
      outfitCard: null,
      message: 'No garments detected — try a photo with better lighting and full outfit visible.',
    });
  }

  // Build StyleScan lanes + luxury detection for each garment
  const enrichedGarments = garments.map(item => {
    const brandConfig = item.brand ? detectLuxuryBrand(`${item.brand} ${item.itemName}`) : null;
    const lanes = buildStyleScanLanes(
      item.itemName,
      item.brand || '',
      item.category || 'fashion'
    );

    return {
      ...item,
      luxuryAuth: brandConfig ? {
        isLuxury: true,
        brandName: brandConfig.displayName,
        hasNFC: brandConfig.hasNFC,
        nfcSince: brandConfig.nfcSince,
      } : null,
      purchaseLanes: lanes,
    };
  });

  // Build outfit card data (shareable summary)
  const totalOutfitValue = enrichedGarments.reduce((s, g) => s + (g.estimatedRetailPrice || 0), 0);
  const luxuryItems = enrichedGarments.filter(g => g.isLuxury || g.luxuryAuth);
  const identifiedBrands = [...new Set(enrichedGarments.map(g => g.brand).filter(Boolean))];

  const outfitCard = {
    totalItems:      enrichedGarments.length,
    totalValue:      totalOutfitValue,
    luxuryItemCount: luxuryItems.length,
    brands:          identifiedBrands,
    summary:         `${enrichedGarments.length}-piece outfit — ${
      identifiedBrands.length > 0
        ? identifiedBrands.slice(0, 3).join(', ')
        : 'mixed brands'
    } — estimated retail $${totalOutfitValue.toFixed(0)}`,
    shareText:       `Scanned my outfit with TagnetIQ Oracle 🔮\n${enrichedGarments.length} items identified · $${totalOutfitValue.toFixed(0)} total value\n${identifiedBrands.slice(0,2).join(' + ')} · tagnetiq.com`,
    generatedAt:     new Date().toISOString(),
  };

  return res.status(200).json({
    success: true,
    garments: enrichedGarments,
    outfitCard,
    itemCount: enrichedGarments.length,
  });
}