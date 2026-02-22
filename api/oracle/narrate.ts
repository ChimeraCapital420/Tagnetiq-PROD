// FILE: api/oracle/narrate.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Narrator — Lightweight LLM Commentary Endpoint
// ═══════════════════════════════════════════════════════════════════════
// Fires ONLY for interesting scans (~30% of all scans).
// Uses gpt-4o-mini for speed and cost.
// Max 100 tokens → punchy, conversational, 2-3 sentences.
// Cost: ~$0.001 per call.
//
// The client-side discrepancy detector decides IF this endpoint fires.
// Template fallback always works even if this endpoint fails.
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export const config = {
  maxDuration: 10,
};

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const {
    itemName,
    category,
    consensusValue,
    votes,
    discrepancies,
    persona,
  } = req.body || {};

  // Basic validation
  if (!itemName) {
    return res.status(400).json({ error: 'itemName required' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI not configured' });
    }

    const openai = new OpenAI({ apiKey });

    // Build compact vote summary for prompt
    const voteSummary = Array.isArray(votes)
      ? votes
          .slice(0, 5)
          .map((v: any) => `${v.provider}: $${v.value} ${v.decision}`)
          .join(', ')
      : 'No vote details';

    // Persona tone hint
    const toneHint = persona === 'estate'
      ? 'Gentle, educational tone. The user might be new to resale.'
      : persona === 'hustle'
        ? 'Direct, hustler energy. Quick and actionable.'
        : 'Knowledgeable friend tone. Natural and conversational.';

    const systemPrompt = `You are Oracle, a knowledgeable AI partner for resale and collecting. Generate 2-3 sentences of natural commentary about this scan result. Focus on what's interesting or noteworthy. ${toneHint} Sound like a friend who knows their stuff, not a robot reading data. Never use bullet points or lists.`;

    const userPrompt = `Item: ${itemName}
Category: ${category || 'general'}
Consensus Value: $${consensusValue || 0}
Provider Votes: ${voteSummary}
What's Interesting: ${discrepancies || 'General analysis'}

Give me 2-3 sentences of natural commentary.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 100,
      temperature: 0.8,
    });

    const commentary = completion.choices[0]?.message?.content?.trim() || null;

    if (!commentary) {
      return res.status(200).json({ commentary: null });
    }

    return res.status(200).json({ commentary });
  } catch (error: any) {
    console.error('[narrate] Error:', error.message);
    // Don't fail hard — client has template fallback
    return res.status(200).json({ commentary: null });
  }
}