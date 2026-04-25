// FILE: api/product-ownership.ts
// RH-023 — Product Ownership Hub
// Every scanned item gets a rich ownership record:
// manuals, consumables, tutorials, maintenance reminders, affiliate links.
// Unlocked by RH-028 Phase 1 (StyleScan brand router is the backbone).
//
// GET  /api/product-ownership?itemName=xxx&category=xxx
// POST /api/product-ownership { action: 'save', userId, analysisId, itemName, ... }
// POST /api/product-ownership { action: 'remind', userId, itemId, reminderType }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 30 };

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Category-specific consumable and maintenance data
const CONSUMABLE_MAP: Record<string, {
  consumables: { name: string; interval: string; affiliateQuery: string }[];
  maintenance: { task: string; intervalDays: number }[];
  manualSearch: string;
}> = {
  sneakers: {
    consumables: [
      { name: 'Sneaker cleaner', interval: 'Monthly', affiliateQuery: 'sneaker cleaning kit' },
      { name: 'Crep Protect spray', interval: 'Seasonal', affiliateQuery: 'crep protect sneaker spray' },
      { name: 'Replacement laces', interval: 'As needed', affiliateQuery: 'sneaker replacement laces' },
      { name: 'Toe box stuffers', interval: 'For storage', affiliateQuery: 'sneaker toe box stuffers' },
    ],
    maintenance: [
      { task: 'Clean uppers and sole', intervalDays: 14 },
      { task: 'Apply protector spray', intervalDays: 90 },
      { task: 'Check and replace laces', intervalDays: 180 },
    ],
    manualSearch: 'sneaker care guide',
  },
  handbags: {
    consumables: [
      { name: 'Leather conditioner', interval: 'Every 3 months', affiliateQuery: 'leather conditioner handbag' },
      { name: 'Leather cleaner', interval: 'Monthly', affiliateQuery: 'leather cleaner luxury bag' },
      { name: 'Dust bag', interval: 'For storage', affiliateQuery: 'dust bag luxury handbag storage' },
      { name: 'Brass hardware polish', interval: 'Quarterly', affiliateQuery: 'brass polish metal cleaner' },
    ],
    maintenance: [
      { task: 'Wipe down with clean cloth', intervalDays: 7 },
      { task: 'Apply leather conditioner', intervalDays: 90 },
      { task: 'Polish hardware', intervalDays: 120 },
      { task: 'Professional cleaning', intervalDays: 365 },
    ],
    manualSearch: 'leather handbag care guide',
  },
  watches: {
    consumables: [
      { name: 'Watch cleaning cloth', interval: 'Ongoing', affiliateQuery: 'watch cleaning cloth microfiber' },
      { name: 'Watch winder', interval: 'One time', affiliateQuery: 'automatic watch winder' },
      { name: 'Watch band replacement', interval: 'Annual', affiliateQuery: 'watch band replacement' },
      { name: 'Watch cleaning solution', interval: 'Monthly', affiliateQuery: 'watch cleaning kit solution' },
    ],
    maintenance: [
      { task: 'Wipe case and bracelet', intervalDays: 7 },
      { task: 'Professional service', intervalDays: 1825 }, // 5 years
      { task: 'Battery replacement (quartz)', intervalDays: 730 },
    ],
    manualSearch: 'watch servicing guide',
  },
  electronics: {
    consumables: [
      { name: 'Screen protector', interval: 'As needed', affiliateQuery: 'screen protector replacement' },
      { name: 'Cleaning kit', interval: 'Monthly', affiliateQuery: 'electronics cleaning kit' },
      { name: 'Replacement cables', interval: 'As needed', affiliateQuery: 'charging cable replacement' },
    ],
    maintenance: [
      { task: 'Clean ports and surfaces', intervalDays: 30 },
      { task: 'Check for software updates', intervalDays: 7 },
      { task: 'Battery health check', intervalDays: 180 },
    ],
    manualSearch: 'electronics care maintenance',
  },
  coins: {
    consumables: [
      { name: 'Coin sleeves (mylar)', interval: 'For storage', affiliateQuery: 'coin sleeves mylar holders' },
      { name: 'Coin albums', interval: 'For collection', affiliateQuery: 'coin album collection binder' },
      { name: 'Cotton gloves', interval: 'Handling only', affiliateQuery: 'cotton gloves coin handling' },
    ],
    maintenance: [
      { task: 'Inspect for environmental damage', intervalDays: 90 },
      { task: 'Verify storage conditions', intervalDays: 180 },
    ],
    manualSearch: 'coin storage care guide numismatics',
  },
  general: {
    consumables: [
      { name: 'Storage materials', interval: 'As needed', affiliateQuery: 'storage organizer containers' },
      { name: 'Cleaning supplies', interval: 'Monthly', affiliateQuery: 'general cleaning kit supplies' },
    ],
    maintenance: [
      { task: 'Inspect item condition', intervalDays: 90 },
    ],
    manualSearch: 'item care storage guide',
  },
};

