// FILE: api/oracle/ask.ts
// STATUS: NEW - This is the Oracle's new brain for proactive, conversational advice.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { verifyUser } from '../_lib/security';
import { supaAdmin } from '../_lib/supaAdmin';

export const config = {
  runtime: 'edge',
  maxDuration: 60, // Allow longer for thoughtful responses
};

const openai = new OpenAI({ apiKey: process.env.TIER2_OPENAI_TOKEN });

const systemPrompt = `
You are the Oracle, the AI heart of the TagnetIQ platform. You serve as an expert analyst and a proactive business partner to the user. Your personality is professional, insightful, and slightly futuristic. You are not a simple chatbot; you are a high-level advisor.

Your goal is to synthesize the user's question with their recent activity to provide actionable, intelligent advice.

- **Analyze Context:** Carefully review the user's scan history and vault contents. Identify patterns, high-value categories, and potential opportunities.
- **Be Proactive:** Don't just answer the question literally. Anticipate the user's underlying goal and offer strategic suggestions.
- **Be Conversational:** Your responses must be in natural language, clear, and concise. Address the user directly.
- **Maintain Persona:** You are the Oracle. Your responses should be confident and authoritative, yet helpful.

Given a user's question and their data, provide a direct, insightful response as if you were speaking to them through a heads-up display.
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { question, conversationHistory } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'A valid "question" string is required.' });
    }

    // In a real implementation, we would fetch the user's recent scans and vault items here.
    // For now, we will use mock context to demonstrate the capability.
    const userContext = `
      ## User Context ##
      Recent Scans: [
        { itemName: 'Kenner Star Wars Figure', estimatedValue: '$85.00' },
        { itemName: 'First Edition "Dune"', estimatedValue: '$2,500.00' },
        { itemName: 'LEGO Millennium Falcon 75192', estimatedValue: '$750.00' }
      ]
      Vault Items: [
        { asset_name: 'Vintage Kenner Collection', owner_valuation: '$3,200.00' },
        { asset_name: 'Rare Sci-Fi First Editions', owner_valuation: '$7,800.00' }
      ]
      Stated Interests: ['starwars', 'books-firstedition', 'lego']
    `;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: userContext }
    ];

    // Add conversation history if it exists
    if (Array.isArray(conversationHistory)) {
        messages.push(...conversationHistory);
    }

    messages.push({ role: 'user', content: question });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages,
      temperature: 0.7,
      max_tokens: 200,
    });

    const responseText = completion.choices[0].message.content;

    if (!responseText) {
      throw new Error('The Oracle returned an empty response.');
    }

    return res.status(200).json({ response: responseText });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error in Oracle "ask" endpoint:', message);
    return res.status(500).json({ error: 'The Oracle is currently contemplating. Please try again later.' });
  }
}
