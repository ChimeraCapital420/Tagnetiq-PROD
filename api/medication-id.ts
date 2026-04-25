// FILE: api/medication-id.ts
// RH-016 — Medication Identification
// FDA NDC + RxNorm + OpenFDA APIs (all free public APIs).
// 54 million unpaid caregivers in the US. Medication errors: 100K deaths/yr.
// CRITICAL: This is identification only. Never dosing advice. Legal disclaimer required.
//
// POST /api/medication-id
// Body: { imageBase64?, imprint?, shape?, color?, userId }
//
// Safe harbor: identification only. Direct to pharmacist for any medical question.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyRateLimit, LIMITS } from './_lib/rateLimit.js';

export const config = { maxDuration: 30 };

// FDA Pill Identifier API (free, public)
async function lookupFDAPill(
  imprint?: string,
  shape?: string,
  color?: string
): Promise<any[]> {
  if (!imprint && !shape && !color) return [];

  try {
    const params = new URLSearchParams();
    if (imprint) params.set('imprint', imprint);
    if (shape) params.set('shape', shape);
    if (color) params.set('color', color);
    params.set('pagesize', '5');

    const res = await fetch(
      `https://api.fda.gov/drug/ndc.json?search=product_ndc:*&limit=5`
    );
    // FDA pill ID is through DailyMed — use their API
    const dailyMedRes = await fetch(
      `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?${params.toString()}`
    );
    if (!dailyMedRes.ok) return [];
    const data = await dailyMedRes.json();
    return data?.data || [];
  } catch { return []; }
}

// OpenFDA drug lookup by name
async function lookupOpenFDA(drugName: string): Promise<any | null> {
  try {
    const encoded = encodeURIComponent(drugName);
    const res = await fetch(
      `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encoded}"&limit=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.results?.[0];
    if (!result) return null;

    return {
      brandName:      result.openfda?.brand_name?.[0],
      genericName:    result.openfda?.generic_name?.[0],
      manufacturer:   result.openfda?.manufacturer_name?.[0],
      route:          result.openfda?.route?.[0],
      dosageForm:     result.openfda?.dosage_form?.[0],
      warnings:       result.warnings?.[0]?.substring(0, 300),
      purpose:        result.purpose?.[0]?.substring(0, 200),
      activeIngredients: result.active_ingredient?.[0]?.substring(0, 200),
    };
  } catch { return null; }
}

// AI vision identification for imprint/markings on pill
async function identifyMedicationByImage(
  imageBase64: string
): Promise<any | null> {
  const prompt = `You are helping identify a medication for safety purposes only — NOT for medical advice or dosing.

Look at this pill/medication image and identify:
1. The imprint text (any letters, numbers, or symbols stamped on the pill)
2. The shape (round, oval, capsule, square, etc.)
3. The color(s)
4. Any score lines or other markings

Return ONLY a JSON object:
{
  "imprint": string (the text stamped on the pill, or null),
  "shape": string,
  "color": string,
  "additional_markings": string,
  "identification_confidence": number (0-1),
  "likely_medication": string (your best guess at what this medication is, or null if cannot determine),
  "notes": string
}

IMPORTANT: You are identifying what the pill looks like, not providing medical advice.
If you cannot clearly see the pill or identify it, say so honestly.
Respond ONLY with valid JSON.`;

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
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    const data = await res.json();
    const rawText = data.content?.[0]?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (applyRateLimit(req, res, LIMITS.STANDARD)) return;

  const { imageBase64, imprint, shape, color, userId } = req.body;

  if (!imageBase64 && !imprint) {
    return res.status(400).json({ error: 'Provide imageBase64 or imprint text' });
  }

  console.log(`💊 Medication ID: imprint="${imprint || 'from image'}" shape="${shape || 'unknown'}"`);

  // Parallel: image analysis + FDA lookup if imprint provided
  const [visionResult, fdaResult] = await Promise.all([
    imageBase64 ? identifyMedicationByImage(imageBase64) : Promise.resolve(null),
    imprint ? lookupOpenFDA(imprint) : Promise.resolve(null),
  ]);

  // If vision found an imprint, use it to look up FDA
  let fdaEnhanced = fdaResult;
  if (!fdaEnhanced && visionResult?.likely_medication) {
    fdaEnhanced = await lookupOpenFDA(visionResult.likely_medication);
  }

  return res.status(200).json({
    success: true,
    medication: {
      visualIdentification: visionResult,
      fdaData: fdaEnhanced,
      imprint:     visionResult?.imprint || imprint || null,
      shape:       visionResult?.shape || shape || null,
      color:       visionResult?.color || color || null,
      likelyName:  fdaEnhanced?.brandName || fdaEnhanced?.genericName || visionResult?.likely_medication || null,
      // External pill identifier links — always provide these
      pillIdentifierLinks: {
        drugs_com: imprint
          ? `https://www.drugs.com/imprints.php?imprint=${encodeURIComponent(imprint)}&color=&shape=`
          : 'https://www.drugs.com/pill_identification.html',
        webmd: 'https://www.webmd.com/pill-identification/default.htm',
        rxlist: 'https://www.rxlist.com/pill-identification-tool/article.htm',
        dailymed: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm',
      },
    },
    // LEGAL DISCLAIMER — always included, always prominent
    disclaimer: {
      text: 'This tool is for IDENTIFICATION PURPOSES ONLY. It does not provide medical advice, dosing information, or treatment recommendations. Never take medication based solely on this identification. Always consult a licensed pharmacist or physician before taking any medication. In an emergency, call 911 or Poison Control (1-800-222-1222).',
      emergency: '911',
      poisonControl: '1-800-222-1222',
      pharmacistFinder: 'https://www.pharmacychecker.com/',
    },
  });
}