// FILE: api/oracle/ask.ts
// STATUS: Surgically updated to accept Hydra v2.1 AnalysisResult for context-aware advice.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { verifyUser } from '../_lib/security.js';
// Hephaestus Note: SupaAdmin is not needed for this endpoint as it only uses passed context.

export const config = {
  runtime: 'edge',
  maxDuration: 60,
};

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY });

const systemPrompt = `
You are the Oracle, the AI heart of the TagnetIQ platform. You serve as an expert analyst and a proactive business partner to the user. Your personality is professional, insightful, and slightly futuristic. You are not a simple chatbot; you are a high-level advisor.

Your goal is to synthesize the user's question with their recent activity and the specific item analysis they provide to give actionable, intelligent advice.

- **Analyze Context:** Carefully review the provided analysis context, including the item's valuation factors.
- **Be Proactive:** Don't just answer the question literally. Anticipate the user's underlying goal and offer strategic suggestions based on the provided data.
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
    // --- HYDRA V2.1 SURGICAL UPDATE START ---
    // The endpoint now accepts an `analysisContext` object alongside the question.
    const { question, conversationHistory, analysisContext } = req.body;
    // --- HYDRA V2.1 SURGICAL UPDATE END ---

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'A valid "question" string is required.' });
    }

    // --- HYDRA V2.1 SURGICAL UPDATE START ---
    // The userContext is now built dynamically from the provided analysis object.
    // This makes the Oracle's advice directly relevant to the item being discussed.
    let userContext = "## User Context ##\nNo specific item context provided.";
    if (analysisContext) {
        userContext = `
            ## Analysis Context for Conversation ##
            Item Name: ${analysisContext.itemName}
            Estimated Value: $${analysisContext.estimatedValue}
            Summary: ${analysisContext.summary_reasoning}
            Key Valuation Factors:
            ${analysisContext.valuation_factors.map((factor: string) => `- ${factor}`).join('\n')}
        `;
    }
    // --- HYDRA V2.1 SURGICAL UPDATE END ---

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: userContext }
    ];

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

