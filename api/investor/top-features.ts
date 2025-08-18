// FILE: api/investor/top-features.ts (CREATE THIS NEW FILE)

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory cache to manage costs and performance
let featuresCache = {
  data: null as any,
  timestamp: 0,
};
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Function to perform feature request analysis using Anthropic's Claude
async function getTopFeatures(feedbackItems: { id: number; content: string }[]) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const batchContent = feedbackItems.map(f => `[${f.id}] ${f.content}`).join('\n');

  const systemPrompt = `You are a product manager AI. Analyze the following user feedback. Identify the top 3-5 most frequently requested features or improvements. Group similar requests under a single category. Return ONLY a JSON array of objects, each with a "feature" name and a "count". Example: [{"feature":"Dark Mode","count":5},{"feature":"More Integrations","count":3}]`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: batchContent }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Anthropic API Error:", errorBody);
    throw new Error('Failed to get feature analysis from Anthropic API.');
  }

  const result = await response.json();
  const jsonText = result.content[0].text;
  
  return JSON.parse(jsonText);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (Date.now() - featuresCache.timestamp < CACHE_DURATION && featuresCache.data) {
    return res.status(200).json(featuresCache.data);
  }

  try {
    const { data: feedback, error } = await supaAdmin
      .from('feedback')
      .select('id, content')
      .not('content', 'is', null);

    if (error) throw error;
    if (!feedback || feedback.length < 3) { // Require a minimum amount of feedback
      return res.status(200).json([]);
    }

    const topFeatures = await getTopFeatures(feedback);

    featuresCache = {
      data: topFeatures,
      timestamp: Date.now(),
    };
    
    return res.status(200).json(topFeatures);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error in top features handler:', message);
    return res.status(500).json({ error: message });
  }
}