async function generateOwnershipData(
  itemName: string,
  category: string,
  brandName?: string
): Promise<any> {
  const categoryKey = Object.keys(CONSUMABLE_MAP).find(k =>
    category.toLowerCase().includes(k) || k === 'general'
  ) || 'general';

  const categoryData = CONSUMABLE_MAP[categoryKey];

  // Build affiliate URLs for consumables
  const consumablesWithLinks = categoryData.consumables.map(c => ({
    ...c,
    amazonUrl: `https://www.amazon.com/s?k=${encodeURIComponent(c.affiliateQuery)}`,
    ebayUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(c.affiliateQuery)}`,
  }));

  // Generate tutorial search URLs
  const tutorials = [
    {
      title: `How to care for ${brandName || 'your'} ${itemName}`,
      youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${brandName || ''} ${itemName} care maintenance guide`)}`,
      source: 'YouTube',
    },
    {
      title: `${itemName} authentication guide`,
      youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${brandName || ''} ${itemName} authentication real vs fake`)}`,
      source: 'YouTube',
    },
    {
      title: `How to maximize resale value`,
      youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${itemName} resale tips how to sell for most money`)}`,
      source: 'YouTube',
    },
  ];

  // Manual search
  const manualUrl = brandName
    ? `https://www.google.com/search?q=${encodeURIComponent(`${brandName} ${itemName} owner's manual care guide site:${brandName.toLowerCase().replace(/\s/g, '')}.com`)}`
    : `https://www.google.com/search?q=${encodeURIComponent(`${itemName} ${categoryData.manualSearch}`)}`;

  return {
    itemName,
    category: categoryKey,
    brandName: brandName || null,
    consumables: consumablesWithLinks,
    maintenance: categoryData.maintenance.map(m => ({
      ...m,
      nextDue: new Date(Date.now() + m.intervalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })),
    tutorials,
    manualUrl,
    generatedAt: new Date().toISOString(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { itemName, category, brandName } = req.query;
    if (!itemName || typeof itemName !== 'string') {
      return res.status(400).json({ error: 'itemName required' });
    }

    const data = await generateOwnershipData(
      itemName,
      (category as string) || 'general',
      brandName as string | undefined
    );
    return res.status(200).json({ success: true, ownership: data });
  }

  if (req.method === 'POST') {
    const { action, userId, analysisId, itemName, category, brandName, itemId, reminderType } = req.body;

    if (action === 'save') {
      if (!userId || !itemName) {
        return res.status(400).json({ error: 'userId and itemName required' });
      }

      const ownershipData = await generateOwnershipData(itemName, category || 'general', brandName);

      const { data, error } = await supabase
        .from('ownership_records')
        .upsert({
          user_id:     userId,
          analysis_id: analysisId || null,
          item_name:   itemName,
          category:    category || 'general',
          brand_name:  brandName || null,
          ownership_data: ownershipData,
          updated_at:  new Date().toISOString(),
        }, { onConflict: 'user_id,item_name' })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, record: data });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}