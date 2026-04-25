// FILE: api/fine-art.ts
// RH-018 — Fine Art Authentication
// HYDRA vision + art authority databases → authentication + valuation.
// B2B target: appraisers, estate attorneys, insurance adjusters.
// Global art market: $65B. Insurance documentation niche: $2B+.
// B2B pricing: $200–$500 per authentication report.
//
// POST /api/fine-art
// Body: { imageBase64, imageBase64Back?, artistName?, title?, medium?, userId }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyRateLimit, LIMITS } from './_lib/rateLimit.js';

export const config = { maxDuration: 45 };

const ART_ANALYSIS_PROMPT = `You are an expert fine art authenticator, appraiser, and art historian.
Analyze this artwork image comprehensively and return a JSON object with:
{
  "artist_likely": string (most likely artist or "Unknown"),
  "artist_confidence": number (0-1),
  "period_style": string (art movement/period: Impressionist, Abstract Expressionism, etc.),
  "estimated_date": string (e.g., "circa 1920-1940" or specific year if detectable),
  "medium": string (oil on canvas, watercolor, print, sculpture, etc.),
  "subject": string (what is depicted),
  "dimensions_visible": boolean,
  "signature_present": boolean,
  "signature_location": string (if present: bottom right, bottom left, verso, etc.),
  "signature_readable": string (what the signature appears to read, or null),
  "condition_assessment": string (excellent | very good | good | fair | poor),
  "condition_notes": string (specific condition observations),
  "authenticity_indicators": string[] (positive markers: provenance labels, canvas stamps, gallery stickers, etc.),
  "red_flags": string[] (concerns: inconsistencies, anachronistic materials, etc.),
  "authentication_confidence": number (0-1),
  "estimated_value_range": { "low": number, "high": number, "currency": "USD" },
  "comparable_sales": string (description of comparable sales if known),
  "recommended_next_steps": string[] (what to do to formally authenticate and appraise),
  "authority_resources": string[] (relevant auction houses, databases, registries to check),
  "notes": string
}

Be honest about uncertainty. Authentication requires physical examination — this is a preliminary AI assessment only.
Respond ONLY with valid JSON.`;

async function analyzeArtwork(
  imageBase64: string,
  imageBase64Back?: string,
  artistName?: string,
  title?: string,
  medium?: string
): Promise<any> {
  const contextClues = [
    artistName ? `Known artist: ${artistName}` : '',
    title ? `Known title: ${title}` : '',
    medium ? `Known medium: ${medium}` : '',
  ].filter(Boolean).join('. ');

  const prompt = contextClues
    ? `${ART_ANALYSIS_PROMPT}\n\nAdditional context provided: ${contextClues}`
    : ART_ANALYSIS_PROMPT;

  const content: any[] = [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
  ];

  if (imageBase64Back) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64Back },
    });
    content.push({ type: 'text', text: 'The second image shows the verso (back) of the artwork.' });
  }

  content.push({ type: 'text', text: prompt });

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
        messages: [{ role: 'user', content }],
      }),
    });

    const data = await res.json();
    const rawText = data.content?.[0]?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch { return null; }
}

function buildArtResources(artistName?: string) {
  const artist = artistName || '';
  const encoded = encodeURIComponent(artist);
  return {
    askArt: `https://www.askart.com/Price_Artwork/Price_Artwork.aspx?searchtype=QUICK&artist=${encoded}`,
    artnet: `https://www.artnet.com/artists/${encoded.toLowerCase().replace(/%20/g, '-')}/`,
    christies: `https://www.christies.com/en/results?term=${encoded}&section=&action=paging&year_from=&year_to=&currency=USD`,
    sothebys: `https://www.sothebys.com/en/results?from=&to=&f8=&q=${encoded}`,
    invaluable: `https://www.invaluable.com/search/?query=${encoded}&categoryName=Paintings&countryOrigin=`,
    liveauctioneers: `https://www.liveauctioneers.com/search/?keyword=${encoded}`,
    askartSignatureSearch: artist ? `https://www.askart.com/Signature_Artwork/index.aspx?searchtype=QUICK&artist=${encoded}` : null,
    artLoss: 'https://www.artloss.com/en/search', // Always check stolen art registry
    ifar: 'https://www.ifar.org/', // International Foundation for Art Research
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (applyRateLimit(req, res, LIMITS.STANDARD)) return;

  const { imageBase64, imageBase64Back, artistName, title, medium, userId } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 required' });
  }

  console.log(`🎨 Fine Art: artist="${artistName || 'unknown'}" title="${title || 'unknown'}"`);

  const analysis = await analyzeArtwork(imageBase64, imageBase64Back, artistName, title, medium);

  if (!analysis) {
    return res.status(500).json({ error: 'Analysis failed — try again with a clearer image' });
  }

  const resources = buildArtResources(artistName || analysis.artist_likely);

  return res.status(200).json({
    success: true,
    artwork: {
      ...analysis,
      authorityResources: resources,
      disclaimer: 'This is a preliminary AI assessment only. Fine art authentication requires physical examination by a qualified appraiser. Always verify with recognized auction house specialists, the artist\'s catalogue raisonné, and provenance documentation. Check the Art Loss Register before any transaction.',
      reportType: 'preliminary_ai_assessment',
      reportVersion: '1.0',
      generatedAt: new Date().toISOString(),
    },
  });
}