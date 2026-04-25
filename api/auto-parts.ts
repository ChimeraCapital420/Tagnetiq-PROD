// FILE: api/auto-parts.ts
// RH-017 — Auto Parts ID
// NHTSA VIN decoder already integrated in HYDRA.
// This extends it: scan a part → identify it → find compatible vehicles
// → route to salvage yards, RockAuto, eBay Motors.
// $25B market. Zero AI tooling currently exists for this.
//
// POST /api/auto-parts
// Body: { imageBase64?, partNumber?, vehicleVin?, itemName?, userId }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyRateLimit, LIMITS } from './_lib/rateLimit.js';

export const config = { maxDuration: 45 };

async function lookupNHTSA(vin: string) {
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`
    );
    const data = await res.json();
    const r = data?.Results?.[0];
    if (!r) return null;
    return {
      make:         r.Make,
      model:        r.Model,
      year:         r.ModelYear,
      trim:         r.Trim,
      engineSize:   r.DisplacementL,
      fuelType:     r.FuelTypePrimary,
      driveType:    r.DriveType,
      bodyClass:    r.BodyClass,
    };
  } catch { return null; }
}

async function identifyPart(
  itemName: string,
  imageBase64?: string,
  vehicleInfo?: any
): Promise<any> {
  const vehicleContext = vehicleInfo
    ? `Vehicle: ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.trim || ''}`
    : '';

  const prompt = `You are an expert auto parts identifier with knowledge of OEM and aftermarket parts.

${vehicleContext}
Part description: ${itemName}

Identify this auto part and return a JSON object with:
{
  "partName": string,
  "partCategory": string (engine | transmission | suspension | brakes | electrical | body | interior | exhaust | cooling | fuel),
  "oem_part_numbers": string[] (likely OEM part numbers if identifiable),
  "compatible_vehicles": string[] (list of likely compatible makes/models/years),
  "condition_factors": string[] (what to inspect to assess condition),
  "estimated_value_new": number (USD, new OEM price),
  "estimated_value_used_good": number (USD, used good condition),
  "where_to_sell": string[] (best platforms for this part type),
  "search_terms": string[] (best eBay/RockAuto search terms),
  "notes": string
}

Respond ONLY with valid JSON.`;

  try {
    const messages: any[] = [];

    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: prompt },
        ],
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages,
      }),
    });

    const data = await res.json();
    const rawText = data.content?.[0]?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch { return null; }
}

function buildPartLinks(partInfo: any, vehicleInfo: any) {
  const query = partInfo?.search_terms?.[0]
    || `${partInfo?.partName} ${vehicleInfo?.year || ''} ${vehicleInfo?.make || ''}`.trim();

  const encodedQuery = encodeURIComponent(query);
  const oemPartNum = partInfo?.oem_part_numbers?.[0];

  return {
    ebayMotors: `https://www.ebay.com/sch/6028/i.html?_nkw=${encodedQuery}&LH_Complete=1&LH_Sold=1`,
    ebayActive: `https://www.ebay.com/sch/6028/i.html?_nkw=${encodedQuery}`,
    rockAuto: oemPartNum
      ? `https://www.rockauto.com/en/partsearch/?partnum=${encodeURIComponent(oemPartNum)}`
      : `https://www.rockauto.com/en/catalog/${vehicleInfo?.make?.toLowerCase() || ''}`,
    car_part: `https://www.car-part.com/cgi-bin/search.cgi?q=${encodedQuery}`,
    lkqOnline: `https://www.lkqonline.com/search?q=${encodedQuery}`,
    craigslist: `https://www.craigslist.org/search/apa?query=${encodedQuery}`,
    facebook: `https://www.facebook.com/marketplace/search/?query=${encodedQuery}&categoryId=807311116002614`,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (applyRateLimit(req, res, LIMITS.STANDARD)) return;

  const { imageBase64, partNumber, vehicleVin, itemName = '', userId } = req.body;

  if (!imageBase64 && !itemName && !partNumber) {
    return res.status(400).json({ error: 'Provide imageBase64, itemName, or partNumber' });
  }

  console.log(`🔧 Auto Parts: "${itemName}" | VIN: ${vehicleVin || 'none'} | Part#: ${partNumber || 'none'}`);

  // Parallel: NHTSA lookup + AI part identification
  const [vehicleInfo, partInfo] = await Promise.all([
    vehicleVin ? lookupNHTSA(vehicleVin) : Promise.resolve(null),
    identifyPart(partNumber ? `Part number: ${partNumber} — ${itemName}` : itemName, imageBase64, null),
  ]);

  if (!partInfo) {
    return res.status(500).json({ error: 'Could not identify part — try adding a description' });
  }

  const purchaseLinks = buildPartLinks(partInfo, vehicleInfo);

  return res.status(200).json({
    success: true,
    autopart: {
      ...partInfo,
      vehicleInfo,
      purchaseLinks,
      disclaimer: 'Always verify part compatibility with your specific vehicle before purchasing. Part numbers and compatibility are AI estimates — confirm with a qualified mechanic or parts specialist.',
    },
  });
}