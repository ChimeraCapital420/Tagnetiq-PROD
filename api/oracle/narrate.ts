// FILE: api/oracle/narrate.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Narrator — Lightweight LLM Commentary Endpoint
// ═══════════════════════════════════════════════════════════════════════
// Fires ONLY for interesting scans (~30% of all scans).
// Uses gpt-4o-mini via raw fetch (no SDK dependency).
// Max 100 tokens → punchy, conversational, 2-3 sentences.
// Cost: ~$0.001 per call.
//
// The client-side discrepancy detector decides IF this endpoint fires.
// Template fallback always works even if this endpoint fails.
//
// IMPORTANT: Uses raw fetch() — NOT the openai npm package.
// This matches the pattern used by HYDRA engine and all other AI calls.
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 10,
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get the OpenAI API key from environment.
 * Checks both common env var names used across the codebase.
 */
function getOpenAIKey(): string | null {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.OPEN_AI_API_KEY ||
    null
  );
}

/**
 * Build a compact vote summary string for the prompt.
 * Limits to 5 votes to keep prompt small.
 */
function buildVoteSummary(votes: any): string {
  if (!Array.isArray(votes) || votes.length === 0) {
    return 'No vote details available';
  }

  return votes
    .slice(0, 5)
    .map((v: any) => {
      const provider = v.provider || v.providerName || v.provider_id || 'Unknown';
      const value = v.value ?? v.estimatedValue ?? v.estimated_value ?? '?';
      const decision = v.decision || '?';
      return `${provider}: $${value} ${decision}`;
    })
    .join(', ');
}

/**
 * Get persona-specific tone instruction.
 */
function getToneHint(persona?: string): string {
  switch (persona) {
    case 'estate':
      return 'Gentle, educational tone. The user might be new to resale or dealing with a difficult situation. Be warm and supportive.';
    case 'flipper':
    case 'hustle':
      return 'Direct, hustler energy. Quick and actionable. Focus on the money angle.';
    case 'collector':
      return 'Enthusiastic collector tone. Focus on rarity, history, and what makes this piece special.';
    case 'new_user':
      return 'Welcoming and educational. Explain briefly why the analysis matters.';
    default:
      return 'Knowledgeable friend tone. Natural and conversational.';
  }
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Method check ──────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ── Parse body safely ─────────────────────────────────────────────────
  let body: any;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    body = {};
  }

  const {
    itemName,
    category,
    consensusValue,
    votes,
    discrepancies,
    persona,
  } = body;

  // ── Validate minimum input ────────────────────────────────────────────
  if (!itemName || typeof itemName !== 'string') {
    // Don't 500 — return graceful null so client uses template fallback
    return res.status(200).json({ commentary: null, reason: 'no_item_name' });
  }

  // ── Check API key ─────────────────────────────────────────────────────
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    console.warn('[narrate] No OpenAI API key found (checked OPENAI_API_KEY and OPEN_AI_API_KEY)');
    return res.status(200).json({ commentary: null, reason: 'no_api_key' });
  }

  // ── Build prompt ──────────────────────────────────────────────────────
  const toneHint = getToneHint(persona);
  const voteSummary = buildVoteSummary(votes);

  const systemPrompt = `You are Oracle, a knowledgeable AI partner for resale and collecting. Generate 2-3 sentences of natural commentary about this scan result. Focus on what's interesting or noteworthy. ${toneHint} Sound like a friend who knows their stuff, not a robot reading data. Never use bullet points or lists. Keep it under 60 words.`;

  const userPrompt = `Item: ${itemName}
Category: ${category || 'general'}
Consensus Value: $${consensusValue ?? 'unknown'}
Provider Votes: ${voteSummary}
What's Interesting: ${discrepancies || 'General analysis complete'}

Give me 2-3 sentences of natural commentary.`;

  // ── Call gpt-4o-mini via raw fetch ────────────────────────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 100,
        temperature: 0.8,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // ── Handle non-200 from OpenAI ────────────────────────────────────
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn(`[narrate] OpenAI returned ${response.status}: ${errorText.slice(0, 200)}`);
      return res.status(200).json({ commentary: null, reason: `openai_${response.status}` });
    }

    // ── Parse response ────────────────────────────────────────────────
    const data = await response.json();

    const commentary =
      data?.choices?.[0]?.message?.content?.trim() || null;

    if (!commentary) {
      console.warn('[narrate] OpenAI returned empty content');
      return res.status(200).json({ commentary: null, reason: 'empty_response' });
    }

    console.log(`[narrate] Generated commentary for "${itemName}" (${commentary.length} chars)`);
    return res.status(200).json({ commentary });

  } catch (error: any) {
    // ── Graceful degradation — NEVER 500 ──────────────────────────────
    // Client has template fallback. Narrate failing should be invisible.
    if (error.name === 'AbortError') {
      console.warn(`[narrate] Timeout after 8s for "${itemName}"`);
      return res.status(200).json({ commentary: null, reason: 'timeout' });
    }

    console.error(`[narrate] Unexpected error for "${itemName}":`, error.message);
    return res.status(200).json({ commentary: null, reason: 'error' });
  }
}