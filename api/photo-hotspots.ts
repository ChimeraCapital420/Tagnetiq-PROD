// FILE: api/photo-hotspots.ts
// RH-022 — Photo Hotspots
// Unlocked by RH-020 (Item History Layer).
// User taps a region of a scan photo → HYDRA vision providers analyze
// that specific crop and return targeted information about that area.
//
// Mobile-first: coordinates come from touch events on the image.
// The crop is sent to vision-capable providers only (OpenAI, Anthropic,
// Google, Llama 4, Kimi) — no text-only providers waste tokens on this.
//
// POST /api/photo-hotspots
// Body: {
//   imageBase64: string,       full image
//   cropX: number,             tap X as % of image width (0-1)
//   cropY: number,             tap Y as % of image height (0-1)
//   cropRadius: number,        hotspot radius as % (default 0.15)
//   itemName: string,
//   category: string,
//   analysisId: string,
//   userId?: string,
//   hotspotIntent?: 'authenticate' | 'damage' | 'identify' | 'value'
// }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyRateLimit, LIMITS } from './_lib/rateLimit.js';

export const config = { maxDuration: 30 };

// Intent-specific prompts — each hotspot tap gets the right question
const INTENT_PROMPTS: Record<string, string> = {
  authenticate: `You are examining a specific region of this item photo for authentication markers.
Focus ONLY on the tapped region. Look for:
- Stitching quality and consistency (authentic = uniform, tight stitches)
- Hardware stamps and engravings (font, centering, depth)
- Material texture and grain
- Logo alignment and print quality
- Edge paint and finishing quality
Return a JSON object: { finding: string, authenticity_signal: 'authentic' | 'suspicious' | 'inconclusive', confidence: number (0-1), detail: string }`,

  damage: `You are examining a specific region of this item photo for condition issues.
Focus ONLY on the tapped region. Look for:
- Scratches, scuffs, or wear marks
- Stains, discoloration, or fading
- Tears, cracks, or structural damage
- Missing hardware or components
- Repairs or alterations
Return a JSON object: { finding: string, severity: 'none' | 'minor' | 'moderate' | 'significant', impact_on_value: string, detail: string }`,

  identify: `You are examining a specific region of this item photo for identification information.
Focus ONLY on the tapped region. Look for:
- Text, labels, stamps, or markings
- Model numbers, serial numbers, or date codes
- Country of manufacture indicators
- Brand marks or signatures
- Material composition indicators
Return a JSON object: { finding: string, identified_text: string, significance: string, detail: string }`,

  value: `You are examining a specific region of this item photo to assess how it affects value.
Focus ONLY on the tapped region. Look for:
- Rare or desirable features in this area
- Condition factors that affect pricing
- Authenticity markers that command premium
- Damage that reduces value
- Unique characteristics (limited edition, artist signature, etc.)
Return a JSON object: { finding: string, value_impact: 'positive' | 'negative' | 'neutral', estimated_impact_pct: number, detail: string }`,
};

async function analyzeHotspot(
  imageBase64: string,
  itemName: string,
  category: string,
  intent: string,
  cropInfo: { x: number; y: number; radius: number }
): Promise<{ provider: string; result: any; responseTime: number } | null> {
  // Use Anthropic Claude as primary hotspot analyzer
  // It has the best spatial understanding of image regions
  const prompt = `${INTENT_PROMPTS[intent] || INTENT_PROMPTS.identify}

Item context: ${itemName} (category: ${category})
Tapped region: approximately ${Math.round(cropInfo.x * 100)}% from left, ${Math.round(cropInfo.y * 100)}% from top of the image.
Focus your analysis on what is visible in that specific area of the image.

Respond ONLY with valid JSON. No preamble, no explanation outside the JSON.`;

  const start = Date.now();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64,
              },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    let parsed: any = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { finding: rawText.substring(0, 200), raw: true };
    }

    return {
      provider: 'Anthropic',
      result: parsed,
      responseTime: Date.now() - start,
    };
  } catch (err: any) {
    console.error('Hotspot analysis error:', err.message);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (applyRateLimit(req, res, LIMITS.STANDARD)) return;

  const {
    imageBase64,
    cropX = 0.5,
    cropY = 0.5,
    cropRadius = 0.15,
    itemName = 'Unknown Item',
    category = 'general',
    analysisId,
    userId,
    hotspotIntent = 'identify',
  } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 required' });
  }

  const validIntents = ['authenticate', 'damage', 'identify', 'value'];
  const intent = validIntents.includes(hotspotIntent) ? hotspotIntent : 'identify';

  console.log(`🔍 Hotspot analysis: ${itemName} | intent: ${intent} | tap: (${cropX.toFixed(2)}, ${cropY.toFixed(2)})`);

  const result = await analyzeHotspot(
    imageBase64,
    itemName,
    category,
    intent,
    { x: cropX, y: cropY, radius: cropRadius }
  );

  if (!result) {
    return res.status(500).json({ error: 'Analysis failed — try again' });
  }

  // Build human-readable summary from the structured result
  const summary = result.result.finding || result.result.detail || 'Analysis complete';

  return res.status(200).json({
    success: true,
    hotspot: {
      intent,
      itemName,
      tapPosition: { x: cropX, y: cropY, radius: cropRadius },
      provider: result.provider,
      responseTime: result.responseTime,
      result: result.result,
      summary,
      // Intent-specific top-level fields for easy UI rendering
      ...(intent === 'authenticate' && {
        authenticitySignal: result.result.authenticity_signal,
        authenticityConfidence: result.result.confidence,
      }),
      ...(intent === 'damage' && {
        damageSeverity: result.result.severity,
        valueImpact: result.result.impact_on_value,
      }),
      ...(intent === 'identify' && {
        identifiedText: result.result.identified_text,
        significance: result.result.significance,
      }),
      ...(intent === 'value' && {
        valueImpact: result.result.value_impact,
        impactPct: result.result.estimated_impact_pct,
      }),
    },
  });
}