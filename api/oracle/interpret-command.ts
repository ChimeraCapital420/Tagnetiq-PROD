// FILE: api/oracle/interpret-command.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { verifyUser } from '../_lib/security';

export const config = {
  runtime: 'edge',
};

// Initialize the OpenAI client using the existing environment variable from the Hydra engine.
const openai = new OpenAI({ apiKey: process.env.TIER2_OPENAI_TOKEN });

const systemPrompt = `
You are the "TagnetIQ Command Interpreter," a specialized AI model that converts natural language user commands into structured JSON objects. Your purpose is to understand the user's intent and extract relevant parameters for the TagnetIQ application.

You must only respond with a single, valid JSON object and nothing else. Do not wrap your response in markdown or any other text.

The JSON object must have the following structure:
{
  "intent": "INTENT_TYPE",
  "parameters": { ... },
  "feedback_phrase": "A short, conversational phrase confirming you understood the command."
}

Here are the possible INTENT_TYPE values and their associated parameters:

1.  **SEARCH_ARENA**: When the user wants to find items in the marketplace.
    -   **parameters**: { "query": "string" }
    -   **Example**: "search the arena for vintage star wars figures" -> { "intent": "SEARCH_ARENA", "parameters": { "query": "vintage star wars figures" }, "feedback_phrase": "Searching the Arena for vintage Star Wars figures." }

2.  **INITIATE_SCAN**: When the user wants to start scanning an item, especially if they specify a category.
    -   **parameters**: { "category_id": "string", "subcategory_id": "string | null" }
        - Use the provided category list to map user terms to valid IDs.
    -   **Example**: "scan this for valuable comic books" -> { "intent": "INITIATE_SCAN", "parameters": { "category_id": "collectibles", "subcategory_id": "collectibles-comics" }, "feedback_phrase": "Okay, preparing to scan for comic books." }

3.  **NAVIGATE**: When the user wants to go to a specific section of the app.
    -   **parameters**: { "destination": "dashboard" | "vault" | "arena" | "settings" }
    -   **Example**: "take me to my vault" -> { "intent": "NAVIGATE", "parameters": { "destination": "vault" }, "feedback_phrase": "Opening your Vault." }

4.  **UNKNOWN**: If the command is ambiguous or unrelated to the app's functions.
    -   **parameters**: {}
    -   **Example**: "what is the weather like today" -> { "intent": "UNKNOWN", "parameters": {}, "feedback_phrase": "Sorry, I can't help with that. I can assist with scanning and navigating the app." }

**Available Category IDs for INITIATE_SCAN intent:**
- real-estate (subcategories: real-estate-comps, real-estate-rental, real-estate-flip)
- vehicles (subcategories: vehicles-vin, vehicles-value, vehicles-auction, vehicles-parts)
- collectibles (subcategories: collectibles-coins, collectibles-stamps, collectibles-tradingcards, collectibles-comics, collectibles-toys)
- luxury-goods (subcategories: luxury-watches, luxury-handbags, luxury-jewelry, luxury-art)
- lego (subcategories: lego-set, lego-parts, lego-minifig)
- starwars (subcategories: starwars-figures, starwars-vehicles, starwars-props)
- sports-memorabilia (subcategories: sports-cards, sports-jerseys, sports-autographs)
- books-and-media (subcategories: books-firstedition, books-vinyl, books-videogames)
- amazon

Always select the most appropriate intent. Be concise with the feedback_phrase. Your primary function is accuracy in interpretation.
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyUser(req);
    const { command } = req.body;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'A valid "command" string is required.' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo', // Using a high-tier model for accuracy
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: command },
      ],
      response_format: { type: 'json_object' },
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
    console.error('Error in Oracle command interpretation:', message);
    return res.status(500).json({ error: 'Failed to interpret command.' });
  }
}