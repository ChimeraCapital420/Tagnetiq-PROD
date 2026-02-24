// FILE: api/investor/top-features.ts
// Top Feature Requests API - REAL DATA ONLY
// Table: feedback (2 rows)
//
// SECURITY: Dual-path auth (admin JWT or invite token)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin.js';
import { verifyInvestorAccess, setInvestorCORS } from '../_lib/investorAuth.js';

interface CacheEntry {
  data: FeatureRequest[];
  timestamp: number;
}

let featuresCache: CacheEntry | null = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

interface FeatureRequest {
  feature: string;
  count: number;
  category?: string;
}

const FEATURE_KEYWORDS: Record<string, { keywords: string[]; category: string }> = {
  'Dark Mode': { keywords: ['dark mode', 'dark theme', 'night mode', 'theme'], category: 'UI/UX' },
  'Bulk Operations': { keywords: ['bulk', 'batch', 'multiple', 'mass scan'], category: 'Core Feature' },
  'Price Alerts': { keywords: ['alert', 'notification', 'price change', 'notify'], category: 'Notifications' },
  'Better Search': { keywords: ['search', 'find', 'filter', 'sort'], category: 'Core Feature' },
  'Mobile App': { keywords: ['mobile', 'app', 'ios', 'android', 'phone'], category: 'Platform' },
  'Export Data': { keywords: ['export', 'download', 'csv', 'backup', 'report'], category: 'Data' },
  'Social Features': { keywords: ['share', 'social', 'friend', 'community', 'follow'], category: 'Social' },
  'Performance': { keywords: ['slow', 'fast', 'speed', 'loading', 'performance'], category: 'Technical' },
  'More Categories': { keywords: ['category', 'type', 'coin', 'card', 'sneaker'], category: 'Content' },
  'Better AI': { keywords: ['ai', 'accuracy', 'identification', 'recognize'], category: 'Core Feature' },
  'Price History': { keywords: ['history', 'trend', 'chart', 'graph', 'historical'], category: 'Data' },
  'Wishlist': { keywords: ['wishlist', 'want', 'wish', 'save', 'later'], category: 'Feature' },
};

function extractFeaturesFromText(texts: string[]): FeatureRequest[] {
  const counts: Record<string, { count: number; category: string }> = {};

  texts.forEach(text => {
    const lower = text.toLowerCase();
    Object.entries(FEATURE_KEYWORDS).forEach(([feature, { keywords, category }]) => {
      if (keywords.some(kw => lower.includes(kw))) {
        if (!counts[feature]) {
          counts[feature] = { count: 0, category };
        }
        counts[feature].count++;
      }
    });
  });

  return Object.entries(counts)
    .map(([feature, { count, category }]) => ({ feature, count, category }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setInvestorCORS(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyInvestorAccess(req);

    // Check cache first
    if (featuresCache && Date.now() - featuresCache.timestamp < CACHE_DURATION) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(featuresCache.data);
    }

    const { data: feedback, error } = await supaAdmin
      .from('feedback')
      .select('*')
      .limit(200);

    if (error) {
      console.error('Error fetching feedback:', error);
    }

    if (!feedback || feedback.length === 0) {
      featuresCache = { data: [], timestamp: Date.now() };
      res.setHeader('X-Cache', 'MISS');
      return res.status(200).json([]);
    }

    const texts = feedback
      .map(f => f.content || f.message || f.text || f.feedback || '')
      .filter(t => t.length > 0);

    if (texts.length === 0) {
      featuresCache = { data: [], timestamp: Date.now() };
      return res.status(200).json([]);
    }

    const features = extractFeaturesFromText(texts);

    featuresCache = { data: features, timestamp: Date.now() };

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');

    return res.status(200).json(features);

  } catch (error: any) {
    const msg = error.message || 'An unexpected error occurred.';
    if (msg.includes('Authentication') || msg.includes('Authorization')) {
      return res.status(401).json({ error: msg });
    }
    console.error('Error in top features handler:', msg);
    return res.status(200).json([]);
  }
}