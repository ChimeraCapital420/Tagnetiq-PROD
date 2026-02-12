// FILE: api/oracle/interpret-command.ts
// Oracle Phase 1 — NLU intent classification (API fallback only)
// FIXED: Downgraded from gpt-4-turbo → gpt-4o-mini (10x cheaper, 3x faster, same accuracy)
// FIXED: Removed edge runtime — OpenAI SDK requires Node.js runtime
// NOTE: This endpoint is now only called for ambiguous commands.
//       Common commands (scan, vault, navigate, search) are classified client-side
//       in src/lib/oracle/command-router.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { verifyUser } from '../_lib/security.js';

export const config = {
  maxDuration: 15, // Intent classification should be fast
};

const openai = new OpenAI({ apiKey: process.env.TIER2_OPENAI_TOKEN });

const systemPrompt = `You are the "TagnetIQ Command Interpreter." Convert natural language commands into structured JSON.

Respond with ONLY a valid JSON object (no markdown, no backticks):
{
  "intent": "INTENT_TYPE",
  "parameters": { ... },
  "feedback_phrase": "Short confirmation phrase."
}

INTENT_TYPE options:

1. SEARCH_ARENA — Find items in marketplace
   parameters: { "query": "string" }

2. INITIATE_SCAN — Start scanning, optionally with category
   parameters: { "category_id": "string", "subcategory_id": "string | null" }

3. NAVIGATE — Go to app section
   parameters: { "destination": "dashboard" | "vault" | "arena" | "settings" | "marketplace" }

4. UNKNOWN — Ambiguous or unrelated
   parameters: {}

Category IDs for INITIATE_SCAN:
- real-estate (sub: real-estate-comps, real-estate-rental, real-estate-flip)
- vehicles (sub: vehicles-vin, vehicles-value, vehicles-auction, vehicles-parts)
- collectibles (sub: collectibles-coins, collectibles-stamps, collectibles-tradingcards, collectibles-comics, collectibles-toys)
- luxury-goods (sub: luxury-watches, luxury-handbags, luxury-jewelry, luxury-art)
- lego (sub: lego-set, lego-parts, lego-minifig)
- starwars (sub: starwars-figures, starwars-vehicles, starwars-props)
- sports-memorabilia (sub: sports-cards, sports-jerseys, sports-autographs)
- books-and-media (sub: books-firstedition, books-vinyl, books-videogames)
- amazon

Be concise with feedback_phrase. Accuracy is your primary goal.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyUser(req);
    const { command, language } = req.body;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'A valid "command" string is required.' });
    }

    const userMessage = language && language !== 'en'
      ? `[User language: ${language}] ${command}`
      : command;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast + cheap for intent classification
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.1, // Low temp for consistent classification
    });

    const result = completion.choices[0].message.content;

    if (!result) {
      throw new Error('LLM returned an empty response.');
    }

    return res.status(200).json(JSON.parse(result));

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Oracle interpret-command error:', message);
    return res.status(500).json({
      intent: 'UNKNOWN',
      parameters: {},
      feedback_phrase: 'Sorry, I had trouble processing that. Try again.',
    });
  }
}