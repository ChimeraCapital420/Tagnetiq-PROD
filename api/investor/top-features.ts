// FILE: api/investor/top-features.ts
// Top Feature Requests API - Analyzes feedback to identify popular requests
// Mobile-first: Cached responses, graceful fallbacks

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// In-memory cache to reduce API costs
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

interface FeedbackItem {
  id: number;
  content: string;
}

// Demo feature requests for when no real data exists
const DEMO_FEATURES: FeatureRequest[] = [
  { feature: 'Dark Mode', count: 24, category: 'UI/UX' },
  { feature: 'Bulk Scanning', count: 18, category: 'Core Feature' },
  { feature: 'Price Alerts', count: 15, category: 'Notifications' },
  { feature: 'Collection Export', count: 12, category: 'Data' },
  { feature: 'Social Sharing', count: 9, category: 'Social' },
];

async function analyzeTopFeaturesWithAI(feedbackItems: FeedbackItem[]): Promise<FeatureRequest[]> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY not set, using keyword extraction fallback');
    return extractFeaturesFromKeywords(feedbackItems);
  }

  const batchContent = feedbackItems.map(f => `[${f.id}] ${f.content}`).join('\n');

  const systemPrompt = `You are a product manager AI. Analyze the following user feedback. Identify the top 3-5 most frequently requested features or improvements. Group similar requests under a single category. Return ONLY a valid JSON array of objects, each with a "feature" name and a "count" number. Example: [{"feature":"Dark Mode","count":5},{"feature":"More Integrations","count":3}]`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: batchContent }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Anthropic API Error:', errorBody);
      throw new Error('AI analysis failed');
    }

    const result = await response.json();
    const jsonText = result.content[0].text;

    // Parse JSON, handling potential markdown formatting
    const cleanJson = jsonText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson);

  } catch (error) {
    console.error('AI feature analysis failed:', error);
    return extractFeaturesFromKeywords(feedbackItems);
  }
}

function extractFeaturesFromKeywords(feedbackItems: FeedbackItem[]): FeatureRequest[] {
  // Simple keyword-based feature extraction
  const featureKeywords: Record<string, string[]> = {
    'Dark Mode': ['dark mode', 'dark theme', 'night mode', 'theme'],
    'Bulk Operations': ['bulk', 'batch', 'multiple', 'mass'],
    'Price Alerts': ['alert', 'notification', 'notify', 'price change'],
    'Better Search': ['search', 'find', 'filter', 'sort'],
    'Mobile App': ['mobile', 'app', 'ios', 'android', 'phone'],
    'Export Data': ['export', 'download', 'csv', 'backup'],
    'Social Features': ['share', 'social', 'friend', 'community'],
    'Faster Performance': ['slow', 'fast', 'speed', 'performance', 'loading'],
  };

  const counts: Record<string, number> = {};

  feedbackItems.forEach(item => {
    const lower = item.content.toLowerCase();
    Object.entries(featureKeywords).forEach(([feature, keywords]) => {
      if (keywords.some(kw => lower.includes(kw))) {
        counts[feature] = (counts[feature] || 0) + 1;
      }
    });
  });

  return Object.entries(counts)
    .map(([feature, count]) => ({ feature, count }))
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
    let feedbackItems: FeedbackItem[] = [];

    // Try to fetch feedback from database
    if (supabaseUrl && supabaseServiceKey) {
      // Try 'feedback' table first
      const { data: feedback, error: feedbackError } = await supabase
        .from('feedback')
        .select('id, content')
        .not('content', 'is', null)
        .limit(200);

      if (!feedbackError && feedback && feedback.length > 0) {
        feedbackItems = feedback;
      } else {
        // Try 'user_feedback' table as fallback
        const { data: userFeedback } = await supabase
          .from('user_feedback')
          .select('id, content, message')
          .limit(200);

        if (userFeedback && userFeedback.length > 0) {
          feedbackItems = userFeedback.map(f => ({
            id: f.id,
            content: f.content || f.message || '',
          })).filter(f => f.content.length > 0);
        }
      }
    }

    // If not enough feedback, return demo data
    if (feedbackItems.length < 3) {
      featuresCache = { data: DEMO_FEATURES, timestamp: Date.now() };
      res.setHeader('X-Cache', 'DEMO');
      return res.status(200).json(DEMO_FEATURES);
    }

    // Analyze features
    const topFeatures = await analyzeTopFeaturesWithAI(feedbackItems);

    // Cache the results
    const features = topFeatures.length > 0 ? topFeatures : DEMO_FEATURES;
    featuresCache = { data: features, timestamp: Date.now() };

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');

    return res.status(200).json(features);

  } catch (error) {
    console.error('Error in top features handler:', error);

    // Return demo data on error instead of failing
    return res.status(200).json(DEMO_FEATURES);
  }
}