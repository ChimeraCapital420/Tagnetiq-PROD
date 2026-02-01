// FILE: api/investor/top-features.ts
// Top Feature Requests API - REAL DATA ONLY
// Table: feedback (2 rows)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Cache to reduce computation
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

// Feature keywords to look for in feedback
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
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check cache first
  if (featuresCache && Date.now() - featuresCache.timestamp < CACHE_DURATION) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(featuresCache.data);
  }

  try {
    // Fetch feedback from database
    const { data: feedback, error } = await supabase
      .from('feedback')
      .select('*')
      .limit(200);

    if (error) {
      console.error('Error fetching feedback:', error);
    }

    // If no feedback, return honest empty state
    if (!feedback || feedback.length === 0) {
      featuresCache = { data: [], timestamp: Date.now() };
      res.setHeader('X-Cache', 'MISS');
      // Return empty array (frontend expects array for .map())
      return res.status(200).json([]);
    }

    // Extract text content from feedback
    const texts = feedback
      .map(f => f.content || f.message || f.text || f.feedback || '')
      .filter(t => t.length > 0);

    if (texts.length === 0) {
      featuresCache = { data: [], timestamp: Date.now() };
      // Return empty array
      return res.status(200).json([]);
    }

    // Extract features from feedback text
    const features = extractFeaturesFromText(texts);

    // Cache the results (store array directly)
    featuresCache = { data: features, timestamp: Date.now() };

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');

    // Return array directly (frontend expects array for .map())
    return res.status(200).json(features);

  } catch (error) {
    console.error('Error in top features handler:', error);
    // Return empty array on error
    return res.status(200).json([]);
  }
}