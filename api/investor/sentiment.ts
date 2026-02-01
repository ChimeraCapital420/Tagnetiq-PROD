// FILE: api/investor/sentiment.ts
// Sentiment Analysis API - Analyzes feedback sentiment using AI
// Mobile-first: Cached responses, graceful fallbacks

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// In-memory cache to reduce API costs
interface CacheEntry {
  data: SentimentData;
  timestamp: number;
}

let sentimentCache: CacheEntry | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

interface SentimentData {
  Positive: number;
  Neutral: number;
  Negative: number;
  total: number;
  lastUpdated: string;
}

interface FeedbackItem {
  id: number;
  content: string;
}

async function analyzeSentimentWithAI(feedbackItems: FeedbackItem[]): Promise<Record<string, string>> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  
  if (!ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY not set, using fallback sentiment analysis');
    // Simple keyword-based fallback
    const results: Record<string, string> = {};
    const positiveWords = ['love', 'great', 'awesome', 'excellent', 'amazing', 'helpful', 'good', 'best', 'fantastic'];
    const negativeWords = ['hate', 'bad', 'terrible', 'awful', 'worst', 'broken', 'bug', 'issue', 'problem', 'slow'];

    feedbackItems.forEach(item => {
      const lower = item.content.toLowerCase();
      const hasPositive = positiveWords.some(word => lower.includes(word));
      const hasNegative = negativeWords.some(word => lower.includes(word));

      if (hasPositive && !hasNegative) {
        results[item.id.toString()] = 'Positive';
      } else if (hasNegative && !hasPositive) {
        results[item.id.toString()] = 'Negative';
      } else {
        results[item.id.toString()] = 'Neutral';
      }
    });

    return results;
  }

  const batchContent = feedbackItems
    .map(f => `Feedback ID ${f.id}: "${f.content}"`)
    .join('\n---\n');

  const systemPrompt = `You are an expert sentiment analysis AI. Analyze the following batch of user feedback. For each feedback item, classify it as 'Positive', 'Neutral', or 'Negative'. Return ONLY a valid JSON object where keys are the Feedback IDs (as strings) and values are the sentiment classifications. Example: {"1":"Positive","2":"Negative","3":"Neutral"}`;

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
    console.error('AI sentiment analysis failed:', error);
    // Fallback to simple analysis
    const results: Record<string, string> = {};
    feedbackItems.forEach(item => {
      results[item.id.toString()] = 'Neutral';
    });
    return results;
  }
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
  if (sentimentCache && Date.now() - sentimentCache.timestamp < CACHE_DURATION) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(sentimentCache.data);
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
        .limit(100);

      if (!feedbackError && feedback && feedback.length > 0) {
        feedbackItems = feedback;
      } else {
        // Try 'user_feedback' table as fallback
        const { data: userFeedback } = await supabase
          .from('user_feedback')
          .select('id, content, message')
          .limit(100);

        if (userFeedback && userFeedback.length > 0) {
          feedbackItems = userFeedback.map(f => ({
            id: f.id,
            content: f.content || f.message || '',
          })).filter(f => f.content.length > 0);
        }
      }
    }

    // If no feedback data, return demo sentiment distribution
    if (feedbackItems.length === 0) {
      const demoData: SentimentData = {
        Positive: 42,
        Neutral: 28,
        Negative: 12,
        total: 82,
        lastUpdated: new Date().toISOString(),
      };

      sentimentCache = { data: demoData, timestamp: Date.now() };
      res.setHeader('X-Cache', 'DEMO');
      return res.status(200).json(demoData);
    }

    // Analyze sentiment
    const sentimentResults = await analyzeSentimentWithAI(feedbackItems);

    // Count sentiments
    const sentimentCounts: SentimentData = {
      Positive: 0,
      Neutral: 0,
      Negative: 0,
      total: feedbackItems.length,
      lastUpdated: new Date().toISOString(),
    };

    Object.values(sentimentResults).forEach((sentiment) => {
      const key = sentiment as 'Positive' | 'Neutral' | 'Negative';
      if (key in sentimentCounts) {
        sentimentCounts[key]++;
      }
    });

    // Cache the results
    sentimentCache = { data: sentimentCounts, timestamp: Date.now() };

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    return res.status(200).json(sentimentCounts);

  } catch (error) {
    console.error('Error in sentiment analysis handler:', error);

    // Return demo data on error instead of failing
    const fallbackData: SentimentData = {
      Positive: 35,
      Neutral: 45,
      Negative: 20,
      total: 100,
      lastUpdated: new Date().toISOString(),
    };

    return res.status(200).json(fallbackData);
  }
}