// FILE: api/investor/sentiment.ts (CREATE THIS NEW FILE)

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- This is a simplified, in-memory cache for this example ---
// In production, you might use a more persistent cache like Redis or a dedicated table.
let sentimentCache = {
  data: null as any,
  timestamp: 0,
};
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Function to perform sentiment analysis using Anthropic's Claude
async function getSentimentAnalysis(feedbackItems: { id: number; content: string }[]) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  // Prepare a batch of feedback content for the AI
  const batchContent = feedbackItems.map(f => `Feedback ID ${f.id}: "${f.content}"`).join('\n---\n');

  const systemPrompt = `You are an expert sentiment analysis AI. Analyze the following batch of user feedback. For each feedback item, classify it as 'Positive', 'Neutral', or 'Negative'. Return ONLY a JSON object where keys are the Feedback IDs and values are the sentiment classifications. Example: {"1":"Positive","2":"Negative","3":"Neutral"}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307", // Using the fast and cost-effective model
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: batchContent }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Anthropic API Error:", errorBody);
    throw new Error('Failed to get sentiment analysis from Anthropic API.');
  }

  const result = await response.json();
  const sentimentJsonText = result.content[0].text;
  
  return JSON.parse(sentimentJsonText);
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
  // --- Check Cache ---
  if (Date.now() - sentimentCache.timestamp < CACHE_DURATION && sentimentCache.data) {
    return res.status(200).json(sentimentCache.data);
  }

  try {
    const { data: feedback, error } = await supaAdmin
      .from('feedback')
      .select('id, content');

    if (error) throw error;
    if (!feedback || feedback.length === 0) {
      return res.status(200).json({ Positive: 0, Neutral: 0, Negative: 0 });
    }

    const sentimentResults = await getSentimentAnalysis(feedback);
    
    // Aggregate the results
    const sentimentCounts = {
        Positive: 0,
        Neutral: 0,
        Negative: 0,
    };

    Object.values(sentimentResults).forEach((sentiment: any) => {
        if (sentiment in sentimentCounts) {
            sentimentCounts[sentiment as 'Positive' | 'Neutral' | 'Negative']++;
        }
    });

    // --- Update Cache ---
    sentimentCache = {
      data: sentimentCounts,
      timestamp: Date.now(),
    };
    
    return res.status(200).json(sentimentCounts);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error in sentiment analysis handler:', message);
    return res.status(500).json({ error: message });
  }
}