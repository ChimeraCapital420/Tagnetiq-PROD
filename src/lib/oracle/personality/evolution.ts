// FILE: src/lib/oracle/personality/evolution.ts
// Personality Evolution — the Oracle learns how to communicate
//
// Every ~10 conversations, an LLM analyzes the conversation patterns
// and updates the Oracle's personality traits, communication style,
// humor level, and free-text personality notes.
//
// This runs NON-BLOCKING — the user never waits for evolution.

import type { SupabaseClient } from '@supabase/supabase-js';
import type OpenAI from 'openai';
import type { OracleIdentity, PersonalityEvolution } from '../types.js';

// =============================================================================
// EVOLUTION PROMPT
// =============================================================================

function buildEvolutionPrompt(
  conversationHistory: any[],
  identity: OracleIdentity
): string {
  const recentMessages = conversationHistory.slice(-20)
    .map((m: any) => `${m.role}: ${m.content}`)
    .join('\n');

  // Sprint C.1: Include AI DNA context when available
  const aiDnaContext = identity.ai_dna?.provider_personality_blend
    ? `\nAI DNA blend: ${JSON.stringify(identity.ai_dna.provider_personality_blend)}`
    : '';

  return `Analyze this conversation between an AI personality and a user.
Extract personality insights about how the AI should communicate with THIS specific user.
${aiDnaContext}

Conversation:
${recentMessages}

Current personality notes: ${identity.personality_notes || 'None yet'}
Current traits: ${identity.personality_traits?.join(', ') || 'None yet'}

Respond with ONLY a JSON object:
{
  "personality_notes": "Updated free-text personality document. What this Oracle has learned about communicating with this user. What jokes landed, what tone works, what topics they care about. 2-3 sentences max.",
  "traits": ["trait1", "trait2", "trait3"],
  "communication_style": "casual|balanced|professional|enthusiast",
  "humor_level": "none|light|moderate|heavy",
  "preferred_response_length": "short|medium|detailed"
}`;
}

// =============================================================================
// PARSE EVOLUTION RESPONSE
// =============================================================================

function parseEvolutionResponse(responseText: string): PersonalityEvolution | null {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      personality_notes: parsed.personality_notes || '',
      traits: Array.isArray(parsed.traits) ? parsed.traits : [],
      communication_style: parsed.communication_style || 'balanced',
      humor_level: parsed.humor_level || 'moderate',
      preferred_response_length: parsed.preferred_response_length || 'short',
    };
  } catch {
    return null;
  }
}

// =============================================================================
// EVOLVE
// =============================================================================

/**
 * Periodically analyze conversation patterns and update personality.
 * Runs every ~10 conversations. Non-blocking — caller should .catch() this.
 *
 * @param openai - OpenAI client (for GPT-4o-mini evolution analysis)
 * @param supabase - Supabase admin client
 * @param identity - Current Oracle identity
 * @param conversationHistory - Recent conversation messages
 */
export async function evolvePersonality(
  openai: OpenAI,
  supabase: SupabaseClient,
  identity: OracleIdentity,
  conversationHistory: any[]
): Promise<void> {
  // Only evolve every 10 conversations
  if (identity.conversation_count % 10 !== 0 || identity.conversation_count === 0) return;

  // Need enough conversation to analyze
  if (conversationHistory.length < 6) return;

  // Skip if identity is a fallback (no DB record)
  if (!identity.id) return;

  try {
    const prompt = buildEvolutionPrompt(conversationHistory, identity);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 300,
    });

    const responseText = completion.choices[0].message.content || '';
    const evolution = parseEvolutionResponse(responseText);

    if (!evolution) {
      console.warn('Personality evolution: failed to parse LLM response');
      return;
    }

    await supabase
      .from('oracle_identity')
      .update({
        personality_notes: evolution.personality_notes || identity.personality_notes,
        personality_traits: evolution.traits.length > 0 ? evolution.traits : identity.personality_traits,
        communication_style: evolution.communication_style || identity.communication_style,
        humor_level: evolution.humor_level || identity.humor_level,
        preferred_response_length: evolution.preferred_response_length || identity.preferred_response_length,
      })
      .eq('id', identity.id);

    console.log(`🧬 Oracle personality evolved for user ${identity.user_id}`);
  } catch (err: any) {
    console.warn('Personality evolution failed (non-fatal):', err.message);
  }
}