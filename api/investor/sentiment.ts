// FILE: api/investor/sentiment.ts
// Sentiment Analysis API - REAL DATA ONLY
// Table: feedback (2 rows)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Cache to reduce API costs
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
  source: 'database' | 'no_data';
  note?: string;
}

// Simple keyword-based sentiment (no AI dependency)
function analyzeSentiment(text: string): 'Positive' | 'Neutral' | 'Negative' {
  const lower = text.toLowerCase();
  
  const positiveWords = [
    'love', 'great', 'awesome', 'excellent', 'amazing', 'helpful', 
    'good', 'best', 'fantastic', 'perfect', 'nice', 'thanks', 
    'wonderful', 'impressed', 'easy', 'useful', 'recommend'
  ];
  const negativeWords = [
    'hate', 'bad', 'terrible', 'awful', 'worst', 'broken', 
    'bug', 'issue', 'problem', 'slow', 'crash', 'error',
    'frustrating', 'annoying', 'difficult', 'confusing', 'wrong'
  ];

  const positiveCount = positiveWords.filter(word => lower.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lower.includes(word)).length;

  if (positiveCount > negativeCount) return 'Positive';
  if (negativeCount > positiveCount) return 'Negative';
  return 'Neutral';
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
    // Fetch feedback from database
    const { data: feedback, error } = await supabase
      .from('feedback')
      .select('*')
      .limit(100);

    if (error) {
      console.error('Error fetching feedback:', error);
    }

    // If no feedback data, return honest zero state
    if (!feedback || feedback.length === 0) {
      const noData: SentimentData = {
        Positive: 0,
        Neutral: 0,
        Negative: 0,
        total: 0,
        lastUpdated: new Date().toISOString(),
        source: 'no_data',
        note: 'No feedback has been submitted yet'
      };

      sentimentCache = { data: noData, timestamp: Date.now() };
      res.setHeader('X-Cache', 'MISS');
      return res.status(200).json(noData);
    }

    // Analyze real feedback
    const sentimentCounts: SentimentData = {
      Positive: 0,
      Neutral: 0,
      Negative: 0,
      total: feedback.length,
      lastUpdated: new Date().toISOString(),
      source: 'database',
      note: `Based on ${feedback.length} feedback submission${feedback.length !== 1 ? 's' : ''}`
    };

    feedback.forEach(item => {
      // Try different possible field names for feedback content
      const content = item.content || item.message || item.text || item.feedback || '';
      if (content) {
        const sentiment = analyzeSentiment(content);
        sentimentCounts[sentiment]++;
      } else {
        sentimentCounts.Neutral++;
      }
    });

    // Cache the results
    sentimentCache = { data: sentimentCounts, timestamp: Date.now() };

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    return res.status(200).json(sentimentCounts);

  } catch (error) {
    console.error('Error in sentiment analysis:', error);

    // Return honest error state
    return res.status(200).json({
      Positive: 0,
      Neutral: 0,
      Negative: 0,
      total: 0,
      lastUpdated: new Date().toISOString(),
      source: 'no_data',
      note: 'Error fetching feedback data'
    });
  }
}